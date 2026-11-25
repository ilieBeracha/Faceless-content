import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { loadChannel } from "../core/channels.ts";
import { ContextBundle } from "../core/context.ts";
import { IsolationError, PipelinePause } from "../core/errors.ts";
import { writeJson } from "../core/util.ts";
import { makeEpisode } from "../pipeline/episode.ts";
import { approveFactcheck, readFactcheck } from "../pipeline/factcheck.ts";
import { checkScript, factualHash } from "../pipeline/script-check.ts";
import { makeChannel, passScriptReview, sampleScript, tempWorkspace } from "./helpers.ts";

describe("context isolation", () => {
  it("refuses another channel's files, unlisted skills and stray paths", () => {
    const ws = tempWorkspace();
    makeChannel(ws, "alpha");
    makeChannel(ws, "beta");
    const ctx = new ContextBundle(ws, { purpose: "script", channel: "alpha", skills: ["write-script"] });
    ctx.addFile("channels/alpha/channel.md", "channel");
    ctx.addFile("skills/write-script/SKILL.md", "skill");
    assert.throws(() => ctx.addFile("channels/beta/channel.md", "channel"), IsolationError);
    assert.throws(() => ctx.addFile("drafts/beta/ideas/x.md", "channel"), IsolationError);
    assert.throws(() => ctx.addFile("skills/render-motion-graphics/SKILL.md", "skill"), IsolationError);
    assert.throws(() => ctx.addFile("channels/alpha/../beta/channel.md", "channel"), IsolationError);
    assert.throws(() => ctx.addFile("README.md", "channel"), IsolationError);
    assert.deepEqual(ctx.manifest().files.map((f) => f.path), ["AGENTS.md", "channels/alpha/channel.md", "skills/write-script/SKILL.md"]);
  });

  it("the script task contains only AGENTS.md, this channel and the series' skills", async () => {
    const ws = tempWorkspace();
    makeChannel(ws, "alpha", { status: "active" });
    makeChannel(ws, "beta", { status: "active" });
    await assert.rejects(makeEpisode(ws, { channel: "alpha", series: "inside", llm: "agent" }), (e: unknown) => e instanceof PipelinePause && e.kind === "waiting-for-agent");
    const ep = loadChannel(ws, "alpha");
    const epDir = join(ep.dir, "episodes", readFileSync(join(ep.dir, "ideas.md"), "utf8").match(/used_in: episodes\/(\S+)/)![1]);
    const manifest = JSON.parse(readFileSync(join(epDir, "tasks", "script.manifest.json"), "utf8")) as { files: { path: string }[] };
    const paths = manifest.files.map((f) => f.path);
    assert.ok(paths.includes("AGENTS.md"));
    assert.ok(paths.every((p) => p === "AGENTS.md" || p.startsWith("channels/alpha/") || p.startsWith("skills/") || p.startsWith("(inline)")), paths.join("\n"));
    assert.deepEqual(paths.filter((p) => p.startsWith("skills/")).sort(), ["skills/captions/SKILL.md", "skills/render-3d-explainer/SKILL.md", "skills/render-talking-character/SKILL.md", "skills/write-script/SKILL.md"]);
    assert.ok(!readFileSync(join(epDir, "tasks", "script.md"), "utf8").includes("channels/beta"));
  });
});

describe("pipeline gates", () => {
  it("marks the idea used, waits for the script, then stops at the fact-check — nothing voiced before approval", async () => {
    const ws = tempWorkspace();
    makeChannel(ws, "alpha", { status: "active" });
    await assert.rejects(makeEpisode(ws, { channel: "alpha", series: "inside", llm: "agent" }), PipelinePause);
    const ch = loadChannel(ws, "alpha");
    const idea = ch.ideas.find((i) => i.id === "a-ballpoint-pen")!;
    assert.equal(idea.status, "used");
    const epDir = join(ch.dir, idea.fields.used_in!);
    const script = sampleScript("alpha");
    writeJson(join(epDir, "script.json"), script);
    // The script review comes first: no fact-check list until it passes.
    await assert.rejects(makeEpisode(ws, { channel: "alpha", series: "inside", llm: "agent" }), (e: unknown) => e instanceof PipelinePause && e.kind === "waiting-for-agent");
    assert.ok(existsSync(join(epDir, "tasks", "script-review.md")));
    assert.equal(readFactcheck(epDir), null);
    passScriptReview(epDir, script);
    await assert.rejects(makeEpisode(ws, { channel: "alpha", series: "inside", llm: "agent" }), (e: unknown) => e instanceof PipelinePause && e.kind === "awaiting-approval");
    assert.equal(readFactcheck(epDir)?.status, "pending");
    assert.equal(existsSync(join(epDir, "audio")), false);
  });

  it("refuses draft channels", async () => {
    const ws = tempWorkspace();
    makeChannel(ws, "alpha");
    await assert.rejects(makeEpisode(ws, { channel: "alpha", series: "inside", llm: "agent" }), /is draft, not active/);
  });

  it("an approval is bound to the exact words and numbers", async () => {
    const ws = tempWorkspace();
    makeChannel(ws, "alpha", { status: "active" });
    await assert.rejects(makeEpisode(ws, { channel: "alpha", series: "inside", llm: "agent" }), PipelinePause);
    const ch = loadChannel(ws, "alpha");
    const epDir = join(ch.dir, ch.ideas.find((i) => i.id === "a-ballpoint-pen")!.fields.used_in!);
    const script = sampleScript("alpha");
    writeJson(join(epDir, "script.json"), script);
    passScriptReview(epDir, script);
    await assert.rejects(makeEpisode(ws, { channel: "alpha", series: "inside", llm: "agent" }), PipelinePause);
    approveFactcheck(epDir, script, "Tester");
    assert.equal(readFactcheck(epDir)?.status, "approved");

    // A camera change keeps the approval; a word change doesn't.
    const camera = structuredClone(script);
    (camera.beats[1].visual as unknown as { shot: string }).shot = "orbit";
    assert.equal(factualHash(camera), factualHash(script));
    const words = structuredClone(script);
    words.beats[1].voiceover = words.beats[1].voiceover.replace("tiny", "huge");
    assert.notEqual(factualHash(words), factualHash(script));
    const label = structuredClone(script);
    (label.visuals["render-3d-explainer"] as { parts: { label: string }[] }).parts[1].label = "Steel ball";
    assert.notEqual(factualHash(label), factualHash(script));
    writeJson(join(epDir, "script.json"), words);
    passScriptReview(epDir, words);
    await assert.rejects(makeEpisode(ws, { channel: "alpha", series: "inside", llm: "agent" }), (e: unknown) => e instanceof PipelinePause && e.kind === "awaiting-approval");
    assert.equal(readFactcheck(epDir)?.status, "pending");
  });
});

