import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { AccountStore } from "../storefront/accounts.ts";
import { brandKit, cleanVideoPath, videoPath, videoVersions } from "../storefront/brand-kit.ts";
import { Builder, buildWorkspace, orderSeed, type CaptionBaker, type Drafter, type Reviser, type Suggester, type VideoMaker } from "../storefront/builder.ts";
import { episodesDir } from "../pipeline/episode.ts";
import { readFactcheck, writeFactcheck } from "../pipeline/factcheck.ts";
import { channelExists, loadChannel } from "../core/channels.ts";
import { readJson, readText, writeJson, writeText } from "../core/util.ts";
import { SECTIONS } from "../storefront/store.ts";
import { ENGINE_DIR } from "../core/workspace.ts";
import { OWN_HOST, OWN_LOOK, loadCatalog, readHosts, readLooks } from "../storefront/catalog.ts";
import { HOST_RIGS, buildHost, buildLook, hostFields, lookFields } from "../storefront/designer.ts";
import type { SignIn } from "../storefront/google.ts";
import { hostSvg } from "../storefront/host-svg.tsx";
import { createAdminServer, createPublicServer } from "../storefront/server.ts";
import { OrderStore, validateIntake } from "../storefront/store.ts";
import { makeChannel, sampleScript, tempWorkspace } from "./helpers.ts";
import { factualHash } from "../pipeline/script-check.ts";
import { newStoryboard, readStoryboard, storyboardApproved, videoCaptions, writeStoryboard } from "../pipeline/storyboard.ts";
import { paintPaths } from "../skills/render-themed/paint.ts";
import { showsHost, shotsUsed, type Shot } from "../skills/render-themed/schema.ts";
import type { Script } from "../skills/write-script/schema.ts";
import { sha256 } from "../core/util.ts";
import { NO_HOST } from "../storefront/catalog.ts";

const GOOD = { contact_name: "Sam Example", email: "sam@example.com", idea: "How bridges stay up", audience: "Curious adults", tone: "calm, clear", look: "Blueprint", look_note: "", avatar: "Byte", host: "", avoid: "" };
const OFFER = loadCatalog(ENGINE_DIR);

/** The sample script told in painted shots (a look with a world): the same words, shots instead of 3D scenes. */
function paintedScript(channel: string): Script {
  const s = sampleScript(channel);
  const shots: Record<string, Shot[]> = {
    hook: [{ show: "The host stares at a giant pen dripping blue ink", host: true }],
    explain: [{ show: "A tiny steel ball sits in the tip of a pen", host: false }, { at: "ink", show: "Thick blue ink waits behind the ball", host: false }],
    payoff: [{ show: "A pen cap shaped like a round ball", host: false }],
  };
  return { ...s, visuals: {}, beats: s.beats.map((b) => ({ ...b, visual: { skill: "render-themed", shots: shots[b.id] } })) };
}
const form = (values: Record<string, string>) => ({ method: "POST", redirect: "manual" as const, headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(values).toString() });

describe("storefront: intake and orders", () => {
  it("rejects an incomplete or malformed form, field by field", () => {
    const r = validateIntake({ ...GOOD, contact_name: " ", email: "not-an-email", look: "Neon", avatar: "Nobody" }, OFFER);
    assert.ok(r.errors);
    assert.deepEqual(Object.keys(r.errors).sort(), ["avatar", "contact_name", "email", "look"]);
  });

  it("always accepts a look or a host that is not on offer, as long as the look is described", () => {
    assert.deepEqual(validateIntake({ ...GOOD, avatar: OWN_HOST }, OFFER).design?.model, null);
    assert.deepEqual(Object.keys(validateIntake({ ...GOOD, look: OWN_LOOK }, OFFER).errors ?? {}), ["look_note"]);
    const own = validateIntake({ ...GOOD, look: OWN_LOOK, look_note: "Like a 1970s textbook" }, OFFER);
    assert.equal(own.intake?.look, OWN_LOOK);
    assert.equal(own.design?.theme, null);
  });

  it("takes the ready-made look and host as they are when nothing was changed in the designer", () => {
    const r = validateIntake(GOOD, OFFER);
    assert.equal(r.design?.theme?.name, "Blueprint");
    assert.equal(r.design?.model?.rig, "pixel-sprite");
  });

  it("builds the customer's own look and host from the designer's settings", () => {
    const blueprint = OFFER.looks.find((l) => l.name === "Blueprint")!.theme;
    const look = { ...lookFields(blueprint), l_paper: "#102030", l_surface: "glow", l_display: "fredoka", l_host: "right", l_host_size: "large", l_pictures: "stacked" };
    const host = { h_rig: "flat-2d", h_shape: "star", h_extra: "crown", h_hair: "", h_eyes: "sleepy", h_main: "#00aa88", h_second: "#112233", h_accent: "#ffcc00", h_mood: "grumpy" };
    const r = validateIntake({ ...GOOD, avatar: OWN_HOST, ...look, ...host }, OFFER);
    assert.ok(r.design);
    assert.deepEqual([r.design.theme?.paper, r.design.theme?.surface, r.design.theme?.display, r.design.theme?.accent], ["#102030", "glow", ["fredoka"], blueprint.accent]);
    assert.deepEqual(r.design.theme?.layout, { host: "right", host_size: "large", lettering: "middle", pictures: "stacked" });
    const model = r.design.model;
    assert.ok(model?.rig === "flat-2d");
    assert.deepEqual([model.params.body.shape, model.params.body.color, model.params.accessories[0].type, model.params.eyes.style, model.expressions.neutral.brow], ["star", "#00aa88", "crown", "sleepy", "down"]);
    assert.deepEqual(hostFields(model), host);
  });

  it("paints every designed look in a world: the customer's words, or one made from what the channel is", () => {
    const own = validateIntake({ ...GOOD, world: "A tiny world on a kitchen table, claymation" }, OFFER);
    assert.equal(own.design?.theme?.world?.description, "A tiny world on a kitchen table, claymation");
    const made = validateIntake({ ...GOOD, world: "" }, OFFER);
    assert.match(made.design?.theme?.world?.description ?? "", new RegExp(`a channel about ${GOOD.idea}`));
    assert.equal(validateIntake({ ...GOOD, world: "x".repeat(1201) }, OFFER).errors?.world, "Your world must be 1200 characters or fewer.");
  });

  it("keeps the scene layouts picked in the designer, frames of the look's own included, and reports ones it cannot read", () => {
    const blueprint = OFFER.looks.find((l) => l.name === "Blueprint")!.theme;
    const own = { name: "host-peeks", host: { x: 0, y: 70, w: 30, h: 30 }, text: { x: 0, y: 0, w: 100, h: 34, align: "top" }, picture: { x: 32, y: 36, w: 68, h: 64 } };
    const frames = ["split", "title-card", own];
    const r = validateIntake({ ...GOOD, ...lookFields(blueprint), l_frames: JSON.stringify(frames) }, OFFER);
    assert.deepEqual(r.design?.theme?.layout.frames, frames);
    assert.equal(lookFields(r.design!.theme!).l_frames, JSON.stringify(frames));
    assert.equal(lookFields(blueprint).l_frames, "", "a look without frames keeps the classic arrangement");
    assert.match(validateIntake({ ...GOOD, ...lookFields(blueprint), l_frames: "[split" }, OFFER).errors?.look ?? "", /scene layouts could not be read/);
    assert.match(validateIntake({ ...GOOD, ...lookFields(blueprint), l_frames: JSON.stringify(["nope"]) }, OFFER).errors?.look ?? "", /layout\.frames/);
  });

  it("refuses designer settings the renderer would refuse, and a 3D robot that is not one of the ready ones", () => {
    assert.match(validateIntake({ ...GOOD, ...lookFields(OFFER.looks[0].theme), l_paper: "red" }, OFFER).errors?.look ?? "", /not valid/);
    assert.match(validateIntake({ ...GOOD, h_rig: "flat-2d", h_shape: "cube", h_extra: "none", h_eyes: "round", h_main: "#000000", h_second: "#000000", h_accent: "#000000", h_mood: "calm" }, OFFER).errors?.avatar ?? "", /shape: "cube" is not offered/);
    assert.match(validateIntake({ ...GOOD, h_rig: "orb-bot-3d" }, OFFER).errors?.avatar ?? "", /3D robot/);
    assert.equal(validateIntake({ ...GOOD, avatar: "Rivet", h_rig: "orb-bot-3d" }, OFFER).design?.model?.rig, "orb-bot-3d");
  });

  it("can rebuild every ready-made host and look from its own settings, in every option the designer offers", () => {
    for (const l of OFFER.looks) assert.deepEqual(buildLook(lookFields(l.theme), l.name).theme, l.theme, l.id);
    for (const h of OFFER.hosts) if (HOST_RIGS[h.model.rig]) assert.equal(buildHost(hostFields(h.model)).problems, null, h.id);
    for (const [h_rig, o] of Object.entries(HOST_RIGS))
      for (const h_shape of o.shape.length ? o.shape : [""])
        for (const h_extra of o.extra.length ? o.extra : [""])
          for (const h_hair of o.hair.length ? o.hair : [""])
            for (const h_eyes of o.eyes.length ? o.eyes : [""]) {
              const built = buildHost({ h_rig, h_shape, h_extra, h_hair, h_eyes, h_main: "#3366ff", h_second: "#111111", h_accent: "#ffcc00", h_mood: "calm" });
              assert.equal(built.problems, null, `${h_rig} ${h_shape} ${h_extra} ${h_hair} ${h_eyes}`);
              assert.match(hostSvg(built.model!), /^<svg xmlns/);
            }
  });

  it("stores orders on disk under an unguessable token", () => {
    const file = join(mkdtempSync(join(tmpdir(), "storefront-")), "orders.json");
    const a = new OrderStore(file).create(validateIntake(GOOD, OFFER).intake!, { theme: null, model: null }, true, null);
    const b = new OrderStore(file).create(validateIntake(GOOD, OFFER).intake!, { theme: null, model: null }, true, null);
    assert.notEqual(a.token, b.token);
    assert.ok(a.token.length >= 43);
    const reopened = new OrderStore(file);
    assert.equal(reopened.byToken(a.token)?.id, a.id);
    assert.equal(reopened.list().length, 2);
    assert.throws(() => reopened.update("ord-missing", () => {}), /No order/);
  });
});

