import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { QUALITY_CHECKS } from "../qa/qa.ts";
import { failureReason } from "../storefront/pages.ts";

describe("storefront: why a video stopped", () => {
  it("says what the customer can act on, and keeps the engine's words when no plainer ones fit", () => {
    assert.match(failureReason("Gemini API POST models/gemini-2.5-flash-image:generateContent failed (429): Your project has exceeded its monthly spending cap. Please go to AI Studio"), /^The picture service refused the request: its monthly spending limit is reached\./);
    assert.equal(
      failureReason('QA failed — see channels/ord-d4f51a1b/episodes/2026-11-19-noble-rot/qa-report.md   - Fact-check approved: pending Fix what it lists (usually script.json), then run the same command again.'),
      "The finished video did not pass a check that must pass: Fact-check approved: pending",
    );
    assert.match(failureReason('Channel "ord-1" has validation errors — fix them before making episodes.'), /channel's own files have a problem/);
    assert.equal(failureReason("the writer is down"), "the writer is down");
  });

  it("treats timing, placement and loudness as quality notes, and never the format, the facts or banned topics", () => {
    for (const id of ["length", "hook-line", "hook-speech", "hook-text", "safe-areas", "cut-off", "loudness"]) assert.ok(QUALITY_CHECKS.includes(id), id);
    for (const id of ["format", "factcheck", "banned-topics", "captions-sync", "footage-real", "footage-speech"]) assert.ok(!QUALITY_CHECKS.includes(id), id);
  });
});
