import pc from "picocolors";
import { bodySections, type MarkdownDoc } from "./markdown.ts";
import { describeType, type FieldSpec, type FieldType, type TemplateSchema } from "./template-schema.ts";
import { isPlainObject, SLUG_RE } from "./util.ts";

export interface Issue {
  level: "error" | "warning";
  /** Workspace-relative file the issue is in. */
  file: string;
  path?: string;
  message: string;
  hint?: string;
}

/** Resolves ref(...) fields. Return the list of valid names when `value` is not one of them. */
export type RefResolver = (target: string, value: string) => { ok: true } | { ok: false; available: string[] };

export interface ValidateOptions {
  file: string;
  resolveRef?: RefResolver;
  /** Top-level keys that are allowed even though the template doesn't list them (e.g. "draft"). */
  ignoreKeys?: string[];
}

const PLACEHOLDER = /\bTODO\b|^<[^>]*>$/;

export function validateAgainstTemplate(doc: MarkdownDoc, schema: TemplateSchema, opts: ValidateOptions): Issue[] {
  const issues: Issue[] = [];
  const templateRef = (spec: FieldSpec) => `templates/${schema.name}:${spec.line}`;

  const error = (spec: FieldSpec, path: string, message: string) => {
    const help = spec.description ? `${spec.description} (${templateRef(spec)})` : `see ${templateRef(spec)}`;
    issues.push({ level: "error", file: opts.file, path, message, hint: help });
  };

  const checkValue = (spec: FieldSpec, value: unknown, path: string) => {
    if (isMissing(value, spec)) {
      if (spec.required) {
        const example = spec.example !== undefined && spec.example !== "" && !isMissing(spec.example, spec) ? ` e.g. ${JSON.stringify(spec.example)}` : "";
        error(spec, path, `missing required field "${path}" (${describeType(spec.type)}${example ? "," + example : ""})`);
      }
      return;
    }
    const problem = checkType(spec.type, value, opts.resolveRef);
    if (problem) {
      error(spec, path, `"${path}" ${problem}`);
      return;
    }
    const bounds = checkBounds(spec, value);
    if (bounds) error(spec, path, `"${path}" ${bounds}`);
  };

  const validateObject = (obj: Record<string, unknown>, parent: string | null, concrete: string, topLevel: boolean) => {
    const children = schema.fields.filter((f) => f.parent === parent);
    for (const spec of children) {
      const path = concrete ? `${concrete}.${spec.key}` : spec.key;
      const value = obj[spec.key];
      checkValue(spec, value, path);
      if (spec.type.kind === "object" && isPlainObject(value)) validateObject(value, spec.path, path, false);
      if (spec.type.kind === "list" && spec.type.of.kind === "object" && Array.isArray(value)) {
        value.forEach((item, i) => {
          if (isPlainObject(item)) validateObject(item, `${spec.path}[]`, `${path}[${i}]`, false);
          else issues.push({ level: "error", file: opts.file, path: `${path}[${i}]`, message: `"${path}[${i}]" must be a group of fields (key: value lines)`, hint: `see ${templateRef(spec)}` });
        });
      }
    }
    const known = new Set(children.map((c) => c.key));
    const ignored = new Set(topLevel ? (opts.ignoreKeys ?? []) : []);
    for (const key of Object.keys(obj)) {
      if (!known.has(key) && !ignored.has(key)) {
        const where = concrete ? `${concrete}.${key}` : key;
        issues.push({ level: "warning", file: opts.file, path: where, message: `unknown field "${where}" — it is not in templates/${schema.name} (typo?)` });
      }
    }
  };

  validateObject(doc.data, null, "", true);

  const sections = bodySections(doc.body);
  for (const section of schema.requiredSections) {
    const present = sections.get(section.toLowerCase());
    if (present === undefined) {
      issues.push({ level: "error", file: opts.file, message: `missing required section "## ${section}" in the body`, hint: `see templates/${schema.name}` });
    } else if (!present) {
      issues.push({ level: "error", file: opts.file, message: `section "## ${section}" is empty`, hint: `see templates/${schema.name}` });
    }
  }
  return issues;
}

function isMissing(value: unknown, spec: FieldSpec): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "" || PLACEHOLDER.test(value.trim());
  if (Array.isArray(value)) return value.length === 0 && spec.min !== 0;
  if (isPlainObject(value) && (spec.type.kind === "object" || spec.type.kind === "map")) return Object.keys(value).length === 0 && spec.min !== 0;
  return false;
}

