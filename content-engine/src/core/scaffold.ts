/**
 * Creating channel files from templates. Every function here refuses to touch an existing file:
 * channels are never overwritten — you edit them, and git keeps the history.
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseMarkdown, serializeMarkdown } from "./markdown.ts";
import { assertSlug, createFileExclusive, readText, today } from "./util.ts";
import { EngineError } from "./errors.ts";
import type { Workspace } from "./workspace.ts";

export function templateBody(ws: Workspace, name: string, vars: Record<string, string>): string {
  const { body } = parseMarkdown(readText(ws.templatePath(name)), `templates/${name}`);
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

/** A markdown file with clean YAML frontmatter + the template's body. */
export function renderFromTemplate(ws: Workspace, template: string, data: Record<string, unknown>, vars: Record<string, string>): string {
  const header = `# Fields are documented in templates/${template} — check with: ./engine validate\n`;
  const md = serializeMarkdown(data, templateBody(ws, template, vars));
  return md.replace(/^---\n/, `---\n${header}`);
}

export interface ChannelInput {
  slug: string;
  name: string;
  niche: string;
  audience: { who: string; age_range: string; made_for_kids: boolean };
  tone: string[];
  language: string;
  platforms: string[];
  cadence: string;
  banned_topics: string[];
  brand: { primary_color: string; accent_color: string; background_top: string; background_bottom: string; text_color?: string; font: string; caption_case?: string };
  promise?: string;
}

