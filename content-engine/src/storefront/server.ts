/**
 * Two HTTP servers. The public one serves the landing page, the intake form and each customer's
 * workspace (reached only through its secret link). The admin one lists orders and must be bound
 * to this computer only.
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { brotliCompressSync, constants as zlib, gzipSync } from "node:zlib";
import { HOLD_SECONDS, SESSION_SECONDS, type AccountStore, type HoldKind, type User } from "./accounts.ts";
import type { SignIn } from "./google.ts";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { join } from "node:path";
import { channelExists, listChannelSlugs } from "../core/channels.ts";
import { ENGINE_DIR, type Workspace } from "../core/workspace.ts";
import { brandKit, framesDir, versionPath, videoPath } from "./brand-kit.ts";
import { CustomerError, parseBeatForm, parseCaptionForm, type Builder } from "./builder.ts";
import { hostPicture, loadCatalog } from "./catalog.ts";
import { buildHost } from "./designer.ts";
import { hostSvg } from "./host-svg.tsx";
import { CONSOLE_VIEWS, accountPage, adminPage, createPage, demoPage, landingPage, messagePage, workspacePage, type Account, type ConsoleView } from "./pages.ts";
import { MAX_ROUNDS, ORDER_STATUSES, SECTIONS, changeRequests, isBuilding, validateIntake, videoUnderWay, type Order, type OrderStatus, type OrderStore, type SectionId } from "./store.ts";

export interface StorefrontOptions {
  ws: Workspace;
  store: OrderStore;
  product: string;
  /** Hosted payment page (for example a Stripe payment link). Null = not switched on: new orders start without payment. */
  paymentUrl: string | null;
  /** The channel shown on the demo page. */
  demoChannel: string;
  /** The folder that holds themes/ and avatars/: the looks and hosts a customer can pick. */
  libraryDir: string;
  /** Where customers reach the public server: used for the links shown in admin and for the sign-in return address. */
  publicBase: string;
  /** Sign-in and accounts. Null = switched off: orders are reached by their private link only. */
  accounts: { store: AccountStore; signIn: SignIn } | null;
  /** Automatic builds. Null = switched off: a channel is made by hand and linked on the orders page. */
  builder: Builder | null;
}

const MAX_BODY = 20_000;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FRAME = /^[\w.-]+\.jpg$/;

/** Site assets: the fonts the engine already bundles, and the sample media shown on the landing page. */
const FONTS: Record<string, string> = {
  "grotesk-700.woff2": "space-grotesk/files/space-grotesk-latin-700-normal.woff2",
  "fredoka-600.woff2": "fredoka/files/fredoka-latin-600-normal.woff2",
  "anton-400.woff2": "anton/files/anton-latin-400-normal.woff2",
  "montserrat-800.woff2": "montserrat/files/montserrat-latin-800-normal.woff2",
  "baloo-700.woff2": "baloo-2/files/baloo-2-latin-700-normal.woff2",
};
const MEDIA: Record<string, string> = { ".jpg": "image/jpeg", ".mp4": "video/mp4", ".js": "text/javascript; charset=utf-8" };

function sendAsset(req: IncomingMessage, res: ServerResponse, parts: string[], libraryDir: string): void {
  if (req.method !== "GET") throw new HttpError(404, "There is no page at this address.");
  if (parts.length === 3 && parts[1] === "font" && FONTS[parts[2]]) return sendFile(req, res, join(ENGINE_DIR, "node_modules", "@fontsource", FONTS[parts[2]]), "font/woff2", null, true);
  if (parts.length === 3 && parts[1] === "host" && parts[2].endsWith(".jpg") && SLUG.test(parts[2].slice(0, -4)) && existsSync(hostPicture(libraryDir, parts[2].slice(0, -4)))) return sendFile(req, res, hostPicture(libraryDir, parts[2].slice(0, -4)), "image/jpeg", null, true);
  const type = parts.length === 2 && /^[a-z0-9-]+\.(jpg|mp4|js)$/.test(parts[1]) ? MEDIA[parts[1].slice(parts[1].lastIndexOf("."))] : undefined;
  const path = type ? join(ENGINE_DIR, "src", "storefront", "assets", parts[1]) : null;
  if (!path || !type || !existsSync(path)) throw new HttpError(404, "There is no page at this address.");
  if (type === MEDIA[".js"]) return sendText(res, 200, readFileSync(path, "utf8"), { "content-type": type, "cache-control": "public, max-age=3600", "x-content-type-options": "nosniff" });
  sendFile(req, res, path, type, null, true);
}

