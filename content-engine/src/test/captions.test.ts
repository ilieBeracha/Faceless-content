import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captionSettingsSchema, newStoryboard, setVideoCaptions, videoCaptions, writeStoryboard } from "../pipeline/storyboard.ts";
import { mergeLayouts, type LayoutSummary } from "../render/render-episode.ts";
import type { EpisodeProps } from "../render/types.ts";
import { regions } from "../render/timeline.ts";
import { liveCaptions } from "../skills/captions/live.ts";
import { activeWordIndex, buildPages, estimateWidth, FONT_SIZES, GAP, pageAt } from "../skills/captions/pages.ts";
import { voiceTokens } from "../skills/write-script/schema.ts";
import { sayFor } from "../voice/synthesize.ts";

const words = "Okay but… WHY though? The ink waits for the ball to roll and then it flows onto the paper.".split(" ").map((text, i) => ({ i, beat: i < 4 ? "hook" : "body", text, start: i * 0.3, end: i * 0.3 + 0.25 }));

describe("captions", () => {
  it("pages never cross a beat or a sentence end and fit the width", () => {
    const pages = buildPages(words, (t) => estimateWidth(t, 74, false), 700, 2);
    assert.deepEqual(pages[0].lines.flatMap((l) => l.words).map((w) => w.text), ["Okay", "but…", "WHY", "though?"]);
    for (const p of pages) for (const l of p.lines) assert.ok(l.words.reduce((n, w) => n + estimateWidth(w.text, 74, false), 0) + (l.words.length - 1) * 18 <= 700);
    for (const p of pages) assert.ok(p.lines.length <= 2);
  });

  it("are always on screen: from the first frame, through pauses, to the end; only a hidden beat shows nothing", () => {
    // A 3 s pause after the hook, so the pages have a long gap between them.
    const paused = words.map((w) => (w.beat === "body" ? { ...w, start: w.start + 3, end: w.end + 3 } : w));
    const measure = (t: string) => estimateWidth(t, 74, false);
    const pages = buildPages(paused, measure, 700, 2);
    const last = pages[pages.length - 1];
    assert.equal(pageAt(pages, 0, paused.length), pages[0], "up on the first frame");
    assert.equal(pageAt(pages, 2.5, paused.length), pages[0], "the hook stays up through the pause");
    assert.equal(pageAt(pages, pages[1].start, paused.length), pages[1]);
    assert.equal(pageAt(pages, last.end + 10, paused.length), last, "the last page stays to the end");
    const bodyOnly = pages.filter((p) => p.lines[0].words[0].beat !== "hook");
    assert.equal(pageAt(bodyOnly, 0.5, paused.length), null, "a hidden first beat shows nothing, not the next beat early");
    const hookOnly = pages.filter((p) => p.lines[0].words[0].beat === "hook");
    assert.equal(pageAt(hookOnly, pages[1].start + 0.1, paused.length), null, "a hidden last beat shows nothing");
  });

  it("highlights the word being spoken", () => {
    assert.equal(activeWordIndex(words, 0.0), 0);
    assert.equal(activeWordIndex(words, 0.65), 2);
    assert.equal(activeWordIndex(words, -1), -1);
  });

  it("voice tokens keep punctuation-only tokens with the previous word", () => {
    assert.deepEqual(voiceTokens("It clicks — then locks."), ["It", "clicks —", "then", "locks."]);
  });

  it("pronunciations replace the word but keep its punctuation", () => {
    assert.equal(sayFor("1938,", { "1938": "nineteen thirty-eight" }), "nineteen thirty-eight,");
    assert.equal(sayFor("(LED)", { LED: "L E D" }), "(L E D)");
    assert.equal(sayFor("pen.", {}), "pen.");
  });

  it("live: the browser gets the same pages and place the video draws, for every size and letter case", () => {
    const safeArea = { top: 250, bottom: 440, left: 60, right: 150 };
    const props = { width: 1080, height: 1920, safeArea, words, direction: "rtl", captionStyle: "pages", brand: { font: "fredoka", accent_color: "#8b2f3e", caption_color: "#e1a73e" } } as unknown as EpisodeProps;
    const live = liveCaptions(props);
    const band = regions(1080, 1920, safeArea).captions;
    assert.deepEqual(Object.keys(live.pages).sort(), ["large:normal", "large:upper", "medium:normal", "medium:upper", "small:normal", "small:upper"]);
    const drawn = buildPages(words, (t) => estimateWidth(t, FONT_SIZES.medium, false), band.w - 80, 2, GAP);
    assert.deepEqual(live.pages["medium:normal"], drawn.map((p) => ({ s: p.start, e: p.end, l: p.lines.map((l) => l.words.map((w) => w.i)) })));
    assert.deepEqual([live.regions.bottom, live.regions.middle.y, live.rtl, live.accent, live.singleColor], [band, Math.round(960 - band.h / 2), true, "#8b2f3e", "#e1a73e"]);
    assert.deepEqual(live.words[0], { t: "Okay", s: 0, e: 0.25, b: "hook" });
    assert.deepEqual(live.fonts.heebo, { family: "Heebo", weight: 900 });
  });

  it("a video's own caption settings (captions.json) win over its storyboard's, and must name a real font and parts", () => {
    const dir = mkdtempSync(join(tmpdir(), "caps-"));
    const script = { beats: [{ id: "hook" }, { id: "body" }] } as never;
    assert.equal(videoCaptions(dir), null);
    writeStoryboard(dir, newStoryboard({ show: true, size: "medium", place: "bottom", case: "normal", hide_beats: [] }));
    assert.equal(videoCaptions(dir)?.size, "medium");
    setVideoCaptions(dir, script, { show: true, size: "large", place: "middle", case: "upper", font: "heebo", text_color: "#ffee00", hide_beats: ["body"] });
    assert.deepEqual(videoCaptions(dir), { show: true, size: "large", place: "middle", case: "upper", font: "heebo", text_color: "#ffee00", hide_beats: ["body"] });
    assert.throws(() => setVideoCaptions(dir, script, { show: true, size: "large", place: "middle", case: "upper", hide_beats: ["outro"] }), /"outro", which is not a beat/);
    assert.equal(captionSettingsSchema.safeParse({ show: true, size: "large", place: "middle", case: "upper", font: "comic-sans", hide_beats: [] }).success, false);
    writeFileSync(join(dir, "captions.json"), "{}");
    assert.throws(() => videoCaptions(dir), /is not valid caption settings/);
  });

  it("the finished video's layout: the pictures' text from the clean render, the captions from the captions pass", () => {
    const empty = (): LayoutSummary => ({ frame: { w: 1080, h: 1920 }, safe: { x: 0, y: 0, w: 1080, h: 1920 }, elements: {}, violations: [], violationCounts: {}, captionWord: {}, firstCaptionFrame: null, probes: 0 });
    const scene = { ...empty(), elements: { label: { kind: "label", frames: 3, minX: 0, minY: 0, maxX: 1, maxY: 1 } }, violationCounts: { "label:cut-off": 2 }, probes: 3 };
    const caps = { ...empty(), elements: { captions: { kind: "caption", frames: 9, minX: 0, minY: 0, maxX: 1, maxY: 1 } }, violationCounts: { "label:cut-off": 1, "captions:outside-safe-area": 4 }, captionWord: { 0: 0, 5: 1 }, firstCaptionFrame: 0, probes: 9 };
    const merged = mergeLayouts(scene, caps);
    assert.deepEqual(Object.keys(merged.elements), ["label", "captions"]);
    assert.deepEqual(merged.violationCounts, { "label:cut-off": 3, "captions:outside-safe-area": 4 });
    assert.deepEqual([merged.captionWord, merged.firstCaptionFrame, merged.probes], [{ 0: 0, 5: 1 }, 0, 12]);
  });
});