/** channel.md + ideas.md + learnings.md, status draft. */
export function createChannel(ws: Workspace, input: ChannelInput): string[] {
  assertSlug(input.slug, "channel slug");
  const dir = ws.channelDir(input.slug);
  if (existsSync(dir)) throw new EngineError(`channels/${input.slug} already exists — channels are never overwritten.`, "Pick another slug, or edit the existing channel's files.");
  const { promise, ...fields } = input;
  const data = { ...fields, status: "draft", created: today() };
  const ordered = { slug: data.slug, name: data.name, status: data.status, niche: data.niche, audience: data.audience, tone: data.tone, language: data.language, platforms: data.platforms, cadence: data.cadence, banned_topics: data.banned_topics, brand: data.brand, created: data.created };
  let text = renderFromTemplate(ws, "channel.md", ordered, { name: input.name });
  if (promise) text = text.replace(/(## Promise[^\n]*\n\n)<!--[^]*?-->/, `$1${promise}`);
  const files = [join(dir, "channel.md"), join(dir, "ideas.md"), join(dir, "learnings.md")];
  createFileExclusive(files[0], text);
  createFileExclusive(files[1], templateBody(ws, "ideas.md", { name: input.name }).trimStart());
  createFileExclusive(files[2], templateBody(ws, "learnings.md", { name: input.name }).trimStart());
  mkdirSync(join(dir, "characters"), { recursive: true });
  mkdirSync(join(dir, "series"), { recursive: true });
  return files;
}

/** Skeleton for an agent to fill in (seed flow): the annotated template with slug/status/created set. */
export function createChannelSkeleton(ws: Workspace, slug: string, name: string): string[] {
  assertSlug(slug, "channel slug");
  const dir = ws.channelDir(slug);
  if (existsSync(dir)) throw new EngineError(`channels/${slug} already exists — channels are never overwritten.`, "Pick another --slug.");
  const tpl = readText(ws.templatePath("channel.md"))
    .replace(/^slug: my-channel/m, `slug: ${slug}`)
    .replace(/^name: My Channel( *)/m, `name: ${JSON.stringify(name)}$1`)
    .replace(/^created: 2026-01-01/m, `created: ${today()}`)
    .replace(/\{\{name\}\}/g, name || "(channel name)");
  const files = [join(dir, "channel.md"), join(dir, "ideas.md"), join(dir, "learnings.md")];
  createFileExclusive(files[0], tpl);
  createFileExclusive(files[1], templateBody(ws, "ideas.md", { name }).trimStart());
  createFileExclusive(files[2], templateBody(ws, "learnings.md", { name }).trimStart());
  mkdirSync(join(dir, "characters"), { recursive: true });
  mkdirSync(join(dir, "series"), { recursive: true });
  return files;
}

export interface CharacterInput {
  name: string;
  display_name: string;
  pronoun: string;
  concept: string;
  look: string;
  personality: string[];
  catchphrases: string[];
  good_at: string[];
  bad_at: string[];
  voice: { provider: string; voice_id: string; speed: number; pitch_semitones?: number; sentence_pause?: number; clause_pause?: number };
  pronunciations?: Record<string, string>;
  how_it_talks: string;
  model: Record<string, unknown>;
}

export function characterFiles(ws: Workspace, baseDir: string, input: CharacterInput, extra: Record<string, unknown> = {}): { md: string; model: string; text: string; json: string } {
  assertSlug(input.name, "character name");
  const { how_it_talks, model, ...fields } = input;
  const data = { ...extra, ...fields, pronunciations: fields.pronunciations ?? {}, original: true };
  let text = renderFromTemplate(ws, "character.md", data, { display_name: input.display_name });
  text = text.replace(/(## How it talks[^\n]*\n\n)<!--[^]*?-->/, `$1${how_it_talks}`);
  return { md: join(baseDir, `${input.name}.md`), model: join(baseDir, input.name, "model.json"), text, json: JSON.stringify(model, null, 2) };
}

export function createCharacter(ws: Workspace, channel: string, input: CharacterInput): string[] {
  const files = characterFiles(ws, join(ws.channelDir(channel), "characters"), input);
  if (existsSync(files.md) || existsSync(files.model)) throw new EngineError(`Character "${input.name}" already exists in ${channel}.`, `Edit it instead: ./engine edit character --channel ${channel} --name ${input.name}`);
  createFileExclusive(files.md, files.text);
  createFileExclusive(files.model, files.json);
  return [files.md, files.model];
}

export interface SeriesInput {
  slug: string;
  name: string;
  format: string;
  characters: string[];
  length: { min_seconds: number; max_seconds: number };
  hook_pattern: string;
  beats: { id: string; seconds: number; purpose: string }[];
  visual_style: string;
  skills: { script: string; render: string[]; captions: string };
  cta?: string;
}

export function seriesFile(ws: Workspace, baseDir: string, input: SeriesInput, extra: Record<string, unknown> = {}): { path: string; text: string } {
  assertSlug(input.slug, "series slug");
  const data = { ...extra, slug: input.slug, name: input.name, status: "active", format: input.format, characters: input.characters, length: input.length, hook_pattern: input.hook_pattern, beats: input.beats, visual_style: input.visual_style, skills: input.skills, ...(input.cta ? { cta: input.cta } : {}), created: today() };
  return { path: join(baseDir, `${input.slug}.md`), text: renderFromTemplate(ws, "series.md", data, { name: input.name }) };
}

export function createSeries(ws: Workspace, channel: string, input: SeriesInput): string[] {
  const file = seriesFile(ws, join(ws.channelDir(channel), "series"), input);
  if (existsSync(file.path)) throw new EngineError(`Series "${input.slug}" already exists in ${channel}.`, `Edit it instead: ./engine edit series --channel ${channel} --name ${input.slug}`);
  createFileExclusive(file.path, file.text);
  return [file.path];
}

/** A starting model.json for a rig, with the standard expression set. */
export function defaultModel(rig: "orb-bot-3d" | "flat-2d", colors: { body: string; accent: string; eye?: string }): Record<string, unknown> {
  const expressions = {
    neutral: { eye_scale: 1, pupil_scale: 1, lid: 0, tilt_deg: 0, look: [0, 0], bounce: 0.3, brow: "flat", mouth_curve: 0.25, glow: 1 },
    curious: { eye_scale: 1.12, pupil_scale: 1.15, lid: 0, tilt_deg: 12, look: [0.35, 0.2], bounce: 0.45, brow: "up", mouth_curve: 0.15, glow: 1.15 },
    excited: { eye_scale: 1.15, pupil_scale: 0.9, lid: 0, tilt_deg: -6, look: [0, 0], bounce: 0.8, brow: "up", mouth_curve: 0.7, glow: 1.4 },
    surprised: { eye_scale: 1.3, pupil_scale: 0.7, lid: 0, tilt_deg: 0, look: [0, 0.1], bounce: 0.5, brow: "up", mouth_curve: 0, glow: 1.3 },
    thinking: { eye_scale: 0.95, pupil_scale: 1, lid: 0.3, tilt_deg: -10, look: [-0.4, 0.4], bounce: 0.2, brow: "worried", mouth_curve: -0.1, glow: 0.9 },
  };
  if (rig === "orb-bot-3d") {
    return {
      rig,
      params: {
        body: { shape: "sphere", color: colors.body, metalness: 1, roughness: 0.2, facets: 24 },
        eye: { count: 1, size: 0.42, sclera: "#f5f8fc", iris: colors.eye ?? colors.accent, pupil: "#0a0e14", glow: 0.7 },
        mouth: { style: "led-bar", color: colors.eye ?? colors.accent, width: 0.34 },
        antenna: { enabled: true, color: "#9aa3b0", tip: colors.accent, length: 0.45 },
        accent: colors.accent,
        arms: "stubs",
        hover: 0.05,
      },
      expressions,
    };
  }
  return {
    rig,
    params: {
      body: { shape: "blob", color: colors.body, outline: "#1d1b26", outline_width: 7 },
      eyes: { style: "round", white: "#ffffff", pupil: "#1d1b26", spacing: 0.36, y: -0.12, size: 0.17 },
      mouth: { color: "#3b1f2b", tongue: "#ff7a8a", width: 0.3, y: 0.2 },
      cheeks: colors.accent,
      accessories: [],
    },
    expressions,
  };
}
