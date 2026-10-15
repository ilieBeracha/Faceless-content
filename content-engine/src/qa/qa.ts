/**
 * QA step. Automated checks first (measured on the rendered MP4 and the render's layout probes),
 * then an agent review of tone, banned topics and the sampled frames. Writes qa-report.md, and on
 * a pass: publish.json (with the AI-disclosure fields) and a learnings.md entry.
 */
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ContextBundle } from "../core/context.ts";
import { hasFilter, measureLoudness, probe, runFfmpeg } from "../core/ffmpeg.ts";
import { runTask, type LlmProviderName, type Task } from "../core/tasks.ts";
import { nowIso, readJson, readText, today, writeJson, writeText } from "../core/util.ts";
import type { Workspace } from "../core/workspace.ts";
import type { EpisodeRef } from "../pipeline/episode.ts";
import { readFactcheck } from "../pipeline/factcheck.ts";
import { allText, bannedTopicHits, factualHash, type SeriesData } from "../pipeline/script-check.ts";
import type { LayoutSummary } from "../render/render-episode.ts";
import { outputPath } from "../render/render-episode.ts";
import { activeWordIndex } from "../skills/captions/pages.ts";
import { footagePaths, readLedger, spent, type FootageState } from "../skills/render-ai-video/footage.ts";
import { firstSentence, voiceTokens, type Script } from "../skills/write-script/schema.ts";
import { voicePaths, type Timings } from "../voice/synthesize.ts";

