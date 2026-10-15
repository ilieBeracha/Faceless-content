/**
 * Render step: episode folder → props → Remotion → out/<channel>/<episode>.mp4
 * The render package (props + voice.wav) is staged in .cache/ so only this episode's files are served.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { canonicalJson, nowIso, readJson, sha256, writeJson } from "../core/util.ts";
import type { Workspace } from "../core/workspace.ts";
import { ENGINE_DIR } from "../core/workspace.ts";
import type { EpisodeRef } from "../pipeline/episode.ts";
import type { SeriesData } from "../pipeline/script-check.ts";
import { parseCharacterModel } from "../skills/render-talking-character/rigs.ts";
import type { Script } from "../skills/write-script/schema.ts";
import { voicePaths, type Timings } from "../voice/synthesize.ts";
import { QA_PREFIX, type ProbeRecord } from "./qa-probe.ts";
import { safeRect } from "./timeline.ts";
import type { Brand, EpisodeProps, Rect } from "./types.ts";

export const RENDER_VERSION = 1;

export function outputPath(ws: Workspace, channel: string, episode: string): string {
  return ws.path("out", channel, `${episode}.mp4`);
}

export function brandOf(channelData: Record<string, unknown>): Brand {
  const b = (channelData.brand ?? {}) as Record<string, string>;
  return {
    primary_color: b.primary_color ?? "#3d5afe",
    accent_color: b.accent_color ?? "#ffb300",
    background: [b.background_top ?? "#0d1b2a", b.background_bottom ?? "#1b263b"],
    text_color: b.text_color ?? "#ffffff",
    font: b.font ?? "montserrat",
    caption_case: (b.caption_case as Brand["caption_case"]) ?? "normal",
    ...(b.caption_color ? { caption_color: b.caption_color } : {}),
  };
}

export function buildProps(ws: Workspace, ep: EpisodeRef, script: Script): EpisodeProps {
  const series = ep.channel.series.get(ep.series)!.data as unknown as SeriesData;
  const paths = voicePaths(ep.dir);
  const timings = readJson<Timings>(paths.timings);
  const envelope = readJson<{ values: number[] }>(paths.envelope).values;
  const characters: EpisodeProps["characters"] = {};
  for (const name of series.characters) {
    const doc = ep.channel.characters.get(name)!;
    characters[name] = { name, display_name: String(doc.data.display_name ?? name), model: parseCharacterModel(readJson(doc.modelPath)) };
  }
  const v = ws.config.video;
  return {
    width: v.width,
    height: v.height,
    fps: v.fps,
    durationInFrames: timings.frames,
    safeArea: ws.config.safe_area,
    brand: brandOf(ep.channel.doc.data),
    script,
    words: timings.words,
    beats: timings.beats,
    envelope,
    characters,
    renderSkills: series.skills.render,
    captionsSkill: series.skills.captions ?? null,
    captionStyle: ((ep.channel.series.get(ep.series)!.data.caption_style as string) === "single-word" ? "single-word" : "pages"),
    audioFile: "voice.wav",
    ...(timings.clips ? { clips: timings.clips.map(({ id, beat, file, start, duration, trim }) => ({ id, beat, file, start, duration, trim })) } : {}),
    showSafeAreas: false,
    qaProbe: true,
  };
}

/** Hash of the render code, so changing a skill re-renders episodes that use it. */
function codeHash(): string {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?|css)$/.test(e)) files.push(p);
    }
  };
  walk(join(ENGINE_DIR, "src", "render"));
  walk(join(ENGINE_DIR, "src", "skills"));
  return sha256(files.sort().map((f) => readFileSync(f, "utf8")).join("\n"));
}

export interface LayoutSummary {
  frame: { w: number; h: number };
  safe: Rect;
  elements: Record<string, { kind: string; frames: number; minX: number; minY: number; maxX: number; maxY: number }>;
  violations: { f: number; id: string; kind: string; problem: "outside-safe-area" | "cut-off" | "text-overflow"; box: [number, number, number, number] }[];
  violationCounts: Record<string, number>;
  captionWord: Record<number, number>;
  firstHeadlineFrame: number | null;
  probes: number;
}

