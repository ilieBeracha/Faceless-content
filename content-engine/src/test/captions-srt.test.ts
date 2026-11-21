import { test } from "node:test";
import assert from "node:assert/strict";
import { captionsSrt } from "../skills/captions/srt.ts";

const w = (i: number, beat: string, text: string, start: number, end: number) => ({ i, beat, text, start, end });

test("captions come as an .srt file: lines of at most 16 characters, never across two beats, broken after a sentence", () => {
  const srt = captionsSrt(
    [w(0, "hook", "צרפת", 0.1, 0.4), w(1, "hook", "הפסידה", 0.4, 0.8), w(2, "hook", "ביין.", 0.8, 1.2), w(3, "hook", "והיא", 1.3, 1.5), w(4, "scene", "בפריז,", 2.0, 2.4), w(5, "scene", "במאי", 2.4, 2.7), w(6, "scene", "1976", 2.7, 3.6)],
    16,
    2,
  );
  assert.equal(
    srt,
    "1\n00:00:00,100 --> 00:00:01,300\nצרפת הפסידה\nביין.\n\n2\n00:00:01,300 --> 00:00:02,000\nוהיא\n\n3\n00:00:02,000 --> 00:00:03,950\nבפריז, במאי 1976\n",
  );
});
