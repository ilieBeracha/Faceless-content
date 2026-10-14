import { existsSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { channelStatus, listChannelSlugs, loadChannel, validateChannel, type Channel } from "../../core/channels.ts";
import { listDrafts, validateDraft } from "../../core/drafts.ts";
import { EngineError } from "../../core/errors.ts";
import { listSkills } from "../../core/skills.ts";
import { readJson } from "../../core/util.ts";
import { formatIssues, hasErrors, type Issue } from "../../core/validate.ts";
import type { Workspace } from "../../core/workspace.ts";
import { listEpisodes } from "../../pipeline/episode.ts";
import type { SeriesData } from "../../pipeline/script-check.ts";
import { KOKORO_VOICES } from "../../voice/voices.ts";
import { heading, log, statusColor, table } from "../ui.ts";
import { listEpisodesTable } from "./episode.ts";

function counts(ch: Channel) {
  const ideas = { new: 0, used: 0, rejected: 0 } as Record<string, number>;
  for (const i of ch.ideas) ideas[i.status] = (ideas[i.status] ?? 0) + 1;
  const episodes = listEpisodes(ch);
  return { ideas, episodes, done: episodes.filter((e) => e.status === "done").length };
}

export function list(ws: Workspace, what: string, opts: { channel?: string; status?: string }): void {
  const slugs = opts.channel ? [opts.channel] : listChannelSlugs(ws);
  if (opts.channel) loadChannel(ws, opts.channel);
  switch (what) {
    case "channels": {
      table(
        ["channel", "name", "status", "niche", "chars", "series", "ideas new/used/rej", "episodes done/all"],
        slugs.map((s) => {
          const ch = loadChannel(ws, s);
          const c = counts(ch);
          return [s, String(ch.doc.data.name ?? ""), statusColor(channelStatus(ch)), String(ch.doc.data.niche ?? ""), String(ch.characters.size), String(ch.series.size), `${c.ideas.new ?? 0}/${c.ideas.used ?? 0}/${c.ideas.rejected ?? 0}`, `${c.done}/${c.episodes.length}`];
        }),
      );
      return;
    }
    case "characters": {
      const rows: string[][] = [];
      for (const s of slugs) {
        const ch = loadChannel(ws, s);
        for (const [name, doc] of ch.characters) {
          const model = existsSync(doc.modelPath) ? readJson<{ rig: string }>(doc.modelPath).rig : "(no model.json)";
          const voice = doc.data.voice as { provider?: string; voice_id?: string; speed?: number } | undefined;
          rows.push([s, name, String(doc.data.display_name ?? ""), model, `${voice?.provider}/${voice?.voice_id} ×${voice?.speed ?? 1}`, String(doc.data.concept ?? "")]);
        }
      }
      table(["channel", "character", "display name", "rig", "voice", "concept"], rows);
      return;
    }
    case "series": {
      const rows: string[][] = [];
      for (const s of slugs) {
        const ch = loadChannel(ws, s);
        for (const [slug, doc] of ch.series) {
          const d = doc.data as unknown as SeriesData;
          rows.push([s, slug, d.name, statusColor(d.status), `${d.length?.min_seconds}–${d.length?.max_seconds}s`, (d.characters ?? []).join(", "), (d.skills?.render ?? []).join(" + "), (d.beats ?? []).map((b) => b.id).join(" → ")]);
        }
      }
      table(["channel", "series", "name", "status", "length", "characters", "render skills", "beats"], rows);
      return;
    }
    case "ideas": {
      if (!opts.channel) throw new EngineError("list ideas needs --channel <slug>.");
      const ch = loadChannel(ws, opts.channel);
      table(["id", "series", "status", "title", "note"], ch.ideas.filter((i) => !opts.status || i.status === opts.status).map((i) => [i.id, i.series, statusColor(i.status), i.title, i.fields.used_in ?? i.fields.rejected_reason ?? i.angle ?? ""]));
      return;
    }
    case "episodes":
      listEpisodesTable(ws, slugs);
      return;
    case "drafts":
      table(["draft", "kind", "channel", "status", "title"], listDrafts(ws).filter((d) => !opts.channel || d.channel === opts.channel).filter((d) => !opts.status || d.status === opts.status).map((d) => [d.rel, d.kind, d.channel ?? "—", statusColor(d.status), d.ideaCounts ? `${d.title} (${Object.entries(d.ideaCounts).map(([k, v]) => `${v} ${k}`).join(", ")})` : d.title]));
      return;
    case "skills":
      table(["skill", "kind", "layer", "description"], listSkills(ws).map((s) => [s.name, s.kind, s.layer ?? "", s.description]));
      return;
    case "voices":
      table(["voice id", "description", "quality"], KOKORO_VOICES.map((v) => [v.id, v.desc, v.grade]));
      log(pc.dim("All free and local (Kokoro, Apache-2.0). Paid providers are listed in the README; none is wired up until you choose one."));
      return;
    default:
      throw new EngineError(`Can't list "${what}".`, "Try: channels, characters, series, ideas, episodes, drafts, skills, voices");
  }
}

export function compare(ws: Workspace, slugs: string[]): void {
  if (slugs.length < 2) throw new EngineError("Give at least two channel slugs to compare.");
  const chans = slugs.map((s) => loadChannel(ws, s));
  const row = (label: string, f: (c: Channel) => string) => [pc.bold(label), ...chans.map(f)];
  const stats = chans.map((c) => {
    const eps = listEpisodes(c).filter((e) => e.status === "done");
    const durations = eps.map((e) => join(c.dir, "episodes", e.id, "audio", "timings.json")).filter(existsSync).map((p) => readJson<{ duration: number }>(p).duration);
    return { eps, avg: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0 };
  });
  const rows = [
    row("name", (c) => String(c.doc.data.name)),
    row("status", (c) => statusColor(channelStatus(c))),
    row("niche", (c) => String(c.doc.data.niche)),
    row("audience", (c) => `${(c.doc.data.audience as { who: string; age_range: string })?.who} (${(c.doc.data.audience as { age_range: string })?.age_range})`),
    row("tone", (c) => ((c.doc.data.tone as string[]) ?? []).join(", ")),
    row("platforms", (c) => ((c.doc.data.platforms as string[]) ?? []).join(", ")),
    row("cadence", (c) => String(c.doc.data.cadence)),
    row("font / colors", (c) => {
      const b = c.doc.data.brand as Record<string, string>;
      return `${b?.font} ${b?.primary_color} ${b?.accent_color}`;
    }),
    row("characters", (c) => [...c.characters.values()].map((d) => `${d.data.display_name} (${existsSync(d.modelPath) ? readJson<{ rig: string }>(d.modelPath).rig : "?"}, ${(d.data.voice as { voice_id: string })?.voice_id})`).join("; ")),
    row("series", (c) => [...c.series.values()].map((d) => `${d.data.name} [${((d.data.skills as { render: string[] })?.render ?? []).join("+")}]`).join("; ")),
    row("ideas new/used/rej", (c) => {
      const k = counts(c).ideas;
      return `${k.new ?? 0}/${k.used ?? 0}/${k.rejected ?? 0}`;
    }),
    row("episodes done", (_c) => ""),
    row("banned topics", (c) => String(((c.doc.data.banned_topics as string[]) ?? []).length)),
  ];
  rows[11] = [pc.bold("episodes done / avg length"), ...stats.map((s) => `${s.eps.length} / ${s.avg ? s.avg.toFixed(1) + "s" : "—"}`)];
  table(["", ...slugs], rows);
}

export function validate(ws: Workspace, opts: { channel?: string; drafts?: boolean }): boolean {
  const issues: Issue[] = [];
  const slugs = opts.channel ? [opts.channel] : listChannelSlugs(ws);
  for (const s of slugs) issues.push(...validateChannel(ws, loadChannel(ws, s)));
  if (opts.drafts || !opts.channel) for (const d of listDrafts(ws).filter((d) => d.status === "proposed")) issues.push(...validateDraft(ws, d));
  heading(`Validated ${slugs.length} channel(s)${opts.drafts || !opts.channel ? " and open drafts" : ""} against templates/`);
  log(formatIssues(issues));
  return !hasErrors(issues);
}
