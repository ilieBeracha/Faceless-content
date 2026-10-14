/**
 * ideas.md — one idea per "## <id>" heading followed by "- key: value" lines.
 *
 *   ## ballpoint-pen
 *   - title: Inside It: a ballpoint pen
 *   - series: inside-it
 *   - status: new
 *   - angle: Why doesn't the ink leak out when the pen sits in your pocket?
 *   - added: 2026-10-14
 *
 * Ideas are never deleted: status moves new → used | rejected (and rejected → new via reopen).
 * Edits are made line-by-line so anything a person wrote in the file is preserved.
 */
import { EngineError } from "./errors.ts";
import { slugify, SLUG_RE } from "./util.ts";

export const IDEA_STATUSES = ["new", "used", "rejected"] as const;
export const DRAFT_IDEA_STATUSES = ["proposed", "approved", "rejected"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number] | (typeof DRAFT_IDEA_STATUSES)[number];

export interface Idea {
  id: string;
  title: string;
  series: string;
  status: string;
  angle?: string;
  added?: string;
  fields: Record<string, string>;
  /** 0-based line index of the "## id" heading. */
  line: number;
}

export interface IdeaInput {
  title: string;
  series: string;
  angle?: string;
  id?: string;
  extra?: Record<string, string>;
}

export function parseIdeas(text: string): Idea[] {
  const lines = text.split(/\r?\n/);
  const ideas: Idea[] = [];
  let current: Idea | null = null;
  lines.forEach((line, index) => {
    const heading = /^##\s+(\S.*?)\s*$/.exec(line);
    if (heading) {
      current = { id: heading[1], title: "", series: "", status: "", fields: {}, line: index };
      ideas.push(current);
      return;
    }
    if (/^#\s/.test(line)) {
      current = null;
      return;
    }
    const field = /^\s*[-*]\s+([a-z_]+)\s*:\s*(.*?)\s*$/.exec(line);
    if (field && current && !(field[1] in current.fields)) current.fields[field[1]] = field[2];
  });
  for (const idea of ideas) {
    idea.title = idea.fields.title ?? "";
    idea.series = idea.fields.series ?? "";
    idea.status = idea.fields.status ?? "";
    idea.angle = idea.fields.angle;
    idea.added = idea.fields.added;
  }
  return ideas;
}

export interface IdeaProblem {
  id: string;
  message: string;
}

/** Structural problems in an ideas file (duplicate ids, unknown statuses, unknown series). */
export function checkIdeas(ideas: Idea[], opts: { statuses: readonly string[]; series?: string[] }): IdeaProblem[] {
  const problems: IdeaProblem[] = [];
  const seen = new Set<string>();
  for (const idea of ideas) {
    if (!SLUG_RE.test(idea.id)) problems.push({ id: idea.id, message: `idea id "${idea.id}" must be lowercase-with-dashes (it is the "## " heading)` });
    if (seen.has(idea.id)) problems.push({ id: idea.id, message: `idea id "${idea.id}" is used twice — ids must be unique` });
    seen.add(idea.id);
    if (!idea.title) problems.push({ id: idea.id, message: `idea "${idea.id}" has no "- title:" line` });
    if (!opts.statuses.includes(idea.status)) problems.push({ id: idea.id, message: `idea "${idea.id}" has status "${idea.status || "(none)"}" — use one of: ${opts.statuses.join(", ")}` });
    if (!idea.series) problems.push({ id: idea.id, message: `idea "${idea.id}" has no "- series:" line` });
    else if (opts.series && idea.series !== "any" && !opts.series.includes(idea.series)) {
      problems.push({ id: idea.id, message: `idea "${idea.id}" is for series "${idea.series}", which this channel doesn't have (available: ${opts.series.join(", ") || "none"})` });
    }
  }
  return problems;
}

/** Render new idea blocks to append to an ideas file. */
export function renderIdeas(inputs: IdeaInput[], existingIds: Iterable<string>, status: string, added: string): { text: string; ids: string[] } {
  const taken = new Set(existingIds);
  const ids: string[] = [];
  const blocks = inputs.map((input) => {
    if (!input.title.trim()) throw new EngineError("An idea needs a title.");
    let id = input.id ? input.id : slugify(input.title);
    if (!SLUG_RE.test(id)) id = slugify(id) || "idea";
    let unique = id;
    for (let n = 2; taken.has(unique); n++) unique = `${id}-${n}`;
    taken.add(unique);
    ids.push(unique);
    const lines = [`## ${unique}`, `- title: ${oneLine(input.title)}`, `- series: ${input.series}`, `- status: ${status}`];
    if (input.angle) lines.push(`- angle: ${oneLine(input.angle)}`);
    lines.push(`- added: ${added}`);
    for (const [k, v] of Object.entries(input.extra ?? {})) lines.push(`- ${k}: ${oneLine(v)}`);
    return lines.join("\n");
  });
  return { text: blocks.join("\n\n"), ids };
}

export function appendIdeaBlocks(fileText: string, blocks: string): string {
  return fileText.replace(/\s*$/, "") + "\n\n" + blocks + "\n";
}

/**
 * Change one idea's status (and set/insert extra fields) without touching anything else.
 */
export function updateIdea(fileText: string, id: string, fields: Record<string, string>): string {
  const lines = fileText.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^##\\s+${escapeRe(id)}\\s*$`).test(l));
  if (start === -1) throw new EngineError(`No idea with id "${id}".`);
  let end = lines.findIndex((l, i) => i > start && /^#{1,2}\s/.test(l));
  if (end === -1) end = lines.length;
  let lastField = start;
  for (const [key, value] of Object.entries(fields)) {
    const re = new RegExp(`^(\\s*[-*]\\s+)${escapeRe(key)}\\s*:.*$`);
    const idx = lines.findIndex((l, i) => i > start && i < end && re.test(l));
    if (idx !== -1) {
      lines[idx] = lines[idx].replace(re, `$1${key}: ${oneLine(value)}`);
    } else {
      for (let i = start + 1; i < end; i++) if (/^\s*[-*]\s+[a-z_]+\s*:/.test(lines[i])) lastField = i;
      lines.splice(lastField + 1, 0, `- ${key}: ${oneLine(value)}`);
      end++;
    }
  }
  return lines.join("\n");
}

function oneLine(text: string): string {
  return text.replace(/\s*\n\s*/g, " ").trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
