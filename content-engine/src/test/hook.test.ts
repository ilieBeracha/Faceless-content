import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LENGTH_MARGIN, budgetWordsPerSecond, hookLimit, hookTiming, pauseSeconds, speechSeconds, syllables, wordSyllables } from "../pipeline/script-check.ts";
import { tempWorkspace } from "./helpers.ts";

const kokoro = (speed: number) => ({ voice: { provider: "kokoro", voice_id: "af_bella", speed } });

describe("hook timing, estimated before the voice exists", () => {
  it("counts spoken syllables", () => {
    assert.equal(syllables("Venus's day outlasts its year."), 8);
    assert.equal(syllables("Does toast always land butter-down?"), 8);
    assert.equal(syllables("A real moth jammed a computer."), 8);
    assert.equal(syllables("Why doesn't your pen leak?"), 6);
    assert.equal(wordSyllables("phone"), 1);
    assert.equal(wordSyllables("table"), 2);
    assert.equal(wordSyllables("boxes"), 2);
    assert.equal(wordSyllables("landed"), 2);
    assert.equal(wordSyllables("1947."), 6, "a number is said in words");
  });

  it("rejects the hooks that ran over 2 s once voiced, and keeps one that landed in time", () => {
    const ws = tempWorkspace();
    // Both were voiced at speed 1.0 and ended at 2.06 s and 2.13 s: over the 2.0 s limit.
    for (const s of ["Venus's day outlasts its year.", "Does toast always land butter-down?"]) {
      const h = hookTiming(ws, kokoro(1), s);
      assert.ok(h.seconds > h.limit, `${s} ≈ ${h.seconds}s`);
    }
    // Voiced at speed 1.06, it ended at 1.91 s.
    const moth = hookTiming(ws, kokoro(1.06), "A real moth jammed a computer.");
    assert.ok(moth.seconds <= moth.limit, `moth ≈ ${moth.seconds}s`);
  });

  it("tells the writer how many syllables fit, more for a faster voice", () => {
    const ws = tempWorkspace();
    assert.deepEqual(hookLimit(ws, kokoro(1)), { unit: "syllables", max: 7 });
    assert.ok(hookLimit(ws, kokoro(1.2)).max > 7);
    assert.equal(hookLimit(ws, { voice: { provider: "veo", voice_id: "x" } }).unit, "words");
  });
});

describe("video length, estimated before the voice exists", () => {
  const wine = { voice: { provider: "kokoro", voice_id: "am_fenrir", speed: 0.92, sentence_pause: 0.5, clause_pause: 0.15 } };

  it("adds the pauses the voice makes at sentence ends and clause breaks, by the voice's own settings", () => {
    const line = "Swirl. A film climbs, then falls — slowly.";
    assert.ok(Math.abs(pauseSeconds(wine, line) - (2 * 0.5 + 2 * 0.15)) < 1e-9);
    assert.ok(Math.abs(pauseSeconds(kokoro(1), line) - (2 * 0.25 + 2 * 0.1)) < 1e-9, "a voice without pause settings gets the voice step's defaults");
    assert.ok(Math.abs(speechSeconds(tempWorkspace(), wine, line) - (7 / (3.24 * 0.92) + 1.3)) < 1e-9);
  });

  it("gives a slow voice with long pauses a smaller word budget: the 103-word script that ran 47.7 s no longer fits 30–45 s", () => {
    const ws = tempWorkspace();
    const wps = budgetWordsPerSecond(ws, wine);
    assert.ok(wps < budgetWordsPerSecond(ws, kokoro(1)));
    const a = ws.config.audio;
    const overhead = 6 * a.beat_gap_seconds + a.lead_in_seconds + a.outro_hold_seconds;
    const most = Math.round((45 * (1 - LENGTH_MARGIN) - overhead) * wps);
    assert.ok(most < 103, `budget tops out at ${most} words`);
  });
});