class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function send(res: ServerResponse, status: number, html: string, extra: Record<string, string | string[]> = {}): void {
  sendText(res, status, html, {
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; img-src 'self'; media-src 'self'; form-action 'self' https:; base-uri 'none'; frame-ancestors 'none'",
    "x-content-type-options": "nosniff",
    // The workspace link is a secret: never send it on to another site, never cache or index it.
    "referrer-policy": "no-referrer",
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow",
    ...extra,
  });
}

/** Send text, compressed when the browser accepts it: pages are several times smaller on a slow connection. */
function sendText(res: ServerResponse, status: number, text: string, headers: Record<string, string | string[]>): void {
  const accepts = String(res.req.headers["accept-encoding"] ?? "");
  const encoding = /\bbr\b/.test(accepts) ? "br" : /\bgzip\b/.test(accepts) ? "gzip" : null;
  const plain = Buffer.from(text, "utf8");
  const body = encoding === "br" ? brotliCompressSync(plain, { params: { [zlib.BROTLI_PARAM_QUALITY]: 5, [zlib.BROTLI_PARAM_SIZE_HINT]: plain.length } }) : encoding === "gzip" ? gzipSync(plain) : plain;
  res.writeHead(status, { ...headers, vary: "accept-encoding", "content-length": String(body.length), ...(encoding ? { "content-encoding": encoding } : {}) });
  res.end(body);
}

function redirect(res: ServerResponse, location: string, cookies: string[] = []): void {
  res.writeHead(303, { location, "cache-control": "no-store", "referrer-policy": "no-referrer", ...(cookies.length ? { "set-cookie": cookies } : {}) });
  res.end();
}

/** Cookie names: the session, a form held during sign-in, and the sign-in round trip's state. */
const SESSION = "sid";
const HOLD = "hold";
const STATE = "signin";

function readCookies(req: IncomingMessage): Record<string, string> {
  return Object.fromEntries((req.headers.cookie ?? "").split(";").map((c) => c.trim().split("=") as [string, string]).filter(([k, v]) => k && v));
}

