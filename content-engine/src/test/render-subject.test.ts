import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPages, estimateWidth } from "../skills/captions/pages.ts";
import { beatVisualSchema, checkBeat, countingValue, picturesUsed, sceneSchema, sceneText, viewText } from "../skills/render-subject/schema.ts";
import { boxOf, subjectPrompt } from "../skills/render-subject/paint.ts";
import type { TimedWord } from "../render/types.ts";

const scene = sceneSchema.parse({
  subject: { name: "Glass", show: "a tall wine glass, half full of red wine" },
  pictures: [{ id: "white", show: "the same glass, half full of white wine" }, { id: "bottle", show: "a wine bottle", name: "Bottle" }],
  style: "flat vector illustration, soft gradients",
});

describe("render-subject", () => {
  it("fills defaults and lists every on-screen text for the fact-check", () => {
    const v = beatVisualSchema.parse({ skill: "render-subject", views: [{ view: "hero" }, { view: "stat", at_word: 3, value: "54", subtitle: "students fooled", caption: "Bordeaux · 2001" }] });
    assert.equal(v.views[0].at_word, 0);
    assert.equal(v.views[0].picture, "main");
    assert.deepEqual(viewText(v.views[1]), ["Bordeaux · 2001", "54", "students fooled"]);
    assert.deepEqual(sceneText(scene), ["Glass", "Bottle"]);
    assert.deepEqual(scene.background, { top: "#1b2130", bottom: "#07080d" });
  });

  it("checks timing, unknown pictures and views that need another picture", () => {
    const bad = beatVisualSchema.parse({
      skill: "render-subject",
      views: [{ view: "hero", at_word: 1 }, { view: "swap", at_word: 9, picture: "main" }, { view: "focus", at_word: 2, picture: "rose", x: 0.5, y: 0.4 }],
    });
    const problems = checkBeat(bad, scene, "turn", "It looks red but it is not");
    assert.ok(problems.some((p) => /first view must start at word 0/.test(p)));
    assert.ok(problems.some((p) => /past the beat's last word/.test(p)));
    assert.ok(problems.some((p) => /must increase/.test(p)));
    assert.ok(problems.some((p) => /picture "rose" is not in/.test(p)));
    assert.ok(problems.some((p) => /a swap needs another picture/.test(p)));
  });

  it("refuses a picture called main and duplicate ids", () => {
    assert.throws(() => sceneSchema.parse({ subject: { name: "X", show: "a single red apple" }, pictures: [{ id: "main", show: "another red apple" }], style: "flat illustration" }));
    assert.throws(() => sceneSchema.parse({ subject: { name: "X", show: "a single red apple" }, pictures: [{ id: "a", show: "a green apple" }, { id: "a", show: "a yellow apple" }], style: "flat illustration" }));
  });

  it("paints only the pictures the views use, the subject first", () => {
    const beats = [{ visual: { skill: "render-subject", views: [{ view: "swap", picture: "white" }] } }, { visual: { skill: "render-subject", views: [{ view: "hero" }] } }];
    assert.deepEqual(picturesUsed(scene, beats), ["main", "white"]);
  });

  it("asks for the subject alone on the scene's background, and for later pictures in the subject's style", () => {
    const first = subjectPrompt(scene, scene.subject.show, false);
    assert.match(first, /#1b2130 at the top fading to #07080d/);
    assert.doesNotMatch(first, /reference picture/);
    assert.match(subjectPrompt(scene, "the same glass, half full of white wine", true), /reference picture is the video's subject/);
  });

  it("finds the subject in a picture painted on a plain background", () => {
    const w = 20;
    const h = 40;
    const rgb = Buffer.alloc(w * h * 3);
    // a background that gets much lighter toward the top, as painted backgrounds do
    for (let i = 0; i < w * h; i++) rgb.set([30, 60 + Math.round((1 - Math.floor(i / w) / h) * 90), 60], i * 3);
    // the subject: a block from x 5–14, y 10–29, plus one speck of grain that must not count
    for (let y = 10; y < 30; y++) for (let x = 5; x < 15; x++) rgb.set([200, 40, 60], (y * w + x) * 3);
    rgb.set([255, 255, 255], (2 * w + 18) * 3);
    assert.deepEqual(boxOf(rgb, w, h), { x0: 5 / w, y0: 10 / h, x1: 15 / w, y1: 30 / h });
    assert.throws(() => boxOf(Buffer.alloc(w * h * 3), w, h), /no subject/);
  });

  it("counts a number up to its value and leaves other values alone", () => {
    assert.equal(countingValue("-224 °C", 0.5), "-112 °C");
    assert.equal(countingValue("54", 1), "54");
    assert.equal(countingValue("2.5 km", 0), "0.0 km");
    assert.equal(countingValue("1 in 3", 1), "1 in 3");
    assert.equal(countingValue("Bordeaux", 0.3), "Bordeaux");
  });

  it('"chunks" captions hold at most three words on one line', () => {
    const words: TimedWord[] = "one two three four five six seven".split(" ").map((text, i) => ({ i, text, start: i * 0.3, end: i * 0.3 + 0.25, beat: "b1" }) as TimedWord);
    const pages = buildPages(words, (t) => estimateWidth(t, 74, false), 900, 1, 30, 0.35, 3);
    assert.deepEqual(pages.map((p) => p.lines.flatMap((l) => l.words.map((w) => w.text)).join(" ")), ["one two three", "four five six", "seven"]);
    assert.ok(pages.every((p) => p.lines.length === 1));
  });
});