export interface Check {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface QaReview {
  render_hash: string;
  tone: { pass: boolean; notes: string };
  banned_topics: { pass: boolean; notes: string };
  visuals: { pass: boolean; notes: string };
  character: { pass: boolean; notes: string };
  overall: "pass" | "fail";
  fixes: string[];
  learnings: string[];
}

export async function runQa(ws: Workspace, ep: EpisodeRef, script: Script, opts: { llm: LlmProviderName; log: (l: string) => void; fresh: boolean }): Promise<{ passed: boolean; summary: string; failures: string[] }> {
  const log = opts.log;
  const checks = automatedChecks(ws, ep, script);
  const renderHash = readJson<{ inputs_hash: string }>(join(ep.dir, "render.json")).inputs_hash;
  const frames = sampleFrames(ws, ep, Math.max(4, ws.config.qa.frames_to_sample), opts.fresh);
  writeJson(join(ep.dir, "qa", "automated.json"), { checked_at: nowIso(), render_hash: renderHash, checks });
  const failedAuto = checks.filter((c) => !c.pass);
  log(`• QA: ${checks.length - failedAuto.length}/${checks.length} automated checks passed`);

  const reviewPath = join(ep.dir, "qa-review.json");
  let review: QaReview | null = existsSync(reviewPath) ? readJson<QaReview>(reviewPath) : null;
  if (review && review.render_hash !== renderHash) review = null;
  if (!review) {
    writeReport(ws, ep, script, checks, null, frames);
    await runTask(ws, reviewTask(ws, ep, script, checks, frames, renderHash), opts.llm);
    review = readJson<QaReview>(reviewPath);
  }

  const bannedHits = checks.find((c) => c.id === "banned-topics");
  if (bannedHits && !bannedHits.pass && review.banned_topics.pass) {
    bannedHits.pass = true;
    bannedHits.detail += " — reviewed: false positive";
  }
  const reviewPass = review.overall === "pass" && review.tone.pass && review.banned_topics.pass && review.visuals.pass && review.character.pass;
  const failures = [...checks.filter((c) => !c.pass).map((c) => `${c.label}: ${c.detail}`), ...(reviewPass ? [] : ["Agent review: " + (review.fixes.join("; ") || "failed")])];
  const passed = failures.length === 0;
  writeReport(ws, ep, script, checks, review, frames, passed);
  if (passed) {
    writePublishMetadata(ws, ep, script);
    appendLearnings(ws, ep, script, review);
  }
  return { passed, summary: passed ? "all checks passed" : `${failures.length} problem(s)`, failures };
}

function automatedChecks(ws: Workspace, ep: EpisodeRef, script: Script): Check[] {
  const cfg = ws.config;
  const series = ep.channel.series.get(ep.series)!.data as unknown as SeriesData;
  const out = outputPath(ws, ep.channel.slug, ep.state.id);
  const timings = readJson<Timings>(voicePaths(ep.dir).timings);
  const envelope = readJson<{ values: number[] }>(voicePaths(ep.dir).envelope).values;
  const layout = readJson<LayoutSummary>(join(ep.dir, "qa", "layout.json"));
  const checks: Check[] = [];
  const add = (id: string, label: string, pass: boolean, detail: string) => checks.push({ id, label, pass, detail });

  const p = probe(out);
  add("format", "Format", p.width === cfg.video.width && p.height === cfg.video.height && Math.abs((p.fps ?? 0) - cfg.video.fps) < 0.01 && p.videoCodec === "h264" && p.audioCodec === "aac", `${p.width}×${p.height} @ ${p.fps?.toFixed(2)} fps, ${p.videoCodec}/${p.audioCodec}, ${p.pixFmt}`);
  const { min_seconds: min, max_seconds: max } = series.length;
  add("length", "Length", p.duration >= min - 0.05 && p.duration <= max + 0.05, `${p.duration.toFixed(2)}s (series allows ${min}–${max}s)`);

  const hookWords = voiceTokens(firstSentence(script.beats[0].voiceover)).length;
  const hookEnd = timings.words[hookWords - 1]?.end ?? Infinity;
  add("hook-speech", "Hook: speech starts immediately", timings.speech_start <= cfg.hook.speech_starts_by_seconds, `first word at ${timings.speech_start.toFixed(2)}s (limit ${cfg.hook.speech_starts_by_seconds}s)`);
  add("hook-line", "Hook: first line lands in 2 s", hookEnd <= cfg.hook.hook_line_ends_by_seconds, `"${firstSentence(script.beats[0].voiceover)}" ends at ${hookEnd.toFixed(2)}s (limit ${cfg.hook.hook_line_ends_by_seconds}s)`);
  if (script.beats[0].on_screen_text) {
    const f = layout.firstHeadlineFrame;
    add("hook-text", "Hook: on-screen text", f !== null && f / cfg.video.fps <= cfg.hook.on_screen_by_seconds, f === null ? "headline never seen by the layout probe" : `visible from ${(f / cfg.video.fps).toFixed(2)}s`);
  }

  const outside = Object.entries(layout.violationCounts).filter(([k]) => k.endsWith(":outside-safe-area"));
  add("safe-areas", "Text inside safe areas", outside.length === 0, outside.length ? outside.map(([k, n]) => `${k.replace(":outside-safe-area", "")} (${n} frames)`).join(", ") : `${Object.keys(layout.elements).length} text elements checked on every frame (${layout.probes} measurements)`);
  const cut = Object.entries(layout.violationCounts).filter(([k]) => k.endsWith(":cut-off") || k.endsWith(":text-overflow"));
  add("cut-off", "Nothing cut off", cut.length === 0, cut.length ? cut.map(([k, n]) => `${k} (${n} frames)`).join(", ") : "no element leaves the frame or overflows its box");

  // Captions: same words as the script, highlight matches the timings, and timings match the audio.
  const scriptWords = script.beats.flatMap((b) => voiceTokens(b.voiceover));
  const sameWords = scriptWords.length === timings.words.length && scriptWords.every((w, i) => w === timings.words[i].text);
  let mismatched = 0;
  let probed = 0;
  for (const [f, word] of Object.entries(layout.captionWord)) {
    if (word < 0) continue;
    probed++;
    const t = Number(f) / cfg.video.fps;
    const expected = activeWordIndex(timings.words, t);
    const nearby = [-1, 0, 1].map((d) => activeWordIndex(timings.words, t + (d * cfg.qa.caption_sync_tolerance_frames) / cfg.video.fps));
    if (word !== expected && !nearby.includes(word)) mismatched++;
  }
  const voiced = timings.words.filter((w) => w.end - w.start >= 0.12);
  const quiet = voiced.filter((w) => {
    const a = Math.floor(w.start * cfg.video.fps);
    const b = Math.max(a + 1, Math.ceil(w.end * cfg.video.fps));
    const vals = envelope.slice(a, b);
    return vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length) < 0.12;
  });
  const syncOk = sameWords && probed > 0 && mismatched / probed <= cfg.qa.caption_sync_max_bad_ratio && quiet.length <= Math.ceil(voiced.length * 0.03);
  add(
    "captions-sync",
    "Captions in sync",
    syncOk,
    `${timings.words.length} words; text matches script: ${sameWords ? "yes" : "NO"}; highlight off on ${mismatched}/${probed} frames; words over silent audio: ${quiet.length}${quiet.length ? ` (${quiet.slice(0, 4).map((w) => w.text).join(", ")})` : ""}`,
  );

