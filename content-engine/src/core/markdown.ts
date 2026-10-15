import { isMap, parseDocument, stringify } from "yaml";
import { EngineError } from "./errors.ts";
import { isPlainObject } from "./util.ts";

export interface MarkdownDoc {
  data: Record<string, unknown>;
  /** The frontmatter YAML exactly as written (comments included). */
  frontmatter: string;
  body: string;
  /** 1-based line where the frontmatter YAML starts (for error messages). */
  frontmatterLine: number;
}

const FENCE = /^---\s*$/;

/** Split a markdown file into YAML frontmatter + body. */
export function parseMarkdown(text: string, label = "file"): MarkdownDoc {
  const lines = text.split(/\r?\n/);
  if (!FENCE.test(lines[0] ?? "")) {
    return { data: {}, frontmatter: "", body: text, frontmatterLine: 0 };
  }
  const end = lines.findIndex((l, i) => i > 0 && FENCE.test(l));
  if (end === -1) throw new EngineError(`${label}: frontmatter starts with --- but never ends.`, "Add a closing --- line after the YAML block.");
  const frontmatter = lines.slice(1, end).join("\n");
  const doc = parseDocument(frontmatter, { prettyErrors: true });
  if (doc.errors.length) {
    throw new EngineError(`${label}: the YAML frontmatter is not valid.\n  ${doc.errors.map((e) => e.message.split("\n")[0]).join("\n  ")}`, "Check indentation and quotes (values containing ':' or '#' need quotes).");
  }
  const data = doc.toJS() ?? {};
  if (!isPlainObject(data)) throw new EngineError(`${label}: frontmatter must be a YAML mapping (key: value lines).`);
  return { data, frontmatter, body: lines.slice(end + 1).join("\n"), frontmatterLine: 2 };
}

export function serializeMarkdown(data: Record<string, unknown>, body: string): string {
  const yaml = stringify(data, { lineWidth: 0 }).trimEnd();
  return `---\n${yaml}\n---\n${body.startsWith("\n") ? body : "\n" + body}`;
}

/**
 * Set top-level or nested frontmatter fields while keeping comments and formatting.
 * `updates` keys may be dotted paths ("draft.status").
 */
export function updateFrontmatter(text: string, updates: Record<string, unknown>, label = "file"): string {
  const lines = text.split(/\r?\n/);
  if (!FENCE.test(lines[0] ?? "")) throw new EngineError(`${label} has no frontmatter to update.`);
  const end = lines.findIndex((l, i) => i > 0 && FENCE.test(l));
  // Fast path: edit only the lines of scalar fields, so every other line (and comment) stays byte-identical.
  const edited = editScalarLines(lines.slice(1, end), updates);
  if (edited) return ["---", ...edited, ...lines.slice(end)].join("\n");
  const doc = parseDocument(lines.slice(1, end).join("\n"));
  if (!isMap(doc.contents)) throw new EngineError(`${label}: frontmatter must be a YAML mapping.`);
  for (const [path, value] of Object.entries(updates)) {
    doc.setIn(path.split("."), value);
  }
  const yaml = doc.toString({ lineWidth: 0 }).trimEnd();
  return ["---", yaml, ...lines.slice(end)].join("\n");
}

type Scalar = string | number | boolean | null;
const isScalar = (v: unknown): v is Scalar => v === null || ["string", "number", "boolean"].includes(typeof v);
const indentOf = (line: string) => line.length - line.trimStart().length;
const isContent = (line: string) => line.trim() !== "" && !line.trim().startsWith("#");

/** Index where an inline comment starts in a YAML value (" #" outside quotes), or -1. */
function commentStart(rest: string): number {
  let quote: string | null = null;
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "#" && (i === 0 || /\s/.test(rest[i - 1]))) return i;
  }
  return -1;
}

function formatScalar(value: Scalar, oldValue: string): string {
  if (typeof value !== "string") return String(value);
  if (oldValue.startsWith("'")) return `'${value.replace(/'/g, "''")}'`;
  if (oldValue.startsWith('"')) return JSON.stringify(value);
  return stringify(value, { lineWidth: 0 }).trimEnd();
}