/** A cookie scripts cannot read, sent only to this site. `seconds` 0 removes it. */
function cookie(o: StorefrontOptions, name: string, value: string, seconds: number): string {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${o.publicBase.startsWith("https://") ? "; Secure" : ""}`;
}

function sameSecret(a: string, b: string): boolean {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

async function readForm(req: IncomingMessage): Promise<Record<string, string>> {
  if (!(req.headers["content-type"] ?? "").startsWith("application/x-www-form-urlencoded")) throw new HttpError(415, "Send this as a normal web form.");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, "That is more text than this form accepts.");
    chunks.push(chunk as Buffer);
  }
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString("utf8")));
}

/** Send a file, honouring a Range request so the video player can seek. */
function sendFile(req: IncomingMessage, res: ServerResponse, path: string, type: string, downloadName: string | null, shared = false): void {
  const size = statSync(path).size;
  // Customer files are private and never cached; site assets are the same for everyone.
  const headers: Record<string, string | number> = { "content-type": type, "accept-ranges": "bytes", "cache-control": shared ? "public, max-age=3600" : "private, no-store", "x-content-type-options": "nosniff", ...(shared ? {} : { "x-robots-tag": "noindex" }) };
  if (downloadName) headers["content-disposition"] = `attachment; filename="${downloadName}"`;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) {
      res.writeHead(416, { "content-range": `bytes */${size}` });
      res.end();
      return;
    }
    res.writeHead(206, { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": end - start + 1 });
    createReadStream(path, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, "content-length": size });
  createReadStream(path).pipe(res);
}

/** A customer sees their channel's files only after payment and only once a channel is linked. */
function linkedChannel(order: Order): string | null {
  return order.status !== "awaiting-payment" && order.channel ? order.channel : null;
}

/** The workspace a linked channel lives in: the one automatic builds write to, or the engine's own. */
function channelHome(o: StorefrontOptions, slug: string): Workspace {
  return o.builder && channelExists(o.builder.ws, slug) ? o.builder.ws : o.ws;
}

function handler(product: string, name: string, route: (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<void>) {
  return (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    route(req, res, url).catch((err: unknown) => {
      if (err instanceof HttpError || err instanceof CustomerError) {
        send(res, err instanceof HttpError ? err.status : 409, messagePage(product, "That did not work", err.message));
        return;
      }
      // Log the path without its secret token.
      console.error(`[${name}] ${req.method} ${url.pathname.replace(/^\/w\/[^/]+/, "/w/…")} failed:`, err);
      send(res, 500, messagePage(product, "Something went wrong on our side", "Nothing was lost. Please try again in a moment."));
    });
  };
}

export function createPublicServer(o: StorefrontOptions): Server {
  return createServer(
    handler(o.product, "public", async (req, res, url) => {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "assets") return sendAsset(req, res, parts, o.libraryDir);
      const acc = o.accounts;
      const jar = readCookies(req);
      const user: User | null = (acc && jar[SESSION] && acc.store.userBySession(jar[SESSION])) || null;
      const account: Account = acc ? (user ? "in" : "out") : null;

      /** Send the order or save the design for a signed-in person, then show them where it went. */
      const finish = (who: User, kind: HoldKind, form: Record<string, string>, cookies: string[]) => {
        if (!acc) throw new Error("finish() needs accounts switched on.");
        if (kind === "draft") {
          acc.store.saveDraft(who.id, form);
          return redirect(res, "/account", cookies);
        }
        const catalog = loadCatalog(o.libraryDir);
        const result = validateIntake(form, catalog);
        if (result.errors) return send(res, 422, createPage(o.product, catalog, form, result.errors, "in"), cookies.length ? { "set-cookie": cookies } : {});
        const order = o.store.create(result.intake, result.design, o.paymentUrl !== null, who.id);
        o.builder?.consider(order.id);
        acc.store.clearDraft(who.id);
        return redirect(res, `/w/${order.token}`, cookies);
      };
      /** Keep the form and send the visitor to sign in; the sign-in's return picks it up again. */
      const signInFirst = (kind: HoldKind, form: Record<string, string>) => {
        if (!acc) throw new Error("signInFirst() needs accounts switched on.");
        return redirect(res, "/signin", [cookie(o, HOLD, acc.store.hold(kind, form), HOLD_SECONDS)]);
      };

      if (req.method === "GET" && parts.length === 0) return send(res, 200, landingPage(o.product, loadCatalog(o.libraryDir), account));
      if (req.method === "GET" && url.pathname === "/demo") return send(res, 200, demoPage(o.product, brandKit(o.ws, o.demoChannel), account));
      if (acc) {
        const returnTo = `${o.publicBase}/auth/google/callback`;
        if (req.method === "GET" && url.pathname === "/signin") {
          const state = randomBytes(24).toString("base64url");
          return redirect(res, acc.signIn.startUrl(returnTo, state), [cookie(o, STATE, state, HOLD_SECONDS)]);
        }
        if (req.method === "GET" && url.pathname === "/auth/google/callback") {
          const state = url.searchParams.get("state") ?? "";
          const code = url.searchParams.get("code") ?? "";
          if (!state || !jar[STATE] || !sameSecret(state, jar[STATE])) throw new HttpError(400, "That sign-in did not start here, or it took too long. Please try again.");
          if (!code) throw new HttpError(400, "The sign-in was not finished. Please try again.");
          const who = acc.store.signIn(await acc.signIn.identity(code, returnTo));
          const cookies = [cookie(o, SESSION, acc.store.openSession(who.id), SESSION_SECONDS), cookie(o, STATE, "", 0), cookie(o, HOLD, "", 0)];
          const held = jar[HOLD] ? acc.store.take(jar[HOLD]) : undefined;
          return held ? finish(who, held.kind, held.form, cookies) : redirect(res, "/account", cookies);
        }
        if (req.method === "POST" && url.pathname === "/signout") {
          if (jar[SESSION]) acc.store.closeSession(jar[SESSION]);
          return redirect(res, "/", [cookie(o, SESSION, "", 0)]);
        }
        if (req.method === "GET" && url.pathname === "/account") {
          if (!user) return redirect(res, "/signin");
          const orders = o.store.listFor(user.id);
          const kits = new Map(orders.flatMap((ord) => { const slug = linkedChannel(ord); return slug ? [[ord.id, brandKit(channelHome(o, slug), slug)] as const] : []; }));
          return send(res, 200, accountPage(o.product, user, orders, kits, acc.store.draft(user.id)));
        }
        if (req.method === "POST" && url.pathname === "/draft") {
          const form = await readForm(req);
          return user ? finish(user, "draft", form, []) : signInFirst("draft", form);
        }
      }
      if (req.method === "GET" && url.pathname === "/preview/host.svg") {
        // The designer's live picture: the host these settings describe, drawn by the video's own components.
        const built = buildHost(Object.fromEntries(url.searchParams));
        if (built.problems) throw new HttpError(400, `These host settings are not valid: ${built.problems.join("; ")}.`);
        sendText(res, 200, hostSvg(built.model), { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=3600", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" });
        return;
      }
      if (req.method === "GET" && url.pathname === "/create") {
        // A signed-in person picks up the design they saved, unless they asked for a fresh start.
        const saved = acc && user && !url.searchParams.has("new") ? acc.store.draft(user.id) : undefined;
        return send(res, 200, createPage(o.product, loadCatalog(o.libraryDir), saved?.form ?? {}, {}, account));
      }
      if (req.method === "POST" && url.pathname === "/intake") {
        const form = await readForm(req);
        const catalog = loadCatalog(o.libraryDir);
        const result = validateIntake(form, catalog);
        if (result.errors) return send(res, 422, createPage(o.product, catalog, form, result.errors, account));
        if (!acc) {
          const order = o.store.create(result.intake, result.design, o.paymentUrl !== null, null);
          o.builder?.consider(order.id);
          return redirect(res, `/w/${order.token}`);
        }
        return user ? finish(user, "order", form, []) : signInFirst("order", form);
      }
      if (parts[0] === "w" && parts[1]) {
        const order = o.store.byToken(parts[1]);
        if (!order) throw new HttpError(404, "This workspace link is not valid. Check that you copied all of it.");
        if (req.method === "GET" && parts.length === 2) {
          const slug = linkedChannel(order);
          const facts = o.builder && order.video?.state === "facts" ? o.builder.facts(order) : null;
          // A channel built here, whose kit the customer approved, gets its dashboard: videos, ideas and controls.
          const dash = o.builder && slug && order.kit_approved && channelExists(o.builder.ws, slug) ? o.builder.dashboard(order) : null;
          const view = url.searchParams.get("view") ?? "overview";
          if (!(CONSOLE_VIEWS as readonly string[]).includes(view)) throw new HttpError(404, "There is no page at this address.");
          const kit = slug ? brandKit(channelHome(o, slug), slug) : null;
          // One finished video's own page: it has to be one of this channel's.
          const episode = view === "video" ? url.searchParams.get("e") : null;
          if (view === "video" && !(dash && kit?.episodes.some((e) => e.id === episode))) throw new HttpError(404, "That video is not available.");
          return send(res, 200, workspacePage(o.product, order, kit, o.paymentUrl, o.builder !== null, facts, dash, view as ConsoleView, url.searchParams.has("pick"), episode));
        }
        if (req.method === "POST" && parts.length === 3 && parts[2] === "decision") {
          if (!linkedChannel(order)) throw new HttpError(409, "There is nothing to decide on yet.");
          if (order.kit_approved) throw new HttpError(409, "This brand kit is approved and locked.");
          if (isBuilding(order)) throw new HttpError(409, "Your changes are being made. Decide again when the revised kit is here.");
          const form = await readForm(req);
          const section = SECTIONS.find((s) => s.id === form.section)?.id as SectionId | undefined;
          const decision = form.decision;
          const note = (form.note ?? "").trim();
          if (!section) throw new HttpError(400, "That is not a part of the brand kit.");
          if (decision !== "approve" && decision !== "change" && decision !== "clear") throw new HttpError(400, "Choose Approve or Ask for a change.");
          if (note.length > 600) throw new HttpError(400, "Keep the note to 600 characters or fewer.");
          if (decision === "change" && !note) throw new HttpError(400, "Say what you would like changed, so we know what to do.");
          o.store.update(order.id, (ord) => {
            if (decision === "clear") delete ord.decisions[section];
            else ord.decisions[section] = { decision, note: decision === "change" ? note : "", at: new Date().toISOString() };
          });
          return redirect(res, `/w/${order.token}#${section}`);
        }
        if (req.method === "POST" && parts.length === 3 && parts[2] === "revise" && o.builder) {
          const slug = linkedChannel(order);
          if (!slug) throw new HttpError(409, "There is nothing to change yet.");
          if (order.kit_approved) throw new HttpError(409, "This brand kit is approved and locked.");
          if (isBuilding(order)) throw new HttpError(409, "Your changes are already being made.");
          if (SECTIONS.some((s) => !order.decisions[s.id])) throw new HttpError(409, "Decide on every part first, so all your changes are made in one go.");
          if (!changeRequests(order).length) throw new HttpError(409, "You have not asked for any changes.");
          if ((order.rounds ?? 0) >= MAX_ROUNDS) throw new HttpError(409, `This kit has been revised ${MAX_ROUNDS} times. Further changes are made by hand.`);
          o.builder.revise(order.id, channelHome(o, slug));
          return redirect(res, `/w/${order.token}`);
        }
        if (req.method === "POST" && parts.length === 3 && parts[2] === "approve") {
          if (!linkedChannel(order)) throw new HttpError(409, "There is nothing to approve yet.");
          if (isBuilding(order)) throw new HttpError(409, "Your changes are being made. Approve when the revised kit is here.");
          if (SECTIONS.some((s) => order.decisions[s.id]?.decision !== "approve")) throw new HttpError(409, "Approve every part of the brand kit first.");
          if (!order.kit_approved)
            o.store.update(order.id, (ord) => {
              ord.kit_approved = new Date().toISOString();
            });
          o.builder?.startVideo(order.id);
          return redirect(res, `/w/${order.token}`);
        }
        if (req.method === "POST" && parts.length === 3 && parts[2] === "facts" && o.builder) {
          if (order.video?.state !== "facts") throw new HttpError(409, "There are no facts to check right now.");
          const form = await readForm(req);
          if (form.decision === "approve") o.builder.approveFacts(order.id);
          else if (form.decision === "change") {
            const note = (form.note ?? "").trim();
            if (!note) throw new HttpError(400, "Say which fact is wrong and what should change.");
            if (note.length > 600) throw new HttpError(400, "Keep the note to 600 characters or fewer.");
            if (order.video.rounds >= MAX_ROUNDS) throw new HttpError(409, `This script has been rewritten ${MAX_ROUNDS} times. Further changes are made by hand.`);
            // A change asked for under one line of the script names that line, so only it is rewritten.
            let about = "";
            if (form.line !== undefined) {
              const beats = o.builder.facts(order).beats;
              const n = Number(form.line);
              if (!Number.isInteger(n) || n < 1 || n > beats.length) throw new HttpError(400, "Choose a line of the script.");
              about = `Line ${n} (“${beats[n - 1]!.voiceover}”), change only this line: `;
            }
            o.builder.changeFacts(order.id, about + note);
          } else throw new HttpError(400, "Choose Approve the facts or Ask for a change.");
          return redirect(res, order.video.idea ? `/w/${order.token}?view=new` : `/w/${order.token}`);
        }
        // The storyboard of the video under way: change a part, set its captions or its speaking speed, or approve it.
        if (req.method === "POST" && parts.length === 4 && parts[2] === "storyboard" && o.builder) {
          const form = await readForm(req);
          if (parts[3] === "beat") {
            const beat = (form.beat ?? "").trim();
            if (!SLUG.test(beat)) throw new HttpError(400, "Choose a part of the video.");
            const again = Number(form.repaint);
            o.builder.editBeat(order.id, beat, parseBeatForm(form, o.builder.storyboard(order).hostOnScreen), Number.isInteger(again) && again >= 1 && again <= 3 ? again : undefined);
            return redirect(res, `/w/${order.token}?view=new#s-${beat}-1`);
          } else if (parts[3] === "captions") o.builder.setVideoCaptions(order.id, parseCaptionForm(form));
          else if (parts[3] === "speed") o.builder.setVideoPace(order.id, (form.pace ?? "").trim());
          else if (parts[3] === "approve") o.builder.approveStoryboard(order.id);
          else if (parts[3] === "cancel") {
            o.builder.cancelRevision(order.id);
            return redirect(res, `/w/${order.token}?view=videos`);
          } else throw new HttpError(404, "There is no page at this address.");
          // A revision with nothing changed is finished at once: back to the videos.
          return redirect(res, `/w/${order.token}?view=${videoUnderWay(o.store.byId(order.id) ?? order) ? "new" : "videos"}`);
        }
        // Continue a video that stopped, from the step it stopped at.
        if (req.method === "POST" && parts.length === 3 && parts[2] === "retry" && o.builder) {
          o.builder.retryVideo(order.id);
          return redirect(res, `/w/${order.token}?view=new`);
        }
        // Open a finished video again at its storyboard, to change it and make a new version.
        if (req.method === "POST" && parts.length === 3 && parts[2] === "revise-video" && o.builder) {
          const episode = ((await readForm(req)).episode ?? "").trim();
          if (!SLUG.test(episode)) throw new HttpError(400, "Choose a video to revise.");
          o.builder.reviseVideo(order.id, episode);
          return redirect(res, `/w/${order.token}?view=new`);
        }
        if (req.method === "GET" && parts.length === 6 && parts[2] === "video" && SLUG.test(parts[3]) && parts[4] === "v" && /^[1-9]\d{0,3}$/.test(parts[5])) {
          const slug = linkedChannel(order);
          const path = slug ? versionPath(channelHome(o, slug), slug, parts[3], Number(parts[5])) : null;
          if (!path || !existsSync(path)) throw new HttpError(404, "That video is not available.");
          return sendFile(req, res, path, "video/mp4", null);
        }
        if (req.method === "POST" && parts.length === 3 && o.builder && (parts[2] === "host" || parts[2] === "captions")) {
          const form = await readForm(req);
          if (parts[2] === "host") {
            if (form.lead === "0" || form.lead === "1") o.builder.setHostLead(order.id, form.lead === "1");
            else if (form.on !== "0" && form.on !== "1") throw new HttpError(400, "Choose to put the host on screen or take it off.");
            else o.builder.setHost(order.id, form.on === "1");
          } else o.builder.setChannelCaptions(order.id, parseCaptionForm(form));
          return redirect(res, `/w/${order.token}?view=settings`);
        }
        if (req.method === "GET" && parts.length === 4 && parts[2] === "shot" && o.builder) {
          return sendFile(req, res, o.builder.shotPicture(order, parts[3]), "image/jpeg", null);
        }
        // The channel's dashboard: make a video from an idea, ask for ideas, decide on suggestions, pause or resume.
        if (req.method === "POST" && parts.length === 3 && o.builder && ["make", "suggest", "proposal", "idea", "channel"].includes(parts[2])) {
          const form = await readForm(req);
          const pick = (form.idea ?? "").trim();
          if (parts[2] === "make") {
            // The New video form sends a topic and maybe a picked idea: a typed topic wins.
            const topic = (form.topic ?? "").trim();
            if (topic) o.builder.makeOwnVideo(order.id, topic);
            else if (SLUG.test(pick)) o.builder.makeVideo(order.id, pick);
            else throw new HttpError(400, form.topic === undefined ? "Choose an idea to make." : "Type a topic or pick one of your ideas.");
            return redirect(res, `/w/${order.token}?view=new`);
          }
          if (parts[2] === "suggest") {
            o.builder.suggestIdeas(order.id, form.direction ?? "");
            return redirect(res, `/w/${order.token}?view=ideas`);
          }
          if (parts[2] === "proposal") {
            if (form.decision === "keep-all") o.builder.keepAll(order.id, form.draft ?? "");
            else if (!SLUG.test(pick) || form.decision !== "keep" && form.decision !== "skip") throw new HttpError(400, "Choose Keep or Skip for a suggested idea.");
            else o.builder.decideProposal(order.id, form.draft ?? "", pick, form.decision === "keep");
            return redirect(res, `/w/${order.token}?view=ideas`);
          }
          if (parts[2] === "idea") {
            if (!SLUG.test(pick)) throw new HttpError(400, "Choose an idea.");
            o.builder.dropIdea(order.id, pick);
            return redirect(res, `/w/${order.token}?view=ideas`);
          }
          if (form.status !== "paused" && form.status !== "active") throw new HttpError(400, "Choose Pause or Resume.");
          o.builder.setPaused(order.id, form.status === "paused");
          return redirect(res, `/w/${order.token}?view=settings`);
        }
        if (req.method === "GET" && parts.length === 4 && parts[2] === "video" && SLUG.test(parts[3])) {
          const slug = linkedChannel(order);
          const path = slug ? videoPath(channelHome(o, slug), slug, parts[3]) : null;
          if (!path || !existsSync(path)) throw new HttpError(404, "That video is not available.");
          return sendFile(req, res, path, "video/mp4", url.searchParams.has("download") ? `${parts[3]}.mp4` : null);
        }
        if (req.method === "GET" && parts.length === 5 && parts[2] === "frame" && SLUG.test(parts[3]) && FRAME.test(parts[4])) {
          const slug = linkedChannel(order);
          const path = slug ? join(framesDir(channelHome(o, slug), slug, parts[3]), parts[4]) : null;
          if (!path || !existsSync(path)) throw new HttpError(404, "That picture is not available.");
          return sendFile(req, res, path, "image/jpeg", null);
        }
      }
      throw new HttpError(404, "There is no page at this address.");
    }),
  );
}

