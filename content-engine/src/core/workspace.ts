import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { assertSlug, deepMerge, isPlainObject } from "./util.ts";

/** The content-engine folder (where package.json lives). */
export const ENGINE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export interface EngineConfig {
  video: { width: number; height: number; fps: number; codec: "h264"; crf: number };
  length: { min_seconds: number; max_seconds: number };
  safe_area: { top: number; bottom: number; left: number; right: number };
  hook: { speech_starts_by_seconds: number; hook_line_ends_by_seconds: number; on_screen_by_seconds: number };
  audio: {
    target_lufs: number;
    lufs_tolerance: number;
    true_peak_max_db: number;
    sample_rate: number;
    lead_in_seconds: number;
    beat_gap_seconds: number;
    outro_hold_seconds: number;
    max_outro_padding_seconds: number;
  };
  voice: {
    default_provider: string;
    providers: Record<string, { kind: "local" | "api"; cost: string; dir?: string; model_url?: string; voices_url?: string; python_packages?: string[]; license?: string }>;
  };
  llm: { provider: "agent" | "anthropic"; anthropic: { model: string; effort: string; max_tokens: number } };
  captions: { max_chars_per_line: number; max_lines: number };
  qa: { caption_sync_tolerance_frames: number; caption_sync_max_bad_ratio: number; frames_to_sample: number };
  render: { gl: string; jpeg_quality: number; concurrency?: number | null; browser_executable?: string | null };
  git: { auto_commit: boolean };
  fonts: string[];
  platforms: Record<string, { max_seconds: number; ai_disclosure: string }>;
  ai_video: {
    provider: "gemini";
    image_model: string;
    video_model: string;
    resolution: string;
    person_generation: string;
    budget_per_episode_usd: number;
    identity_budget_usd: number;
    check_model: string;
    rates_usd: { image: number; check: number; video_per_second: Record<string, number>; video_per_second_default: number };
    clip_seconds: number[];
    words_per_second: number;
    max_retries_per_shot: number;
    concurrency: number;
  };
}

/**
 * A content-engine workspace: AGENTS.md, templates/, channels/, drafts/, skills/, workflows/.
 * Everything the engine reads or writes goes through one of these, so tests can use a temp copy.
 */
export class Workspace {
  private cachedConfig?: EngineConfig;

  constructor(public readonly root: string) {}

  static fromEnv(): Workspace {
    loadDotEnv(ENGINE_DIR);
    const root = process.env.CONTENT_ENGINE_ROOT ? resolve(process.env.CONTENT_ENGINE_ROOT) : ENGINE_DIR;
    return new Workspace(root);
  }

  path(...parts: string[]): string {
    return join(this.root, ...parts);
  }

  /** Workspace-relative path with forward slashes (for messages, manifests and git). */
  rel(absPath: string): string {
    return relative(this.root, absPath).split(sep).join("/");
  }

  get agentsFile(): string {
    return this.path("AGENTS.md");
  }

  channelsDir(): string {
    return this.path("channels");
  }

  channelDir(slug: string): string {
    return this.path("channels", assertSlug(slug, "channel slug"));
  }

  templatePath(name: string): string {
    return this.path("templates", name);
  }

  skillDir(name: string): string {
    return this.path("skills", assertSlug(name, "skill name"));
  }

  get config(): EngineConfig {
    if (!this.cachedConfig) {
      const base = JSON.parse(readFileSync(this.path("engine.config.json"), "utf8"));
      const localPath = this.path("engine.config.local.json");
      const local = existsSync(localPath) ? JSON.parse(readFileSync(localPath, "utf8")) : {};
      let merged = deepMerge(base, local) as EngineConfig;
      // Environment overrides for machine-specific render settings.
      if (process.env.REMOTION_GL) merged = deepMerge(merged, { render: { gl: process.env.REMOTION_GL } });
      if (process.env.REMOTION_BROWSER_EXECUTABLE) merged = deepMerge(merged, { render: { browser_executable: process.env.REMOTION_BROWSER_EXECUTABLE } });
      if (process.env.RENDER_CONCURRENCY) merged = deepMerge(merged, { render: { concurrency: Number(process.env.RENDER_CONCURRENCY) } });
      if (process.env.ENGINE_LLM) merged = deepMerge(merged, { llm: { provider: process.env.ENGINE_LLM } });
      if (process.env.ENGINE_AUTO_COMMIT === "0") merged = deepMerge(merged, { git: { auto_commit: false } });
      this.cachedConfig = stripComments(merged) as EngineConfig;
    }
    return this.cachedConfig;
  }
}

function stripComments(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripComments);
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, stripComments(v)]));
  }
  return value;
}

/** Minimal .env loader: KEY=value lines; existing environment variables win. */
export function loadDotEnv(dir: string): void {
  const file = join(dir, ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trimStart().startsWith("#")) continue;
    const [, key, raw] = m;
    const value = raw.replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[key] === undefined && value !== "") process.env[key] = value;
  }
}
