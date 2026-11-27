import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { readJson } from "../core/util.ts";
import type { EpisodeRef } from "../pipeline/episode.ts";
import { beatSpans } from "../render/timeline.ts";
import type { EpisodeProps } from "../render/types.ts";
import { clipSeconds, motionPaths, motionPrompt, readMotionClips, runAnimate, type MotionLedger } from "../skills/render-themed/animate.ts";
import { paintPaths, runPaint } from "../skills/render-themed/paint.ts";
import { parseTheme } from "../skills/render-themed/schema.ts";
import { shotTimeline } from "../skills/render-themed/shots.ts";
import type { Script } from "../skills/write-script/schema.ts";
import { ENGINE_DIR } from "../core/workspace.ts";
import { tempWorkspace } from "./helpers.ts";

const world = { description: "A very simple flat cartoon town, thick black outlines, three soft colours, sunny afternoon" };
const beat = (id: string, voiceover: string, shots: { at?: string; show: string }[]) => ({ id, speaker: "bot", voiceover, visual: { skill: "render-themed", shots }, character: { placement: "hidden" } });
const story = (bLine = "It quacked at me.") =>
  ({ beats: [beat("a", "I went to the hospital, and inside was a goose.", [{ show: "Someone walks to the hospital" }, { at: "goose", show: "A goose pours tea at the desk" }]), beat("b", bLine, [{ show: "The goose quacks" }])], visuals: {} }) as unknown as Script;

/** The episode's timeline as the voice step would leave it: each word 0.3 s, each beat right after the one before. */
function timeline(script: Script): EpisodeProps {
  const words: { i: number; beat: string; text: string; start: number; end: number }[] = [];
  const beats: { start: number; end: number }[] = [];
  let t = 0.2;
  for (const b of script.beats) {
    const start = t;
    for (const text of b.voiceover.split(" ")) {
      words.push({ i: words.length, beat: b.id, text, start: t, end: t + 0.25 });
      t += 0.3;
    }
    beats.push({ start, end: t });
    t += 0.4;
  }
  const shots = Object.fromEntries(script.beats.flatMap((b) => (b.visual as unknown as { shots: unknown[] }).shots.map((_, n) => [`${b.id}-${n + 1}`, `shots/${b.id}-${n + 1}.jpg`])));
  return { script, words, beats, fps: 30, durationInFrames: Math.ceil(t * 30), shots } as unknown as EpisodeProps;
}

function episode() {
  const ws = tempWorkspace();
  const channelDir = ws.path("channels", "town");
  const ep = { dir: join(channelDir, "episodes", "e1"), channel: { dir: channelDir, slug: "town", characters: new Map() } } as unknown as EpisodeRef;
  const theme = parseTheme({ ...readJson<Record<string, unknown>>(join(ENGINE_DIR, "themes", "blueprint.json")), world }, "t.json");
  return { ws, ep, theme };
}

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.ENGINE_AI_VIDEO_FAKE;
  delete process.env.FAL_KEY;
});

