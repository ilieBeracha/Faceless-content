/**
 * The episode pipeline — identical for every channel:
 *
 *   idea → script → fact-check (STOP for human approval) → voice → render → QA
 *
 * Each step writes its result into channels/<channel>/episodes/<date>-<idea>/ and the pipeline is
 * resumable: run `make episode` again and it continues from the first unfinished step.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { channelStatus, loadChannel, seriesDoc, validateChannel, type Channel } from "../core/channels.ts";
import { ContextBundle } from "../core/context.ts";
import { EngineError, PipelinePause, ValidationError } from "../core/errors.ts";
import { commitPaths } from "../core/git.ts";
import { parseIdeas, updateIdea, type Idea } from "../core/ideas.ts";
import { listSkills } from "../core/skills.ts";
import { runTask, type LlmProviderName, type Task } from "../core/tasks.ts";
import { nowIso, readJson, readText, today, writeJson, writeText } from "../core/util.ts";
import { formatIssues, hasErrors } from "../core/validate.ts";
import type { Workspace } from "../core/workspace.ts";
import type { Script } from "../skills/write-script/schema.ts";
import { readFactcheck, writeFactcheck } from "./factcheck.ts";
import { checkScript, factualHash, WORDS_PER_SECOND, type CharacterVoice, type SeriesData } from "./script-check.ts";

export const STEPS = ["idea", "script", "factcheck", "voice", "render", "qa"] as const;
export type StepName = (typeof STEPS)[number];

export interface EpisodeState {
  id: string;
  channel: string;
  series: string;
  idea: string;
  title: string;
  created: string;
  updated: string;
  status: "in-progress" | "done";
  steps: Partial<Record<StepName, { status: "done" | "waiting" | "failed"; at: string; note?: string }>>;
}

export interface EpisodeRef {
  ws: Workspace;
  channel: Channel;
  series: string;
  dir: string;
  state: EpisodeState;
}

export interface MakeEpisodeOptions {
  channel: string;
  series: string;
  idea?: string;
  /** Start a new episode even if one is in progress for this channel + series. */
  newEpisode?: boolean;
  /** Continue a specific episode (folder name). */
  episode?: string;
  llm?: LlmProviderName;
  /** Steps to run again even if already done (e.g. ["voice", "render"]). */
  redo?: StepName[];
  log?: (line: string) => void;
}

export function episodesDir(channel: Channel): string {
  return join(channel.dir, "episodes");
}

export function listEpisodes(channel: Channel): EpisodeState[] {
  const dir = episodesDir(channel);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((d) => existsSync(join(dir, d, "episode.json")))
    .sort()
    .map((d) => readJson<EpisodeState>(join(dir, d, "episode.json")));
}

export function loadEpisode(ws: Workspace, channelSlug: string, episodeId: string): EpisodeRef {
  const channel = loadChannel(ws, channelSlug);
  const dir = join(episodesDir(channel), episodeId);
  if (!existsSync(join(dir, "episode.json"))) {
    const known = listEpisodes(channel).map((e) => e.id);
    throw new EngineError(`Channel "${channelSlug}" has no episode "${episodeId}".`, known.length ? `Episodes: ${known.join(", ")}` : "Make one with ./engine make episode");
  }
  const state = readJson<EpisodeState>(join(dir, "episode.json"));
  return { ws, channel, series: state.series, dir, state };
}

function saveState(ep: EpisodeRef): void {
  ep.state.updated = nowIso();
  writeJson(join(ep.dir, "episode.json"), ep.state);
}

function mark(ep: EpisodeRef, step: StepName, status: "done" | "waiting" | "failed", note?: string): void {
  ep.state.steps[step] = { status, at: nowIso(), ...(note ? { note } : {}) };
  saveState(ep);
}

export function readScript(ep: EpisodeRef): Script {
  const path = join(ep.dir, "script.json");
  const check = checkScript(ep.ws, readJson(path), { channel: ep.channel, series: ep.series, idea: ep.state.idea });
  if (!check.script || check.errors.length) {
    throw new PipelinePause("needs-fix", [`${ep.ws.rel(path)} has problems:`, ...check.errors.map((e) => `  - ${e}`), "Fix the script, then run the same command again."]);
  }
  return check.script;
}

