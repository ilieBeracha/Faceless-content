import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { brandKit, videoPath } from "../storefront/brand-kit.ts";
import { ENGINE_DIR } from "../core/workspace.ts";
import { OWN_HOST, OWN_LOOK, loadCatalog, readHosts, readLooks } from "../storefront/catalog.ts";
import { HOST_RIGS, buildHost, buildLook, hostFields, lookFields } from "../storefront/designer.ts";
import { hostSvg } from "../storefront/host-svg.tsx";
import { createAdminServer, createPublicServer } from "../storefront/server.ts";
import { OrderStore, validateIntake } from "../storefront/store.ts";
import { makeChannel, tempWorkspace } from "./helpers.ts";

const GOOD = { contact_name: "Sam Example", email: "sam@example.com", idea: "How bridges stay up", audience: "Curious adults", tone: "calm, clear", look: "Blueprint", look_note: "", avatar: "Byte", host: "", avoid: "" };
const OFFER = loadCatalog(ENGINE_DIR);
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
    const a = new OrderStore(file).create(validateIntake(GOOD, OFFER).intake!, { theme: null, model: null }, true);
    const b = new OrderStore(file).create(validateIntake(GOOD, OFFER).intake!, { theme: null, model: null }, true);
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
  const options = { ws, store, product: "Test Studio", paymentUrl: null, demoChannel: "kit-demo", libraryDir: ENGINE_DIR, publicBase: "http://example.test" };
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
