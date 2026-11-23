import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { activeWordIndex, buildPages, estimateWidth, pageAt } from "../skills/captions/pages.ts";
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
});