export async function makeEpisode(ws: Workspace, opts: MakeEpisodeOptions): Promise<EpisodeRef> {
  const log = opts.log ?? (() => {});
  const llm = opts.llm ?? ws.config.llm.provider;
  const channel = loadChannel(ws, opts.channel);

  const issues = validateChannel(ws, channel);
  if (hasErrors(issues)) throw new ValidationError(`Channel "${channel.slug}" has validation errors — fix them before making episodes.`, formatIssues(issues));
  if (channelStatus(channel) !== "active") {
    throw new EngineError(`Channel "${channel.slug}" is ${channelStatus(channel)}, not active.`, channelStatus(channel) === "draft" ? `Review it, then approve it: ./engine approve channel ${channel.slug}` : `Reactivate it with: ./engine set-status channel ${channel.slug} active`);
  }
  const series = seriesDoc(channel, opts.series).data as unknown as SeriesData;
  if (series.status !== "active") throw new EngineError(`Series "${opts.series}" is ${series.status}, not active.`);

  const ep = findOrCreateEpisode(ws, channel, opts, log);
  const redo = new Set(opts.redo ?? []);
  const done = (step: StepName) => ep.state.steps[step]?.status === "done" && !redo.has(step);

  // 2. Script
  const scriptPath = join(ep.dir, "script.json");
  if (!existsSync(scriptPath) || redo.has("script")) {
    mark(ep, "script", "waiting");
    log(`• script: preparing the writing task (${llm})`);
    await runTask(ws, scriptTask(ws, ep, series), llm);
    commitPaths(ws, [ep.dir], `${channel.slug}: script for ${ep.state.id}`);
  }
  const script = readScript(ep);
  if (!done("script")) {
    ep.state.title = script.title;
    mark(ep, "script", "done");
    commitPaths(ws, [ep.dir], `${channel.slug}: script ready for ${ep.state.id}`);
  }
  log(`• script: ${script.beats.length} beats, ${script.claims.length} claims`);

  // 3. Fact-check — hard stop until a person approves the exact claims of this script.
  const hash = factualHash(script);
  let factcheck = readFactcheck(ep.dir);
  if (!factcheck || factcheck.scriptHash !== hash) {
    const path = writeFactcheck(ep.dir, script, { channel: channel.slug, episode: ep.state.id });
    mark(ep, "factcheck", "waiting", factcheck ? "script changed; claims need a fresh approval" : undefined);
    commitPaths(ws, [ep.dir], `${channel.slug}: fact-check list for ${ep.state.id}`);
    factcheck = readFactcheck(ep.dir)!;
    log(`• fact-check: wrote ${ws.rel(path)}`);
  }
  if (factcheck.status === "changes-requested") {
    throw new PipelinePause("needs-fix", [
      `The fact-check asked for changes: ${factcheck.notes ?? "(no notes)"}`,
      `Revise ${ws.rel(scriptPath)} (claims, sources, wording), then run the same command again.`,
    ]);
  }
  if (factcheck.status !== "approved") {
    throw new PipelinePause("awaiting-approval", [
      `Review every claim in ${ws.rel(join(ep.dir, "factcheck.md"))}.`,
      `Approve: ./engine approve factcheck --channel ${channel.slug} --episode ${ep.state.id} --by "<your name>"`,
      `Or ask for changes: ./engine reject factcheck --channel ${channel.slug} --episode ${ep.state.id} --reason "…"`,
      "Nothing is voiced or rendered until then.",
    ]);
  }
  if (!done("factcheck")) mark(ep, "factcheck", "done", `approved by ${factcheck.approvedBy}`);
  log(`• fact-check: approved by ${factcheck.approvedBy} (${factcheck.approvedAt})`);

  // 4. Voice
  const { synthesizeEpisode } = await import("../voice/synthesize.ts");
  const voice = await synthesizeEpisode(ws, ep, script, { force: redo.has("voice"), log });
  if (!done("voice") || voice.regenerated) {
    mark(ep, "voice", "done", `${voice.duration.toFixed(2)}s`);
    commitPaths(ws, [join(ep.dir, "audio"), join(ep.dir, "episode.json")], `${channel.slug}: voice for ${ep.state.id}`);
  }
  log(`• voice: ${voice.duration.toFixed(2)}s, ${voice.words} words${voice.regenerated ? "" : " (cached)"}`);

  // 5. Render
  const { renderEpisode } = await import("../render/render-episode.ts");
  const render = await renderEpisode(ws, ep, script, { force: redo.has("render") || voice.regenerated, log });
  if (!done("render") || render.regenerated) {
    mark(ep, "render", "done", ws.rel(render.output));
    commitPaths(ws, [join(ep.dir, "render.json"), join(ep.dir, "qa"), join(ep.dir, "episode.json")], `${channel.slug}: render for ${ep.state.id}`);
  }
  log(`• render: ${ws.rel(render.output)}${render.regenerated ? "" : " (cached)"}`);

  // 6. QA
  const { runQa } = await import("../qa/qa.ts");
  const qa = await runQa(ws, ep, script, { llm, log, fresh: render.regenerated || redo.has("qa") });
  mark(ep, "qa", qa.passed ? "done" : "failed", qa.summary);
  if (qa.passed) {
    ep.state.status = "done";
    saveState(ep);
  }
  commitPaths(ws, [ep.dir, channel.learningsPath], `${channel.slug}: QA ${qa.passed ? "passed" : "failed"} for ${ep.state.id}`);
  if (!qa.passed) {
    throw new PipelinePause("needs-fix", [`QA failed — see ${ws.rel(join(ep.dir, "qa-report.md"))}`, ...qa.failures.map((f) => `  - ${f}`), "Fix what it lists (usually script.json), then run the same command again."]);
  }
  return ep;
}