  const loud = measureLoudness(out);
  const lufsOk = Math.abs(loud.integratedLufs - cfg.audio.target_lufs) <= cfg.audio.lufs_tolerance;
  add("loudness", "Loudness", lufsOk && loud.truePeakDb <= cfg.audio.true_peak_max_db + 0.3, `${loud.integratedLufs.toFixed(1)} LUFS (target ${cfg.audio.target_lufs} ±${cfg.audio.lufs_tolerance}), true peak ${loud.truePeakDb.toFixed(1)} dBTP (max ${cfg.audio.true_peak_max_db})`);

  const hits = bannedTopicHits(ep.channel, allText(script));
  add("banned-topics", "Banned topics (keyword screen)", hits.length === 0, hits.length ? hits.map((h) => `"${h.topic}" ~ "${h.match}"`).join("; ") : `none of ${((ep.channel.doc.data.banned_topics as string[]) ?? []).length} banned topics mentioned`);

  if (series.skills.render.includes("render-ai-video")) {
    const fp = footagePaths(ep.dir);
    const state = existsSync(fp.state) ? readJson<FootageState>(fp.state) : null;
    const shots = Object.entries(state?.shots ?? {}).filter(([id]) => (timings.clips ?? []).some((c) => c.id === id));
    const fake = shots.filter(([, s]) => s.clip?.fake || s.still?.fake);
    add("footage-real", "Footage is real (not placeholders)", shots.length > 0 && fake.length === 0, fake.length ? `${fake.length} placeholder clip(s) made with ENGINE_AI_VIDEO_FAKE=1 — generate real footage first` : `${shots.length} clips from ${ws.config.ai_video.video_model}`);
    const wrong = shots.filter(([, s]) => s.clip?.speech?.same_words !== true);
    add("footage-speech", "Every clip says its line", shots.length > 0 && wrong.length === 0, wrong.length ? wrong.map(([id, s]) => `${id}: heard "${s.clip?.speech?.transcript ?? "?"}"`).join("; ") : `${shots.length} clips checked by ear`);
    const ledger = readLedger(ws, ep.dir);
    add("footage-budget", "Within budget", spent(ledger) <= ledger.budget_usd + 1e-9, `$${spent(ledger).toFixed(2)} spent of $${ledger.budget_usd.toFixed(2)} (${ledger.entries.length} paid calls logged in footage/ledger.json)`);
  }

  const fc = readFactcheck(ep.dir);
  add("factcheck", "Fact-check approved", Boolean(fc && fc.status === "approved" && fc.scriptHash === factualHash(script)), fc ? `${fc.status} by ${fc.approvedBy ?? "—"} (${script.claims.length} claims)` : "missing");
  return checks;
}