describe("storefront: brand kit from channel files", () => {
  it("reads name, promise, host, colours and format from the channel", () => {
    const ws = tempWorkspace();
    makeChannel(ws, "kit-demo");
    const kit = brandKit(ws, "kit-demo");
    assert.equal(kit.name, "Test kit-demo");
    assert.equal(kit.promise, "Short peeks inside everyday objects.");
    assert.equal(kit.host.name, "Bot");
    assert.deepEqual(kit.series.beats.map((b) => b.id), ["hook", "explain", "payoff"]);
    assert.ok(kit.colours.some((c) => c.hex === "#3d5afe"));
    assert.deepEqual(kit.never, ["weapons", "medical advice"]);
    assert.deepEqual(kit.episodes, []);
  });
});

describe("storefront: servers", () => {
  const ws = tempWorkspace();
  makeChannel(ws, "kit-demo");
  const store = new OrderStore(ws.path("storefront", "orders.json"));
  const options = { ws, store, product: "Test Studio", paymentUrl: null, demoChannel: "kit-demo", libraryDir: ENGINE_DIR, publicBase: "http://example.test", accounts: null, builder: null };
  let pub: Server;
  let admin: Server;
  let base = "";
  let adminBase = "";
  before(async () => {
    pub = createPublicServer(options);
    admin = createAdminServer(options);
    await Promise.all([new Promise<void>((r) => pub.listen(0, "127.0.0.1", r)), new Promise<void>((r) => admin.listen(0, "127.0.0.1", r))]);
    base = `http://127.0.0.1:${(pub.address() as AddressInfo).port}`;
    adminBase = `http://127.0.0.1:${(admin.address() as AddressInfo).port}`;
  });
  after(() => {
    pub.close();
    admin.close();
  });

  it("shows the form again with messages when the intake is bad, and creates nothing", async () => {
    const res = await fetch(`${base}/intake`, form({ ...GOOD, email: "nope" }));
    assert.equal(res.status, 422);
    assert.match(await res.text(), /Enter an email address/);
    assert.equal(store.list().length, 0);
  });

  it("turns a good intake into a private workspace link", async () => {
    const res = await fetch(`${base}/intake`, form({ ...GOOD, contact_name: "<script>alert(1)</script>" }));
    assert.equal(res.status, 303);
    const location = res.headers.get("location")!;
    assert.match(location, /^\/w\/[\w-]{43,}$/);
    const page = await fetch(base + location);
    assert.equal(page.status, 200);
    assert.equal(page.headers.get("referrer-policy"), "no-referrer");
    assert.equal(page.headers.get("cache-control"), "no-store");
    const html = await page.text();
    assert.ok(!html.includes("<script>alert(1)</script>"), "customer text must be escaped");
    assert.match(html, /Your brand kit is being made/);
    assert.match(html, /Not needed for now/);
    assert.doesNotMatch(html, /Waiting for payment|Pay securely|Received/);
    assert.doesNotMatch(html, /Test kit-demo/);
    assert.equal(store.list()[0].status, "in-production");
  });

  it("waits for payment when a payment link is set, and shows nothing of the channel until it arrives", async () => {
    const paidStore = new OrderStore(ws.path("storefront", "paid-orders.json"));
    const paid = { ...options, store: paidStore, paymentUrl: "https://pay.example.test/link" };
    const site = createPublicServer(paid);
    const back = createAdminServer(paid);
    await Promise.all([new Promise<void>((r) => site.listen(0, "127.0.0.1", r)), new Promise<void>((r) => back.listen(0, "127.0.0.1", r))]);
    try {
      const at = `http://127.0.0.1:${(site.address() as AddressInfo).port}`;
      const backAt = `http://127.0.0.1:${(back.address() as AddressInfo).port}`;
      const res = await fetch(`${at}/intake`, form(GOOD));
      assert.equal(res.status, 303);
      const order = paidStore.list()[0];
      assert.equal(order.status, "awaiting-payment");
      assert.equal(order.no_payment, undefined);
      assert.equal((await fetch(`${backAt}/orders/${order.id}/channel`, form({ channel: "kit-demo" }))).status, 303);
      const html = await (await fetch(at + res.headers.get("location")!)).text();
      assert.match(html, /Waiting for payment/);
      assert.match(html, /href="https:\/\/pay\.example\.test\/link"/);
      assert.doesNotMatch(html, /Test kit-demo/);
    } finally {
      site.close();
      back.close();
    }
  });

  it("compresses pages and scripts for browsers that accept it, with the same content", async () => {
    for (const path of ["/create", "/assets/app.js"]) {
      const plain = await fetch(base + path, { headers: { "accept-encoding": "identity" } });
      assert.equal(plain.headers.get("content-encoding"), null, path);
      const text = await plain.text();
      for (const encoding of ["br", "gzip"]) {
        const res = await fetch(base + path, { headers: { "accept-encoding": encoding } });
        assert.equal(res.headers.get("content-encoding"), encoding, path);
        assert.equal(res.headers.get("vary"), "accept-encoding", path);
        assert.ok(Number(res.headers.get("content-length")) < text.length / 2, `${path} as ${encoding} is under half the size`);
        assert.equal(await res.text(), text, `${path} as ${encoding}`);
      }
    }
  });

  it("serves its fonts and sample media, and nothing else, from /assets", async () => {
    const font = await fetch(`${base}/assets/font/grotesk-700.woff2`);
    assert.equal(font.status, 200);
    assert.equal(font.headers.get("content-type"), "font/woff2");
    assert.equal((await fetch(`${base}/assets/collage-1.jpg`)).headers.get("content-type"), "image/jpeg");
    assert.equal((await fetch(`${base}/assets/..%2Fserver.ts`)).status, 404);
    assert.equal((await fetch(`${base}/assets/font/nope.woff2`)).status, 404);
    assert.match((await fetch(`${base}/assets/app.js`)).headers.get("content-type")!, /^text\/javascript/);
    for (const page of ["/", "/demo", "/create"]) {
      const res = await fetch(base + page);
      assert.equal(res.status, 200, page);
      for (const src of (await res.text()).match(/\/assets\/[\w./-]+/g) ?? []) assert.equal((await fetch(base + src)).status, 200, `${page} → ${src}`);
    }
  });

  it("has a landing page, a demo of a real channel, and a creation page", async () => {
    const home = await (await fetch(base)).text();
    assert.match(home, /href="\/demo"/);
    assert.match(home, /href="\/create"/);
    const demo = await (await fetch(`${base}/demo`)).text();
    assert.match(demo, /Test kit-demo/);
    assert.match(demo, /Short peeks inside everyday objects\./);
    const create = await (await fetch(`${base}/create`)).text();
    assert.match(create, /action="\/intake"/);
    assert.equal((create.match(/<fieldset class="step">/g) ?? []).length, 4);
  });

  it("offers every look and host in the library, plus the two open choices, and accepts any of them", async () => {
    const catalog = loadCatalog(ENGINE_DIR);
    const create = await (await fetch(`${base}/create`)).text();
    for (const name of [...catalog.looks.map((l) => l.name), OWN_LOOK]) assert.ok(create.includes(`name="look" value="${name}"`), name);
    for (const name of [...catalog.hosts.map((h) => h.name), OWN_HOST]) assert.ok(create.includes(`name="avatar" value="${name}"`), name);
    const last = { look: catalog.looks[catalog.looks.length - 1].name, avatar: catalog.hosts[catalog.hosts.length - 1].name };
    assert.equal((await fetch(`${base}/intake`, form({ ...GOOD, ...last }))).status, 303);
    assert.equal((await fetch(`${base}/assets/host/no-such-host.jpg`)).status, 404);
  });

  it("draws the designer's host picture from its settings, and stores the design on the order", async () => {
    const host = { h_rig: "neon-line", h_shape: "hex", h_extra: "", h_hair: "", h_eyes: "", h_main: "#ff00aa", h_second: "#00ffee", h_accent: "#101020", h_mood: "cheerful" };
    const pic = await fetch(`${base}/preview/host.svg?${new URLSearchParams(host)}`);
    assert.equal(pic.headers.get("content-type"), "image/svg+xml; charset=utf-8");
    assert.match(await pic.text(), /#ff00aa/);
    assert.equal((await fetch(`${base}/preview/host.svg?h_rig=neon-line`)).status, 400);
    const before = store.list().length;
    assert.equal((await fetch(`${base}/intake`, form({ ...GOOD, avatar: OWN_HOST, ...host }))).status, 303);
    const made = store.list()[before];
    assert.ok(made.design?.model?.rig === "neon-line" && made.design.model.params.line === "#ff00aa");
    assert.equal(made.design.theme?.name, "Blueprint");
    assert.match(await (await fetch(adminBase)).text(), /model\.json/);
  });

  it("answers 404 for a wrong token and never exposes the orders list publicly", async () => {
    assert.equal((await fetch(`${base}/w/${"x".repeat(43)}`)).status, 404);
    assert.equal((await fetch(`${base}/orders`)).status, 404);
  });

  it("has no sign-in or account pages while sign-in is switched off", async () => {
    for (const path of ["/signin", "/account", "/auth/google/callback?code=ok-sam&state=x"]) assert.equal((await fetch(base + path, { redirect: "manual" })).status, 404, path);
    assert.equal((await fetch(`${base}/draft`, form(GOOD))).status, 404);
    assert.doesNotMatch(await (await fetch(`${base}/create`)).text(), /Sign in|Save for later/);
  });

  it("shows the brand kit, video and decisions only after linking", async () => {
    const order = store.list()[0];
    const video = videoPath(ws, "kit-demo", "2026-01-01-demo");
    mkdirSync(dirname(video), { recursive: true });
    writeFileSync(video, Buffer.from("0123456789"));
    assert.equal((await fetch(`${base}/w/${order.token}/video/2026-01-01-demo`)).status, 404);
    assert.equal((await fetch(`${base}/w/${order.token}/decision`, form({ section: "name", decision: "approve" }))).status, 409);

    assert.equal((await fetch(`${adminBase}/orders/${order.id}/status`, form({ status: "bogus" }))).status, 400);
    assert.equal((await fetch(`${adminBase}/orders/${order.id}/channel`, form({ channel: "no-such-channel" }))).status, 400);
    assert.equal((await fetch(`${adminBase}/orders/${order.id}/status`, form({ status: "paid" }))).status, 303);
    assert.equal((await fetch(`${adminBase}/orders/${order.id}/channel`, form({ channel: "kit-demo" }))).status, 303);

    const html = await (await fetch(`${base}/w/${order.token}`)).text();
    assert.match(html, /Test kit-demo/);
    assert.match(html, /Short peeks inside everyday objects\./);

    const part = await fetch(`${base}/w/${order.token}/video/2026-01-01-demo`, { headers: { range: "bytes=2-5" } });
    assert.equal(part.status, 206);
    assert.equal(await part.text(), "2345");
    assert.equal((await fetch(`${base}/w/${order.token}/video/..%2F..%2Fsecret`)).status, 404);

    assert.equal((await fetch(`${base}/w/${order.token}/decision`, form({ section: "look", decision: "change", note: "" }))).status, 400);
    assert.equal((await fetch(`${base}/w/${order.token}/decision`, form({ section: "look", decision: "change", note: "Try the blueprint look" }))).status, 303);
    assert.equal(store.byId(order.id)?.decisions.look?.note, "Try the blueprint look");
    assert.match(await (await fetch(adminBase)).text(), /Try the blueprint look/);
  });

  it("walks the decisions to one final approval that locks the kit and moves the order on to its videos", async () => {
    const order = store.list().find((o) => o.channel === "kit-demo")!;
    const page = async () => (await fetch(`${base}/w/${order.token}`)).text();
    const decide = (values: Record<string, string>) => fetch(`${base}/w/${order.token}/decision`, form(values));
    assert.match(await page(), /1 of 6 decided[\s\S]*Next: the name/);
    assert.equal((await decide({ section: "name", decision: "approve" })).status, 303);
    assert.match(await page(), /2 of 6 decided[\s\S]*Next: the host/);
    assert.equal((await decide({ section: "name", decision: "clear" })).status, 303);
    assert.equal(store.byId(order.id)?.decisions.name, undefined);
    assert.equal((await fetch(`${base}/w/${order.token}/approve`, form({}))).status, 409);
    for (const s of SECTIONS) if (s.id !== "look") assert.equal((await decide({ section: s.id, decision: "approve" })).status, 303);
    // One part still asks for a change, and automatic builds are off here: the notes wait for a person.
    assert.match(await page(), /5 approved, 1 to change[\s\S]*We make these by hand/);
    assert.equal((await fetch(`${base}/w/${order.token}/revise`, form({}))).status, 404);
    assert.equal((await fetch(`${base}/w/${order.token}/approve`, form({}))).status, 409);
    assert.equal((await decide({ section: "look", decision: "approve" })).status, 303);
    assert.equal(store.byId(order.id)?.decisions.look?.note, "");
    assert.match(await page(), /Everything approved[\s\S]*Approve brand kit/);
    assert.equal((await fetch(`${base}/w/${order.token}/approve`, form({}))).status, 303);
    assert.ok(store.byId(order.id)?.kit_approved);
    const done = await page();
    assert.match(done, /Brand kit approved/);
    assert.match(done, /First one being made/);
    assert.doesNotMatch(done, /id="finish"|Undo/);
    assert.equal((await decide({ section: "name", decision: "change", note: "Too late" })).status, 409);
    assert.match(await (await fetch(adminBase)).text(), /Kit approved/);
  });
});

describe("storefront: the library of looks and hosts", () => {
  const library = () => {
    const dir = mkdtempSync(join(tmpdir(), "library-"));
    for (const f of ["themes/blueprint.json", "avatars/byte.json", "avatars/byte.jpg"]) {
      mkdirSync(dirname(join(dir, f)), { recursive: true });
      cpSync(join(ENGINE_DIR, f), join(dir, f));
    }
    return dir;
  };

  it("makes a new file a new option, with no code change", () => {
    const dir = library();
    assert.deepEqual(loadCatalog(dir).looks.map((l) => l.name), ["Blueprint"]);
    cpSync(join(ENGINE_DIR, "themes", "arcade.json"), join(dir, "themes", "my-look.json"));
    cpSync(join(ENGINE_DIR, "avatars", "vex.json"), join(dir, "avatars", "my-host.json"));
    cpSync(join(ENGINE_DIR, "avatars", "vex.jpg"), join(dir, "avatars", "my-host.jpg"));
    const catalog = loadCatalog(dir);
    assert.deepEqual(catalog.looks.map((l) => l.id), ["blueprint", "my-look"]);
    assert.deepEqual(catalog.hosts.map((h) => h.name), ["Byte", "Vex"]);
  });

  it("stops on a host without a picture, a repeated name, or a file that is not valid", () => {
    const dir = library();
    cpSync(join(ENGINE_DIR, "avatars", "vex.json"), join(dir, "avatars", "vex.json"));
    assert.throws(() => loadCatalog(dir), /avatars\/vex\.json has no picture/);
    cpSync(join(ENGINE_DIR, "avatars", "byte.json"), join(dir, "avatars", "vex.json"));
    assert.throws(() => readHosts(dir), /the name "Byte" is already used/);
    writeFileSync(join(dir, "themes", "broken.json"), JSON.stringify({ name: "Broken" }));
    assert.throws(() => readLooks(dir), /themes\/broken\.json is not a valid theme/);
  });
});

describe("storefront: sign-in and accounts", () => {
  const ws = tempWorkspace();
  makeChannel(ws, "kit-demo");
  const store = new OrderStore(ws.path("storefront", "orders.json"));
  const accountsFile = ws.path("storefront", "accounts.json");
  // Stands in for Google: the code "ok-<name>" signs in as <name>; anything else is refused.
  const signIn: SignIn = {
    startUrl: (redirectUri, state) => `https://signin.example.test/?${new URLSearchParams({ redirect_uri: redirectUri, state })}`,
    identity: async (code) => {
      if (!code.startsWith("ok-")) throw new Error("refused");
      return { sub: `g-${code.slice(3)}`, email: `${code.slice(3)}@example.com`, name: code.slice(3) };
    },
  };
  const options = { ws, store, product: "Test Studio", paymentUrl: null, demoChannel: "kit-demo", libraryDir: ENGINE_DIR, publicBase: "http://example.test", accounts: { store: new AccountStore(accountsFile), signIn }, builder: null };
  let pub: Server;
  let base = "";
  before(async () => {
    pub = createPublicServer(options);
    await new Promise<void>((r) => pub.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(pub.address() as AddressInfo).port}`;
  });
  after(() => pub.close());

  /** A browser that keeps its cookies between requests and never follows redirects by itself. */
  function browser() {
    const jar = new Map<string, string>();
    const flags: string[] = [];
    return {
      jar,
      flags,
      async go(path: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
        const res = await fetch(base + path, { ...init, redirect: "manual", headers: { ...init.headers, cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") } });
        for (const c of res.headers.getSetCookie()) {
          const [name, value] = c.split(";")[0].split("=");
          flags.push(c);
          if (/Max-Age=0\b/.test(c)) jar.delete(name);
          else jar.set(name, value);
        }
        return res;
      },
      /** Go through the whole sign-in as `name`; returns where the site sends them afterwards. */
      async signIn(name: string) {
        const start = await this.go("/signin");
        assert.equal(start.status, 303);
        const at = new URL(start.headers.get("location")!);
        assert.equal(at.origin, "https://signin.example.test");
        assert.equal(at.searchParams.get("redirect_uri"), "http://example.test/auth/google/callback");
        return this.go(`/auth/google/callback?code=ok-${name}&state=${at.searchParams.get("state")}`);
      },
    };
  }

  it("signs a person in, shows them their page, and signs them out again", async () => {
    const b = browser();
    assert.match(await (await b.go("/")).text(), /href="\/signin">Sign in</);
    const away = await b.go("/account");
    assert.equal(away.status, 303);
    assert.equal(away.headers.get("location"), "/signin");
    const back = await b.signIn("sam");
    assert.equal(back.status, 303);
    assert.equal(back.headers.get("location"), "/account");
    assert.ok(b.flags.every((c) => /; HttpOnly; SameSite=Lax;/.test(c)), "every cookie is hidden from scripts and kept to this site");
    const mine = await (await b.go("/account")).text();
    assert.match(mine, /sam@example\.com[\s\S]*Sign out/);
    assert.match(mine, /Nothing here yet/);
    assert.match(await (await b.go("/")).text(), /href="\/account"><span class="long">My channels</);
    const session = b.jar.get("sid")!;
    assert.ok(!readFileSync(accountsFile, "utf8").includes(session), "the session secret is stored only as a hash");
    assert.equal((await b.go("/signout", { method: "POST" })).status, 303);
    assert.equal(b.jar.has("sid"), false);
    b.jar.set("sid", session);
    assert.equal((await b.go("/account")).headers.get("location"), "/signin", "a signed-out session cannot be reused");
  });

  it("refuses a sign-in return that did not start in this browser", async () => {
    const b = browser();
    assert.equal((await b.go("/auth/google/callback?code=ok-eve&state=made-up")).status, 400);
    await b.go("/signin");
    assert.equal((await b.go("/auth/google/callback?code=ok-eve&state=made-up")).status, 400);
    assert.equal(b.jar.has("sid"), false);
  });

  it("holds an order through sign-in, then keeps it on that person's page only", async () => {
    const b = browser();
    const bad = await b.go("/intake", form({ ...GOOD, email: "nope" }));
    assert.equal(bad.status, 422);
    assert.equal(b.jar.has("hold"), false);
    const sent = await b.go("/intake", form({ ...GOOD, idea: "How lighthouses work" }));
    assert.equal(sent.headers.get("location"), "/signin");
    assert.equal(store.list().length, 0, "nothing is ordered before sign-in");
    const back = await b.signIn("ana");
    assert.match(back.headers.get("location")!, /^\/w\/[\w-]{43,}$/);
    assert.equal(b.jar.has("hold"), false);
    const [order] = store.list();
    assert.equal(order.intake.idea, "How lighthouses work");
    assert.equal(order.user, options.accounts.store.userBySession(b.jar.get("sid")!)?.id);
    assert.match(await (await b.go(back.headers.get("location")!)).text(), /href="\/account">My channels</);
    const mine = await (await b.go("/account")).text();
    assert.match(mine, /How lighthouses work/);
    assert.match(mine, /In production/);
    assert.ok(mine.includes(`href="/w/${order.token}"`));
    // Signed in already: the next one goes straight through.
    assert.match((await b.go("/intake", form({ ...GOOD, idea: "How tides work" }))).headers.get("location")!, /^\/w\//);
    assert.equal(store.listFor(order.user!).length, 2);
    const other = browser();
    await other.signIn("ben");
    assert.doesNotMatch(await (await other.go("/account")).text(), /lighthouses|tides/);
  });

  it("saves a design for later, brings it back on the create page, and clears it once sent", async () => {
    const b = browser();
    const saved = await b.go("/draft", form({ idea: "Why bread rises", look: "Blueprint", contact_name: "" }));
    assert.equal(saved.headers.get("location"), "/signin");
    assert.equal((await b.signIn("cy")).headers.get("location"), "/account");
    assert.match(await (await b.go("/account")).text(), /Your saved design[\s\S]*Why bread rises/);
    assert.match(await (await b.go("/create")).text(), /Why bread rises/);
    assert.doesNotMatch(await (await b.go("/create?new")).text(), /Why bread rises/);
    assert.equal((await b.go("/draft", form({ idea: "Why bread rises twice" }))).headers.get("location"), "/account");
    assert.match(await (await b.go("/create")).text(), /Why bread rises twice/);
    assert.match((await b.go("/intake", form({ ...GOOD, idea: "Why bread rises twice" }))).headers.get("location")!, /^\/w\//);
    assert.doesNotMatch(await (await b.go("/account")).text(), /Your saved design/);
    const create = await (await b.go("/create")).text();
    assert.match(create, /Save for later/);
    // Everything the step-by-step script (assets/app.js) looks up on load is on the page; without one, it stops and the form can't be sent.
    for (const [needed, found] of [["the wizard form", /<form[^>]*data-wizard/], ["the steps", /class="step"/], ["the progress bar", /class="bar"><i><\/i>/], ["the step count", /data-count/], ["Back", /data-back/], ["Continue", /data-next/], ["Create", /data-submit/], ["the phone", /data-frame/], ["the host picture", /data-host-img/]] as const)
      assert.match(create, found, `the create page has ${needed}`);
  });
});

describe("storefront: automatic builds", () => {
  const ws = tempWorkspace();
  makeChannel(ws, "kit-demo");
  const built = buildWorkspace(ENGINE_DIR, ws.path("storefront", "workspace"));
  const seen: { slug: string; seed: string; skills: string[] }[] = [];
  let broken = false;
  let hold: Promise<void> = Promise.resolve();
  // Stands in for the Claude API: writes a small valid channel over the skeleton (once `hold` lets it), or fails when told to.
  const draft: Drafter = async (to, slug, seed, skills) => {
    seen.push({ slug, seed, skills });
    await hold;
    if (broken) throw new Error("the writer is down");
    const from = tempWorkspace();
    makeChannel(from, slug);
    cpSync(from.channelDir(slug), to.channelDir(slug), { recursive: true, force: true });
  };
  const revised: { slug: string; requests: { about: string; note: string }[]; keep: string[] }[] = [];
  // Stands in for the Claude API's revision: renames the channel, or fails when told to.
  const revise: Reviser = async (to, slug, requests, _skills, keep) => {
    revised.push({ slug, requests, keep });
    await hold;
    if (broken) throw new Error("the writer is down");
    const doc = join(to.channelDir(slug), "channel.md");
    writeText(doc, readText(doc).replace(/name: "?Test [\w-]+"?/, 'name: "Revised name"'));
  };
  const made: { slug: string; series: string; rewrite: boolean; note?: string }[] = [];
  const EPISODE = "2026-01-01-first";
  // Stands in for the episode pipeline: writes a script and its fact-check list and stops there; once the list is approved, writes the video.
  // When set, the channel tells its videos in painted shots: the stand-in also paints them and stops at the storyboard.
  let boards = false;
  const video: VideoMaker = async (to, slug, series, pick, captions) => {
    await hold;
    if (broken) throw new Error("the writer is down");
    // The first video is EPISODE; a video of a chosen idea gets its own folder.
    const id = pick.episode ?? (pick.idea ? `2026-01-02-${pick.idea}` : EPISODE);
    const dir = join(episodesDir(loadChannel(to, slug)), id);
    const state = (status: "in-progress" | "done") => writeJson(join(dir, "episode.json"), { id, channel: slug, series, idea: pick.idea ?? "a-ballpoint-pen", title: pick.idea ? `Inside ${pick.idea}` : "Inside a pen", created: "2026-01-01T00:00:00.000Z", updated: "2026-01-01T00:00:00.000Z", status, steps: {} });
    const check = readFactcheck(dir);
    const rewrite = check?.status === "changes-requested";
    made.push({ slug, series, rewrite, note: check?.notes });
    if (!check || rewrite) {
      const script = { ...(boards ? paintedScript(slug) : sampleScript(slug)), title: rewrite ? "Inside a pen, corrected" : "Inside a pen" };
      writeJson(join(dir, "script.json"), script);
      state("in-progress");
      writeFactcheck(dir, script, { channel: slug, episode: id });
      return { episode: id, state: "facts" };
    }
    // Words changed after the approval (on the storyboard): the facts are checked again, as the real pipeline does.
    const written = readJson<Script>(join(dir, "script.json"));
    if (check.scriptHash !== factualHash(written)) {
      writeFactcheck(dir, written, { channel: slug, episode: id });
      return { episode: id, state: "facts" };
    }
    if (check.status !== "approved") return { episode: id, state: "facts" };
    if (boards) {
      // "Paints" every shot: its picture is its words, so a changed shot gets a new picture.
      const paint = paintPaths(dir);
      const painted: Record<string, { sha: string }> = {};
      for (const s of shotsUsed(written.beats)) {
        const file = join(paint.dir, `${s.id}.jpg`);
        mkdirSync(paint.dir, { recursive: true });
        writeFileSync(file, `${s.shot.show} | host: ${showsHost(s.shot)}`);
        painted[s.id] = { sha: sha256(readFileSync(file)) };
      }
      writeJson(paint.state, { shots: painted });
      if (!readStoryboard(dir)) writeStoryboard(dir, newStoryboard(captions));
      if (!storyboardApproved(dir, written)) return { episode: id, state: "storyboard" };
    }
    const file = videoPath(to, slug, id);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from("0123456789"));
    if (boards) {
      // Its voice's timings and its clean render (the video without captions), as the real pipeline leaves them.
      const words = written.beats.flatMap((b) => b.voiceover.split(/\s+/).map((text) => ({ beat: b.id, text })));
      const timed = words.map((w, i) => ({ i, ...w, start: i * 0.3, end: i * 0.3 + 0.25 }));
      const audio = join(dir, "audio");
      mkdirSync(audio, { recursive: true });
      writeJson(join(audio, "timings.json"), { frames: Math.ceil(words.length * 0.3 * 30) + 30, words: timed, beats: written.beats.map((b) => ({ id: b.id, speaker: "narrator", start: timed.find((w) => w.beat === b.id)!.start, end: timed.findLast((w) => w.beat === b.id)!.end })) });
      writeJson(join(audio, "envelope.json"), { values: [] });
      const clean = cleanVideoPath(to, slug, id);
      mkdirSync(dirname(clean), { recursive: true });
      writeFileSync(clean, Buffer.from("clean"));
    }
    // The video of a chosen idea passes with review notes that don't block it (as the real pipeline does for the storefront).
    if (pick.idea) writeJson(join(dir, "qa-review.json"), { render_hash: "x", tone: { pass: true, notes: "" }, banned_topics: { pass: true, notes: "" }, visuals: { pass: false, notes: "" }, character: { pass: true, notes: "" }, overall: "fail", fixes: ["Move the caption above the <label>"], learnings: [] });
    state("done");
    return { episode: id, state: "done" };
  };
  const suggested: { slug: string; series: string; direction?: string }[] = [];
  // Stands in for the Claude API's brainstorm: writes two proposed ideas as a draft for the channel.
  const suggest: Suggester = async (to, slug, series, direction) => {
    await hold;
    if (broken) throw new Error("the writer is down");
    suggested.push({ slug, series, ...(direction ? { direction } : {}) });
    const n = suggested.length;
    writeText(
      to.path("drafts", slug, "ideas", `2026-01-0${n}-batch.md`),
      `---\ndraft: {kind: ideas, channel: ${slug}, status: proposed, created: 2026-01-0${n}}\n---\n\n## glass-bottles-${n}\n- title: How a glass bottle is blown ${n}\n- series: ${series}\n- status: proposed\n- angle: Sand turns into a bottle in seconds\n- fact: Glass is mostly sand melted at about 1,700 °C.\n- fact_source: https://www.britannica.com/technology/glass\n\n## zips-${n}\n- title: Why a zip never slips ${n}\n- series: ${series}\n- status: proposed\n`,
    );
  };
  // Drawing captions into a video needs the renderer: the test only records which videos were asked for.
  const baked: string[] = [];
  const captions: CaptionBaker = async (_ws, slug, episode) => {
    baked.push(`${slug}/${episode}`);
  };
  const setup = (name: string, perDay: number, paymentUrl: string | null) => {
    const store = new OrderStore(ws.path("storefront", `${name}.json`));
    const builder = new Builder(store, built, { draft, revise, video, suggest, captions }, perDay);
    return { store, builder, options: { ws, store, product: "Test Studio", paymentUrl, demoChannel: "kit-demo", libraryDir: ENGINE_DIR, publicBase: "http://example.test", accounts: null, builder } };
  };
  const serve = async (server: Server) => {
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  };

  it("builds the channel when an order arrives, with the customer's look and host on it, and shows the kit", async () => {
    const { store, builder, options } = setup("auto", 20, null);
    const site = createPublicServer(options);
    try {
      const base = await serve(site);
      let release = () => {};
      hold = new Promise<void>((r) => (release = r));
      const res = await fetch(`${base}/intake`, form({ ...GOOD, avoid: "politics" }));
      const link = res.headers.get("location")!;
      assert.match(await (await fetch(base + link)).text(), /This takes several minutes/);
      release();
      await builder.idle();
      const order = store.list()[0];
      assert.equal(order.channel, order.id);
      assert.equal(order.build?.state, "done");
      assert.equal(channelExists(ws, order.id), false, "built channels stay out of the engine's own channels/");
      const channel = loadChannel(built, order.id);
      assert.equal(channel.doc.data.status, "draft", "a built channel is never approved by the server");
      assert.deepEqual(readJson(join(channel.dir, "theme.json")), order.design?.theme);
      assert.deepEqual(readJson(channel.characters.get("bot")!.modelPath), order.design?.model);
      const { seed, skills } = seen[seen.length - 1];
      assert.match(seed, /How bridges stay up/);
      assert.match(seed, /Topics to avoid \(add them to banned_topics\): politics/);
      assert.match(seed, /"name": "Blueprint"/);
      assert.deepEqual(skills, ["render-themed"]);
      const html = await (await fetch(base + link)).text();
      assert.match(html, new RegExp(`Test ${order.id}`));
      assert.match(html, /Ready to review/);
    } finally {
      site.close();
    }
  });

  it("describes a look and host given in words only, and asks for no theme", () => {
    const r = validateIntake({ ...GOOD, look: OWN_LOOK, look_note: "Like a 1970s textbook", avatar: OWN_HOST, host: "A sleepy owl" }, OFFER);
    assert.ok(r.intake);
    const seed = orderSeed(new OrderStore(ws.path("storefront", "words.json")).create(r.intake, r.design, false, null));
    assert.match(seed, /The look, in their words: Like a 1970s textbook/);
    assert.match(seed, /Notes on the host: A sleepy owl/);
    assert.doesNotMatch(seed, /theme\.json|model\.json/);
  });

  it("records a failed build on the order, tells the customer, and builds again into a new folder only when asked", async () => {
    const { store, builder, options } = setup("fail", 20, null);
    const site = createPublicServer(options);
    const back = createAdminServer(options);
    try {
      const [base, adminBase] = [await serve(site), await serve(back)];
      broken = true;
      const link = (await fetch(`${base}/intake`, form(GOOD))).headers.get("location")!;
      await builder.idle();
      const id = store.list()[0].id;
      assert.deepEqual([store.byId(id)?.build?.state, store.byId(id)?.build?.error, store.byId(id)?.channel], ["failed", "the writer is down", null]);
      assert.match(await (await fetch(base + link)).text(), /Your brand kit did not finish/);
      assert.match(await (await fetch(adminBase)).text(), /the writer is down[\s\S]*Build again/);
      const calls = seen.length;
      builder.resume();
      await builder.idle();
      assert.equal(seen.length, calls, "a failed build is not retried by itself");
      broken = false;
      assert.equal((await fetch(`${adminBase}/orders/${id}/build`, form({}))).status, 303);
      await builder.idle();
      assert.deepEqual([store.byId(id)?.channel, store.byId(id)?.build?.state, store.byId(id)?.build?.attempts], [`${id}-2`, "done", 2]);
      assert.equal(channelExists(built, id), true, "the failed attempt's folder is kept");
    } finally {
      broken = false;
      site.close();
      back.close();
    }
  });

  it("does not build an order that is waiting for payment until it is marked paid", async () => {
    const { store, builder, options } = setup("paid", 20, "https://pay.example.test/link");
    const site = createPublicServer(options);
    const back = createAdminServer(options);
    try {
      const [base, adminBase] = [await serve(site), await serve(back)];
      await fetch(`${base}/intake`, form(GOOD));
      await builder.idle();
      const id = store.list()[0].id;
      assert.deepEqual([store.byId(id)?.build, store.byId(id)?.channel], [undefined, null]);
      await fetch(`${adminBase}/orders/${id}/status`, form({ status: "paid" }));
      await builder.idle();
      assert.equal(store.byId(id)?.channel, id);
    } finally {
      site.close();
      back.close();
    }
  });

  it("at start, builds orders that were waiting or cut off, and gives up on one cut off twice", async () => {
    const { store, builder } = setup("resume", 20, null);
    const r = validateIntake(GOOD, OFFER);
    assert.ok(r.intake);
    const waiting = store.create(r.intake, r.design, false, null);
    const cutOff = store.create(r.intake, r.design, false, null);
    const cutOffTwice = store.create(r.intake, r.design, false, null);
    const unpaid = store.create(r.intake, r.design, true, null);
    store.update(cutOff.id, (o) => (o.build = { state: "building", attempts: 1, at: "2026-01-01T00:00:00.000Z", started: "2026-01-01T00:00:00.000Z" }));
    store.update(cutOffTwice.id, (o) => (o.build = { state: "building", attempts: 2, at: "2026-01-01T00:00:00.000Z", started: "2026-01-01T00:00:00.000Z" }));
    builder.resume();
    await builder.idle();
    assert.equal(store.byId(waiting.id)?.channel, waiting.id);
    assert.equal(store.byId(cutOff.id)?.channel, `${cutOff.id}-2`);
    assert.deepEqual([store.byId(cutOffTwice.id)?.build?.state, store.byId(cutOffTwice.id)?.channel], ["failed", null]);
    assert.match(store.byId(cutOffTwice.id)?.build?.error ?? "", /cut off 2 times/);
    assert.equal(store.byId(unpaid.id)?.build, undefined);
  });

  it("stops at the daily limit and says so on the order", async () => {
    const { store, builder } = setup("limit", 1, null);
    const r = validateIntake(GOOD, OFFER);
    assert.ok(r.intake);
    const first = store.create(r.intake, r.design, false, null);
    const second = store.create(r.intake, r.design, false, null);
    builder.resume();
    await builder.idle();
    assert.equal(store.byId(first.id)?.channel, first.id);
    assert.deepEqual([store.byId(second.id)?.build?.state, store.byId(second.id)?.channel], ["failed", null]);
    assert.match(store.byId(second.id)?.build?.error ?? "", /limit of 1 automatic builds a day/);
  });

  it("revises the kit from the customer's change requests into a new folder, and opens the changed parts again", async () => {
    const { store, builder, options } = setup("revise", 20, null);
    const site = createPublicServer(options);
    try {
      const base = await serve(site);
      const link = (await fetch(`${base}/intake`, form(GOOD))).headers.get("location")!;
      await builder.idle();
      const id = store.list()[0].id;
      const decide = (values: Record<string, string>) => fetch(`${base}${link}/decision`, form(values));
      await decide({ section: "name", decision: "change", note: "A shorter name" });
      assert.equal((await fetch(`${base}${link}/revise`, form({}))).status, 409, "every part is decided before changes are sent");
      for (const s of SECTIONS) if (s.id !== "name") await decide({ section: s.id, decision: "approve" });
      assert.match(await (await fetch(base + link)).text(), /5 approved, 1 to change[\s\S]*Send 1 change<[\s\S]*Revision 1 of 3/);

      let release = () => {};
      hold = new Promise<void>((r) => (release = r));
      assert.equal((await fetch(`${base}${link}/revise`, form({}))).status, 303);
      const waiting = await (await fetch(base + link)).text();
      assert.match(waiting, /Your changes are being made/);
      assert.match(waiting, /http-equiv="refresh"/);
      assert.equal((await decide({ section: "host", decision: "clear" })).status, 409);
      release();
      await builder.idle();

      const order = store.byId(id)!;
      assert.deepEqual([order.channel, order.rounds, order.build?.state], [`${id}-r1`, 1, "done"]);
      assert.equal(order.decisions.name, undefined, "the changed part is open again");
      assert.equal(order.decisions.host?.decision, "approve", "the approved parts stay approved");
      assert.equal(channelExists(built, id), true, "the earlier version is kept");
      assert.equal(loadChannel(built, id).doc.data.name, `Test ${id}`);
      const call = revised[revised.length - 1];
      assert.deepEqual(call.requests, [{ about: "The name, the promise and the point", note: "A shorter name" }]);
      assert.deepEqual(call.keep, [`channels/${id}-r1/theme.json`, `channels/${id}-r1/characters/bot/model.json`]);
      assert.deepEqual(readJson(join(built.channelDir(`${id}-r1`), "theme.json")), order.design?.theme);
      assert.match(await (await fetch(base + link)).text(), /Revised name[\s\S]*5 of 6 decided/);

      broken = true;
      await decide({ section: "name", decision: "change", note: "Shorter still" });
      await fetch(`${base}${link}/revise`, form({}));
      await builder.idle();
      const failed = store.byId(id)!;
      assert.deepEqual([failed.channel, failed.rounds, failed.build?.state, failed.build?.kind, failed.decisions.name?.note], [`${id}-r1`, 2, "failed", "revise", "Shorter still"]);
      assert.match(await (await fetch(base + link)).text(), /Your changes did not finish[\s\S]*Send 1 change</);
      broken = false;
      store.update(id, (o) => (o.rounds = 3));
      assert.match(await (await fetch(base + link)).text(), /We make these by hand/);
      assert.equal((await fetch(`${base}${link}/revise`, form({}))).status, 409);
    } finally {
      broken = false;
      site.close();
    }
  });

  it("at start, marks a revision that was cut off as failed instead of running it again", () => {
    const { store, builder } = setup("cut-revise", 20, null);
    const r = validateIntake(GOOD, OFFER);
    assert.ok(r.intake);
    const order = store.create(r.intake, r.design, false, null);
    store.update(order.id, (o) => {
      o.channel = "kit-demo";
      o.build = { kind: "revise", state: "building", attempts: 1, at: "2026-01-01T00:00:00.000Z" };
    });
    builder.resume();
    assert.deepEqual([store.byId(order.id)?.build?.state, store.byId(order.id)?.channel], ["failed", "kit-demo"]);
  });

  it("after the kit is approved, writes the script, has the customer check its facts, and only then makes the video", async () => {
    const { store, builder, options } = setup("video", 20, null);
    const site = createPublicServer(options);
    try {
      const base = await serve(site);
      const link = (await fetch(`${base}/intake`, form(GOOD))).headers.get("location")!;
      await builder.idle();
      const id = store.list()[0].id;
      const page = async () => (await fetch(base + link)).text();
      const facts = (values: Record<string, string>) => fetch(`${base}${link}/facts`, form(values));
      for (const s of SECTIONS) await fetch(`${base}${link}/decision`, form({ section: s.id, decision: "approve" }));
      assert.equal(loadChannel(built, id).doc.data.status, "draft");
      assert.equal((await facts({ decision: "approve" })).status, 409, "no facts before there is a script");

      let release = () => {};
      hold = new Promise<void>((r) => (release = r));
      assert.equal((await fetch(`${base}${link}/approve`, form({}))).status, 303);
      const writing = await page();
      assert.match(writing, /Under way[\s\S]*Writing the script · step 2 of/);
      assert.match(writing, /class="tag busy"><i><\/i>Making a video/);
      assert.match(writing, /http-equiv="refresh"/);
      const channel = loadChannel(built, id).doc.data;
      assert.deepEqual([channel.status, channel.approved_by], ["active", "Sam Example"], "the customer's approval of the kit makes the channel active");
      release();
      await builder.idle();

      assert.deepEqual([store.byId(id)?.video?.state, store.byId(id)?.video?.episode], ["facts", EPISODE]);
      const checking = await page();
      assert.match(checking, /Needs you[\s\S]*Check the facts[\s\S]*href="[^"]*view=new">Check the facts/);
      const step = async () => (await fetch(`${base}${link}?view=new`)).text();
      assert.match(await step(), /<span class="n">1<\/span>[\s\S]*<span class="n">2<\/span>[\s\S]*A tiny ball sits in the tip[\s\S]*class="proof">A ballpoint pen&#39;s tip holds a small metal ball\.[\s\S]*href="https:\/\/example\.org\/ballpoint"[\s\S]*name="line" value="2"[\s\S]*Simpler words[\s\S]*Rewrite this line[\s\S]*Looks right · make the video[\s\S]*Rewrite 1 of 3/);
      assert.match(checking, /class="tag busy"><i><\/i>Making a video/, "a video waiting for its facts is still under way");
      assert.doesNotMatch(checking, /http-equiv="refresh"|<video/);
      assert.equal(existsSync(videoPath(built, id, EPISODE)), false, "nothing is made before the facts are approved");

      assert.equal((await facts({ decision: "maybe" })).status, 400);
      assert.equal((await facts({ decision: "change", note: " " })).status, 400);
      assert.equal((await facts({ decision: "change", line: "9", note: "Shorter" })).status, 400, "only a line of this script");
      // A change asked for under a line names that line for the writer.
      assert.equal((await facts({ decision: "change", line: "2", note: "The ball is tungsten carbide, say so" })).status, 303);
      await builder.idle();
      const dir = join(episodesDir(loadChannel(built, id)), EPISODE);
      assert.deepEqual([store.byId(id)?.video?.state, store.byId(id)?.video?.rounds, made[made.length - 1].rewrite], ["facts", 1, true]);
      assert.match(made[made.length - 1].note ?? "", /^Line 2 \(“A tiny ball sits in the tip[^”]*”\), change only this line: The ball is tungsten carbide, say so$/);
      assert.match(await step(), /Inside a pen, corrected[\s\S]*Rewrite 2 of 3/);

      assert.equal((await facts({ decision: "approve" })).status, 303);
      await builder.idle();
      assert.equal(store.byId(id)?.video?.state, "done");
      const check = readFactcheck(dir);
      assert.deepEqual([check?.status, check?.approvedBy], ["approved", "Sam Example"]);
      const done = await page();
      assert.match(done, new RegExp(`Videos[\\s\\S]*class="vt" href="[^"]*view=video&amp;e=${EPISODE}"`));
      const watch = await (await fetch(`${base}${link}?view=video&e=${EPISODE}`)).text();
      assert.match(watch, new RegExp(`<video controls[^>]*/video/${EPISODE}[\\s\\S]*Download video[\\s\\S]*Before you post[\\s\\S]*AI label`));
      assert.equal((await fetch(`${base}${link}?view=video&e=no-such-video`)).status, 404, "only this channel’s finished videos have a page");
      assert.match(done, /class="tag ok"><i><\/i>Active/);
      assert.doesNotMatch(done, /Check the facts|http-equiv="refresh"/);
      assert.equal(await (await fetch(`${base}${link}/video/${EPISODE}`)).text(), "0123456789");
      assert.equal((await facts({ decision: "approve" })).status, 409);
    } finally {
      site.close();
    }
  });

  it("records a failed video on the order, tells the customer, and continues it only when asked", async () => {
    const { store, builder, options } = setup("video-fail", 20, null);
    const site = createPublicServer(options);
    const admin = createAdminServer(options);
    try {
      const base = await serve(site);
      const adminBase = await serve(admin);
      const link = (await fetch(`${base}/intake`, form(GOOD))).headers.get("location")!;
      await builder.idle();
      const id = store.list()[0].id;
      for (const s of SECTIONS) await fetch(`${base}${link}/decision`, form({ section: s.id, decision: "approve" }));
      broken = true;
      await fetch(`${base}${link}/approve`, form({}));
      await builder.idle();
      assert.deepEqual([store.byId(id)?.video?.state, store.byId(id)?.video?.failed_at, store.byId(id)?.video?.error], ["failed", "writing", "the writer is down"]);
      // The customer sees the step it stopped at, why, and a way to continue from that step.
      assert.match(await (await fetch(base + link)).text(), /The last video did not finish[\s\S]*being written[\s\S]*<b>Why:<\/b> the writer is down[\s\S]*\/retry"><button type="submit" class="btn sm">Try again from that step/);
      assert.match(await (await fetch(adminBase)).text(), /First video: failed[\s\S]*the writer is down[\s\S]*Make the video again/);
      builder.resume();
      await builder.idle();
      assert.equal(store.byId(id)?.video?.state, "failed", "a failed video is not started again by itself");
      // Trying again while the cause is still there stops again, with the reason; nothing is retried behind their back.
      assert.equal((await fetch(`${base}${link}/retry`, form({}))).status, 303);
      await builder.idle();
      assert.deepEqual([store.byId(id)?.video?.state, store.byId(id)?.video?.error], ["failed", "the writer is down"]);

      broken = false;
      assert.equal((await fetch(`${adminBase}/orders/${id}/video`, form({}))).status, 303);
      await builder.idle();
      assert.equal(store.byId(id)?.video?.state, "facts");
      store.update(id, (o) => (o.video!.rounds = 3));
      assert.match(await (await fetch(`${base}${link}?view=new`)).text(), /rewritten 3 times/);
      assert.equal((await fetch(`${base}${link}/facts`, form({ decision: "change", note: "Again" }))).status, 409);

      broken = true;
      await fetch(`${base}${link}/facts`, form({ decision: "approve" }));
      await builder.idle();
      assert.deepEqual([store.byId(id)?.video?.state, store.byId(id)?.video?.failed_at], ["failed", "making"]);
      broken = false;
      await fetch(`${adminBase}/orders/${id}/video`, form({}));
      await builder.idle();
      assert.equal(store.byId(id)?.video?.state, "done", "it continues from the step that failed");
    } finally {
      broken = false;
      site.close();
      admin.close();
    }
  });

  it("opens the channel's dashboard after the kit is approved: make videos from ideas, ask for ideas, keep or skip them, pause", async () => {
    const { store, builder, options } = setup("dashboard", 20, null);
    const site = createPublicServer(options);
    try {
      const base = await serve(site);
      const link = (await fetch(`${base}/intake`, form(GOOD))).headers.get("location")!;
      await builder.idle();
      const id = store.list()[0].id;
      const page = async (view = "") => (await fetch(base + link + (view ? `?view=${view}` : ""))).text();
      const post = (action: string, values: Record<string, string>) => fetch(`${base}${link}/${action}`, form(values));
      for (const s of SECTIONS) await post("decision", { section: s.id, decision: "approve" });
      await post("approve", {});
      await builder.idle();
      await post("facts", { decision: "approve" });
      await builder.idle();
      assert.equal(store.byId(id)?.video?.state, "done");

      // The approved channel is its own app now: no order greeting, steps, brief or privacy note.
      const home = await page();
      assert.match(home, /class="sbar"[\s\S]*>Videos<[\s\S]*>Ideas<[\s\S]*Look &amp; voice<[\s\S]*New video[\s\S]*class="tag ok"><i><\/i>Active[\s\S]*class="mtabs"/);
      assert.match(home, /Videos[\s\S]*1 made[\s\S]*class="vt" href=[\s\S]*class="vt add"[\s\S]*Up next[\s\S]*A zipper[\s\S]*>Make it<[\s\S]*Suggest ideas/);
      assert.doesNotMatch(home, /Hello,|class="track"|Your brief|private to you|In production/);
      assert.match(await page("settings"), /Pause the channel/);
      assert.equal((await fetch(`${base}${link}?view=nope`)).status, 404);

      // A video from a chosen idea: written, its facts checked by the customer, then made. One at a time.
      assert.equal((await post("make", { idea: "no-such-idea" })).status, 409);
      const made = await post("make", { idea: "a-zipper" });
      assert.deepEqual([made.status, made.headers.get("location")], [303, `${link}?view=new`], "making a video opens the New video flow");
      await builder.idle();
      assert.match(await page("new"), /<li class="done">Topic<\/li><li aria-current="step">Script<\/li><li>Video<\/li>[\s\S]*<span class="n">1<\/span>[\s\S]*class="proof">[\s\S]*Looks right · make the video[\s\S]*Rewrite 1 of 3/);
      assert.deepEqual([store.byId(id)?.video?.state, store.byId(id)?.video?.idea, store.byId(id)?.video?.episode], ["facts", "a-zipper", "2026-01-02-a-zipper"]);
      const checking = await page();
      assert.match(checking, /Needs you[\s\S]*Check the facts[\s\S]*href="[^"]*view=new">Check the facts/);
      assert.match(checking, /disabled title="A video is under way">Make it/);
      assert.match((await (await post("make", { idea: "a-ballpoint-pen" })).text()), /already under way/);
      assert.equal((await post("facts", { decision: "approve" })).headers.get("location"), `${link}?view=new`);
      await builder.idle();
      assert.equal(store.byId(id)?.video?.state, "done");
      assert.match(await page("new"), /Your new video is ready[\s\S]*<video[\s\S]*Download the video[\s\S]*Pick a new topic[\s\S]*1 tip for the next video[\s\S]*Move the caption above the &lt;label&gt;[\s\S]*Up next[\s\S]*Make it next/);
      assert.match(await page("new&pick"), /What’s this one about\?[\s\S]*name="topic"[\s\S]*start from one of your ideas[\s\S]*type="radio" name="idea" value="a-ballpoint-pen" form="make"[\s\S]*form="make" class="go">Write the script/);
      assert.equal((await page("videos")).match(/class="vt" /g)?.length, 2, "both videos are in Videos");

      // Not wanted: the idea is marked rejected, never deleted.
      assert.equal((await post("idea", { idea: "a-ballpoint-pen" })).status, 303);
      const ideas = readText(loadChannel(built, id).ideasPath);
      assert.match(ideas, /## a-ballpoint-pen[\s\S]*?status: rejected/);

      // New ideas come back as suggestions; kept ones join the ideas, skipped ones stay in the draft as rejected.
      assert.equal((await post("suggest", { direction: "  things in the kitchen " })).status, 303);
      await builder.idle();
      assert.equal(store.byId(id)?.suggest?.state, "done");
      assert.equal(suggested.at(-1)?.direction, "things in the kitchen", "the customer's topic reaches the writer");
      const suggestedPage = await page("ideas");
      assert.match(suggestedPage, /Suggested for you[\s\S]*How a glass bottle is blown 1[\s\S]*Key fact<\/span>Glass is mostly sand melted at about 1,700 °C\.[\s\S]*href="https:\/\/www\.britannica\.com\/technology\/glass"[^>]*rel="noopener noreferrer nofollow">Check it at britannica\.com[\s\S]*Keep[\s\S]*Why a zip never slips 1/);
      const draft = `drafts/${id}/ideas/2026-01-01-batch.md`;
      assert.equal((await post("proposal", { draft, idea: "glass-bottles-1", decision: "keep" })).status, 303);
      assert.equal((await post("proposal", { draft, idea: "zips-1", decision: "skip" })).status, 303);
      assert.equal((await post("proposal", { draft, idea: "zips-1", decision: "keep" })).status, 409, "a skipped suggestion is decided");
      assert.equal((await post("proposal", { draft: "../../orders.json", idea: "zips-1", decision: "keep" })).status, 409);
      const after = await page("ideas");
      assert.doesNotMatch(after, /Suggested for you/);
      assert.match(after, /Waiting to be made[\s\S]*How a glass bottle is blown 1/);
      assert.doesNotMatch(after, /Why a zip never slips 1/);
      assert.match(readText(built.path(draft)), /## zips-1[\s\S]*?status: rejected/);
      assert.match(readText(loadChannel(built, id).ideasPath), /## glass-bottles-1[\s\S]*?fact: Glass is mostly sand[\s\S]*?fact_source: https:\/\/www\.britannica\.com/, "a kept idea keeps its fact");
      assert.match(await page("new&pick"), /start from one of your ideas[\s\S]*How a glass bottle is blown 1[\s\S]*Key fact/);
      await post("suggest", {});
      await builder.idle();
      assert.equal((await post("proposal", { draft: `drafts/${id}/ideas/2026-01-02-batch.md`, decision: "keep-all" })).status, 303);
      assert.match(await page("ideas"), /Waiting to be made[\s\S]*How a glass bottle is blown 2[\s\S]*Why a zip never slips 2/, "Keep all keeps the whole batch");
      assert.match(await (await post("suggest", { direction: "x".repeat(161) })).text(), /160 characters/);
      await post("suggest", {});
      await builder.idle();
      assert.match(await (await post("suggest", {})).text(), /3 times today/, "a paid request has a daily limit");

      // Paused: no new videos until it is resumed.
      assert.equal((await post("channel", { status: "paused" })).status, 303);
      assert.equal(loadChannel(built, id).doc.data.status, "paused");
      assert.match(await page(), /class="tag"><i><\/i>Paused[\s\S]*The channel is paused[\s\S]*Resume the channel/);
      assert.match(await page("settings"), /Resume the channel/);
      assert.match(await (await post("make", { topic: " ", idea: "" })).text(), /Type a topic or pick one of your ideas/);
      assert.match(await (await post("make", { topic: "", idea: "glass-bottles-1" })).text(), /channel is paused/, "with no topic typed, the picked idea is made");
      await post("channel", { status: "active" });

      // A video on the customer's own topic: it joins the ideas, marked as theirs, and is made like any other.
      assert.match(await (await post("make", { topic: "hi" })).text(), /a few words/);
      assert.equal((await post("make", { topic: "  Why the sea   is salty " })).status, 303);
      await builder.idle();
      assert.equal(store.byId(id)?.video?.idea, "why-the-sea-is-salty");
      assert.match(readText(loadChannel(built, id).ideasPath), /## why-the-sea-is-salty\n- title: Why the sea is salty[\s\S]*?by: customer/);
      assert.match(await (await post("make", { topic: "Why ice floats on water" })).text(), /already under way/, "one video at a time, own topics too");
      assert.match(readText(loadChannel(built, id).ideasPath), /## why-the-sea-is-salty/);
      assert.doesNotMatch(readText(loadChannel(built, id).ideasPath), /why-ice-floats/, "a refused topic is not added to the ideas");
    } finally {
      site.close();
    }
  });

  it("stops a painted video at its storyboard: the customer changes shots, the host and captions, then approves", async () => {
    const { store, builder, options } = setup("storyboard", 20, null);
    const site = createPublicServer(options);
    boards = true;
    try {
      const base = await serve(site);
      const link = (await fetch(`${base}/intake`, form(GOOD))).headers.get("location")!;
      await builder.idle();
      const id = store.list()[0].id;
      // This channel tells its videos in painted shots, in the world the customer's look carries.
      const seriesDoc = [...loadChannel(built, id).series.values()][0].abs;
      writeText(seriesDoc, readText(seriesDoc).replace("render-3d-explainer", "render-themed"));
      const page = async (view = "") => (await fetch(base + link + (view ? `?view=${view}` : ""))).text();
      const post = (action: string, values: Record<string, string>) => fetch(`${base}${link}/${action}`, form(values));
      for (const s of SECTIONS) await post("decision", { section: s.id, decision: "approve" });
      await post("approve", {});
      await builder.idle();
      assert.equal((await post("storyboard/approve", {})).status, 409, "no storyboard before the facts are approved");
      // Held, to see the step it is on while it works.
      let release = () => {};
      hold = new Promise<void>((r) => (release = r));
      await post("facts", { decision: "approve" });
      assert.equal(store.byId(id)?.video?.state, "painting", "approved facts go to painting, not straight to the video");
      release();
      await builder.idle();
      assert.equal(store.byId(id)?.video?.state, "storyboard");
      const dir = join(episodesDir(loadChannel(built, id)), EPISODE);

      const board = await page("new");
      assert.match(board, /<li class="done">Topic<\/li><li class="done">Script<\/li><li aria-current="step">Pictures<\/li><li>Video<\/li>/);
      assert.match(board, /\d pictures<\/h1>[\s\S]*id="t-hook-1" href="#s-hook-1"[\s\S]*\/shot\/hook-1\?v=[0-9a-f]{12}[\s\S]*id="s-hook-1"[\s\S]*Shot 1 of [\s\S]*Why doesn&#39;t your pen leak\?[\s\S]*name="repaint" value="1"[\s\S]*name="host_1" checked[\s\S]*id="s-explain-1"[\s\S]*Cuts in on the word[\s\S]*Voice speed[\s\S]*value="normal" aria-pressed="true"[\s\S]*Make the video/);
      assert.doesNotMatch(board, /id="captions"|storyboard\/captions/, "captions are set on the finished video, not on the storyboard");
      assert.match(board, /10 repaints left/);
      assert.match(await page(), /Needs you[\s\S]*Check the pictures[\s\S]*href="[^"]*view=new">Check the pictures/);
      const picture = await fetch(`${base}${link}/shot/hook-1`);
      assert.deepEqual([picture.status, picture.headers.get("content-type"), await picture.text()], [200, "image/jpeg", "The host stares at a giant pen dripping blue ink | host: true"]);
      assert.equal((await fetch(`${base}${link}/shot/../../orders`)).status, 404);

      // One part: the first shot shows something else without the host, the second is removed. Only the changed shot is repainted.
      hold = new Promise<void>((r) => (release = r));
      const edit = await post("storyboard/beat", { beat: "explain", show_1: "A tiny steel ball rolls inside the tip of a pen", show_2: "Thick blue ink waits behind the ball", at_2: "ink", remove_2: "on" });
      assert.deepEqual([edit.status, edit.headers.get("location")], [303, `${link}?view=new#s-explain-1`]);
      assert.deepEqual([store.byId(id)?.video?.state, store.byId(id)?.video?.repaints], ["painting", 1]);
      release();
      await builder.idle();
      assert.equal(store.byId(id)?.video?.state, "storyboard");
      const explain = readJson<Script>(join(dir, "script.json")).beats.find((b) => b.id === "explain")!;
      assert.deepEqual((explain.visual as unknown as { shots: Shot[] }).shots, [{ show: "A tiny steel ball rolls inside the tip of a pen", host: false }]);
      assert.match(readText(join(dir, "shots", "explain-1.jpg")), /rolls inside the tip/);
      assert.match(await page("new"), /9 repaints left/);

      // "New picture": the same shot, painted once more. It counts as a repaint.
      assert.equal((await post("storyboard/beat", { beat: "explain", show_1: "A tiny steel ball rolls inside the tip of a pen", repaint: "1" })).status, 303);
      await builder.idle();
      assert.deepEqual([store.byId(id)?.video?.state, store.byId(id)?.video?.repaints], ["storyboard", 2]);
      assert.match(await page("new"), /8 repaints left/);

      // Refused, with the reason, and nothing changes: the host left out of a shot whose words still say "the host"; an added shot with no word to cut in on.
      assert.match(await (await post("storyboard/beat", { beat: "hook", show_1: "The host stares at a giant pen dripping blue ink" })).text(), /leaves the host out, but its words say &quot;the host&quot;/);
      assert.match(await (await post("storyboard/beat", { beat: "hook", show_1: "The host stares at a giant pen dripping blue ink", host_1: "on", show_2: "A puddle of ink on a desk" })).text(), /Pick the word shot 2 cuts in on/);
      assert.equal(store.byId(id)?.video?.repaints, 2);

      // Repaints are paid: past the limit, a change that needs one is refused.
      store.update(id, (o) => {
        o.video = { ...o.video!, repaints: 10 };
      });
      assert.match(await (await post("storyboard/beat", { beat: "payoff", show_1: "A round pen cap rolls across a desk" })).text(), /0 repaints left/);

      // Speed: one of the four, shown as chosen.
      assert.match(await page("new"), /value="normal" aria-pressed="true"/);
      assert.match(await (await post("storyboard/speed", { pace: "warp" })).text(), /Choose one of the speeds/);
      assert.equal((await post("storyboard/speed", { pace: "faster" })).status, 303);
      assert.equal(readStoryboard(dir)?.pace, "faster");
      assert.match(await page("new"), /value="faster" aria-pressed="true"/);

      assert.equal((await post("storyboard/approve", {})).status, 303);
      assert.deepEqual([readStoryboard(dir)?.status, readStoryboard(dir)?.approved_by], ["approved", "Sam Example"]);
      await builder.idle();
      assert.equal(store.byId(id)?.video?.state, "done");

      // A finished video can be opened again at its storyboard. Left as it is, nothing is made and no version is kept.
      const now = () => [store.byId(id)?.video?.state, store.byId(id)?.video?.revising];
      const used = store.byId(id)!.video!.repaints;
      assert.match(await (await fetch(`${base}${link}?view=video&e=2026-01-01-first`)).text(), /\/revise-video"><input type="hidden" name="episode" value="2026-01-01-first"><button type="submit" class="act line">Change something/);
      assert.match(await (await post("revise-video", { episode: "2026-01-09-not-made" })).text(), /That video is not available/);
      assert.equal((await post("revise-video", { episode: EPISODE })).status, 303);
      assert.deepEqual(now(), ["storyboard", true]);
      assert.equal(store.byId(id)?.video?.repaints, used, "repaints are counted per video, across its revisions");
      assert.ok(readJson<{ repaints: number }>(join(dir, "repaints.json")).repaints > 0, "the video's repaints are recorded with it");
      assert.match(await page("new"), /is finished\. Change a picture[\s\S]*Nothing is changed yet\.[\s\S]*kept as an earlier version[\s\S]*Leave it as it is/);
      assert.match(await (await fetch(`${base}${link}?view=video&e=2026-01-01-first`)).text(), /class="act line" disabled title="A video is under way">Change something/);
      const runs = made.length;
      assert.equal((await post("storyboard/cancel", {})).status, 303);
      assert.deepEqual(now(), ["done", undefined]);
      assert.deepEqual([videoVersions(built, id, EPISODE), made.length], [[], runs]);

      // With its speed changed, a new version is made (the facts and the storyboard's shots stay) and the old video is kept.
      await post("revise-video", { episode: EPISODE });
      assert.equal((await post("storyboard/speed", { pace: "normal" })).status, 303);
      assert.match(await page("new"), /Make the new version/);
      assert.match(await (await post("storyboard/cancel", {})).text(), /You changed this video/);
      assert.equal((await post("storyboard/approve", {})).status, 303);
      await builder.idle();
      assert.deepEqual(now(), ["done", undefined]);
      assert.equal(readStoryboard(dir)?.pace, undefined);
      assert.deepEqual(videoVersions(built, id, EPISODE), [1]);
      assert.match(await (await fetch(`${base}${link}?view=video&e=2026-01-01-first`)).text(), /video\/2026-01-01-first\/clean\?r=1"[\s\S]*Earlier versions: <a href="[^"]+\/video\/2026-01-01-first\/v\/1">v1<\/a>/);
      assert.equal((await fetch(`${base}${link}/video/${EPISODE}/v/1`)).status, 200);
      assert.equal((await fetch(`${base}${link}/video/${EPISODE}/v/2`)).status, 404);

      // The finished video's captions step: its clean render plays with the captions drawn over it live, and saving
      // puts them into the video to download without making anything else again.
      const watch = await (await fetch(`${base}${link}?view=video&e=${EPISODE}`)).text();
      assert.match(watch, /id="cap-video"[^>]*src="[^"]+\/video\/2026-01-01-first\/clean\?r=1"[\s\S]*id="cap-layer"[\s\S]*id="cap-form"[\s\S]*name="font"[\s\S]*name="text_color" value="#ffffff"[\s\S]*name="hide_payoff"[\s\S]*Save captions[\s\S]*id="cap-data">\{"width":1080[\s\S]*"words":\[\{"t":"Why"[\s\S]*captions-live\.js/);
      assert.equal((await fetch(`${base}${link}/video/${EPISODE}/clean`)).status, 200);
      assert.equal((await fetch(`${base}/assets/font/cap/heebo-he.woff2`)).status, 200);
      assert.equal((await fetch(`${base}/assets/font/cap/comic-sans.woff2`)).status, 404);
      assert.match(await (await post(`video/${EPISODE}/captions`, { show: "on", size: "huge", place: "bottom", case: "normal" })).text(), /caption settings are not valid/);
      assert.match(await (await post(`video/${EPISODE}/captions`, { show: "on", size: "large", place: "bottom", case: "normal", font: "comic-sans" })).text(), /caption settings are not valid/);
      const runsBefore = made.length;
      assert.equal((await post(`video/${EPISODE}/captions`, { show: "on", size: "large", place: "middle", case: "upper", font: "heebo", text_color: "#ffee00", own_color: "on", color: "#ff0055", hide_payoff: "on" })).status, 303);
      assert.deepEqual(videoCaptions(dir), { show: true, size: "large", place: "middle", case: "upper", font: "heebo", text_color: "#ffee00", color: "#ff0055", hide_beats: ["payoff"] });
      await builder.idle();
      assert.deepEqual([store.byId(id)?.restyle, baked.at(-1), made.length], [undefined, `${id}/${EPISODE}`, runsBefore], "only the captions are drawn again");
      assert.ok(storyboardApproved(dir, readJson<Script>(join(dir, "script.json"))), "changing the captions leaves the storyboard's approval as it was");
      assert.match(await (await fetch(`${base}${link}?view=video&e=${EPISODE}`)).text(), /name="font" id="cap-font"><option[\s\S]*value="heebo" selected[\s\S]*value="#ffee00"[\s\S]*name="hide_payoff" checked/);
      // While they are drawn, and when that stopped, the page says so; another save waits for the one under way.
      const restyle = (state: "working" | "failed") => store.update(id, (o) => {
        o.restyle = { episode: EPISODE, state, at: "2026-01-01T00:00:00.000Z", ...(state === "failed" ? { error: "the renderer is down" } : {}) };
      });
      restyle("working");
      assert.match(await (await fetch(`${base}${link}?view=video&e=${EPISODE}`)).text(), /Putting your saved captions into the video/);
      assert.match(await (await post(`video/${EPISODE}/captions`, { show: "on", size: "small", place: "bottom", case: "normal" })).text(), /still being put into a video/);
      restyle("failed");
      assert.match(await (await fetch(`${base}${link}?view=video&e=${EPISODE}`)).text(), /could not be put into the video \(the renderer is down\)/);
      store.update(id, (o) => {
        delete o.restyle;
      });

      // Settings: the channel's caption defaults, and the host off screen (then no shot may show it) and back.
      assert.match(await page("settings"), /Save caption settings[\s\S]*Take the host off screen/);
      assert.equal((await post("captions", { case: "normal", size: "small", place: "bottom" })).status, 303);
      assert.deepEqual(store.byId(id)?.captions, { show: false, size: "small", place: "bottom", case: "normal", hide_beats: [] });
      assert.equal((await post("host", { on: "0" })).status, 303);
      const theme = () => readJson<{ world: { host?: boolean } }>(join(loadChannel(built, id).dir, "theme.json")).world;
      assert.equal(theme().host, false);
      assert.match(await page("settings"), /The host is off screen[\s\S]*Put the host on screen/);
      await post("host", { on: "1" });
      assert.equal(theme().host, undefined);
      // Optional: the host as the main character. Off by default, not offered while it is off screen, dropped when it leaves the screen.
      const lead = () => readJson<{ world: { host_lead?: boolean } }>(join(loadChannel(built, id).dir, "theme.json")).world.host_lead;
      assert.equal(lead(), undefined);
      assert.match(await page("settings"), /Optional: make the host the main character[\s\S]*name="lead" value="1"[\s\S]*Make the host the main character/);
      assert.equal((await post("host", { lead: "1" })).status, 303);
      assert.equal(lead(), true);
      assert.match(await page("settings"), /The host is the main character[\s\S]*name="lead" value="0"[\s\S]*Show the host only where a shot calls for it/);
      // A video made before that, with a part that never shows the host, can't be revised under the new setting.
      assert.match(await (await post("revise-video", { episode: EPISODE })).text(), /made with a different host setting[\s\S]*main character/);
      assert.equal(store.byId(id)?.video?.state, "done");
      await post("host", { lead: "0" });
      assert.equal(lead(), undefined);
      await post("host", { lead: "1" });
      await post("host", { on: "0" });
      assert.deepEqual([theme().host, lead()], [false, undefined]);
      assert.doesNotMatch(await page("settings"), /main character/);
      assert.match(await (await post("host", { lead: "1" })).text(), /Put the host on screen first/);
      await post("host", { on: "1" });

      // A quality check the finished video missed (how fast the hook lands) is a note on it, shown before the review's.
      writeJson(join(dir, "qa", "automated.json"), { checks: [{ id: "format", label: "Format", pass: true, detail: "1080×1920" }, { id: "hook-line", label: "Hook: first line lands in 2 s", pass: false, detail: '"Rotten grapes, great wine." ends at 2.34s (limit 2s)' }, { id: "cut-off", label: "Nothing cut off", pass: false, detail: "headline:hook:text-overflow (22 frames)" }] });
      assert.match(await (await fetch(`${base}${link}?view=video&e=${EPISODE}`)).text(), /Before you post[\s\S]*The first line, “Rotten grapes, great wine\.”, takes 2\.3 seconds to say\. Under 2 seconds keeps more viewers watching\.[\s\S]*Some on-screen text is cut off/);
      assert.doesNotMatch(await (await fetch(`${base}${link}?view=video&e=${EPISODE}`)).text(), /headline:hook|22 frames|limit 2s/, "the notes are advice, not the measurement");
      rmSync(join(dir, "qa", "automated.json"));

      // The review's reading of banned topics is a note on the finished video (first), not a reason to stop it.
      writeJson(join(dir, "qa-review.json"), { render_hash: "x", tone: { pass: true, notes: "" }, banned_topics: { pass: false, notes: "A glass poured until it spills reads as excess." }, visuals: { pass: true, notes: "" }, character: { pass: true, notes: "" }, overall: "fail", fixes: ["Show a modest pour."], learnings: [] });
      assert.match(await (await fetch(`${base}${link}?view=video&e=${EPISODE}`)).text(), /Before you post[\s\S]*Banned topics: A glass poured until it spills reads as excess\.[\s\S]*Show a modest pour\./);

      // Videos that failed made nothing, so they don't use up the day; finished ones do.
      const today = (n: number, status: "in-progress" | "done") =>
        writeJson(join(episodesDir(loadChannel(built, id)), `today-${n}`, "episode.json"), { id: `today-${n}`, channel: id, series: "inside", idea: `today-${n}`, title: "x", created: new Date().toISOString(), updated: new Date().toISOString(), status, steps: {} });
      for (const n of [1, 2, 3]) today(n, "in-progress");
      assert.equal(builder.dashboard(store.byId(id)!).videosLeftToday, 3, "three failed videos today leave all three");
      for (const n of [1, 2, 3]) today(n, "done");
      assert.equal(builder.dashboard(store.byId(id)!).videosLeftToday, 0);
      assert.match(await (await post("make", { idea: "a-zipper" })).text(), /made 3 videos today/);
    } finally {
      boards = false;
      site.close();
    }
  });

  it("at start, makes the video of an approved kit, continues one that was cut off, and gives up on one cut off twice", async () => {
    const { store, builder } = setup("video-resume", 20, null);
    const r = validateIntake(GOOD, OFFER);
    assert.ok(r.intake);
    const order = (channel: string) => {
      const o = store.create(r.intake, r.design, false, null);
      return store.update(o.id, (x) => {
        x.channel = channel;
        x.kit_approved = "2026-01-01T00:00:00.000Z";
      }).id;
    };
    for (const slug of ["resume-new", "resume-cut", "resume-twice"]) {
      const from = tempWorkspace();
      makeChannel(from, slug, { status: "active" });
      cpSync(from.channelDir(slug), built.channelDir(slug), { recursive: true });
    }
    const fresh = order("resume-new");
    const cut = order("resume-cut");
    const twice = order("resume-twice");
    // Linked by hand to a channel that was not built here: its video is the owner's to make.
    const byHand = order("kit-demo");
    store.update(cut, (o) => (o.video = { state: "writing", attempts: 1, rounds: 0, at: "2026-01-01T00:00:00.000Z" }));
    store.update(twice, (o) => (o.video = { state: "making", episode: EPISODE, attempts: 2, rounds: 0, at: "2026-01-01T00:00:00.000Z" }));
    builder.resume();
    await builder.idle();
    assert.equal(store.byId(fresh)?.video?.state, "facts");
    assert.deepEqual([store.byId(cut)?.video?.state, store.byId(cut)?.video?.attempts], ["facts", 2]);
    assert.deepEqual([store.byId(twice)?.video?.state, store.byId(twice)?.video?.failed_at], ["failed", "making"]);
    assert.match(store.byId(twice)?.video?.error ?? "", /cut off 2 times/);
    assert.equal(store.byId(byHand)?.video, undefined);
  });
});
