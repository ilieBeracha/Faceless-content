import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { loadChannel } from "../core/channels.ts";
import { PipelinePause } from "../core/errors.ts";
import type { GeminiResponse } from "../core/tasks.ts";
import { MAX_REVIEW_FIXES, makeEpisode } from "../pipeline/episode.ts";
import { quoteProblems, type DossierFact } from "../pipeline/research.ts";
import { scriptReviewHash } from "../pipeline/script-review.ts";
import { makeChannel, sampleScript, tempWorkspace, writeDossier } from "./helpers.ts";

// Nothing leaves the machine: fetch answers web pages from `pages` and Gemini calls from `replies`, in turn.
const realFetch = globalThis.fetch;
let pages: Record<string, Response> = {};
let replies: (() => GeminiResponse)[] = [];
let prompts: string[] = [];

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-key";
  pages = {};
  replies = [];
  prompts = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (url.startsWith("https://generativelanguage.googleapis.com/")) {
      const body = JSON.parse(String(init!.body)) as { contents: { parts: { text?: string }[] }[] };
      prompts.push(body.contents[0].parts.map((p) => p.text ?? "").join(""));
      const reply = replies.shift();
      assert.ok(reply, "the test sent more Gemini requests than it has replies");
      return new Response(JSON.stringify(reply()), { status: 200 });
    }
    const page = pages[url];
    assert.ok(page, `the test opened a page it has no answer for: ${url}`);
    return page.clone();
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const html = (body: string) => new Response(`<html><head><style>p{}</style></head><body>${body}</body></html>`, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
const fact = (id: string, source: string, quote: string): DossierFact => ({ id, fact: "…", source, quote });
const answer = (value: unknown): GeminiResponse => ({ candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(value) }] }, finishReason: "STOP" }] });

describe("research quotes are looked for on their pages", () => {
  it("a quote on its page passes, whatever the markup, punctuation, quote marks or case", async () => {
    pages["https://example.org/study"] = html("<p>The students used <em>&ldquo;red-wine&rdquo;</em> terms &mdash; to describe it.</p><p>Fifty&#45;four took part.</p>");
    assert.deepEqual(await quoteProblems([fact("f1", "https://example.org/study", 'the students used "red wine" terms, to describe it'), fact("f2", "https://example.org/study", "The students used … fifty-four took part")]), []);
  });

  it("a quote that isn't on the page, a page that won't open and a PDF are each a problem", async () => {
    pages["https://example.org/study"] = html("<p>Most of the students described it with red-wine words.</p>");
    pages["https://example.org/gone"] = new Response("nope", { status: 404 });
    pages["https://example.org/paper.pdf"] = new Response("%PDF", { status: 200, headers: { "content-type": "application/pdf" } });
    const problems = await quoteProblems([
      fact("f1", "https://example.org/study", "all of the students described it with red-wine words"),
      fact("f2", "https://example.org/study", "Most of the students … with white-wine words"),
      fact("f3", "https://example.org/gone", "anything"),
      fact("f4", "https://example.org/paper.pdf", "anything"),
    ]);
    assert.equal(problems.length, 4);
    assert.match(problems[0], /^fact f1: the quote .* is not on https:\/\/example\.org\/study/);
    assert.match(problems[1], /^fact f2: the quote/);
    assert.match(problems[2], /^fact f3: .* could not be opened \(status 404\)/);
    assert.match(problems[3], /^fact f4: .* is not a web page \(application\/pdf\)/);
  });
});

describe("an API writer fixes what the script review finds", () => {
  /** An episode of the test channel with its dossier, waiting for its script. */
  async function episodeWaitingForScript(ws: ReturnType<typeof tempWorkspace>): Promise<string> {
    makeChannel(ws, "alpha", { status: "active" });
    await assert.rejects(makeEpisode(ws, { channel: "alpha", series: "inside", llm: "agent" }), (e: unknown) => e instanceof PipelinePause && e.kind === "waiting-for-agent");
    const ch = loadChannel(ws, "alpha");
    const dir = join(ch.dir, ch.ideas.find((i) => i.id === "a-ballpoint-pen")!.fields.used_in!);
    writeDossier(dir);
    return dir;
  }
  const draft = (n: number) => ({ ...sampleScript("alpha"), title: `Inside a pen, draft ${n}` });
  const review = (script: object, verdict: "pass" | "fail") => () => answer({ script_hash: scriptReviewHash(script), verdict, issues: verdict === "fail" ? [{ beat: "kicker", problem: "ends on a moral", fix: "end on what happened" }] : [] });

  it("a failed review sends the script back to the writer with what it found, and the fixed script goes on to the fact-check", async () => {
    const ws = tempWorkspace();
    const dir = await episodeWaitingForScript(ws);
    replies.push(() => answer(draft(1)), review(draft(1), "fail"), () => answer(draft(2)), review(draft(2), "pass"));
    await assert.rejects(makeEpisode(ws, { channel: "alpha", series: "inside", llm: "gemini" }), (e: unknown) => e instanceof PipelinePause && e.kind === "awaiting-approval");
    assert.equal(replies.length, 0);
    assert.match(prompts[2], /This fixes a failed review/);
    assert.match(prompts[2], /kicker: ends on a moral → end on what happened/);
    assert.equal(JSON.parse(readFileSync(join(dir, "script.json"), "utf8")).title, "Inside a pen, draft 2");
  });

  it(`after ${MAX_REVIEW_FIXES} rewrites the failure stands where it blocks, and is a note on a customer's video`, async () => {
    const ws = tempWorkspace();
    await episodeWaitingForScript(ws);
    // Each rewrite is a new script, so each gets its own review.
    let n = 0;
    const failing = () => {
      const script = draft(++n);
      return [() => answer(script), review(script, "fail")];
    };
    replies.push(...failing(), ...Array.from({ length: MAX_REVIEW_FIXES }, failing).flat());
    await assert.rejects(makeEpisode(ws, { channel: "alpha", series: "inside", llm: "gemini" }), (e: unknown) => e instanceof PipelinePause && e.kind === "needs-fix" && /The script review failed/.test(e.lines.join(" ")));
    assert.equal(replies.length, 0);

    // The same episode as a customer's video: what is left is a note, and the fact-check comes next.
    replies.push(...Array.from({ length: MAX_REVIEW_FIXES }, failing).flat());
    await assert.rejects(makeEpisode(ws, { channel: "alpha", series: "inside", llm: "gemini", reviewBlocks: false }), (e: unknown) => e instanceof PipelinePause && e.kind === "awaiting-approval");
    assert.equal(replies.length, 0);
    // Run again, it doesn't rewrite a script whose review was already settled.
    await assert.rejects(makeEpisode(ws, { channel: "alpha", series: "inside", llm: "gemini", reviewBlocks: false }), (e: unknown) => e instanceof PipelinePause && e.kind === "awaiting-approval");
  });
});
