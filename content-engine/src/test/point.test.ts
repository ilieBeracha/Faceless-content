import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { loadChannel, validateChannel } from "../core/channels.ts";
import { PipelinePause } from "../core/errors.ts";
import { writeJson } from "../core/util.ts";
import { makeEpisode } from "../pipeline/episode.ts";
import { brandKit } from "../storefront/brand-kit.ts";
import { makeChannel, passScriptReview, sampleScript, tempWorkspace } from "./helpers.ts";

/** Start an episode of the test channel and return its folder (the writer is waiting). */
async function startEpisode(ws: ReturnType<typeof tempWorkspace>): Promise<string> {
  await assert.rejects(makeEpisode(ws, { channel: "alpha", series: "inside", llm: "agent" }), (e: unknown) => e instanceof PipelinePause && e.kind === "waiting-for-agent");
  const ch = loadChannel(ws, "alpha");
  return join(ch.dir, ch.ideas.find((i) => i.id === "a-ballpoint-pen")!.fields.used_in!);
}

describe("a channel's point of view", () => {
  it("a channel needs a Belief and What the viewer gets", () => {
    const ws = tempWorkspace();
    makeChannel(ws, "alpha", { status: "active" });
    const ch = loadChannel(ws, "alpha");
    writeFileSync(ch.doc.abs, readFileSync(ch.doc.abs, "utf8").replace(/## Belief[^]*?(?=## What the viewer gets)/, "## Belief <!-- required -->\n\n<!-- to do -->\n\n"));
    const errors = validateChannel(ws, loadChannel(ws, "alpha")).filter((i) => i.level === "error").map((i) => i.message);
    assert.deepEqual(errors, ['section "## Belief" is empty']);
  });

  it("the writer is given the channel's belief and what the viewer gets", async () => {
    const ws = tempWorkspace();
    makeChannel(ws, "alpha", { status: "active" });
    const task = readFileSync(join(await startEpisode(ws), "tasks", "script.md"), "utf8");
    assert.match(task, /Every everyday object is a clever answer to a problem somebody once had\./);
    assert.match(task, /The one why behind something they use every day\./);
  });

  it("a new script without an angle is sent back before the fact-check", async () => {
    const ws = tempWorkspace();
    makeChannel(ws, "alpha", { status: "active" });
    const dir = await startEpisode(ws);
    const { angle: _none, ...bare } = sampleScript("alpha");
    writeJson(join(dir, "script.json"), bare);
    await assert.rejects(makeEpisode(ws, { channel: "alpha", series: "inside", llm: "agent" }), (e: unknown) => e instanceof PipelinePause && e.kind === "needs-fix" && /has no "angle"/.test(e.lines.join(" ")));
    writeJson(join(dir, "script.json"), sampleScript("alpha"));
    passScriptReview(dir, sampleScript("alpha"));
    await assert.rejects(makeEpisode(ws, { channel: "alpha", series: "inside", llm: "agent" }), (e: unknown) => e instanceof PipelinePause && e.kind === "awaiting-approval");
  });

  it("the brand kit shows the belief and what the viewer gets", () => {
    const ws = tempWorkspace();
    makeChannel(ws, "alpha", { status: "active" });
    const kit = brandKit(ws, "alpha");
    assert.equal(kit.belief, "Every everyday object is a clever answer to a problem somebody once had.");
    assert.equal(kit.gets, "The one why behind something they use every day.");
  });
});
