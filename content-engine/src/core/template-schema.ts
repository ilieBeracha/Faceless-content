/**
 * Templates are the schema.
 *
 * Every frontmatter field in templates/*.md carries an annotation comment:
 *
 *     status: draft     # required enum(draft|active|paused) — draft until you approve it
 *     length:           # required object
 *       min_seconds: 35 # required number min=5 max=180 — shortest acceptable video
 *     beats:            # required list(object) min=2
 *       - id: hook      # required slug
 *
 * Grammar:  # <required|optional> <type> [min=N] [max=N] [— description]
 * Types:    string text number integer boolean date slug color url any object map
 *           enum(a|b|c)  list(<type>)  ref(character|series|font|voice-provider|skill:<kind>)
 *
 * Add a field to a template and every channel file is validated against it immediately.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { EngineError } from "./errors.ts";
import { parseMarkdown } from "./markdown.ts";
import { isPlainObject } from "./util.ts";

export type ScalarName = "string" | "text" | "number" | "integer" | "boolean" | "date" | "slug" | "color" | "url" | "any";

export type FieldType =
  | { kind: "scalar"; name: ScalarName }
  | { kind: "enum"; values: string[] }
  | { kind: "list"; of: FieldType }
  | { kind: "object" }
  | { kind: "map" }
  | { kind: "ref"; target: string };

export interface FieldSpec {
  /** Schema path, e.g. "audience.who" or "beats[].id". */
  path: string;
  key: string;
  /** Path of the containing object ("beats[]" for list items), null at the top level. */
  parent: string | null;
  required: boolean;
  type: FieldType;
  min?: number;
  max?: number;
  description?: string;
  example?: unknown;
  /** 1-based line number in the template file. */
  line: number;
}

export interface TemplateSchema {
  name: string;
  file: string;
  fields: FieldSpec[];
  byPath: Map<string, FieldSpec>;
  /** Body headings marked `<!-- required -->` in the template. */
  requiredSections: string[];
}

const SCALARS: ScalarName[] = ["string", "text", "number", "integer", "boolean", "date", "slug", "color", "url", "any"];

export function parseTemplate(file: string, text: string = readFileSync(file, "utf8")): TemplateSchema {
  const name = basename(file);
  const lines = text.split(/\r?\n/);
  if (!/^---\s*$/.test(lines[0] ?? "")) throw new EngineError(`Template ${name} has no frontmatter.`);
  const end = lines.findIndex((l, i) => i > 0 && /^---\s*$/.test(l));
  const example = parseMarkdown(text, `templates/${name}`).data;

  const fields: FieldSpec[] = [];
  const stack: { keyIndent: number; spec: FieldSpec }[] = [];

  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const m = /^(\s*)(-\s+)?([A-Za-z_][A-Za-z0-9_-]*)\s*:(.*)$/.exec(line);
    if (!m) continue; // scalar list items, multi-line values
    const [, indent, dash, key, rest] = m;
    const keyIndent = indent.length + (dash ? dash.length : 0);
    while (stack.length && stack[stack.length - 1].keyIndent >= keyIndent) stack.pop();
    const parentSpec = stack.at(-1)?.spec;
    const parent = parentSpec ? (parentSpec.type.kind === "list" ? `${parentSpec.path}[]` : parentSpec.path) : null;
    const path = parent ? `${parent}.${key}` : key;

    const comment = extractComment(rest);
    const annotation = comment ? parseAnnotation(comment, name, i + 1) : null;
    const spec: FieldSpec = {
      path,
      key,
      parent,
      required: annotation?.required ?? false,
      type: annotation?.type ?? { kind: "scalar", name: "any" },
      min: annotation?.min,
      max: annotation?.max,
      description: annotation?.description,
      example: exampleAt(example, path),
      line: i + 1,
    };
    fields.push(spec);
    stack.push({ keyIndent, spec });
  }

  const requiredSections = lines
    .slice(end + 1)
    .map((l) => /^##\s+(.+?)\s*<!--\s*required\s*-->\s*$/.exec(l)?.[1])
    .filter((s): s is string => Boolean(s));

  return { name, file, fields, byPath: new Map(fields.map((f) => [f.path, f])), requiredSections };
}

/** The text after the first `#` that is outside quotes and preceded by whitespace. */
function extractComment(rest: string): string | null {
  let quote: string | null = null;
  for (let i = 0; i < rest.length; i++) {
    const c = rest[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "#" && (i === 0 || /\s/.test(rest[i - 1]))) return rest.slice(i + 1).trim();
  }
  return null;
}

function parseAnnotation(comment: string, template: string, line: number) {
  const m = /^(required|optional)\b(.*)$/.exec(comment);
  if (!m) return null;
  const sep = /\s+(—|--)\s+/.exec(m[2]);
  const specPart = sep ? m[2].slice(0, sep.index) : m[2];
  const description = sep ? m[2].slice(sep.index + sep[0].length).trim() : undefined;
  const tokens = specPart.trim().split(/\s+/).filter(Boolean);
  const type = tokens.length ? parseType(tokens[0], template, line) : ({ kind: "scalar", name: "any" } as FieldType);
  let min: number | undefined;
  let max: number | undefined;
  for (const token of tokens.slice(1)) {
    const c = /^(min|max)=(-?\d+(?:\.\d+)?)$/.exec(token);
    if (!c) throw new EngineError(`templates/${template}:${line}: can't read "${token}" (expected min=N or max=N).`);
    if (c[1] === "min") min = Number(c[2]);
    else max = Number(c[2]);
  }
  return { required: m[1] === "required", type, min, max, description };
}

function parseType(expr: string, template: string, line: number): FieldType {
  let m: RegExpExecArray | null;
  if ((m = /^list\((.+)\)$/.exec(expr))) return { kind: "list", of: parseType(m[1], template, line) };
  if ((m = /^enum\((.+)\)$/.exec(expr))) return { kind: "enum", values: m[1].split("|").map((s) => s.trim()) };
  if ((m = /^ref\((.+)\)$/.exec(expr))) return { kind: "ref", target: m[1] };
  if (expr === "object") return { kind: "object" };
  if (expr === "map") return { kind: "map" };
  if ((SCALARS as string[]).includes(expr)) return { kind: "scalar", name: expr as ScalarName };
  throw new EngineError(`templates/${template}:${line}: unknown field type "${expr}".`, `Known types: ${SCALARS.join(", ")}, object, map, enum(a|b), list(type), ref(target).`);
}

function exampleAt(data: unknown, path: string): unknown {
  let current: unknown = data;
  for (const part of path.split(".")) {
    const isList = part.endsWith("[]");
    const key = isList ? part.slice(0, -2) : part;
    if (!isPlainObject(current)) return undefined;
    current = current[key];
    if (isList) current = Array.isArray(current) ? current[0] : undefined;
  }
  return current;
}

export function describeType(type: FieldType): string {
  switch (type.kind) {
    case "scalar":
      return type.name === "any" ? "any value" : type.name;
    case "enum":
      return `one of: ${type.values.join(", ")}`;
    case "list":
      return `a list of ${describeType(type.of)}`;
    case "object":
      return "a group of fields";
    case "map":
      return "a mapping of names to values";
    case "ref":
      return `the name of an existing ${type.target.replace("skill:", "")}${type.target.startsWith("skill:") ? " skill" : ""}`;
  }
}