function sampleFrames(ws: Workspace, ep: EpisodeRef, count: number, fresh: boolean): string[] {
  const dir = join(ep.dir, "qa", "frames");
  const out = outputPath(ws, ep.channel.slug, ep.state.id);
  if (!fresh && existsSync(dir) && readdirSync(dir).length >= count) return readdirSync(dir).filter((f) => f.endsWith(".jpg")).sort().map((f) => join(dir, f));
  mkdirSync(dir, { recursive: true });
  const duration = probe(out).duration;
  const times = [0.5, 1.5, ...Array.from({ length: count - 2 }, (_, i) => ((i + 1) / (count - 1)) * (duration - 0.6))];
  const files: string[] = [];
  for (const t of times) {
    const file = join(dir, `t${t.toFixed(1).padStart(5, "0")}s.jpg`);
    runFfmpeg(["-y", "-ss", t.toFixed(2), "-i", out, "-frames:v", "1", "-vf", "scale=540:-1", "-q:v", "3", file], "extracting a QA frame");
    files.push(file);
  }
  if (hasFilter("tile") && process.platform !== "win32") {
    try {
      runFfmpeg(["-y", "-pattern_type", "glob", "-i", join(dir, "t*.jpg"), "-frames:v", "1", "-vf", `tile=${Math.ceil(files.length / 2)}x2`, join(ep.dir, "qa", "contact-sheet.jpg")], "building the contact sheet");
    } catch {
      // The individual frames are enough for the review.
    }
  }
  return files;
}

function reviewTask(ws: Workspace, ep: EpisodeRef, script: Script, checks: Check[], frames: string[], renderHash: string): Task {
  const series = ep.channel.series.get(ep.series)!;
  const ctx = new ContextBundle(ws, { purpose: "qa-review", channel: ep.channel.slug, series: ep.series, skills: [], globals: ["workflows/qa.md"] });
  ctx.addFile("workflows/qa.md", "workflow");
  ctx.addFile(ep.channel.doc.rel, "channel");
  ctx.addFile(series.rel, "channel");
  for (const name of (series.data.characters as string[]) ?? []) ctx.addFile(ep.channel.characters.get(name)!.rel, "channel");
  ctx.addFile(ws.rel(join(ep.dir, "script.json")), "channel");
  ctx.addInline("automated QA results", checks.map((c) => `- [${c.pass ? "x" : " "}] ${c.label}: ${c.detail}`).join("\n"));
  const reviewPath = join(ep.dir, "qa-review.json");
  const instructions = `
Review the rendered episode **${ep.state.id}** against \`workflows/qa.md\` and this channel's definition.

1. Look at every sampled frame (open the images):
${frames.map((f) => `   - \`${ws.rel(f)}\``).join("\n")}
   The full video is \`${ws.rel(outputPath(ws, ep.channel.slug, ep.state.id))}\`.
${(series.data.skills as SeriesData["skills"]).render.includes("render-ai-video") ? "   This is **realistic AI footage**: also check that it is the same person in every shot, nothing looks fake up close (hands, teeth, eyes, morphing), no letters, subtitles or logos are burned into the footage, the place and clothes fit the era, and the lips match the words.\n" : ""}2. Judge: **tone** (matches the channel's tone and audience?), **banned topics** (anything that touches them, even indirectly? If the keyword screen flagged something, decide whether it is a false positive), **visuals** (readable, on-model, nothing cut off or overlapping, the visual style the series promises), **character** (looks and sounds like its character file).
3. Write \`${ws.rel(reviewPath)}\` as JSON:

\`\`\`json
{
  "render_hash": "${renderHash}",
  "tone": { "pass": true, "notes": "…" },
  "banned_topics": { "pass": true, "notes": "…" },
  "visuals": { "pass": true, "notes": "…" },
  "character": { "pass": true, "notes": "…" },
  "overall": "pass",
  "fixes": [],
  "learnings": ["What worked or didn't for THIS channel, phrased so the next script can use it"]
}
\`\`\`

Be strict: a fail sends the episode back for fixes. Learnings are appended to this channel's learnings.md only.
`;
  return {
    id: "qa-review",
    title: `QA review of ${ep.state.id}`,
    dir: ep.dir,
    context: ctx,
    instructions,
    outputs: [{ path: reviewPath, format: "json", description: "the QA review" }],
    next: `./engine make episode --channel ${ep.channel.slug} --series ${ep.series}`,
  };
}

