/**
 * Start the storefront: `npm run storefront`.
 *   STOREFRONT_NAME          product name shown to customers (default "Channel Studio")
 *   STOREFRONT_PORT          public site port (default 4300)
 *   STOREFRONT_HOST          public site address (default 127.0.0.1; use 0.0.0.0 to accept visitors)
 *   STOREFRONT_ADMIN_PORT    orders page port, always bound to 127.0.0.1 (default 4301)
 *   STOREFRONT_PAYMENT_URL   hosted payment page, e.g. a Stripe payment link (optional; without it new orders start without payment)
 *   STOREFRONT_PUBLIC_URL    the address customers use, for the links shown in admin
 *   STOREFRONT_DEMO_CHANNEL  the channel shown on the demo page (default "no-way-really")
 *   STOREFRONT_AUTOBUILD     "1" = build each order's channel by itself with the Claude API (paid; needs ANTHROPIC_API_KEY)
 *   STOREFRONT_BUILDS_PER_DAY  the most automatic builds started in one day, UTC (default 20)
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *                            switch on "Sign in with Google" and accounts (set both, or neither). In Google's
 *                            console the authorised redirect URI is STOREFRONT_PUBLIC_URL + /auth/google/callback
 */
import { channelExists } from "../core/channels.ts";
import { ENGINE_DIR, Workspace } from "../core/workspace.ts";
import { AccountStore } from "./accounts.ts";
import { Builder, buildWorkspace, claudeDrafter } from "./builder.ts";
import { loadCatalog } from "./catalog.ts";
import { googleSignIn } from "./google.ts";
import { createAdminServer, createPublicServer } from "./server.ts";
import { OrderStore } from "./store.ts";

const ws = Workspace.fromEnv();
const port = Number(process.env.STOREFRONT_PORT ?? process.env.PORT ?? 4300);
const adminPort = Number(process.env.STOREFRONT_ADMIN_PORT ?? 4301);
const host = process.env.STOREFRONT_HOST ?? "127.0.0.1";
const paymentUrl = process.env.STOREFRONT_PAYMENT_URL || null;
if (paymentUrl && !paymentUrl.startsWith("https://")) throw new Error("STOREFRONT_PAYMENT_URL must start with https://");
const demoChannel = process.env.STOREFRONT_DEMO_CHANNEL ?? "no-way-really";
if (!channelExists(ws, demoChannel)) throw new Error(`STOREFRONT_DEMO_CHANNEL: there is no channel "${demoChannel}" to show on the demo page.`);
const googleId = process.env.GOOGLE_CLIENT_ID || null;
const googleSecret = process.env.GOOGLE_CLIENT_SECRET || null;
if (Boolean(googleId) !== Boolean(googleSecret)) throw new Error("Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to switch sign-in on, or neither to leave it off.");
// Read once now so a broken look or host file stops the start, not a customer's visit.
const catalog = loadCatalog(ENGINE_DIR);
const store = new OrderStore(ws.path("storefront", "orders.json"));
const autoBuild = process.env.STOREFRONT_AUTOBUILD === "1";
if (autoBuild && !process.env.ANTHROPIC_API_KEY) throw new Error("STOREFRONT_AUTOBUILD=1 needs ANTHROPIC_API_KEY: automatic builds are written by the Claude API.");
const perDay = Number(process.env.STOREFRONT_BUILDS_PER_DAY ?? 20);
if (!Number.isInteger(perDay) || perDay < 1) throw new Error("STOREFRONT_BUILDS_PER_DAY must be a whole number of 1 or more.");
const builder = autoBuild ? new Builder(store, buildWorkspace(ENGINE_DIR, ws.path("storefront", "workspace")), claudeDrafter, perDay) : null;
const options = {
  ws,
  libraryDir: ENGINE_DIR,
  demoChannel,
  store,
  builder,
  product: process.env.STOREFRONT_NAME ?? "Channel Studio",
  paymentUrl,
  publicBase: process.env.STOREFRONT_PUBLIC_URL ?? `http://localhost:${port}`,
  accounts: googleId && googleSecret ? { store: new AccountStore(ws.path("storefront", "accounts.json")), signIn: googleSignIn(googleId, googleSecret) } : null,
};

createPublicServer(options).listen(port, host, () => console.log(`Public site:  http://${host}:${port}`));
createAdminServer(options).listen(adminPort, "127.0.0.1", () => console.log(`Orders (this computer only):  http://127.0.0.1:${adminPort}`));
console.log(`On offer: ${catalog.looks.length} looks (themes/), ${catalog.hosts.length} hosts (avatars/).`);
console.log(options.accounts ? `Sign in with Google is on. Its return address is ${options.publicBase}/auth/google/callback` : "Sign-in not set (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET): accounts are off, orders are reached by their private link.");
console.log(builder ? `Automatic builds are on (Claude API, paid): at most ${perDay} a day.` : "Automatic builds are off (STOREFRONT_AUTOBUILD): channels are made by hand and linked on the orders page.");
builder?.resume();
if (!paymentUrl) console.log("Payment link not set (STOREFRONT_PAYMENT_URL): new orders start without payment.");
