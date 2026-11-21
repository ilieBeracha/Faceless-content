import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadChannel } from "../core/channels.ts";
import { languageOf } from "../core/languages.ts";
import { bannedTopicHits, hookLimit, hookTiming, letters, speechSeconds } from "../pipeline/script-check.ts";
import { estimateWidth } from "../skills/captions/pages.ts";
import { orderSeed } from "../storefront/builder.ts";
import type { Order } from "../storefront/store.ts";
import { wordTimings } from "../voice/elevenlabs.ts";
import { makeChannel, tempWorkspace } from "./helpers.ts";

const george = { voice: { provider: "elevenlabs", voice_id: "George", language: "he" } };

describe("Hebrew channels", () => {
  it("counts a Hebrew hook in letters (written without most vowels), a digit as a short word", () => {
    assert.equal(letters("פקק הברגה?"), 8);
    assert.equal(letters("ב־1976."), 1 + 4 * 5);
  });

  it("limits and times a Hebrew hook by George's measured rate per letter", () => {
    const ws = tempWorkspace();
    assert.deepEqual(hookLimit(ws, george), { unit: "letters", max: 14 }, "1.9 s of room at 0.135 s a letter");
    const t = hookTiming(ws, george, "פקק הברגה?");
    assert.equal(t.unit, "letters");
    assert.equal(t.count, 8);
    assert.ok(Math.abs(t.seconds - (0.1 + 8 * 0.135)) < 1e-9);
    // The whole George sample (13.76 s) and a 37.3 s episode were the fit: its length is counted in letters, within 8%.
    const line = "פקק הברגה? זה יין זול. ככה כולם חושבים. אבל בניו זילנד, כמעט תשעה מתוך עשרה יינות נסגרים בפקק הברגה, וזה בכוונה. אז לפני שאתם מתנשאים, תבדקו את העובדות.";
    assert.ok(Math.abs(speechSeconds(ws, george, line) / 13.76 - 1) < 0.08, `estimated ${speechSeconds(ws, george, line)} s`);
  });

  it("limits a hook for Erez, the native Hebrew voice, by his own measured rate", () => {
    const ws = tempWorkspace();
    const erez = { voice: { provider: "elevenlabs-direct", voice_id: "AZzja2JCoYeMe9vDQBll", language: "he" } };
    assert.deepEqual(hookLimit(ws, erez), { unit: "letters", max: 15 }, "1.9 s of room at 0.12 s a letter");
    // His hook "עש אמיתי תקע מחשב." (14 letters) ended at 1.71 s: the estimate may not be earlier than that.
    assert.ok(hookTiming(ws, erez, "עש אמיתי תקע מחשב.").seconds >= 1.71);
    assert.equal(languageOf("he").voice?.voice_id, "AZzja2JCoYeMe9vDQBll", "Hebrew channels get Erez");
  });

  it("refuses to estimate a language whose speaking rate was never measured", () => {
    const ws = tempWorkspace();
    assert.throws(() => hookLimit(ws, { voice: { provider: "elevenlabs", voice_id: "George", language: "fr" } }), /no measured speaking rate for the language "fr"/);
  });

  it("screens Hebrew text for a Hebrew banned topic, through the prefixes Hebrew adds", () => {
    const ws = tempWorkspace();
    makeChannel(ws, "he-test", { banned: ["הימורים"] });
    const ch = loadChannel(ws, "he-test");
    assert.deepEqual(bannedTopicHits(ch, ["בואו נדבר על ההימורים באינטרנט."]).map((h) => h.topic), ["הימורים"]);
    assert.deepEqual(bannedTopicHits(ch, ["פקק הברגה זה לא יין זול."]), []);
  });

  it("gives Hebrew letters a real width, so a caption line isn't packed past its box", () => {
    const w = estimateWidth("שלום", 100, false);
    assert.ok(w > 200 && w < 260, `שלום is ${w}px at 100px`);
  });

  it("times Hebrew caption words from the voice's characters, without the punctuation after them", () => {
    const say = ["פקק", "הברגה?", "זה", "יין", "זול."];
    const chars = [...say.join(" ")];
    const run = { characters: chars, character_start_times_seconds: chars.map((_, i) => i * 0.1), character_end_times_seconds: chars.map((_, i) => (i + 1) * 0.1) };
    const words = wordTimings(say, [run]);
    assert.equal(words.length, 5);
    // "הברגה?" is characters 4–9; it ends with its last letter (index 8), not the question mark.
    assert.ok(Math.abs(words[1].end - 0.9) < 1e-9);
  });

  it("knows which languages read right to left, and refuses one it doesn't support", () => {
    assert.equal(languageOf("he").rtl, true);
    assert.equal(languageOf("en").rtl, false);
    assert.throws(() => languageOf("xx"), /isn't supported/);
  });

  it("tells the drafter a Hebrew channel's viewer-facing words are Hebrew and its language is he", () => {
    const seed = orderSeed({ intake: { idea: "יין", audience: "מבוגרים", tone: "עוקצני", look: "x", look_note: "", avatar: "x", host: "", avoid: "", contact_name: "x", email: "x@y.z", language: "he" }, design: null } as unknown as Order);
    assert.match(seed, /The videos are in Hebrew \(עברית\)[\s\S]*Set `language: he` in channel\.md/);
    assert.doesNotMatch(orderSeed({ intake: { idea: "wine", audience: "adults", tone: "dry", look: "x", look_note: "", avatar: "x", host: "", avoid: "", contact_name: "x", email: "x@y.z" }, design: null } as unknown as Order), /The videos are in/);
  });
});