function findOrCreateEpisode(ws: Workspace, channel: Channel, opts: MakeEpisodeOptions, log: (l: string) => void): EpisodeRef {
  if (opts.episode) {
    const ep = loadEpisode(ws, channel.slug, opts.episode);
    if (ep.state.series !== opts.series) throw new EngineError(`Episode ${opts.episode} belongs to series "${ep.state.series}", not "${opts.series}".`);
    log(`Continuing ${ep.state.id}`);
    return ep;
  }
  if (!opts.newEpisode && !opts.idea) {
    const open = listEpisodes(channel).filter((e) => e.series === opts.series && e.status !== "done");
    if (open.length) {
      const latest = open[open.length - 1];
      log(`Continuing ${latest.id} (use --new to start another episode)`);
      return loadEpisode(ws, channel.slug, latest.id);
    }
  }
  const idea = pickIdea(channel, opts.series, opts.idea);
  let id = `${today()}-${idea.id}`;
  for (let n = 2; existsSync(join(episodesDir(channel), id)); n++) id = `${today()}-${idea.id}-${n}`;
  const dir = join(episodesDir(channel), id);
  const state: EpisodeState = {
    id,
    channel: channel.slug,
    series: opts.series,
    idea: idea.id,
    title: idea.title,
    created: nowIso(),
    updated: nowIso(),
    status: "in-progress",
    steps: { idea: { status: "done", at: nowIso(), note: idea.title } },
  };
  writeJson(join(dir, "episode.json"), state);
  writeText(channel.ideasPath, updateIdea(readText(channel.ideasPath), idea.id, { status: "used", used_in: `episodes/${id}` }));
  commitPaths(ws, [dir, channel.ideasPath], `${channel.slug}: start episode ${id} (idea "${idea.id}" → used)`);
  log(`• idea: "${idea.title}" → episodes/${id}`);
  return { ws, channel: { ...channel, ideas: parseIdeas(readText(channel.ideasPath)) }, series: opts.series, dir, state };
}

function pickIdea(channel: Channel, series: string, wanted?: string): Idea {
  if (wanted) {
    const idea = channel.ideas.find((i) => i.id === wanted);
    if (!idea) throw new EngineError(`No idea "${wanted}" in ${channel.slug}/ideas.md.`);
    if (idea.status !== "new") throw new EngineError(`Idea "${wanted}" is ${idea.status}, not new.`, idea.status === "rejected" ? `Reopen it first: ./engine idea reopen --channel ${channel.slug} ${wanted}` : undefined);
    if (idea.series !== series && idea.series !== "any") throw new EngineError(`Idea "${wanted}" is for series "${idea.series}", not "${series}".`);
    return idea;
  }
  const next = channel.ideas.find((i) => i.status === "new" && (i.series === series || i.series === "any"));
  if (!next) {
    throw new EngineError(`No "new" ideas left for series "${series}" in ${channel.slug}.`, `Add some: ./engine add ideas --channel ${channel.slug} --series ${series} "…"  or brainstorm: ./engine brainstorm ideas --channel ${channel.slug} --series ${series}`);
  }
  return next;
}