export function createAdminServer(o: StorefrontOptions): Server {
  return createServer(
    handler(o.product, "admin", async (req, res, url) => {
      const parts = url.pathname.split("/").filter(Boolean);
      const channels = [...listChannelSlugs(o.ws), ...(o.builder ? listChannelSlugs(o.builder.ws) : [])];
      if (req.method === "GET" && parts.length === 0) return send(res, 200, adminPage(o.product, o.store.list(), channels, o.publicBase, o.builder !== null));
      if (parts[0] === "assets") return sendAsset(req, res, parts, o.libraryDir);
      if (req.method === "POST" && parts.length === 3 && parts[0] === "orders") {
        if (!o.store.byId(parts[1])) throw new HttpError(404, "No such order.");
        const form = await readForm(req);
        if (parts[2] === "status") {
          if (!(ORDER_STATUSES as readonly string[]).includes(form.status)) throw new HttpError(400, "That is not an order status.");
          o.store.update(parts[1], (ord) => {
            ord.status = form.status as OrderStatus;
          });
          o.builder?.consider(parts[1]);
          return redirect(res, "/");
        }
        if (parts[2] === "build" && o.builder) {
          o.builder.consider(parts[1], true);
          return redirect(res, "/");
        }
        if (parts[2] === "video" && o.builder) {
          o.builder.startVideo(parts[1], true);
          return redirect(res, "/");
        }
        if (parts[2] === "channel") {
          const slug = form.channel ?? "";
          if (slug && !channels.includes(slug)) throw new HttpError(400, "That channel does not exist.");
          o.store.update(parts[1], (ord) => {
            ord.channel = slug || null;
          });
          return redirect(res, "/");
        }
      }
      throw new HttpError(404, "There is no page at this address.");
    }),
  );
}