function checkType(type: FieldType, value: unknown, resolveRef?: RefResolver): string | null {
  switch (type.kind) {
    case "scalar":
      return checkScalar(type.name, value);
    case "enum":
      return type.values.includes(String(value)) && typeof value !== "object" ? null : `must be one of: ${type.values.join(", ")} (got ${JSON.stringify(value)})`;
    case "object":
    case "map":
      return isPlainObject(value) ? null : `must be a group of fields (got ${JSON.stringify(value)})`;
    case "list": {
      if (!Array.isArray(value)) return `must be a list (got ${JSON.stringify(value)})`;
      if (type.of.kind === "object") return null; // items checked field by field
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] === "string" && PLACEHOLDER.test(value[i].trim())) return `item ${i + 1} is still a placeholder (${JSON.stringify(value[i])})`;
        const p = checkType(type.of, value[i], resolveRef);
        if (p) return `item ${i + 1} ${p}`;
      }
      return null;
    }
    case "ref": {
      if (typeof value !== "string") return `must be a name (got ${JSON.stringify(value)})`;
      if (!resolveRef) return null;
      const res = resolveRef(type.target, value);
      if (res.ok) return null;
      const what = type.target.startsWith("skill:") ? `${type.target.slice(6)} skill` : type.target;
      return `refers to ${what} "${value}", which doesn't exist${res.available.length ? ` (available: ${res.available.join(", ")})` : " (none defined yet)"}`;
    }
  }
}

function checkScalar(name: string, value: unknown): string | null {
  const got = `(got ${JSON.stringify(value)})`;
  switch (name) {
    case "any":
      return null;
    case "string":
    case "text":
      return typeof value === "string" || typeof value === "number" ? null : `must be text ${got}`;
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? null : `must be a number ${got}`;
    case "integer":
      return Number.isInteger(value) ? null : `must be a whole number ${got}`;
    case "boolean":
      return typeof value === "boolean" ? null : `must be true or false ${got}`;
    case "date":
      return (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) || value instanceof Date ? null : `must be a date like 2026-01-31 ${got}`;
    case "slug":
      return typeof value === "string" && SLUG_RE.test(value) ? null : `must be lowercase-with-dashes ${got}`;
    case "color":
      return typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? null : `must be a hex color like "#1e90ff" (quoted) ${got}`;
    case "url":
      return typeof value === "string" && /^https?:\/\/\S+$/.test(value) ? null : `must be a URL starting with http(s):// ${got}`;
    default:
      return null;
  }
}

function checkBounds(spec: FieldSpec, value: unknown): string | null {
  if (spec.min === undefined && spec.max === undefined) return null;
  let measured: number | null = null;
  let unit = "";
  if (typeof value === "number") measured = value;
  else if (Array.isArray(value)) {
    measured = value.length;
    unit = " items";
  } else if (typeof value === "string") {
    measured = value.length;
    unit = " characters";
  }
  if (measured === null) return null;
  if (spec.min !== undefined && measured < spec.min) return `must be at least ${spec.min}${unit} (got ${measured}${unit})`;
  if (spec.max !== undefined && measured > spec.max) return `must be at most ${spec.max}${unit} (got ${measured}${unit})`;
  return null;
}

export function hasErrors(issues: Issue[]): boolean {
  return issues.some((i) => i.level === "error");
}

/** Human-readable report grouped by file. */
export function formatIssues(issues: Issue[]): string {
  if (!issues.length) return pc.green("✔ no problems found");
  const byFile = new Map<string, Issue[]>();
  for (const issue of issues) byFile.set(issue.file, [...(byFile.get(issue.file) ?? []), issue]);
  const out: string[] = [];
  for (const [file, list] of byFile) {
    const errors = list.filter((i) => i.level === "error").length;
    out.push(`${errors ? pc.red("✖") : pc.yellow("⚠")} ${pc.bold(file)}`);
    for (const issue of list.sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1))) {
      const bullet = issue.level === "error" ? pc.red("  • ") : pc.yellow("  ⚠ ");
      out.push(bullet + issue.message);
      if (issue.hint) out.push(pc.dim(`      ${issue.hint}`));
    }
  }
  const e = issues.filter((i) => i.level === "error").length;
  const w = issues.length - e;
  out.push("", `${e} error${e === 1 ? "" : "s"}, ${w} warning${w === 1 ? "" : "s"}`);
  return out.join("\n");
}