/** Line range [start, end) of the block under the key at `line` (its more-indented children). */
function blockEnd(fm: string[], line: number): number {
  const base = indentOf(fm[line]);
  let i = line + 1;
  while (i < fm.length && (!isContent(fm[i]) || indentOf(fm[i]) > base)) i++;
  while (i > line + 1 && !isContent(fm[i - 1])) i--;
  return i;
}

/** Find the line of `key` among the direct children in [from, to) at the children's indentation. */
function findKey(fm: string[], from: number, to: number, key: string): number {
  const first = fm.slice(from, to).findIndex(isContent);
  if (first === -1) return -1;
  const indent = indentOf(fm[from + first]);
  const re = new RegExp(`^\\s{${indent}}${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:(\\s|$)`);
  for (let i = from + first; i < to; i++) if (isContent(fm[i]) && indentOf(fm[i]) === indent && re.test(fm[i])) return i;
  return -1;
}

/**
 * Apply scalar updates by editing single lines (keeping comments and layout), or return null when an update
 * needs the full YAML rewrite (a collection value, a missing parent, a block scalar, or anything ambiguous).
 */
function editScalarLines(fm: string[], updates: Record<string, unknown>): string[] | null {
  const out = [...fm];
  for (const [path, value] of Object.entries(updates)) {
    if (!isScalar(value)) return null;
    const keys = path.split(".");
    let from = 0;
    let to = out.length;
    let parentIndent = -1;
    let line = -1;
    for (let k = 0; k < keys.length; k++) {
      line = findKey(out, from, to, keys[k]);
      if (line === -1) {
        if (k < keys.length - 1) return null;
        // Missing leaf: add it at the end of its parent block.
        const childIndent = (() => {
          const first = out.slice(from, to).find(isContent);
          return first !== undefined && indentOf(first) > parentIndent ? indentOf(first) : parentIndent + 2;
        })();
        out.splice(to, 0, `${" ".repeat(Math.max(0, childIndent))}${keys[k]}: ${formatScalar(value, "")}`);
        line = -2;
        break;
      }
      if (k < keys.length - 1) {
        parentIndent = indentOf(out[line]);
        from = line + 1;
        to = blockEnd(out, line);
      }
    }
    if (line === -2) continue;
    const m = /^(\s*[^:#]+:)(\s*)(.*)$/.exec(out[line]);
    if (!m) return null;
    const [, head, gap, rest] = m;
    const c = commentStart(rest);
    const oldValue = (c === -1 ? rest : rest.slice(0, c)).trimEnd();
    if (/^[|>&*!]/.test(oldValue) || (oldValue === "" && blockEnd(out, line) > line + 1)) return null;
    const newValue = formatScalar(value, oldValue);
    let tail = "";
    if (c !== -1) {
      const pad = rest.slice(oldValue.length, c).length;
      tail = " ".repeat(Math.max(1, pad - (newValue.length - oldValue.length))) + rest.slice(c);
    }
    out[line] = `${head}${gap || " "}${newValue}${tail}`;
  }
  // Safety net: the result must parse and carry exactly the requested values.
  const doc = parseDocument(out.join("\n"));
  if (doc.errors.length) return null;
  for (const [path, value] of Object.entries(updates)) {
    const got = doc.getIn(path.split("."));
    if ((got ?? null) !== value) return null;
  }
  return out;
}

/** Headings (## level) present in a markdown body, with whether they have content under them. */
export function bodySections(body: string): Map<string, boolean> {
  const sections = new Map<string, boolean>();
  let current: string | null = null;
  let hasContent = false;
  const flush = () => {
    if (current !== null) sections.set(current.toLowerCase(), hasContent);
  };
  for (const line of body.split(/\r?\n/)) {
    const m = /^##\s+(.+?)\s*(<!--.*-->)?\s*$/.exec(line);
    if (m) {
      flush();
      current = m[1].trim();
      hasContent = false;
    } else if (current !== null && line.trim() && !/^<!--.*-->$/.test(line.trim()) && !/^#\s/.test(line)) {
      hasContent = true;
    }
  }
  flush();
  return sections;
}
