import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { ContextBundle } from "../core/context.ts";
import { runTask, type GeminiResponse, type Task } from "../core/tasks.ts";
import type { Workspace } from "../core/workspace.ts";
import { tempWorkspace } from "./helpers.ts";

// The Gemini API is never called: fetch is replaced by a stand-in that records each request and replies in turn.
const realFetch = globalThis.fetch;
let requests: { url: string; body: Record<string, unknown> }[] = [];
let replies: GeminiResponse[] = [];
let pages: Record<string, string> = {};

beforeEach(() => {
  process.env.GEMINI_API_KEY = "test-key";
  requests = [];
  replies = [];
  pages = {};
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    if (url.startsWith("https://vertexaisearch.cloud.google.com/grounding-api-redirect/")) {
      const page = pages[url];
      return page ? new Response(null, { status: 302, headers: { location: page } }) : new Response("gone", { status: 404 });
    }
    requests.push({ url, body: JSON.parse(String(init.body)) });
    const reply = replies.shift();
    assert.ok(reply, "the test sent more requests than it has replies");
    return new Response(JSON.stringify(reply), { status: 200 });
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const answer = (text: string, finishReason = "STOP"): GeminiResponse => ({
  candidates: [{ content: { role: "model", parts: [{ text: "thinking out loud", thought: true }, { text, thoughtSignature: "sig" }] }, finishReason }],
  usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
});

function jsonTask(ws: Workspace, opts: Partial<Task> = {}): Task {
  return {
    id: "demo",
    title: "Demo task",
    dir: ws.root,
    context: new ContextBundle(ws, { purpose: "research", skills: [] }),
    instructions: "Write the demo.",
    outputs: [{ path: join(ws.root, "out.json"), format: "json", description: "the demo" }],
    next: "./engine nothing",
    ...opts,
  };
}

test("gemini writes the task's output from the answer, without the thoughts or code fences", async () => {
  const ws = tempWorkspace();
  replies.push(answer('```json\n{"ok": true}\n```'));
  await runTask(ws, jsonTask(ws), "gemini");
  assert.deepEqual(JSON.parse(readFileSync(join(ws.root, "out.json"), "utf8")), { ok: true });
  const { url, body } = requests[0];
  assert.match(url, new RegExp(`models/${ws.config.llm.gemini.model}:generateContent$`));
  assert.equal(body.tools, undefined, "a task that isn't research gets no search");
  assert.deepEqual((body.generationConfig as { thinkingConfig: unknown }).thinkingConfig, { thinkingLevel: ws.config.llm.gemini.thinking_level });
});

test("a research task gets Google Search and URL context, and is told its search limit", async () => {
  const ws = tempWorkspace();
  replies.push(answer("{}"));
  await runTask(ws, jsonTask(ws, { research: { maxSearches: 7 } }), "gemini");
  const body = requests[0].body as { tools: unknown; contents: { parts: { text?: string }[] }[] };
  assert.deepEqual(body.tools, [{ google_search: {} }, { url_context: {} }]);
  assert.match(body.contents[0].parts.at(-1)!.text!, /at most 7 web searches/);
});

test("Google Search's redirect links become the pages they lead to, and one that leads nowhere is an error", async () => {
  const ws = tempWorkspace();
  const link = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQabc-_=";
  pages[link] = "https://example.org/wine-study";
  replies.push(answer(JSON.stringify({ facts: [{ source: link }, { source: link }] })));
  await runTask(ws, jsonTask(ws, { research: { maxSearches: 3 } }), "gemini");
  assert.deepEqual(JSON.parse(readFileSync(join(ws.root, "out.json"), "utf8")), { facts: [{ source: "https://example.org/wine-study" }, { source: "https://example.org/wine-study" }] });
  replies.push(answer(JSON.stringify({ source: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQgone" })));
  await assert.rejects(runTask(ws, jsonTask(ws), "gemini"), /did not lead to a page \(status 404\)/);
});

test("problems the check finds go back with the model's own turn, and the fixed answer is kept", async () => {
  const ws = tempWorkspace();
  let calls = 0;
  replies.push(answer('{"draft": 1}'), answer('{"draft": 2}'));
  await runTask(ws, jsonTask(ws, { check: () => (++calls === 1 ? ["needs a title"] : []) }), "gemini");
  assert.deepEqual(JSON.parse(readFileSync(join(ws.root, "out.json"), "utf8")), { draft: 2 });
  const second = requests[1].body as { contents: { role: string; parts: { text?: string; thoughtSignature?: string }[] }[] };
  assert.equal(second.contents[1].role, "model");
  assert.equal(second.contents[1].parts[1].thoughtSignature, "sig", "the thought signature is sent back as it came");
  assert.match(second.contents[2].parts[0].text!, /needs a title/);
});

test("an answer cut off by the token limit, stopped early or blocked is an error, not a file", async () => {
  const ws = tempWorkspace();
  replies.push(answer('{"half":', "MAX_TOKENS"));
  await assert.rejects(runTask(ws, jsonTask(ws), "gemini"), /hit max_output_tokens/);
  replies.push(answer("", "SAFETY"));
  await assert.rejects(runTask(ws, jsonTask(ws), "gemini"), /finish reason: SAFETY/);
  replies.push({ promptFeedback: { blockReason: "PROHIBITED_CONTENT" } });
  await assert.rejects(runTask(ws, jsonTask(ws), "gemini"), /blocked .*PROHIBITED_CONTENT/);
});

test("without GEMINI_API_KEY the gemini provider stops before calling anything", async () => {
  const ws = tempWorkspace();
  delete process.env.GEMINI_API_KEY;
  const google = process.env.GOOGLE_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  try {
    await assert.rejects(runTask(ws, jsonTask(ws), "gemini"), /GEMINI_API_KEY is not set/);
    assert.equal(requests.length, 0);
  } finally {
    if (google !== undefined) process.env.GOOGLE_API_KEY = google;
  }
});
