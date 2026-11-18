/**
 * Brand kit: everything a customer signs off, read straight from a channel's files. Nothing here is
 * written by hand per customer — change the channel and the kit changes with it.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadChannel } from "../core/channels.ts";
import { readJson } from "../core/util.ts";
import type { Workspace } from "../core/workspace.ts";
import { episodesDir, listEpisodes } from "../pipeline/episode.ts";

export interface BrandKit {
  slug: string;
  name: string;
  promise: string;
  niche: string;
  audience: { who: string; age_range: string };
  language: string;
  cadence: string;
  platforms: string[];
  tone: string[];
  never: string[];
  styleNotes: string[];
  colours: { name: string; hex: string }[];
  font: string;
  host: { name: string; concept: string; look: string; personality: string[]; good_at: string[]; bad_at: string[]; catchphrases: string[]; voice: string };
  series: { name: string; format: string; visual_style: string; beats: { id: string; purpose: string }[] };
  /** `review`: what the QA agent review asked to change, when it didn't pass (shown as notes; it doesn't block storefront videos). */
  episodes: { id: string; title: string; frames: string[]; review: string[] }[];
}

const str = (v: unknown): string => (typeof v === "string" ? v : v === undefined || v === null ? "" : String(v));
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(str) : []);

/** The text under a `## Heading` in a markdown body, up to the next heading. */
function section(body: string, heading: string): string {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => l.replace(/<!--.*?-->/g, "").trim().toLowerCase() === `## ${heading.toLowerCase()}`);
  if (start === -1) return "";
  const end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  return lines.slice(start + 1, end === -1 ? undefined : end).join("\n").trim();
}

/** Where the engine writes an episode's video (same path as render-episode.ts's outputPath, without loading the renderer). */
export function videoPath(ws: Workspace, slug: string, episode: string): string {
  return ws.path("out", slug, `${episode}.mp4`);
}

export function framesDir(ws: Workspace, slug: string, episode: string): string {
  return join(episodesDir(loadChannel(ws, slug)), episode, "qa", "frames");
}

export function brandKit(ws: Workspace, slug: string): BrandKit {
  const channel = loadChannel(ws, slug);
  const c = channel.doc.data;
  const brand = (c.brand ?? {}) as Record<string, unknown>;
  const audience = (c.audience ?? {}) as Record<string, unknown>;
  const series = [...channel.series.values()].find((s) => s.data.status === "active") ?? [...channel.series.values()][0];
  if (!series) throw new Error(`Channel "${slug}" has no series, so there is no brand kit to show.`);
  const hostName = list(series.data.characters)[0];
  const host = channel.characters.get(hostName);
  if (!host) throw new Error(`Channel "${slug}": series "${str(series.data.slug)}" names host "${hostName}", which does not exist.`);
  const voice = (host.data.voice ?? {}) as Record<string, unknown>;
  const colours = [
    { name: "Primary", hex: str(brand.primary_color) },
    { name: "Accent", hex: str(brand.accent_color) },
    { name: "Background, top", hex: str(brand.background_top) },
    { name: "Background, bottom", hex: str(brand.background_bottom) },
    { name: "Text", hex: str(brand.text_color) },
    { name: "Captions", hex: str(brand.caption_color) },
  ].filter((x) => x.hex);
  const episodes = listEpisodes(channel)
    .filter((e) => e.status === "done" && existsSync(videoPath(ws, slug, e.id)))
    .map((e) => {
      const dir = join(episodesDir(channel), e.id, "qa", "frames");
      const all = existsSync(dir) ? readdirSync(dir).filter((f) => /^[\w.-]+\.jpg$/.test(f)).sort() : [];
      // Three frames spread across the video: near the start, the middle, near the end.
      const frames = all.length <= 3 ? all : [all[1], all[Math.floor(all.length / 2)], all[all.length - 2]];
      return { id: e.id, title: e.title, frames, review: reviewNotes(join(episodesDir(channel), e.id, "qa-review.json")) };
    });
  return {
    slug,
    name: str(c.name),
    promise: section(channel.doc.md.body, "Promise"),
    niche: str(c.niche),
    audience: { who: str(audience.who), age_range: str(audience.age_range) },
    language: str(c.language),
    cadence: str(c.cadence),
    platforms: list(c.platforms),
    tone: list(c.tone),
    never: list(c.banned_topics),
    styleNotes: section(channel.doc.md.body, "Style notes").split(/\r?\n/).filter((l) => l.startsWith("- ")).map((l) => l.slice(2).trim()),
    colours,
    font: str(brand.font),
    host: {
      name: str(host.data.display_name),
      concept: str(host.data.concept),
      look: str(host.data.look),
      personality: list(host.data.personality),
      good_at: list(host.data.good_at),
      bad_at: list(host.data.bad_at),
      catchphrases: list(host.data.catchphrases),
      voice: `Synthetic voice "${str(voice.voice_id)}" (${str(voice.provider)}), never presented as a real person`,
    },
    series: {
      name: str(series.data.name),
      format: str(series.data.format),
      visual_style: str(series.data.visual_style),
      beats: ((series.data.beats ?? []) as Record<string, unknown>[]).map((b) => ({ id: str(b.id), purpose: str(b.purpose) })),
    },
    episodes,
  };
}

/** The QA agent review's requested fixes, when the review did not pass. None when there is no review. */
function reviewNotes(path: string): string[] {
  if (!existsSync(path)) return [];
  const r = readJson<{ overall: string; tone: { pass: boolean }; visuals: { pass: boolean }; character: { pass: boolean }; banned_topics: { pass: boolean }; fixes: string[] }>(path);
  const pass = r.overall === "pass" && r.tone.pass && r.visuals.pass && r.character.pass && r.banned_topics.pass;
  return pass ? [] : r.fixes;
}
