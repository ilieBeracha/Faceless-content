import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { checkCharacterModel } from "../skills/render-talking-character/rigs.ts";
import { EngineError } from "./errors.ts";
import { checkIdeas, IDEA_STATUSES, parseIdeas, type Idea } from "./ideas.ts";
import { parseMarkdown, type MarkdownDoc } from "./markdown.ts";
import { listSkills } from "./skills.ts";
import { parseTemplate, type TemplateSchema } from "./template-schema.ts";
import { readJson, readText } from "./util.ts";
import { validateAgainstTemplate, type Issue, type RefResolver } from "./validate.ts";
import type { Workspace } from "./workspace.ts";

export interface Doc {
  abs: string;
  rel: string;
  text: string;
  md: MarkdownDoc;
  data: Record<string, unknown>;
}

export interface CharacterDoc extends Doc {
  name: string;
  assetsDir: string;
  modelPath: string;
}

export interface Channel {
  slug: string;
  dir: string;
  doc: Doc;
  characters: Map<string, CharacterDoc>;
  series: Map<string, Doc>;
  ideasPath: string;
  ideas: Idea[];
  learningsPath: string;
}

export const CHANNEL_STATUSES = ["draft", "active", "paused"] as const;

export function readDoc(ws: Workspace, abs: string): Doc {
  const text = readText(abs);
  const md = parseMarkdown(text, ws.rel(abs));
  return { abs, rel: ws.rel(abs), text, md, data: md.data };
}

export function listChannelSlugs(ws: Workspace): string[] {
  const dir = ws.channelsDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, "channel.md")))
    .map((e) => e.name)
    .sort();
}

export function channelExists(ws: Workspace, slug: string): boolean {
  return existsSync(join(ws.channelDir(slug), "channel.md"));
}

export function loadChannel(ws: Workspace, slug: string): Channel {
  const dir = ws.channelDir(slug);
  const channelFile = join(dir, "channel.md");
  if (!existsSync(channelFile)) {
    const known = listChannelSlugs(ws);
    throw new EngineError(`No channel "${slug}".`, known.length ? `Known channels: ${known.join(", ")}` : "Create one with: ./engine new channel");
  }
  const characters = new Map<string, CharacterDoc>();
  const charDir = join(dir, "characters");
  if (existsSync(charDir)) {
    for (const f of readdirSync(charDir).filter((f) => f.endsWith(".md")).sort()) {
      const name = basename(f, ".md");
      const doc = readDoc(ws, join(charDir, f));
      characters.set(name, { ...doc, name, assetsDir: join(charDir, name), modelPath: join(charDir, name, "model.json") });
    }
  }
  const series = new Map<string, Doc>();
  const seriesDir = join(dir, "series");
  if (existsSync(seriesDir)) {
    for (const f of readdirSync(seriesDir).filter((f) => f.endsWith(".md")).sort()) {
      series.set(basename(f, ".md"), readDoc(ws, join(seriesDir, f)));
    }
  }
  const ideasPath = join(dir, "ideas.md");
  return {
    slug,
    dir,
    doc: readDoc(ws, channelFile),
    characters,
    series,
    ideasPath,
    ideas: existsSync(ideasPath) ? parseIdeas(readText(ideasPath)) : [],
    learningsPath: join(dir, "learnings.md"),
  };
}

const templateCache = new Map<string, TemplateSchema>();
export function template(ws: Workspace, name: string): TemplateSchema {
  const file = ws.templatePath(name);
  const key = `${ws.root}:${name}`;
  if (!templateCache.has(key)) {
    if (!existsSync(file)) throw new EngineError(`Missing template ${ws.rel(file)}.`);
    templateCache.set(key, parseTemplate(file));
  }
  return templateCache.get(key)!;
}

/** Resolves ref(...) annotations, scoped to one channel so references can never point into another. */
export function refResolver(ws: Workspace, channel: Pick<Channel, "characters" | "series"> | null): RefResolver {
  const skills = listSkills(ws);
  return (target, value) => {
    let available: string[] = [];
    if (target === "character") available = channel ? [...channel.characters.keys()] : [];
    else if (target === "series") available = channel ? [...channel.series.keys()] : [];
    else if (target === "font") available = ws.config.fonts;
    else if (target === "voice-provider") available = Object.keys(ws.config.voice.providers);
    else if (target === "platform") available = Object.keys(ws.config.platforms);
    else if (target.startsWith("skill:")) available = skills.filter((s) => s.kind === target.slice(6)).map((s) => s.name);
    else return { ok: true };
    return available.includes(value) ? { ok: true } : { ok: false, available };
  };
}

