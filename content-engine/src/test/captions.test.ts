import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { activeWordIndex, buildPages, estimateWidth } from "../skills/captions/pages.ts";
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
