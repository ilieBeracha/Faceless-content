import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { readJson } from "../core/util.ts";
import { ENGINE_DIR } from "../core/workspace.ts";
import { loadChannelTheme } from "../render/render-episode.ts";
import { characterRect, regions, safeRect } from "../render/timeline.ts";
import { RENDER_SKILLS } from "../skills/registry.ts";
import { beatFrame, frameFit, frameHostRect, onStage } from "../skills/render-themed/frames.ts";
import type { BeatSpan, EpisodeProps } from "../render/types.ts";
import type { EpisodeRef } from "../pipeline/episode.ts";
import { paintPaths, readPaintLedger, runPaint, shotPrompt, worldPaths } from "../skills/render-themed/paint.ts";
import { shotTimeline } from "../skills/render-themed/shots.ts";
import type { Script } from "../skills/write-script/schema.ts";
import { beatVisualSchema, checkFrames, checkShots, FRAME_PRESET_NAMES, FRAME_PRESETS, frameFor, frameSchema, parseTheme, sceneSchema, shotsUsed, themeFrames, type ThBeatVisual } from "../skills/render-themed/schema.ts";
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

describe("render-themed: frames open up the arrangement", () => {
  const good = () => readJson<Record<string, unknown>>(join(ENGINE_DIR, "themes", "blueprint.json"));
  const safe = { top: 250, bottom: 440, left: 60, right: 150 };
  const [w, h] = [1080, 1920];
  const mine = { name: "host-peeks", host: { x: 0, y: 70, w: 30, h: 30 }, text: { x: 0, y: 0, w: 100, h: 34, align: "top" }, picture: { x: 32, y: 36, w: 68, h: 64 } };

  it("takes presets and frames of its own, and fills presets in", () => {
    const th = parseTheme({ ...good(), layout: { frames: ["big-picture", mine] } }, "t.json");
    const frames = themeFrames(th)!;
    assert.deepEqual(frames.map((f) => f.name), ["big-picture", "host-peeks"]);
    assert.equal(frames[0].host, null);
    assert.equal(themeFrames(parseTheme(good(), "t.json")), null, "a look without frames keeps the classic arrangement");
  });

  it("rejects boxes that overlap, leave the stage, or are too small, and frames sharing a name", () => {
    const bad = (frame: unknown) => () => parseTheme({ ...good(), layout: { frames: [frame] } }, "t.json");
    assert.throws(bad({ ...mine, picture: { x: 20, y: 30, w: 68, h: 64 } }), /picture box overlaps the text box/);
    assert.throws(bad({ ...mine, picture: { x: 40, y: 36, w: 68, h: 64 } }), /stay on the stage/);
    assert.throws(bad({ ...mine, text: { x: 0, y: 0, w: 20, h: 34 } }), /layout\.frames/);
    assert.throws(bad("no-such-preset"), /layout\.frames/);
    assert.throws(() => parseTheme({ ...good(), layout: { frames: [mine, mine] } }, "t.json"), /its own name/);
  });

  it("every preset keeps its boxes on the stage and apart", () => {
    for (const name of FRAME_PRESET_NAMES) assert.ok(frameSchema.safeParse(FRAME_PRESETS[name]).success, name);
    assert.ok(FRAME_PRESET_NAMES.length >= 8);
  });

  it("gives each beat its named frame, or the next one in turn, and refuses a name the look lacks", () => {
    const frames = themeFrames(parseTheme({ ...good(), layout: { frames: ["split", "title-card", mine] } }, "t.json"))!;
    assert.deepEqual([0, 1, 2, 3].map((index) => frameFor(frames, { index, id: "b" }).name), ["split", "title-card", "host-peeks", "split"]);
    assert.equal(frameFor(frames, { index: 0, id: "b", frame: "host-peeks" }).name, "host-peeks");
    assert.throws(() => frameFor(frames, { index: 0, id: "b", frame: "nope" }), /frame "nope" is not one of the look's frames/);
  });

  it("stands the host on the bottom of its box, centred, inside the stage; no box, no host", () => {
    const { stage } = regions(w, h, safe);
    const fr = FRAME_PRESETS["host-centre"];
    const full = frameHostRect(fr, "full", w, h, safe)!;
    const small = frameHostRect(fr, "corner", w, h, safe)!;
    const box = onStage(fr.host!, stage);
    for (const r of [full, small]) {
      assert.ok(Math.abs(r.y + r.h - (box.y + box.h)) < 0.01, "stands on the bottom");
      assert.ok(Math.abs(r.x + r.w / 2 - (box.x + box.w / 2)) < 0.01, "centred");
      assert.ok(r.x >= box.x - 0.01 && r.x + r.w <= box.x + box.w + 0.01 && r.y >= box.y - 0.01);
    }
    assert.ok(small.w < full.w);
    assert.equal(frameHostRect(FRAME_PRESETS["big-picture"], "full", w, h, safe), null);
  });

  it("flags beats naming a frame the channel's look does not have", () => {
    const th = parseTheme({ ...good(), layout: { frames: ["split"] } }, "t.json");
    const beat = (frame?: string) => ({ id: "hook", visual: { skill: "render-themed", ...(frame ? { frame } : {}), elements: [] } });
    assert.deepEqual(checkFrames([beat("split"), beat()], th), []);
    assert.match(checkFrames([beat("big-picture")], th)[0], /frame "big-picture" is not one of the look's frames \(split\)/);
    assert.match(checkFrames([beat("split")], parseTheme(good(), "t.json"))[0], /has no layout\.frames/);
  });
});

describe("render-themed: each beat gets a frame its content fits", () => {
  const good = () => readJson<Record<string, unknown>>(join(ENGINE_DIR, "themes", "blueprint.json"));
  const safe = { top: 250, bottom: 440, left: 60, right: 150 };
  const props = (frames: unknown[]) => ({ theme: parseTheme({ ...good(), layout: { frames } }, "t.json"), width: 1080, height: 1920, safeArea: safe }) as unknown as EpisodeProps;
  const span = (index: number, elements: unknown[], frame?: string) => ({ index, id: `b${index}`, beat: { on_screen_text: "Hook", visual: { skill: "render-themed", ...(frame ? { frame } : {}), elements } } }) as unknown as BeatSpan;
  const heading = { type: "heading", lines: ["Wow"] };
  const art = { type: "art", id: "moth" };
  const marks = { type: "marks", items: [{ value: "1878", label: "Edison" }, { value: "1947", label: "Moth" }, { value: "2026", label: "Now" }] };

  it("takes the frames in turn when the beat fits each", () => {
    const p = props(["big-picture", "split"]);
    assert.deepEqual([0, 1, 2].map((i) => beatFrame(p, span(i, [heading, art]))!.name), ["big-picture", "split", "big-picture"]);
  });

  it("skips a frame whose picture box the beat would leave empty", () => {
    assert.equal(beatFrame(props(["big-picture", "title-card"]), span(0, [heading]))!.name, "title-card");
  });

  it("skips a frame too narrow for a timeline, and keeps a frame the beat names even so", () => {
    const p = props(["columns", "title-card"]);
    assert.ok(frameFit(FRAME_PRESETS.columns, [marks] as never, p.theme!, 1080, 1920, safe, true) < 0.75);
    assert.equal(beatFrame(p, span(0, [marks]))!.name, "title-card");
    assert.equal(beatFrame(p, span(0, [marks], "columns"))!.name, "columns");
  });

  it("falls back to the best fit when no frame fits well", () => {
    const p = props(["columns", "picture-in-picture"]);
    const fits = [FRAME_PRESETS.columns, FRAME_PRESETS["picture-in-picture"]].map((f) => frameFit(f, [heading, marks, art] as never, p.theme!, 1080, 1920, safe, true));
    assert.ok(fits.every((f) => f < 0.75));
    assert.equal(beatFrame(p, span(0, [heading, marks, art]))!.name, fits[0] >= fits[1] ? "columns" : "picture-in-picture");
  });

  it("a look without frames has none to give", () => {
    assert.equal(beatFrame({ theme: parseTheme(good(), "t.json"), width: 1080, height: 1920, safeArea: safe } as unknown as EpisodeProps, span(0, [heading])), null);
  });
});

describe("render-themed: painted stories", () => {
  const good = () => readJson<Record<string, unknown>>(join(ENGINE_DIR, "themes", "blueprint.json"));
  const world = { description: "A very simple flat cartoon town, thick black outlines, three soft colours, sunny afternoon" };
  const shots = (...list: { at?: string; show: string; camera?: string }[]) => list;
  const beat = (id: string, voiceover: string, shotList: unknown[] | undefined, elements?: unknown[]) => ({
    id,
    speaker: "bot",
    voiceover,
    visual: { skill: "render-themed", ...(shotList ? { shots: shotList } : {}), ...(elements ? { elements } : {}) },
    character: { placement: "full" },
  });
  const heading = [{ type: "heading", lines: ["Hi"] }];

  it("takes a world in words, and 1–3 shots on a beat that cut in on spoken words", () => {
    assert.equal(parseTheme({ ...good(), world }, "t.json").world?.description, world.description);
    assert.throws(() => parseTheme({ ...good(), world: { description: "tiny" } }, "t.json"), /world\.description/);
    assert.ok(beatVisualSchema.safeParse({ skill: "render-themed", shots: shots({ show: "The host walks up to the hospital doors" }, { at: "inside", show: "The host stares at a giant waiting room", camera: "pan-left" }) }).success);
    assert.equal(beatVisualSchema.safeParse({ skill: "render-themed", shots: shots({ show: "The host walks up", camera: "barrel-roll" }) }).success, false);
    const four = shots(...Array.from({ length: 4 }, () => ({ show: "The host walks up to the doors" })));
    assert.equal(beatVisualSchema.safeParse({ skill: "render-themed", shots: four }).success, false, "at most three shots a beat");
  });

  it("with a world, every beat tells its words in shots, with no lettering, and every cut word is spoken in order", () => {
    const withWorld = parseTheme({ ...good(), world }, "t.json");
    const ok = beat("a", "I went to the hospital, and inside was a goose.", shots({ show: "The host walks to the hospital" }, { at: "goose", show: "A goose at the front desk" }));
    assert.deepEqual(checkShots([ok], withWorld), []);
    assert.match(checkShots([beat("a", "Hi there.", undefined, heading)], withWorld).join("\n"), /needs `shots`[\s\S]*take out `elements`/);
    assert.match(checkShots([beat("a", "I went to the hospital.", shots({ show: "The host walks in" }, { at: "goose", show: "A goose" }))], withWorld)[0], /cuts in on "goose", which is not spoken/);
    assert.match(checkShots([beat("a", "I went to the hospital.", shots({ show: "The host walks in" }, { show: "A goose at the desk" }))], withWorld)[0], /shot 2 needs `at`/);
    assert.match(checkShots([beat("a", "a goose, then a hospital.", shots({ show: "The host walks in" }, { at: "hospital", show: "A hospital" }, { at: "goose", show: "A goose" }))], withWorld)[0], /not spoken after the previous cut/);
    assert.match(checkShots([beat("a", "I went.", shots({ at: "went", show: "The host walks in" }))], withWorld)[0], /first shot starts with the beat/);
    const noWorld = parseTheme(good(), "t.json");
    assert.match(checkShots([beat("a", "Hi.", shots({ show: "The host walks in" }), heading)], noWorld)[0], /no world to paint them in/);
    assert.match(checkShots([beat("a", "Hi.", undefined)], noWorld)[0], /needs `elements`/);
  });

  it("cuts each later shot in just before its word is spoken", () => {
    const b = beat("hook", "I went to the hospital, and inside was a goose.", shots({ show: "The host walks to the hospital" }, { at: "Goose!", show: "A goose at the desk", camera: "push-in" }));
    const words = b.voiceover.split(" ").map((text, i) => ({ i, beat: "hook", text, start: 0.2 + i * 0.3, end: 0.4 + i * 0.3 }));
    const spans = [{ index: 0, id: "hook", beat: b, start: 0, end: 3.2, voiceStart: 0.2, voiceEnd: 3.1 }] as unknown as BeatSpan[];
    const props = { words, shots: { "hook-1": "shots/hook-1.jpg", "hook-2": "shots/hook-2.jpg" } } as unknown as EpisodeProps;
    const t = shotTimeline(props, spans);
    assert.deepEqual(t.map((s) => s.id), ["hook-1", "hook-2"]);
    assert.equal(t[0].start, 0);
    assert.ok(Math.abs(t[1].start - (words[9].start - 0.12)) < 1e-9, "the goose shot lands as \"goose\" is said");
    assert.equal(t[0].end, t[1].start);
    assert.equal(t[1].move, "push-in");
    assert.throws(() => shotTimeline({ ...props, shots: { "hook-1": "shots/hook-1.jpg" } } as unknown as EpisodeProps, spans), /shot "hook-2" has no painted picture/);
  });

  it("asks the painter for the host, acting the line out, in the world's style", () => {
    const p = shotPrompt(world, { show: "The host pushes open the hospital doors" }, "I went to the hospital.");
    assert.match(p, /The host pushes open the hospital doors/);
    assert.match(p, /narrator says: "I went to the hospital\."/);
    assert.match(p, /second reference picture is the host/);
    assert.match(p, /No text of any kind/);
    assert.match(p, /Do not copy its layout, its place, its objects or its camera angle/);
    const without = shotPrompt(world, { show: "A waiting room where every chair holds a goose" }, "The room was full of geese.");
    assert.doesNotMatch(without, /second reference picture/);
    assert.match(without, /There is no host or narrator character in this shot/);
  });

  it("needs no host when no shot shows one, and asks for one only when a shot says \"the host\"", async () => {
    process.env.ENGINE_AI_VIDEO_FAKE = "1";
    try {
      const ws = tempWorkspace();
      const channelDir = ws.path("channels", "hostless");
      const ep = { dir: join(channelDir, "episodes", "e1"), channel: { dir: channelDir, slug: "hostless", characters: new Map() } } as unknown as EpisodeRef;
      const theme = parseTheme({ ...good(), world }, "t.json");
      let drawn = 0;
      const drawHost = async () => {
        drawn++;
      };
      const story = { beats: [beat("a", "The waiting room was full of geese.", shots({ show: "A hospital waiting room where every chair holds a goose" }))], visuals: {} } as unknown as Script;
      const r = await runPaint(ws, ep, story, theme, { drawHost });
      assert.deepEqual(Object.keys(r.files), ["a-1"]);
      assert.equal(drawn, 0, "nobody is drawn for a story without the host");
      const withHost = { beats: [beat("a", "I walked in.", shots({ show: "The host walks into the hospital" }))], visuals: {} } as unknown as Script;
      await assert.rejects(runPaint(ws, ep, withHost, theme, { drawHost }), /shows "the host", but character "bot" has no model\.json/);
    } finally {
      delete process.env.ENGINE_AI_VIDEO_FAKE;
    }
  });

  it("paints the world once, draws the host once, paints every shot from both, and repaints only what changed", async () => {
    process.env.ENGINE_AI_VIDEO_FAKE = "1";
    try {
      const ws = tempWorkspace();
      const channelDir = ws.path("channels", "town");
      mkdirSync(join(channelDir, "characters", "bot"), { recursive: true });
      const modelPath = join(channelDir, "characters", "bot", "model.json");
      writeFileSync(modelPath, JSON.stringify(readJson(join(ENGINE_DIR, "channels", "no-way-really", "characters", "blink", "model.json"))));
      const ep = { dir: join(channelDir, "episodes", "e1"), channel: { dir: channelDir, slug: "town", characters: new Map([["bot", { modelPath }]]) } } as unknown as EpisodeRef;
      const theme = parseTheme({ ...good(), world }, "t.json");
      let drawn = 0;
      const drawHost = async (_m: unknown, out: string) => {
        drawn++;
        mkdirSync(join(out, ".."), { recursive: true });
        writeFileSync(out, "png");
      };
      const s1 = { beats: [beat("a", "I went to the hospital, and inside was a goose.", shots({ show: "The host walks to the hospital" }, { at: "goose", show: "A goose at the desk" })), beat("b", "It quacked.", shots({ show: "The goose quacks at the host" }))], visuals: {} } as unknown as Script;
      assert.deepEqual(shotsUsed(s1.beats).map((s) => s.id), ["a-1", "a-2", "b-1"]);
      const first = await runPaint(ws, ep, s1, theme, { drawHost });
      assert.deepEqual(Object.keys(first.files), ["a-1", "a-2", "b-1"]);
      assert.ok(first.fake && first.regenerated);
      assert.ok(existsSync(worldPaths(channelDir).key));
      assert.ok(existsSync(join(worldPaths(channelDir).hosts, "bot.png")));
      assert.equal(drawn, 1);
      for (const f of Object.values(first.files)) assert.ok(existsSync(f));

      const again = await runPaint(ws, ep, s1, theme, { drawHost });
      assert.equal(again.regenerated, false, "nothing changed, nothing is painted");
      assert.equal(drawn, 1, "the host is drawn once");

      const s2 = { beats: [s1.beats[0], beat("b", "It honked.", shots({ show: "The goose quacks at the host" }))], visuals: {} } as unknown as Script;
      const third = await runPaint(ws, ep, s2, theme, { drawHost });
      assert.ok(third.regenerated, "a changed line repaints its shot");
      assert.equal(readdirSync(paintPaths(ep.dir).retired).filter((f) => f.startsWith("b-1-")).length, 1, "the old shot is kept, not deleted");
      assert.equal(readPaintLedger(ws, ep.dir).entries.length, 5, "world + three shots + the repainted one");
      assert.equal(third.spentUsd, 0, "placeholders cost nothing");
    } finally {
      delete process.env.ENGINE_AI_VIDEO_FAKE;
    }
  });
});