/** Validate every file of a channel against the templates, plus cross-file checks. */
export function validateChannel(ws: Workspace, channel: Channel): Issue[] {
  const issues: Issue[] = [];
  const resolve = refResolver(ws, channel);
  const push = (file: string, message: string, level: Issue["level"] = "error", hint?: string) => issues.push({ level, file, message, hint });

  issues.push(...validateAgainstTemplate(channel.doc.md, template(ws, "channel.md"), { file: channel.doc.rel, resolveRef: resolve }));
  if (channel.doc.data.slug !== undefined && channel.doc.data.slug !== channel.slug) {
    push(channel.doc.rel, `slug is "${String(channel.doc.data.slug)}" but the folder is "${channel.slug}" — they must match`);
  }

  if (channel.characters.size === 0) push(channel.doc.rel, "this channel has no characters yet", "error", `Add one: ./engine add character --channel ${channel.slug}`);
  for (const [name, doc] of channel.characters) {
    issues.push(...validateAgainstTemplate(doc.md, template(ws, "character.md"), { file: doc.rel, resolveRef: resolve }));
    if (doc.data.name !== undefined && doc.data.name !== name) push(doc.rel, `name is "${String(doc.data.name)}" but the file is ${name}.md — they must match`);
    if (!existsSync(doc.modelPath)) {
      push(doc.rel, `missing ${ws.rel(doc.modelPath)} (the character's look: rig + parameters + expressions)`, "error", "See skills/render-talking-character/SKILL.md for the model.json format.");
    } else {
      for (const problem of checkCharacterModel(readJson(doc.modelPath))) push(ws.rel(doc.modelPath), problem);
    }
  }

  if (channel.series.size === 0) push(channel.doc.rel, "this channel has no series yet", "error", `Add one: ./engine add series --channel ${channel.slug}`);
  for (const [slug, doc] of channel.series) {
    issues.push(...validateAgainstTemplate(doc.md, template(ws, "series.md"), { file: doc.rel, resolveRef: resolve }));
    if (doc.data.slug !== undefined && doc.data.slug !== slug) push(doc.rel, `slug is "${String(doc.data.slug)}" but the file is ${slug}.md — they must match`);
    const length = doc.data.length as { min_seconds?: number; max_seconds?: number } | undefined;
    if (length && typeof length.min_seconds === "number" && typeof length.max_seconds === "number") {
      if (length.min_seconds > length.max_seconds) push(doc.rel, `length.min_seconds (${length.min_seconds}) is greater than length.max_seconds (${length.max_seconds})`);
      const beats = Array.isArray(doc.data.beats) ? (doc.data.beats as { seconds?: number }[]) : [];
      const total = beats.reduce((sum, b) => sum + (typeof b.seconds === "number" ? b.seconds : 0), 0);
      if (beats.length && (total < length.min_seconds * 0.8 || total > length.max_seconds * 1.1)) {
        push(doc.rel, `the beats add up to ${total}s but the series length is ${length.min_seconds}–${length.max_seconds}s`, "warning");
      }
    }
    const beatIds = (Array.isArray(doc.data.beats) ? (doc.data.beats as { id?: string }[]) : []).map((b) => b.id);
    const dupes = beatIds.filter((id, i) => id && beatIds.indexOf(id) !== i);
    if (dupes.length) push(doc.rel, `beat ids must be unique (repeated: ${[...new Set(dupes)].join(", ")})`);
  }

  if (!existsSync(channel.ideasPath)) {
    push(ws.rel(channel.ideasPath), "missing ideas.md (the idea backlog)", "error", "Copy templates/ideas.md into the channel folder.");
  } else {
    for (const p of checkIdeas(channel.ideas, { statuses: IDEA_STATUSES, series: [...channel.series.keys()] })) push(ws.rel(channel.ideasPath), p.message);
  }
  if (!existsSync(channel.learningsPath)) push(ws.rel(channel.learningsPath), "missing learnings.md", "warning", "Copy templates/learnings.md into the channel folder.");
  return issues;
}

export function channelStatus(channel: Channel): string {
  return String(channel.doc.data.status ?? "draft");
}

export function seriesDoc(channel: Channel, series: string): Doc {
  const doc = channel.series.get(series);
  if (!doc) {
    throw new EngineError(`Channel "${channel.slug}" has no series "${series}".`, channel.series.size ? `Its series: ${[...channel.series.keys()].join(", ")}` : `Add one: ./engine add series --channel ${channel.slug}`);
  }
  return doc;
}