export class LayoutCollector {
  readonly summary: LayoutSummary;
  constructor(width: number, height: number, safe: Rect) {
    this.summary = { frame: { w: width, h: height }, safe, elements: {}, violations: [], violationCounts: {}, captionWord: {}, firstHeadlineFrame: null, probes: 0 };
  }
  consume(text: string): void {
    if (!text.startsWith(QA_PREFIX)) return;
    let r: ProbeRecord;
    try {
      r = JSON.parse(text.slice(QA_PREFIX.length));
    } catch {
      return;
    }
    // Measurements taken while the page is still parked off-screen (first frames of a tab) are not layout.
    if (r.y < -10_000) return;
    const s = this.summary;
    s.probes++;
    const el = (s.elements[r.id] ??= { kind: r.kind, frames: 0, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    el.frames++;
    el.minX = Math.min(el.minX, r.x);
    el.minY = Math.min(el.minY, r.y);
    el.maxX = Math.max(el.maxX, r.x + r.w);
    el.maxY = Math.max(el.maxY, r.y + r.h);
    const flag = (problem: LayoutSummary["violations"][number]["problem"]) => {
      const key = `${r.id}:${problem}`;
      s.violationCounts[key] = (s.violationCounts[key] ?? 0) + 1;
      if (s.violations.length < 60) s.violations.push({ f: r.f, id: r.id, kind: r.kind, problem, box: [r.x, r.y, r.w, r.h] });
    };
    const tol = 2;
    if (r.x < -tol || r.y < -tol || r.x + r.w > s.frame.w + tol || r.y + r.h > s.frame.h + tol) flag("cut-off");
    else if (r.x < s.safe.x - tol || r.y < s.safe.y - tol || r.x + r.w > s.safe.x + s.safe.w + tol || r.y + r.h > s.safe.y + s.safe.h + tol) flag("outside-safe-area");
    if (r.overflow) flag("text-overflow");
    if (r.kind === "caption" && typeof r.word === "number") s.captionWord[r.f] = r.word;
    if (r.kind === "headline" && (s.firstHeadlineFrame === null || r.f < s.firstHeadlineFrame)) s.firstHeadlineFrame = r.f;
  }
}

async function bundleFor(publicDir: string | null, log: (l: string) => void): Promise<string> {
  const { bundle } = await import("@remotion/bundler");
  log("  ↳ bundling the Remotion project…");
  return bundle({ entryPoint: join(ENGINE_DIR, "src", "render", "index.ts"), ...(publicDir ? { publicDir } : {}), onProgress: () => undefined });
}

function browserOptions(ws: Workspace) {
  const exe = ws.config.render.browser_executable ?? null;
  return { browserExecutable: exe, chromiumOptions: { gl: ws.config.render.gl as "angle" | "swangle" | "egl" | "swiftshader" | "vulkan" | "angle-egl", enableMultiProcessOnLinux: true } };
}

export async function renderEpisode(ws: Workspace, ep: EpisodeRef, script: Script, opts: { force?: boolean; log?: (l: string) => void } = {}): Promise<{ output: string; regenerated: boolean }> {
  const log = opts.log ?? (() => {});
  const props = buildProps(ws, ep, script);
  const wav = voicePaths(ep.dir).wav;
  const clipFiles = (props.clips ?? []).map((c) => ({ src: join(ep.dir, "footage", c.file), dest: c.file }));
  const inputsHash = sha256(canonicalJson({ v: RENDER_VERSION, props: { ...props, envelope: sha256(JSON.stringify(props.envelope)) }, wav: sha256(readFileSync(wav)), clips: clipFiles.map((c) => sha256(readFileSync(c.src))), code: codeHash() }));
  const output = outputPath(ws, ep.channel.slug, ep.state.id);
  const manifestPath = join(ep.dir, "render.json");
  if (!opts.force && existsSync(manifestPath) && existsSync(output) && readJson<{ inputs_hash: string }>(manifestPath).inputs_hash === inputsHash) {
    return { output, regenerated: false };
  }

  const stage = ws.path(".cache", "render", ep.channel.slug, ep.state.id, "public");
  mkdirSync(stage, { recursive: true });
  copyFileSync(wav, join(stage, "voice.wav"));
  for (const c of clipFiles) {
    mkdirSync(dirname(join(stage, c.dest)), { recursive: true });
    copyFileSync(c.src, join(stage, c.dest));
  }
  const serveUrl = await bundleFor(stage, log);
  const { renderMedia, selectComposition } = await import("@remotion/renderer");
  const browser = browserOptions(ws);
  const composition = await selectComposition({ serveUrl, id: "Episode", inputProps: props, ...browser, logLevel: "error" });
  const collector = new LayoutCollector(props.width, props.height, safeRect(props.width, props.height, props.safeArea));
  mkdirSync(join(ws.path("out"), ep.channel.slug), { recursive: true });
  let lastPct = -10;
  const started = Date.now();
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: output,
    inputProps: props,
    ...browser,
    concurrency: ws.config.render.concurrency ?? null,
    crf: ws.config.video.crf,
    imageFormat: "jpeg",
    jpegQuality: ws.config.render.jpeg_quality,
    pixelFormat: "yuv420p",
    audioCodec: "aac",
    audioBitrate: "192k",
    timeoutInMilliseconds: 180_000,
    logLevel: "error",
    onBrowserLog: (l) => collector.consume(l.text),
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100);
      if (pct >= lastPct + 10) {
        lastPct = pct - (pct % 10);
        log(`  ↳ rendering ${pct}% (${Math.round((Date.now() - started) / 1000)}s)`);
      }
    },
  });
  mkdirSync(join(ep.dir, "qa"), { recursive: true });
  writeJson(join(ep.dir, "qa", "layout.json"), collector.summary);
  writeJson(manifestPath, {
    output: ws.rel(output),
    rendered_at: nowIso(),
    seconds_to_render: Math.round((Date.now() - started) / 1000),
    width: props.width,
    height: props.height,
    fps: props.fps,
    frames: props.durationInFrames,
    render_skills: props.renderSkills,
    captions_skill: props.captionsSkill,
    gl: ws.config.render.gl,
    inputs_hash: inputsHash,
  });
  return { output, regenerated: true };
}

/** Render a few stills of any props (used by `./engine doctor` and previews). */
export async function renderStills(ws: Workspace, props: EpisodeProps, frames: number[], outDir: string, log: (l: string) => void = () => {}): Promise<string[]> {
  const serveUrl = await bundleFor(null, log);
  const { renderStill, selectComposition } = await import("@remotion/renderer");
  const browser = browserOptions(ws);
  const composition = await selectComposition({ serveUrl, id: "Episode", inputProps: props, ...browser, logLevel: "error" });
  mkdirSync(outDir, { recursive: true });
  const files: string[] = [];
  for (const frame of frames) {
    const file = join(outDir, `frame-${String(frame).padStart(4, "0")}.jpg`);
    await renderStill({ composition, serveUrl, output: file, frame, inputProps: props, imageFormat: "jpeg", jpegQuality: 85, ...browser, logLevel: "error" });
    files.push(file);
    log(`  ↳ ${file}`);
  }
  return files;
}
