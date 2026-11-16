import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { readJson } from "../core/util.ts";
import { ENGINE_DIR } from "../core/workspace.ts";
import { loadChannelTheme } from "../render/render-episode.ts";
import { characterRect, safeRect } from "../render/timeline.ts";
import { RENDER_SKILLS } from "../skills/registry.ts";
import { parseTheme, sceneSchema, type ThBeatVisual } from "../skills/render-themed/schema.ts";
import { makeChannel, tempWorkspace } from "./helpers.ts";

const spec = RENDER_SKILLS["render-themed"];

describe("render-themed: looks are data", () => {
  it("accepts every theme shipped in themes/, and they cover every choice a theme can make", () => {
    const files = readdirSync(join(ENGINE_DIR, "themes")).filter((f) => f.endsWith(".json"));
    assert.ok(files.length >= 4);
    const themes = files.map((f) => parseTheme(readJson(join(ENGINE_DIR, "themes", f)), f));
    assert.deepEqual([...new Set(themes.map((t) => t.surface))].sort(), ["glow", "plain", "ruled", "torn"]);
    assert.deepEqual([...new Set(themes.map((t) => t.motion))].sort(), ["draw-on", "snappy", "stop-motion"]);
    assert.deepEqual([...new Set(themes.map((t) => t.art))].sort(), ["cutout", "flat", "line"]);
  });

  it("keeps the standard arrangement when a theme sets no layout, and takes one that does", () => {
    const good = readJson<Record<string, unknown>>(join(ENGINE_DIR, "themes", "blueprint.json"));
    assert.deepEqual(parseTheme(good, "t.json").layout, { host: "left", host_size: "medium", lettering: "middle", pictures: "beside" });
    assert.deepEqual(parseTheme({ ...good, layout: { host: "right", pictures: "stacked" } }, "t.json").layout, { host: "right", host_size: "medium", lettering: "middle", pictures: "stacked" });
    assert.throws(() => parseTheme({ ...good, layout: { host: "middle" } }, "t.json"), /layout\.host/);
  });

  it("stands the host on either side, inside the safe area, at three sizes", () => {
    const safe = { top: 250, bottom: 440, left: 60, right: 150 };
    const [w, h] = [1080, 1920];
    const s = safeRect(w, h, safe);
    assert.deepEqual(characterRect("corner", w, h, safe), characterRect("corner", w, h, safe, { host: "left", host_size: "medium" }));
    assert.deepEqual(characterRect("corner", w, h, safe), { x: 50, y: characterRect("corner", w, h, safe).y, w: 261, h: 261 });
    for (const placement of ["corner", "full"] as const) {
      const sizes = (["small", "medium", "large"] as const).map((host_size) => characterRect(placement, w, h, safe, { host: "left", host_size }).w);
      assert.ok(sizes[0] < sizes[1] && sizes[1] < sizes[2], `${placement}: ${sizes}`);
      for (const host_size of ["small", "medium", "large"] as const) {
        const left = characterRect(placement, w, h, safe, { host: "left", host_size });
        const right = characterRect(placement, w, h, safe, { host: "right", host_size });
        assert.equal(left.x, s.x - 10);
        assert.equal(right.x + right.w, s.x + s.w + 10);
        assert.deepEqual([right.y, right.w], [left.y, left.w]);
      }
    }
  });

  it("rejects a theme with a bad colour, an unknown choice or an extra field, naming the field", () => {
    const good = readJson<Record<string, unknown>>(join(ENGINE_DIR, "themes", "blueprint.json"));
    assert.throws(() => parseTheme({ ...good, paper: "blue" }, "t.json"), /t\.json is not a valid theme[\s\S]*paper/);
    assert.throws(() => parseTheme({ ...good, surface: "marble" }, "t.json"), /surface/);
    assert.throws(() => parseTheme({ ...good, glitter: true }, "t.json"), /not a valid theme/);
  });

  it("refuses to render a themed series for a channel with no theme.json, and says what to do", () => {
    const ws = tempWorkspace();
    makeChannel(ws, "no-theme");
    assert.throws(() => loadChannelTheme(ws.path("channels", "no-theme"), "no-theme"), /has no theme\.json/);
  });
});

describe("render-themed: artwork is drawn per episode", () => {
  const moth = { shapes: [{ d: "M50 40C30 15 5 15 6 38c1 16 24 18 44 12z", fill: "ink", anim: "flap" }] };

  it("accepts path data with roles, and nothing that is not path data", () => {
    assert.ok(sceneSchema.safeParse({ art: { moth } }).success);
    for (const d of ['M0 0"/><script>alert(1)</script>', "url(javascript:1)", "M0 0 L10 10 <"]) {
      assert.equal(sceneSchema.safeParse({ art: { x: { shapes: [{ d, fill: "ink" }] } } }).success, false, d);
    }
    assert.equal(sceneSchema.safeParse({ art: { x: { shapes: [{ d: "M0 0L5 5", fill: "#ff0000" }] } } }).success, false, "colours must be roles");
    assert.equal(sceneSchema.safeParse({ art: { x: { shapes: [{ d: "M0 0L5 5" }] } } }).success, false, "needs a fill or a stroke");
    assert.equal(sceneSchema.safeParse({ art: { x: { shapes: [{ d: "M0 0L5 5", stroke: "ink", anim: "spin" }] } } }).success, false, "spin needs a centre");
  });

  it("flags a beat that names artwork nobody drew, or uses two artworks", () => {
    const beat = (elements: unknown[]) => [{ id: "hook", visual: { skill: "render-themed", elements } as ThBeatVisual }];
    assert.deepEqual(spec.check!({ art: { moth } }, beat([{ type: "art", id: "moth" }]), { config: {} as never }), []);
    assert.match(spec.check!({ art: { moth } }, beat([{ type: "art", id: "relay" }]), { config: {} as never })[0], /artwork "relay" is not drawn/);
    assert.match(spec.check!({ art: { moth } }, beat([{ type: "art", id: "moth" }, { type: "art", id: "moth" }]), { config: {} as never })[0], /one artwork per beat/);
  });

  it("lists on-screen lettering for the fact-check, and none for artwork without a label", () => {
    const beats = [{ id: "a", visual: { skill: "render-themed", elements: [{ type: "heading", lines: ["Bug =", "an insect"] }, { type: "art", id: "moth" }, { type: "marks", items: [{ value: "1878", label: "Edison" }, { value: "1947", label: "Moth" }] }] } }];
    assert.deepEqual(spec.text!(undefined, beats), ["Bug = an insect", "1878 Edison", "1947 Moth"]);
  });
});
