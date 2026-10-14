import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { EngineError } from "./errors.ts";

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(text: string, maxLength = 48): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= maxLength) return slug;
  return slug.slice(0, maxLength).replace(/-[^-]*$/, "") || slug.slice(0, maxLength);
}

export function assertSlug(value: string, what: string): string {
  if (!SLUG_RE.test(value)) {
    throw new EngineError(`Invalid ${what} "${value}".`, `Use lowercase letters, digits and single dashes, e.g. "${slugify(value) || "my-" + what}".`);
  }
  return value;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/** JSON with sorted keys, so equal objects always hash the same. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}

export function readJson<T = unknown>(path: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (err) {
    throw new EngineError(`Could not read JSON from ${path}: ${(err as Error).message}`);
  }
}

export function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content.endsWith("\n") ? content : content + "\n");
}

export function writeJson(path: string, value: unknown): void {
  writeText(path, JSON.stringify(value, null, 2));
}

/** Create a file, refusing to touch one that already exists. */
export function createFileExclusive(path: string, content: string): void {
  if (existsSync(path)) {
    throw new EngineError(`${path} already exists — the engine never overwrites existing files.`, "Edit the existing file instead, or choose a different name.");
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content.endsWith("\n") ? content : content + "\n", { flag: "wx" });
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) return (override === undefined ? base : (override as T));
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = k in out ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

export function plural(n: number, word: string, pluralWord = word + "s"): string {
  return `${n} ${n === 1 ? word : pluralWord}`;
}
