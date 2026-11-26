/**
 * Render step: episode folder → props → Remotion → out/<channel>/<episode>.mp4
 * The render package (props + mix.wav: the voice with music and effects under it) is staged in .cache/ so only
 * this episode's files are served.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { canonicalJson, nowIso, readJson, sha256, writeJson } from "../core/util.ts";
import type { Workspace } from "../core/workspace.ts";
import { ENGINE_DIR } from "../core/workspace.ts";
import type { EpisodeRef } from "../pipeline/episode.ts";
import { videoCaptions } from "../pipeline/storyboard.ts";
import type { SeriesData } from "../pipeline/script-check.ts";
import { parseCharacterModel } from "../skills/render-talking-character/rigs.ts";
import { parseTheme, shotsUsed, type Theme } from "../skills/render-themed/schema.ts";
import { readMotionClips } from "../skills/render-themed/animate.ts";
import { EngineError } from "../core/errors.ts";
import { runFfmpeg } from "../core/ffmpeg.ts";
import type { Script } from "../skills/write-script/schema.ts";
import { voicePaths, type Timings } from "../voice/synthesize.ts";
import { ensureMusic, hasOwnScore, mixEpisodeAudio, musicPrompt } from "../audio/bed.ts";
import { languageOf } from "../core/languages.ts";
import { captionsSrt } from "../skills/captions/srt.ts";
import { QA_PREFIX, type ProbeRecord } from "./qa-probe.ts";
import { safeRect } from "./timeline.ts";
import { type Brand, type EpisodeProps, type Rect } from "./types.ts";

export const RENDER_VERSION = 1;

export function outputPath(ws: Workspace, channel: string, episode: string): string {
  return ws.path("out", channel, `${episode}.mp4`);
}

/** The video's captions as a file of their own, beside the video, to lay over it instead of drawing them in. */
export function captionsPath(ws: Workspace, channel: string, episode: string): string {
  return ws.path("out", channel, `${episode}.srt`);
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

/** A channel's look for render-themed: channels/<slug>/theme.json. */
export function loadChannelTheme(channelDir: string, slug: string): Theme {
  const path = join(channelDir, "theme.json");
  if (!existsSync(path)) throw new EngineError(`Channel "${slug}" uses render-themed but has no theme.json.`, "Copy one from the engine's themes/ folder into the channel folder, or write a new one (see skills/render-themed/SKILL.md).");
  return parseTheme(readJson(path), `channels/${slug}/theme.json`);
}

/**
 * render-themed: the channel's look and, when it has a world, the painted shots (staged as shots/<id>.jpg) and,
 * once the motion step has animated them, their moving clips (staged as shots/clips/<id>.mp4).
 */
function themedProps(ep: EpisodeRef, script: Script): Pick<EpisodeProps, "theme" | "shots" | "shotClips"> {
  const theme = loadChannelTheme(ep.channel.dir, ep.channel.slug);
  if (!theme.world) return { theme };
  const ids = shotsUsed(script.beats).map(({ id }) => id);
  const shots = Object.fromEntries(ids.map((id) => [id, `shots/${id}.jpg`]));
  const moving = readMotionClips(ep.dir);
  if (!moving) return { theme, shots };
  const missing = ids.filter((id) => !moving[id]);
  if (missing.length) throw new EngineError(`Shot(s) ${missing.map((id) => `"${id}"`).join(", ")} of ${ep.state.id} have no moving clip, but its other shots do.`, "Run the episode again: its motion step animates every shot.");
  return { theme, shots, shotClips: Object.fromEntries(ids.map((id) => [id, { file: `shots/${moving[id].file}`, seconds: moving[id].seconds }])) };
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
  // A storyboard's caption settings (the person's choices) override the channel's.
  const captions = videoCaptions(ep.dir);
  const brand = brandOf(ep.channel.doc.data);
  return {
    width: v.width,
    height: v.height,
    fps: v.fps,
    durationInFrames: timings.frames,
    safeArea: ws.config.safe_area,
    brand: captions ? { ...brand, caption_case: captions.case, ...(captions.color ? { caption_color: captions.color } : {}) } : brand,
    ...(captions ? { captionLayout: { size: captions.size, place: captions.place, hide_beats: captions.hide_beats, ...(captions.font ? { font: captions.font } : {}), ...(captions.text_color ? { text_color: captions.text_color } : {}), ...(captions.color ? { highlight: captions.color } : {}) } } : {}),
    script,
    words: timings.words,
    beats: timings.beats,
    envelope,
    characters,
    renderSkills: series.skills.render,
    captionsSkill: captions?.show === false ? null : (series.skills.captions ?? null),
    captionStyle: ((ep.channel.series.get(ep.series)!.data.caption_style as string) === "single-word" ? "single-word" : "pages"),
    audioFile: "mix.wav",
    direction: languageOf(String(ep.channel.doc.data.language ?? "en")).rtl ? "rtl" : "ltr",
    ...(series.skills.render.includes("render-themed") ? themedProps(ep, script) : {}),
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
  firstCaptionFrame: number | null;
  probes: number;
}

export class LayoutCollector {
  readonly summary: LayoutSummary;
  constructor(width: number, height: number, safe: Rect) {
    this.summary = { frame: { w: width, h: height }, safe, elements: {}, violations: [], violationCounts: {}, captionWord: {}, firstCaptionFrame: null, probes: 0 };
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
    if (r.kind === "caption" && (s.firstCaptionFrame === null || r.f < s.firstCaptionFrame)) s.firstCaptionFrame = r.f;
  }
}

export async function bundleFor(publicDir: string | null, log: (l: string) => void): Promise<string> {
  const { bundle } = await import("@remotion/bundler");
  log("  ↳ bundling the Remotion project…");
  return bundle({ entryPoint: join(ENGINE_DIR, "src", "render", "index.ts"), ...(publicDir ? { publicDir } : {}), onProgress: () => undefined });
}

export function browserOptions(ws: Workspace) {
  const exe = ws.config.render.browser_executable ?? null;
  return { browserExecutable: exe, chromiumOptions: { gl: ws.config.render.gl as "angle" | "swangle" | "egl" | "swiftshader" | "vulkan" | "angle-egl", enableMultiProcessOnLinux: true } };
}

/**
 * The video without its captions (pictures, motion, sound): rendered once, then the captions are drawn over it
 * (bakeCaptions). Changing how the captions look draws them again on this, never the pictures.
 */
export function cleanPath(ws: Workspace, channel: string, episode: string): string {
  return ws.path("out", channel, "clean", `${episode}.mp4`);
}

/** Props with nothing of the captions in them: what the clean render draws (the channel's own brand, no caption layer). */
function withoutCaptions(props: EpisodeProps, brand: Brand): EpisodeProps {
  const { captionLayout: _layout, ...rest } = props;
  return { ...rest, brand, captionsSkill: null };
}

/** Render settings shared by the clean render and the captions pass. */
function mediaOptions(ws: Workspace, crf: number) {
  return { codec: "h264" as const, crf, imageFormat: "jpeg" as const, jpegQuality: ws.config.render.jpeg_quality, pixelFormat: "yuv420p" as const, audioCodec: "aac" as const, audioBitrate: "192k" as const, timeoutInMilliseconds: 180_000, logLevel: "error" as const, concurrency: ws.config.render.concurrency ?? null };
}

function progress(log: (l: string) => void, what: string) {
  let lastPct = -10;
  const started = Date.now();
  return {
    started,
    onProgress: ({ progress: p }: { progress: number }) => {
      const pct = Math.floor(p * 100);
      if (pct >= lastPct + 10) {
        lastPct = pct - (pct % 10);
        log(`  ↳ ${what} ${pct}% (${Math.round((Date.now() - started) / 1000)}s)`);
      }
    },
  };
}

/** Both layouts in one: the pictures' text from the clean render, the captions from the captions pass. */
export function mergeLayouts(scene: LayoutSummary, captions: LayoutSummary): LayoutSummary {
  const counts = { ...scene.violationCounts };
  for (const [k, n] of Object.entries(captions.violationCounts)) counts[k] = (counts[k] ?? 0) + n;
  return {
    frame: scene.frame,
    safe: scene.safe,
    elements: { ...scene.elements, ...captions.elements },
    violations: [...scene.violations, ...captions.violations].slice(0, 60),
    violationCounts: counts,
    captionWord: captions.captionWord,
    firstCaptionFrame: captions.firstCaptionFrame,
    probes: scene.probes + captions.probes,
  };
}

export async function renderEpisode(ws: Workspace, ep: EpisodeRef, script: Script, opts: { force?: boolean; log?: (l: string) => void } = {}): Promise<{ output: string; regenerated: boolean }> {
  const log = opts.log ?? (() => {});
  const props = buildProps(ws, ep, script);
  const clean = withoutCaptions(props, brandOf(ep.channel.doc.data));
  // What is heard: the voice with the video's music (made once, paid) and the engine's effects under it.
  const tone = ep.channel.doc.data.tone as string[];
  const seconds = props.durationInFrames / props.fps;
  const music = hasOwnScore(script) ? null : await ensureMusic(ws, ep.dir, musicPrompt(tone, script.title), seconds, log);
  const wav = mixEpisodeAudio(ws, ep.dir, voicePaths(ep.dir).wav, music, props.beats, seconds);
  const clipFiles = [
    ...(props.clips ?? []).map((c) => ({ src: join(ep.dir, "footage", c.file), dest: c.file })),
    ...Object.values(props.shots ?? {}).map((file) => ({ src: join(ep.dir, file), dest: file })),
    ...Object.values(props.shotClips ?? {}).map(({ file }) => ({ src: join(ep.dir, file), dest: file })),
  ];
  for (const c of clipFiles) if (!existsSync(c.src)) throw new EngineError(`${ws.rel(c.src)} is missing, so the episode can't be rendered.`, "Run the episode again: its footage or paint step makes it.");
  const inputsHash = sha256(canonicalJson({ v: RENDER_VERSION, props: { ...clean, envelope: sha256(JSON.stringify(clean.envelope)) }, wav: sha256(readFileSync(wav)), clips: clipFiles.map((c) => sha256(readFileSync(c.src))), code: codeHash() }));
  const cleanFile = cleanPath(ws, ep.channel.slug, ep.state.id);
  mkdirSync(dirname(cleanFile), { recursive: true });
  writeFileSync(captionsPath(ws, ep.channel.slug, ep.state.id), captionsSrt(props.words, ws.config.captions.max_chars_per_line, ws.config.captions.max_lines));
  const manifestPath = join(ep.dir, "render.json");
  const cleanDone = !opts.force && existsSync(manifestPath) && existsSync(cleanFile) && readJson<{ inputs_hash: string }>(manifestPath).inputs_hash === inputsHash;

  if (!cleanDone) {
    const stage = ws.path(".cache", "render", ep.channel.slug, ep.state.id, "public");
    mkdirSync(stage, { recursive: true });
    copyFileSync(wav, join(stage, "mix.wav"));
    for (const c of clipFiles) {
      mkdirSync(dirname(join(stage, c.dest)), { recursive: true });
      copyFileSync(c.src, join(stage, c.dest));
    }
    const serveUrl = await bundleFor(stage, log);
    const { renderMedia, selectComposition } = await import("@remotion/renderer");
    const browser = browserOptions(ws);
    const composition = await selectComposition({ serveUrl, id: "Episode", inputProps: clean, ...browser, logLevel: "error" });
    const collector = new LayoutCollector(props.width, props.height, safeRect(props.width, props.height, props.safeArea));
    const p = progress(log, "rendering");
    // A little finer than the finished video: it is encoded again when the captions are drawn over it.
    await renderMedia({ composition, serveUrl, outputLocation: cleanFile, inputProps: clean, ...browser, ...mediaOptions(ws, Math.max(0, ws.config.video.crf - 4)), onBrowserLog: (l) => collector.consume(l.text), onProgress: p.onProgress });
    mkdirSync(join(ep.dir, "qa"), { recursive: true });
    writeJson(scenePath(ep.dir), collector.summary);
    writeJson(manifestPath, {
      output: ws.rel(cleanFile),
      rendered_at: nowIso(),
      seconds_to_render: Math.round((Date.now() - p.started) / 1000),
      width: props.width,
      height: props.height,
      fps: props.fps,
      frames: props.durationInFrames,
      render_skills: props.renderSkills,
      gl: ws.config.render.gl,
      inputs_hash: inputsHash,
    });
  }
  const baked = await bakeCaptions(ws, ep, script, { force: !cleanDone, log });
  return { output: baked.output, regenerated: !cleanDone || baked.regenerated };
}

/** The layout measured in the clean render (the pictures' own text), kept for when only the captions are drawn again. */
function scenePath(episodeDir: string): string {
  return join(episodeDir, "qa", "layout-scene.json");
}

/**
 * Draw the captions over the clean render, as the video's caption settings say (captions.json, else its storyboard's):
 * out/<channel>/<episode>.mp4. Only this runs when the captions change. Throws when the clean render is missing.
 * Writes qa/layout.json: the clean render's layout with the captions' own.
 */
export async function bakeCaptions(ws: Workspace, ep: EpisodeRef, script: Script, opts: { force?: boolean; log?: (l: string) => void } = {}): Promise<{ output: string; regenerated: boolean }> {
  const log = opts.log ?? (() => {});
  const cleanFile = cleanPath(ws, ep.channel.slug, ep.state.id);
  if (!existsSync(cleanFile) || !existsSync(scenePath(ep.dir))) throw new EngineError(`${ws.rel(cleanFile)} is missing, so the captions can't be drawn.`, "Render the episode first (make episode … --redo render).");
  const props = buildProps(ws, ep, script);
  const output = outputPath(ws, ep.channel.slug, ep.state.id);
  const hash = sha256(canonicalJson({ v: RENDER_VERSION, clean: sha256(readFileSync(cleanFile)), props: { ...props, envelope: sha256(JSON.stringify(props.envelope)) }, code: codeHash() }));
  const manifestPath = join(ep.dir, "captions-render.json");
  if (!opts.force && existsSync(manifestPath) && existsSync(output) && readJson<{ inputs_hash: string }>(manifestPath).inputs_hash === hash) return { output, regenerated: false };

  const scene = readJson<LayoutSummary>(scenePath(ep.dir));
  const collector = new LayoutCollector(props.width, props.height, safeRect(props.width, props.height, props.safeArea));
  const started = Date.now();
  const tmp = `${output}.part.mp4`;
  if (props.captionsSkill) {
    // The captions alone, as transparent PNG frames, laid over the clean render by ffmpeg: the pictures are never
    // decoded in the browser (that was what made this pass slow on a small server).
    const frames = ws.path(".cache", "render", ep.channel.slug, ep.state.id, "caption-frames");
    rmSync(frames, { recursive: true, force: true });
    mkdirSync(frames, { recursive: true });
    const serveUrl = await bundleFor(null, log);
    const { renderFrames, selectComposition } = await import("@remotion/renderer");
    const browser = browserOptions(ws);
    const composition = await selectComposition({ serveUrl, id: "CaptionLayer", inputProps: props, ...browser, logLevel: "error" });
    const p = progress(log, "drawing the captions");
    await renderFrames({ composition, serveUrl, inputProps: props, outputDir: frames, imageFormat: "png", imageSequencePattern: "frame-[frame].[ext]", ...browser, timeoutInMilliseconds: 180_000, logLevel: "error", concurrency: ws.config.render.concurrency ?? null, onStart: () => undefined, onFrameUpdate: (done) => p.onProgress({ progress: done / props.durationInFrames }), onBrowserLog: (l) => collector.consume(l.text) });
    log("  ↳ laying the captions over the video");
    runFfmpeg(["-y", "-i", cleanFile, "-framerate", String(props.fps), "-pattern_type", "glob", "-i", join(frames, "frame-*.png"), "-filter_complex", "[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]", "-map", "[v]", "-map", "0:a", "-c:v", "libx264", "-crf", String(ws.config.video.crf), "-c:a", "copy", "-movflags", "+faststart", tmp], "laying the captions over the video");
    rmSync(frames, { recursive: true, force: true });
  } else copyFileSync(cleanFile, tmp); // no captions in this video: the clean render is the video
  renameSync(tmp, output);
  writeJson(join(ep.dir, "qa", "layout.json"), mergeLayouts(scene, collector.summary));
  writeJson(manifestPath, { output: ws.rel(output), rendered_at: nowIso(), seconds_to_render: Math.round((Date.now() - started) / 1000), captions_skill: props.captionsSkill, inputs_hash: hash });
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