describe("render-themed: moving shots", () => {
  it("asks for the painting's own action, a still camera and the painting's style", () => {
    const p = motionPrompt({ show: "A man pours white wine into two glasses" }, "He pours it again.");
    assert.match(p, /A man pours white wine into two glasses/);
    assert.match(p, /narrator says: "He pours it again\."/);
    assert.match(p, /Fixed camera/);
    assert.match(p, /same art style/);
    assert.match(p, /Add nothing new/);
  });

  it("makes each clip as long as its shot is on screen, plus the dissolve, within the model's limit", () => {
    const props = timeline(story());
    const shots = shotTimeline(props, beatSpans(props));
    const lengths = clipSeconds(props, 15);
    for (const s of shots) assert.ok(lengths[s.id] >= s.end - s.start + 0.3, `${s.id} covers its time on screen and the dissolve`);
    assert.deepEqual(Object.keys(lengths), ["a-1", "a-2", "b-1"]);
    assert.ok(Object.values(clipSeconds(props, 1.5)).every((s) => s <= 1.5));
  });

  it("moves every painted shot, keeps the clips, and moves again only the shot whose words changed", async () => {
    process.env.ENGINE_AI_VIDEO_FAKE = "1";
    const { ws, ep, theme } = episode();
    const s1 = story();
    await runPaint(ws, ep, s1, theme);
    const first = await runAnimate(ws, ep, s1, timeline(s1));
    assert.deepEqual(Object.keys(first.clips), ["a-1", "a-2", "b-1"]);
    assert.ok(first.regenerated && first.fake);
    for (const c of Object.values(first.clips)) assert.ok(existsSync(c.file));
    assert.equal(first.spentUsd, 0, "placeholders cost nothing");
    assert.deepEqual(Object.keys(readMotionClips(ep.dir)!), ["a-1", "a-2", "b-1"]);

    const again = await runAnimate(ws, ep, s1, timeline(s1));
    assert.equal(again.regenerated, false, "nothing changed, nothing is moved again");

    const s2 = story("It honked at me.");
    await runPaint(ws, ep, s2, theme);
    const third = await runAnimate(ws, ep, s2, timeline(s2));
    assert.ok(third.regenerated);
    assert.equal(readJson<MotionLedger>(motionPaths(ep.dir).ledger).entries.length, 4, "three shots + the changed one");
    assert.equal(readdirSync(paintPaths(ep.dir).retired).filter((f) => f.startsWith("b-1-") && f.endsWith(".mp4")).length, 1, "the old clip is kept, not deleted");
  });

  it("sends the painted picture, the prompt and the length to fal, and records what it costs", async () => {
    process.env.ENGINE_AI_VIDEO_FAKE = "1";
    const { ws, ep, theme } = episode();
    const s = { ...story(), beats: [story().beats[1]] } as Script;
    await runPaint(ws, ep, s, theme);
    delete process.env.ENGINE_AI_VIDEO_FAKE;
    process.env.FAL_KEY = "test-key";
    const sent: { url: string; body?: Record<string, unknown> }[] = [];
    const clip = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]);
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      sent.push({ url, ...(init?.body ? { body: JSON.parse(String(init.body)) as Record<string, unknown> } : {}) });
      if (init?.method === "POST") return new Response(JSON.stringify({ status_url: "https://queue.fal.run/x/status", response_url: "https://queue.fal.run/x" }));
      if (url.endsWith("/status")) return new Response(JSON.stringify({ status: "COMPLETED" }));
      if (url === "https://queue.fal.run/x") return new Response(JSON.stringify({ video: { url: "https://v3b.fal.media/clip.mp4" } }));
      return new Response(clip);
    }) as typeof fetch;
    const props = timeline(s);
    const r = await runAnimate(ws, ep, s, props);
    const body = sent[0].body!;
    assert.equal(sent[0].url, `https://queue.fal.run/${ws.config.motion.endpoint}`);
    assert.match(String(body.image_url), /^data:image\/jpeg;base64,/);
    assert.equal(body.duration, clipSeconds(props, ws.config.motion.max_clip_seconds)["b-1"]);
    assert.equal(body.prompt_expansion_mode, "disabled");
    assert.match(String(body.prompt), /The goose quacks/);
    assert.equal(r.fake, false);
    assert.equal(r.spentUsd, Math.round(Number(body.duration) * ws.config.motion.usd_per_second * 100) / 100);
  });

  it("stops before an episode would pass its budget, without calling fal", async () => {
    process.env.ENGINE_AI_VIDEO_FAKE = "1";
    const { ws, ep, theme } = episode();
    const s = story();
    await runPaint(ws, ep, s, theme);
    delete process.env.ENGINE_AI_VIDEO_FAKE;
    process.env.FAL_KEY = "test-key";
    globalThis.fetch = (async () => assert.fail("fal must not be called past the budget")) as typeof fetch;
    ws.config.motion.budget_per_episode_usd = 0.01;
    await assert.rejects(runAnimate(ws, ep, s, timeline(s)), /Budget reached: moving this episode's shots has spent \$0\.00 of its \$0\.01 budget/);
  });

  it("plays a shot's clip in place of its still once the shots are moving", () => {
    const props = timeline(story());
    const moving = { ...props, shotClips: { "a-1": { file: "shots/clips/a-1.mp4", seconds: 4 }, "a-2": { file: "shots/clips/a-2.mp4", seconds: 3 }, "b-1": { file: "shots/clips/b-1.mp4", seconds: 2 } } };
    assert.deepEqual(shotTimeline(moving, beatSpans(moving)).map((s) => s.clip?.file), ["shots/clips/a-1.mp4", "shots/clips/a-2.mp4", "shots/clips/b-1.mp4"]);
    assert.ok(shotTimeline(props, beatSpans(props)).every((s) => !s.clip), "without clips the stills are filmed as before");
  });
});
