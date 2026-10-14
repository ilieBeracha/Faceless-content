/**
 * Context bundles: the exact set of files a generation step may use.
 *
 * Rule (AGENTS.md): a generation step loads ONLY AGENTS.md + the target channel's files + the skills
 * that channel's series uses. Every file goes through assertAllowed(), so a bug (or a bad series
 * file) can't pull another channel's content into this one. Each bundle is written with a manifest
 * (path + sha256 of every file) so you can audit what a step saw.
 */
import { existsSync } from "node:fs";
import { IsolationError } from "./errors.ts";
import { nowIso, readText, sha256 } from "./util.ts";
import type { Workspace } from "./workspace.ts";

export type ContextRole = "house-rules" | "channel" | "skill" | "template" | "workflow" | "listing" | "input";

export interface ContextFile {
  path: string;
  role: ContextRole;
  content: string;
  sha256: string;
}

export interface ContextScope {
  /** What this bundle is for, e.g. "script", "new-channel", "brainstorm-ideas". */
  purpose: string;
  /** The only channel whose files may be loaded (none for global steps like niche brainstorming). */
  channel?: string;
  series?: string;
  /** The only skills whose files may be loaded. */
  skills: string[];
  /** Extra global, channel-agnostic files this purpose may read (templates, the QA checklist). */
  globals?: string[];
}

export interface ContextManifest {
  purpose: string;
  channel: string | null;
  series: string | null;
  created: string;
  files: { path: string; role: ContextRole; sha256: string; bytes: number }[];
}

export class ContextBundle {
  readonly files: ContextFile[] = [];

  constructor(
    private readonly ws: Workspace,
    readonly scope: ContextScope,
  ) {
    this.addFile("AGENTS.md", "house-rules");
  }

  /** Add a workspace file (relative path). Throws IsolationError if it is outside the scope. */
  addFile(relPath: string, role: ContextRole, opts: { optional?: boolean } = {}): this {
    this.assertAllowed(relPath);
    const abs = this.ws.path(relPath);
    if (!existsSync(abs)) {
      if (opts.optional) return this;
      throw new IsolationError(`Context file ${relPath} does not exist.`);
    }
    if (this.files.some((f) => f.path === relPath)) return this;
    const content = readText(abs);
    this.files.push({ path: relPath, role, content, sha256: sha256(content) });
    return this;
  }

  /** Add generated text (e.g. the chosen idea, a listing). Not a file, but still recorded in the manifest. */
  addInline(label: string, content: string, role: ContextRole = "input"): this {
    this.files.push({ path: `(inline) ${label}`, role, content, sha256: sha256(content) });
    return this;
  }

  assertAllowed(relPath: string): void {
    const rel = relPath.replace(/\\/g, "/").replace(/^\.\//, "");
    if (rel.includes("..")) throw new IsolationError(`Refusing to load "${rel}": paths may not contain "..".`);
    if (rel === "AGENTS.md") return;
    const [top, second] = rel.split("/");
    const target = this.scope.channel;
    if (top === "channels") {
      if (second && second === target) return;
      throw new IsolationError(
        target
          ? `Refusing to load ${rel}: it belongs to channel "${second}", but this ${this.scope.purpose} step is for channel "${target}". Channels never mix.`
          : `Refusing to load ${rel}: this ${this.scope.purpose} step is not for any channel, so no channel files may be loaded.`,
      );
    }
    if (top === "drafts") {
      if (second === target || (!target && second === "niches")) return;
      throw new IsolationError(`Refusing to load ${rel}: drafts of "${second}" are outside this ${this.scope.purpose} step (channel "${target ?? "none"}").`);
    }
    if (top === "skills") {
      if (second && this.scope.skills.includes(second)) return;
      throw new IsolationError(`Refusing to load ${rel}: skill "${second}" is not one of the skills this step uses (${this.scope.skills.join(", ") || "none"}).`);
    }
    if (this.scope.globals?.includes(rel)) return;
    throw new IsolationError(`Refusing to load ${rel}: it is outside the allowed context for the ${this.scope.purpose} step.`);
  }

  manifest(): ContextManifest {
    return {
      purpose: this.scope.purpose,
      channel: this.scope.channel ?? null,
      series: this.scope.series ?? null,
      created: nowIso(),
      files: this.files.map((f) => ({ path: f.path, role: f.role, sha256: f.sha256, bytes: Buffer.byteLength(f.content) })),
    };
  }

  /** All files as tagged blocks, ready to paste into a prompt or task file. */
  render(): string {
    return this.files
      .map((f) => `<file path="${f.path}" role="${f.role}">\n${f.content.trimEnd()}\n</file>`)
      .join("\n\n");
  }
}
