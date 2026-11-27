/**
 * Brand kit: everything a customer signs off, read straight from a channel's files. Nothing here is
 * written by hand per customer — change the channel and the kit changes with it.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadChannel } from "../core/channels.ts";
import { bodySection } from "../core/markdown.ts";
import { readJson } from "../core/util.ts";
import type { Workspace } from "../core/workspace.ts";
import { episodesDir, listEpisodes } from "../pipeline/episode.ts";

export interface BrandKit {
  slug: string;
  name: string;
  promise: string;
  /** The idea every video argues, and what a viewer leaves each video with ("" on channels from before them). */
  belief: string;
  gets: string;
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
  /** `revisable`: it has a storyboard, so it can be opened again and changed. `versions`: the earlier versions kept from revisions. */
  /** `seconds`: its length, from the voice's timings. `date`: when it was last made (YYYY-MM-DD). `caption`: the post text written with it, when there is one. `captions_file`: whether its captions were written as a file of their own (videos rendered before that have none). */
  episodes: { id: string; title: string; frames: string[]; review: string[]; revisable: boolean; versions: number[]; seconds: number | null; date: string; caption: { text: string; hashtags: string[] } | null; captions_file: boolean }[];
}

const str = (v: unknown): string => (typeof v === "string" ? v : v === undefined || v === null ? "" : String(v));
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(str) : []);


/** Where the engine writes an episode's video (same path as render-episode.ts's outputPath, without loading the renderer). */
export function videoPath(ws: Workspace, slug: string, episode: string): string {
  return ws.path("out", slug, `${episode}.mp4`);
}

/** Where the engine writes an episode's video without its captions (render-episode.ts's cleanPath). */
export function cleanVideoPath(ws: Workspace, slug: string, episode: string): string {
  return ws.path("out", slug, "clean", `${episode}.mp4`);
}

/** Where the engine writes an episode's captions as a file of their own (render-episode.ts's captionsPath). */
export function captionsFilePath(ws: Workspace, slug: string, episode: string): string {
  return ws.path("out", slug, `${episode}.srt`);
}

/** An earlier version of an episode's video, kept when the video is revised. */
export function versionPath(ws: Workspace, slug: string, episode: string, n: number): string {
  return ws.path("out", slug, "versions", episode, `v${n}.mp4`);
}

/** The numbers of the earlier versions kept for an episode's video, oldest first. */
export function videoVersions(ws: Workspace, slug: string, episode: string): number[] {
  const dir = ws.path("out", slug, "versions", episode);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => { const m = /^v(\d+)\.mp4$/.exec(f); return m ? [Number(m[1])] : []; }).sort((a, b) => a - b);
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
      const epDir = join(episodesDir(channel), e.id);
      const timings = join(epDir, "audio", "timings.json");
      const publish = join(epDir, "publish.json");
      const post = existsSync(publish) ? readJson<{ description?: unknown; hashtags?: unknown }>(publish) : null;
      return {
        id: e.id,
        title: e.title,
        frames,
        review: [...checkNotes(join(epDir, "qa", "automated.json")), ...reviewNotes(join(epDir, "qa-review.json"))],
        revisable: existsSync(join(epDir, "storyboard.json")),
        versions: videoVersions(ws, slug, e.id),
        seconds: existsSync(timings) ? Number(readJson<{ duration: number }>(timings).duration) : null,
        date: e.updated.slice(0, 10),
        caption: post && str(post.description) ? { text: str(post.description), hashtags: list(post.hashtags) } : null,
        captions_file: existsSync(captionsFilePath(ws, slug, e.id)),
      };
    });
  return {
    slug,
    name: str(c.name),
    promise: bodySection(channel.doc.md.body, "Promise"),
    belief: bodySection(channel.doc.md.body, "Belief"),
    gets: bodySection(channel.doc.md.body, "What the viewer gets"),
    niche: str(c.niche),
    audience: { who: str(audience.who), age_range: str(audience.age_range) },
    language: str(c.language),
    cadence: str(c.cadence),
    platforms: list(c.platforms),
    tone: list(c.tone),
    never: list(c.banned_topics),
    styleNotes: bodySection(channel.doc.md.body, "Style notes").split(/\r?\n/).filter((l) => l.startsWith("- ")).map((l) => l.slice(2).trim()),
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

/** The automated checks a finished video missed (quality checks: they are notes on a customer's video, not stops). */
function checkNotes(path: string): string[] {
  if (!existsSync(path)) return [];
  return readJson<{ checks: { id: string; label: string; detail: string; pass: boolean }[] }>(path).checks.filter((c) => !c.pass).map(plainNote);
}

/** A missed automatic check as advice a customer can act on, without the measurement's working. */
export function plainNote(c: { id: string; label: string; detail: string }): string {
  switch (c.id) {
    case "hook-line": {
      const m = /^"(.*)" ends at ([\d.]+)s/.exec(c.detail);
      return m ? `The first line, “${m[1]}”, takes ${Number(m[2]).toFixed(1)} seconds to say. Under 2 seconds keeps more viewers watching.` : "The first line takes more than 2 seconds to say. A shorter one keeps more viewers watching.";
    }
    case "hook-speech": return "The voice starts a moment late. Starting straight away keeps more viewers watching.";
    case "hook-text": return "The headline doesn't show in the first half second. Text on screen from the start helps people stop scrolling.";
    case "length": return "The video runs a little outside the length this series aims for.";
    case "safe-areas": return "Some text sits close to the edge, where a phone app's buttons or caption can cover it.";
    case "cut-off": return "Some on-screen text is cut off or runs past its box for a moment. Watch it once before posting.";
    case "loudness": return "The sound is a little quieter or louder than the apps aim for, so they may turn it up or down.";
    case "banned-topics": return `The words come close to one of the channel's banned topics (${c.detail}). Check it before posting.`;
    default: return `${c.label}: this check was missed. Watch the video once before posting.`;
  }
}

/** The QA agent review's requested fixes, when the review did not pass. None when there is no review. */
function reviewNotes(path: string): string[] {
  if (!existsSync(path)) return [];
  const r = readJson<{ overall: string; tone: { pass: boolean }; visuals: { pass: boolean }; character: { pass: boolean }; banned_topics: { pass: boolean; notes: string }; fixes: string[] }>(path);
  const pass = r.overall === "pass" && r.tone.pass && r.visuals.pass && r.character.pass && r.banned_topics.pass;
  // A banned-topic concern comes first: the customer decides whether the video is posted.
  return pass ? [] : [...(r.banned_topics.pass ? [] : [`Banned topics: ${r.banned_topics.notes}`]), ...r.fixes];
}