describe("script review", () => {
  async function scripted(ws: ReturnType<typeof tempWorkspace>) {
    makeChannel(ws, "alpha", { status: "active" });
    makeChannel(ws, "beta", { status: "active" });
    await assert.rejects(makeEpisode(ws, { channel: "alpha", series: "inside", llm: "agent" }), PipelinePause);
    const ch = loadChannel(ws, "alpha");
    const epDir = join(ch.dir, ch.ideas.find((i) => i.id === "a-ballpoint-pen")!.fields.used_in!);
    const script = sampleScript("alpha");
    writeJson(join(epDir, "script.json"), script);
    return { epDir, script };
  }

  it("its task reads only this channel, and a failed review sends the script back before the fact-check", async () => {
    const ws = tempWorkspace();
    const { epDir, script } = await scripted(ws);
    await assert.rejects(makeEpisode(ws, { channel: "alpha", series: "inside", llm: "agent" }), (e: unknown) => e instanceof PipelinePause && e.kind === "waiting-for-agent");
    const manifest = JSON.parse(readFileSync(join(epDir, "tasks", "script-review.manifest.json"), "utf8")) as { files: { path: string }[] };
    assert.ok(manifest.files.every((f) => f.path === "AGENTS.md" || f.path.startsWith("channels/alpha/") || f.path === "skills/write-script/SKILL.md" || f.path.startsWith("(inline)")), manifest.files.map((f) => f.path).join("\n"));
    writeJson(join(epDir, "script-review.json"), { script_hash: JSON.parse(readFileSync(join(epDir, "tasks", "script-review.md"), "utf8").match(/"script_hash": (".*?")/)![1]), verdict: "fail", issues: [{ beat: "kicker", problem: "ends on a pun", fix: "end on what happened" }] });
    await assert.rejects(makeEpisode(ws, { channel: "alpha", series: "inside", llm: "agent" }), (e: unknown) => e instanceof PipelinePause && e.kind === "needs-fix" && /kicker: ends on a pun/.test(e.lines.join(" ")));
    assert.equal(readFactcheck(epDir), null);
    // A pass on an older script doesn't count: the changed script is reviewed again.
    passScriptReview(epDir, script);
    const changed = structuredClone(script);
    changed.beats[1].voiceover = changed.beats[1].voiceover.replace("tiny", "huge");
    writeJson(join(epDir, "script.json"), changed);
    await assert.rejects(makeEpisode(ws, { channel: "alpha", series: "inside", llm: "agent" }), (e: unknown) => e instanceof PipelinePause && e.kind === "waiting-for-agent");
    assert.equal(readFactcheck(epDir), null);
  });

  it("is skipped where review findings don't block", async () => {
    const ws = tempWorkspace();
    const { epDir } = await scripted(ws);
    await assert.rejects(makeEpisode(ws, { channel: "alpha", series: "inside", llm: "agent", reviewBlocks: false }), (e: unknown) => e instanceof PipelinePause && e.kind === "awaiting-approval");
    assert.equal(existsSync(join(epDir, "script-review.json")), false);
  });
});

describe("script checks", () => {
  it("catches structure, skill and hook problems", () => {
    const ws = tempWorkspace();
    makeChannel(ws, "alpha", { status: "active" });
    const ch = loadChannel(ws, "alpha");
    const bad = sampleScript("alpha");
    bad.beats = [bad.beats[1], bad.beats[0], bad.beats[2]];
    bad.beats[1].voiceover = "Have you ever wondered what is inside the pen you hold every day at school? " + bad.beats[1].voiceover;
    (bad.beats[2].visual as unknown as { skill: string }).skill = "render-motion-graphics";
    const { errors } = checkScript(ws, bad, { channel: ch, series: "inside", idea: "a-ballpoint-pen" });
    assert.ok(errors.some((e) => /beats must follow the series structure/.test(e)), errors.join("\n"));
    assert.ok(errors.some((e) => /not one of this series' render skills/.test(e)), errors.join("\n"));
    const ok = checkScript(ws, sampleScript("alpha"), { channel: ch, series: "inside", idea: "a-ballpoint-pen" });
    assert.deepEqual(ok.errors, []);
  });

  it("flags banned-topic keywords for review", () => {
    const ws = tempWorkspace();
    makeChannel(ws, "alpha", { status: "active", banned: ["weapons"] });
    const ch = loadChannel(ws, "alpha");
    const s = sampleScript("alpha");
    s.beats[2].voiceover = "Pens are mightier than weapons.";
    const { warnings } = checkScript(ws, s, { channel: ch, series: "inside", idea: "a-ballpoint-pen" });
    assert.ok(warnings.some((w) => /banned topic "weapons"/.test(w)), warnings.join("\n"));
  });
});


