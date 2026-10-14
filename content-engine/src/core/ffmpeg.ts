import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { EngineError } from "./errors.ts";

interface Tool {
  bin: string;
  env: NodeJS.ProcessEnv;
}

let cached: { ffmpeg: Tool; ffprobe: Tool; source: string } | null = null;

/** ffmpeg/ffprobe: $FFMPEG_PATH, then `ffmpeg` on PATH, then the copy that ships with Remotion. */
export function ffmpegTools(): { ffmpeg: Tool; ffprobe: Tool; source: string } {
  if (cached) return cached;
  const env = process.env;
  if (env.FFMPEG_PATH && existsSync(env.FFMPEG_PATH)) {
    const probe = join(dirname(env.FFMPEG_PATH), "ffprobe");
    cached = { ffmpeg: { bin: env.FFMPEG_PATH, env }, ffprobe: { bin: existsSync(probe) ? probe : "ffprobe", env }, source: "FFMPEG_PATH" };
    return cached;
  }
  if (spawnSync("ffmpeg", ["-version"], { encoding: "utf8" }).status === 0) {
    cached = { ffmpeg: { bin: "ffmpeg", env }, ffprobe: { bin: "ffprobe", env }, source: "system" };
    return cached;
  }
  const require = createRequire(import.meta.url);
  const pkg = { linux: process.arch === "arm64" ? "@remotion/compositor-linux-arm64-gnu" : "@remotion/compositor-linux-x64-gnu", darwin: process.arch === "arm64" ? "@remotion/compositor-darwin-arm64" : "@remotion/compositor-darwin-x64", win32: "@remotion/compositor-win32-x64-msvc" }[process.platform as "linux" | "darwin" | "win32"];
  try {
    const dir = dirname(require.resolve(`${pkg}/package.json`));
    const exe = process.platform === "win32" ? ".exe" : "";
    const libEnv = { ...env, LD_LIBRARY_PATH: dir, DYLD_LIBRARY_PATH: dir };
    cached = { ffmpeg: { bin: join(dir, "ffmpeg" + exe), env: libEnv }, ffprobe: { bin: join(dir, "ffprobe" + exe), env: libEnv }, source: "remotion" };
    return cached;
  } catch {
    throw new EngineError("ffmpeg was not found.", "Install it (macOS: brew install ffmpeg · Ubuntu: sudo apt install ffmpeg) or set FFMPEG_PATH in .env.");
  }
}

export function runFfmpeg(args: string[], what: string): string {
  const { ffmpeg } = ffmpegTools();
  const res = spawnSync(ffmpeg.bin, ["-hide_banner", "-nostdin", ...args], { encoding: "utf8", env: ffmpeg.env, maxBuffer: 64 * 1024 * 1024 });
  if (res.status !== 0) throw new EngineError(`ffmpeg failed while ${what}:\n${(res.stderr || "").split("\n").slice(-8).join("\n")}`);
  return res.stderr ?? "";
}

const filterCache = new Map<string, boolean>();
export function hasFilter(name: string): boolean {
  if (!filterCache.has(name)) {
    const { ffmpeg } = ffmpegTools();
    const res = spawnSync(ffmpeg.bin, ["-hide_banner", "-filters"], { encoding: "utf8", env: ffmpeg.env });
    filterCache.set(name, new RegExp(`\\s${name}\\s`).test(res.stdout ?? ""));
  }
  return filterCache.get(name)!;
}

export interface ProbeResult {
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  videoCodec?: string;
  audioCodec?: string;
  pixFmt?: string;
}

export function probe(file: string): ProbeResult {
  const { ffprobe } = ffmpegTools();
  const res = spawnSync(ffprobe.bin, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], { encoding: "utf8", env: ffprobe.env });
  if (res.status !== 0) throw new EngineError(`ffprobe could not read ${file}: ${res.stderr}`);
  const data = JSON.parse(res.stdout) as { format: { duration: string }; streams: { codec_type: string; codec_name: string; width?: number; height?: number; r_frame_rate?: string; pix_fmt?: string }[] };
  const video = data.streams.find((s) => s.codec_type === "video");
  const audio = data.streams.find((s) => s.codec_type === "audio");
  const [num, den] = (video?.r_frame_rate ?? "0/1").split("/").map(Number);
  return { duration: Number(data.format.duration), width: video?.width, height: video?.height, fps: den ? num / den : undefined, videoCodec: video?.codec_name, audioCodec: audio?.codec_name, pixFmt: video?.pix_fmt };
}

export interface Loudness {
  integratedLufs: number;
  truePeakDb: number;
  lra: number;
  threshold: number;
}

/** EBU R128 loudness via ffmpeg's loudnorm analysis pass. */
export function measureLoudness(file: string): Loudness {
  const stderr = runFfmpeg(["-i", file, "-vn", "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"], `measuring loudness of ${file}`);
  const json = stderr.slice(stderr.lastIndexOf("{"), stderr.lastIndexOf("}") + 1);
  const d = JSON.parse(json) as Record<string, string>;
  return { integratedLufs: Number(d.input_i), truePeakDb: Number(d.input_tp), lra: Number(d.input_lra), threshold: Number(d.input_thresh) };
}
