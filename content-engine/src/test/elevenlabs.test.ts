import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";
import { readJson } from "../core/util.ts";
import { ENGINE_DIR } from "../core/workspace.ts";
import { spokenText, wordTimings, type CharTimings } from "../voice/elevenlabs.ts";

const runs = readJson<{ timestamps: CharTimings[] }>(join(ENGINE_DIR, "src", "test", "fixtures", "elevenlabs-timings.json")).timestamps;
const say = ["Rosé", "isn't", "half", "and", "half.", "Put", "that", "idea", "down"];

describe("elevenlabs voice: caption words from character timings", () => {
  it("times each word from its own characters, across the runs the API returns, without the punctuation after it", () => {
    assert.equal(spokenText(say), runs.map((r) => r.characters.join("")).join(""), "the recording is of exactly these words");
    const words = wordTimings(say, runs);
    assert.deepEqual(words.map((w) => w.i), say.map((_, i) => i));
    assert.equal(words[0].start, 0);
    for (const [k, w] of words.entries()) {
      assert.ok(w.end >= w.start, `"${say[k]}" ends after it starts`);
      if (k > 0) assert.ok(w.start >= words[k - 1].end - 1e-9, `"${say[k]}" starts after "${say[k - 1]}" ends`);
    }
    // "half." is the last word of the first sentence: it ends with its "f" (inside the second run, by 1.92 s), not with the full stop after it.
    assert.ok(words[4].end <= 1.92 && words[4].end > words[4].start);
    assert.ok(words[5].start >= 1.92, '"Put" starts in the third run');
    assert.equal(words.at(-1)!.end, runs.at(-1)!.character_end_times_seconds.at(-1));
  });

  it("refuses timings that are not for the words that were sent", () => {
    assert.throws(() => wordTimings([...say, "slowly."], runs), /caption words can't be timed/);
    assert.throws(() => wordTimings(["Rose", ...say.slice(1)], runs), /caption words can't be timed/);
  });
});
