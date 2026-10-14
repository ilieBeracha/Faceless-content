import { existsSync } from "node:fs";
import { join } from "node:path";
import { commitPaths } from "../../core/git.ts";
import type { LlmProviderName } from "../../core/tasks.ts";
import { readJson } from "../../core/util.ts";
import type { Workspace } from "../../core/workspace.ts";
import { listEpisodes, loadEpisode, makeEpisode, readScript, STEPS, type StepName } from "../../pipeline/episode.ts";
import { approveFactcheck, readFactcheck, rejectFactcheck } from "../../pipeline/factcheck.ts";
import { outputPath } from "../../render/render-episode.ts";
import { heading, log, next, ok, statusColor, table } from "../ui.ts";
import { loadChannel } from "../../core/channels.ts";

export async function makeEpisodeCommand(ws: Workspace, opts: { channel: string; series: string; idea?: string; new?: boolean; episode?: string; redo?: string; llm: LlmProviderName }): Promise<void> {
  const redo = (opts.redo ?? "").split(",").map((s) => s.trim()).filter(Boolean) as StepName[];
  const ep = await makeEpisode(ws, { channel: opts.channel, series: opts.series, idea: opts.idea, newEpisode: opts.new, episode: opts.episode, redo, llm: opts.llm, log: (l) => log(l) });
  ok(`Episode ${ep.state.id} is done — QA passed`);
  log(`  video:   ${ws.rel(outputPath(ws, ep.channel.slug, ep.state.id))}`);
  log(`  report:  ${ws.rel(join(ep.dir, "qa-report.md"))}`);
  log(`  publish: ${ws.rel(join(ep.dir, "publish.json"))} (not posted — posting isn't built yet)`);
}

export function approveFactcheckCommand(ws: Workspace, channel: string, episode: string, by: string): void {
  const ep = loadEpisode(ws, channel, episode);
  const script = readScript(ep);
  approveFactcheck(ep.dir, script, by);
  commitPaths(ws, [join(ep.dir, "factcheck.md")], `${channel}: fact-check for ${episode} approved by ${by}`);
  ok(`Fact-check approved by ${by} (${script.claims.length} claims). The approval is tied to this exact script — any change to words or numbers needs a new approval.`);
  next([`Continue: ./engine make episode --channel ${channel} --series ${ep.state.series}`]);
}

export function rejectFactcheckCommand(ws: Workspace, channel: string, episode: string, reason: string): void {
  const ep = loadEpisode(ws, channel, episode);
  rejectFactcheck(ep.dir, reason);
  commitPaths(ws, [join(ep.dir, "factcheck.md")], `${channel}: fact-check for ${episode} needs changes`);
  ok("Marked the fact-check as changes-requested.");
  next([`Revise ${ws.rel(join(ep.dir, "script.json"))}, then: ./engine make episode --channel ${channel} --series ${ep.state.series}`]);
}

export function episodeStatus(ws: Workspace, channel: string, episode?: string): void {
  const ch = loadChannel(ws, channel);
  const episodes = listEpisodes(ch).filter((e) => !episode || e.id === episode);
  for (const e of episodes) {
    heading(`${e.id} — ${e.title}`);
    log(`  series ${e.series} · idea ${e.idea} · ${statusColor(e.status)}`);
    for (const step of STEPS) {
      const s = e.steps[step];
      log(`  ${s?.status === "done" ? "✔" : s ? "…" : "·"} ${step.padEnd(10)} ${s ? statusColor(s.status) : ""} ${s?.note ?? ""}`);
    }
    const dir = join(ch.dir, "episodes", e.id);
    const fc = readFactcheck(dir);
    if (fc) log(`  fact-check: ${statusColor(fc.status)}${fc.approvedBy ? ` by ${fc.approvedBy}` : ""}`);
    const out = outputPath(ws, ch.slug, e.id);
    if (existsSync(out)) log(`  video: ${ws.rel(out)}`);
  }
  if (!episodes.length) log("  (no episodes)");
}

export function listEpisodesTable(ws: Workspace, channels: string[]): void {
  const rows: string[][] = [];
  for (const slug of channels) {
    const ch = loadChannel(ws, slug);
    for (const e of listEpisodes(ch)) {
      const steps = STEPS.map((s) => (e.steps[s]?.status === "done" ? "✔" : e.steps[s] ? "…" : "·")).join("");
      const render = join(ch.dir, "episodes", e.id, "render.json");
      const secs = existsSync(join(ch.dir, "episodes", e.id, "audio", "timings.json")) ? `${readJson<{ duration: number }>(join(ch.dir, "episodes", e.id, "audio", "timings.json")).duration.toFixed(1)}s` : "";
      rows.push([slug, e.id, e.series, statusColor(e.status), steps, secs, existsSync(render) ? ws.rel(outputPath(ws, slug, e.id)) : ""]);
    }
  }
  table(["channel", "episode", "series", "status", "i s f v r q", "length", "video"], rows);
}
