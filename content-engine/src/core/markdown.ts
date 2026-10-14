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
  const doc = parseDocument(lines.slice(1, end).join("\n"));
  if (!isMap(doc.contents)) throw new EngineError(`${label}: frontmatter must be a YAML mapping.`);
  for (const [path, value] of Object.entries(updates)) {
    doc.setIn(path.split("."), value);
  }
  const yaml = doc.toString({ lineWidth: 0 }).trimEnd();
  return ["---", yaml, ...lines.slice(end)].join("\n");
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