function writeReport(ws: Workspace, ep: EpisodeRef, script: Script, checks: Check[], review: QaReview | null, frames: string[], passed?: boolean): void {
  const status = passed === undefined ? "PENDING REVIEW" : passed ? "PASS" : "FAIL";
  const rows = checks.map((c) => `| ${c.pass ? "✅" : "❌"} | ${c.label} | ${c.detail.replace(/\|/g, "\\|")} |`).join("\n");
  const reviewRows = review
    ? (["tone", "banned_topics", "visuals", "character"] as const).map((k) => `| ${review[k].pass ? "✅" : "❌"} | ${k.replace("_", " ")} | ${review[k].notes.replace(/\|/g, "\\|")} |`).join("\n")
    : "| ⏳ | agent review | waiting for `qa-review.json` |";
  const body = [
    `# QA report — ${script.title}`,
    "",
    `**Status: ${status}** · episode \`${ep.state.id}\` · channel \`${ep.channel.slug}\` · series \`${ep.series}\` · ${today()}`,
    "",
    `Checklist: \`workflows/qa.md\`. Video: \`${ws.rel(outputPath(ws, ep.channel.slug, ep.state.id))}\` (not in git).`,
    "",
    "## Automated checks",
    "",
    "| | Check | Result |",
    "|---|---|---|",
    rows,
    "",
    "## Agent review",
    "",
    "| | Area | Notes |",
    "|---|---|---|",
    reviewRows,
    "",
    review && review.fixes.length ? `**Fixes requested:**\n${review.fixes.map((f) => `- ${f}`).join("\n")}\n` : "",
    "## Sampled frames",
    "",
    frames.map((f) => `- \`${ws.rel(f)}\``).join("\n"),
    "",
  ].join("\n");
  writeText(join(ep.dir, "qa-report.md"), body);
}

function writePublishMetadata(ws: Workspace, ep: EpisodeRef, script: Script): void {
  const platforms = (ep.channel.doc.data.platforms as string[]) ?? [];
  const path = join(ep.dir, "publish.json");
  if (existsSync(path)) return;
  const series = ep.channel.series.get(ep.series)!.data as unknown as SeriesData;
  const realistic = series.skills.render.includes("render-ai-video");
  writeJson(path, {
    status: "not-posted",
    $comment: "Posting is not built yet. Nothing here is sent anywhere.",
    title: script.publish.title,
    description: script.publish.description,
    hashtags: script.publish.hashtags,
    video: ws.rel(outputPath(ws, ep.channel.slug, ep.state.id)),
    ai_disclosure: {
      ai_generated: true,
      label_as_ai_generated: true,
      details: realistic
        ? `Photorealistic AI video: footage, the person on screen and the voice are generated by Google Veo (${ws.config.ai_video.video_model}); the person is fictional, not a real human. Script drafted by an AI agent. Facts reviewed by a person.`
        : "Script drafted by an AI agent, voice synthesised (Kokoro TTS), visuals rendered procedurally. Facts reviewed by a person.",
      realistic,
      platforms: Object.fromEntries(platforms.map((p) => [p, { label_required: realistic ? "yes — realistic AI-generated person and voice" : "check at posting time", how: ws.config.platforms[p]?.ai_disclosure ?? "", labeled: false }])),
    },
    made_for_kids: Boolean((ep.channel.doc.data.audience as { made_for_kids?: boolean } | undefined)?.made_for_kids),
    platforms,
  });
}

function appendLearnings(ws: Workspace, ep: EpisodeRef, script: Script, review: QaReview): void {
  const t = readJson<Timings>(voicePaths(ep.dir).timings);
  const entry = [
    "",
    `## ${today()} · ${ep.state.id}`,
    "",
    `- Episode: "${script.title}" (${ep.series}) — ${t.duration.toFixed(1)}s, ${t.words.length} words, ${t.loudness.integrated_lufs.toFixed(1)} LUFS. QA passed.`,
    ...review.learnings.map((l) => `- ${l}`),
    "",
  ].join("\n");
  const path = ep.channel.learningsPath;
  const text = existsSync(path) ? readText(path) : `# Learnings — ${String(ep.channel.doc.data.name)}\n`;
  if (!text.includes(`· ${ep.state.id}`)) writeText(path, text.trimEnd() + "\n" + entry);
}