/** The writing task: AGENTS.md + this channel's files + only the skills this series uses. */
export function scriptTask(ws: Workspace, ep: EpisodeRef, series: SeriesData): Task {
  const ch = ep.channel;
  const skills = [series.skills.script, ...series.skills.render, series.skills.captions];
  const known = new Set(listSkills(ws).map((s) => s.name));
  const ctx = new ContextBundle(ws, { purpose: "script", channel: ch.slug, series: ep.series, skills });
  ctx.addFile(ws.rel(ch.doc.abs), "channel");
  ctx.addFile(ws.rel(ch.series.get(ep.series)!.abs), "channel");
  for (const name of series.characters) {
    const c = ch.characters.get(name)!;
    ctx.addFile(c.rel, "channel");
    ctx.addFile(ws.rel(c.modelPath), "channel");
  }
  ctx.addFile(ws.rel(ch.learningsPath), "channel", { optional: true });
  for (const skill of skills) if (known.has(skill)) ctx.addFile(`skills/${skill}/SKILL.md`, "skill");
  const idea = ch.ideas.find((i) => i.id === ep.state.idea)!;
  ctx.addInline("the idea for this episode", ["```", `id: ${idea.id}`, `title: ${idea.title}`, `angle: ${idea.angle ?? "(none)"}`, "```"].join("\n"));

  const speaker = ch.characters.get(series.characters[0])!;
  const speed = Number((speaker.data.voice as CharacterVoice | undefined)?.speed ?? 1);
  const wps = WORDS_PER_SECOND * speed;
  const { min_seconds: min, max_seconds: max } = series.length;
  const overhead = series.beats.length * ws.config.audio.beat_gap_seconds + ws.config.audio.lead_in_seconds + ws.config.audio.outro_hold_seconds;
  const lo = Math.round((min - overhead) * wps);
  const hi = Math.round((max - overhead) * wps * 0.95);
  const hookWords = Math.floor((ws.config.hook.hook_line_ends_by_seconds - ws.config.audio.lead_in_seconds) * wps);
  const scriptPath = join(ep.dir, "script.json");
  const banned = ((ch.doc.data.banned_topics as string[]) ?? []).join("; ");

  const instructions = `
Write the script for the idea **"${idea.title}"** (\`${idea.id}\`) as an episode of the series **${series.name}** on channel **${String(ch.doc.data.name)}**.

Follow \`skills/${series.skills.script}/SKILL.md\` exactly. In particular:

1. **Structure.** Use the series beats in this exact order: ${series.beats.map((b) => `\`${b.id}\``).join(" → ")}. Each beat's purpose is in the series file.
2. **Length.** The series runs ${min}–${max}s. At ${speaker.name}'s voice speed that is **${lo}–${hi} spoken words in total** (≈${wps.toFixed(1)} words/s).
3. **Hook.** The first sentence must be **${hookWords} words or fewer** so it lands within ${ws.config.hook.hook_line_ends_by_seconds}s, and the first beat needs \`on_screen_text\`.
4. **Voice.** Write the way the character in this channel talks (personality, vocabulary, catchphrases from its file — a catchphrase at most once, where it fits). Audience: ${JSON.stringify((ch.doc.data.audience as { who?: string })?.who ?? "")}.
5. **Facts.** Every factual statement (spoken, on screen, or in a label) goes into \`claims\` with a real, specific source you have checked (prefer manufacturers, standards bodies, encyclopedias, peer-reviewed or government sources). Never invent a source; if you can't verify something, cut it. A person approves this list before anything renders.
6. **Visuals.** Use only these render skills: ${series.skills.render.map((s) => `\`${s}\``).join(", ")}. Follow each skill's SKILL.md for the \`visuals\` payload and each beat's \`visual\` block.
7. **Banned topics** for this channel (never touch them): ${banned || "none listed"}.
8. **Learnings.** Apply what \`learnings.md\` says worked or failed for this channel.
9. **Publish metadata.** Fill \`publish\` (title, description, up to 5 hashtags). Don't add AI-label text — the engine adds the AI disclosure fields itself.

Write the JSON to \`${ws.rel(scriptPath)}\` (schema \`script/v1\`, documented in the write-script skill).
`;
  return {
    id: "script",
    title: `Write the script for ${ep.state.id}`,
    dir: ep.dir,
    context: ctx,
    instructions,
    outputs: [{ path: scriptPath, format: "json", description: "the episode script (script/v1)" }],
    next: `./engine make episode --channel ${ch.slug} --series ${ep.series}`,
    check: () => {
      const r = checkScript(ws, readJson(scriptPath), { channel: ep.channel, series: ep.series, idea: ep.state.idea });
      return r.errors;
    },
  };
}
