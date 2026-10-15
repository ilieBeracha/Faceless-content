/**
 * Voice step: script beats → one WAV + exact word timings + a per-frame loudness envelope.
 *
 *   audio/voice.wav       48 kHz mono, loudness-normalised (gitignored; re-creatable)
 *   audio/timings.json    every caption word and beat with start/end seconds
 *   audio/envelope.json   0–1 loudness per video frame (drives the character's mouth)
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { EngineError } from "../core/errors.ts";
import { hasFilter, measureLoudness, runFfmpeg } from "../core/ffmpeg.ts";
import { canonicalJson, readJson, sha256, writeJson } from "../core/util.ts";
import type { Workspace } from "../core/workspace.ts";
import { ENGINE_DIR } from "../core/workspace.ts";
import type { EpisodeRef } from "../pipeline/episode.ts";
import type { CharacterVoice, SeriesData } from "../pipeline/script-check.ts";
import { voiceTokens, type Script } from "../skills/write-script/schema.ts";
import { loudnessEnvelope, readWav, writeWavFloat } from "./wav.ts";

export const VOICE_PIPELINE_VERSION = 2;

export interface WordTiming {
  i: number;
  beat: string;
  text: string;
  start: number;
  end: number;
}

export interface BeatTiming {
  id: string;
  speaker: string;
  start: number;
  end: number;
}

export interface Timings {
  version: number;
  hash: string;
  fps: number;
  frames: number;
  /** Total video length in seconds (speech + outro hold). */
  duration: number;
  speech_start: number;
  speech_end: number;
  outro_padding: number;
  words: WordTiming[];
  beats: BeatTiming[];
  voices: Record<string, CharacterVoice>;
  loudness: { integrated_lufs: number; true_peak_db: number };
  /** render-ai-video: where each clip sits on the timeline (seconds) and where it was cut (trim). */
  clips?: { id: string; beat: string; file: string; start: number; duration: number; trim: number; align: string; align_cost: number }[];
}

export function voicePaths(episodeDir: string) {
  const dir = join(episodeDir, "audio");
  return { dir, wav: join(dir, "voice.wav"), timings: join(dir, "timings.json"), envelope: join(dir, "envelope.json"), chunks: join(dir, "chunks") };
}

export function venvPython(ws: Workspace): string {
  return process.platform === "win32" ? ws.path(".venv", "Scripts", "python.exe") : ws.path(".venv", "bin", "python");
}

/** Kokoro voice ids start with a language letter: a = US English, b = UK English, … */
function kokoroLang(voiceId: string): string {
  return ({ a: "en-us", b: "en-gb", e: "es", f: "fr-fr", h: "hi", i: "it", j: "ja", p: "pt-br", z: "cmn" } as Record<string, string>)[voiceId[0]] ?? "en-us";
}

export function characterVoice(ep: EpisodeRef, speaker: string): CharacterVoice & { pronunciations: Record<string, string> } {
  const doc = ep.channel.characters.get(speaker);
  if (!doc) throw new EngineError(`Unknown speaker "${speaker}".`);
  const v = (doc.data.voice ?? {}) as Partial<CharacterVoice>;
  if (!v.provider || !v.voice_id) throw new EngineError(`${doc.rel}: voice.provider and voice.voice_id are required.`);
  return {
    provider: v.provider,
    voice_id: v.voice_id,
    speed: v.speed ?? 1,
    pitch_semitones: v.pitch_semitones ?? 0,
    sentence_pause: v.sentence_pause ?? 0.25,
    clause_pause: v.clause_pause ?? 0.1,
    pronunciations: (doc.data.pronunciations as Record<string, string> | undefined) ?? {},
  };
}

/** What the voice should say for one caption token (pronunciation overrides keep surrounding punctuation). */
export function sayFor(token: string, pronunciations: Record<string, string>): string {
  const m = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u.exec(token);
  if (!m) return token;
  const [, pre, core, post] = m;
  const replacement = pronunciations[core] ?? pronunciations[core.toLowerCase()];
  return replacement ? `${pre}${replacement}${post}` : token;
}

export async function synthesizeEpisode(ws: Workspace, ep: EpisodeRef, script: Script, opts: { force?: boolean; log?: (l: string) => void } = {}): Promise<{ duration: number; words: number; regenerated: boolean }> {
  const log = opts.log ?? (() => {});
  const paths = voicePaths(ep.dir);
  const cfg = ws.config.audio;
  const fps = ws.config.video.fps;
  const series = ep.channel.series.get(ep.series)!.data as unknown as SeriesData;

  const speakers = [...new Set(script.beats.map((b) => b.speaker))];
  const voices = Object.fromEntries(speakers.map((s) => [s, characterVoice(ep, s)]));
  if (Object.values(voices).every((v) => v.provider === "veo")) {
    const { voiceFromClips } = await import("../skills/render-ai-video/audio.ts");
    return voiceFromClips(ws, ep, script, { force: opts.force, log });
  }
  for (const [name, v] of Object.entries(voices)) {
    if (v.provider !== "kokoro") {
      throw new EngineError(`${name} uses voice provider "${v.provider}", which isn't wired up yet.`, v.provider === "veo" ? "A Veo voice only works when every speaker of the series uses it (the video model speaks inside the clips)." : "Only the free local Kokoro voice is available until you choose a paid provider (see README → Voices).");
    }
  }
  const hash = sha256(canonicalJson({ v: VOICE_PIPELINE_VERSION, beats: script.beats.map((b) => [b.id, b.speaker, b.voiceover]), pron: script.pronunciations, voices, audio: cfg, fps, min: series.length.min_seconds }));
  if (!opts.force && existsSync(paths.timings) && existsSync(paths.wav) && existsSync(paths.envelope)) {
    const existing = readJson<Timings>(paths.timings);
    if (existing.hash === hash) return { duration: existing.duration, words: existing.words.length, regenerated: false };
  }

  mkdirSync(paths.chunks, { recursive: true });
  const tokensPerBeat = script.beats.map((b) => voiceTokens(b.voiceover));
  const chunks: KokoroChunk[] = script.beats.map((b, i) => {
    const v = voices[b.speaker];
    const pron = { ...v.pronunciations, ...script.pronunciations };
    return {
      id: `${String(i).padStart(2, "0")}-${b.id}`,
      voice: v.voice_id,
      lang: kokoroLang(v.voice_id),
      speed: v.speed ?? 1,
      sentence_pause: v.sentence_pause ?? 0.25,
      clause_pause: v.clause_pause ?? 0.1,
      say: tokensPerBeat[i].map((t) => sayFor(t, pron)),
    };
  });
  log(`  ↳ synthesizing ${script.beats.length} beats with Kokoro (local, free)…`);
  const out = runKokoro(ws, chunks, paths.chunks);

  // Place beats on the timeline, applying each speaker's pitch.
  const sr = out.sample_rate;
  const pieces: { at: number; samples: Float32Array }[] = [];
  const words: WordTiming[] = [];
  const beats: BeatTiming[] = [];
  let t = cfg.lead_in_seconds;
  out.chunks.forEach((chunk, i) => {
    const beat = script.beats[i];
    const v = voices[beat.speaker];
    const file = v.pitch_semitones ? pitchShift(chunk.file, v.pitch_semitones!, sr) : chunk.file;
    const pcm = readWav(file);
    const scale = pcm.samples.length / sr / chunk.duration; // pitch shifting may change the length by a few samples
    pieces.push({ at: Math.round(t * sr), samples: pcm.samples });
    for (const w of chunk.words) {
      words.push({ i: words.length, beat: beat.id, text: tokensPerBeat[i][w.i], start: round(t + w.start * scale), end: round(t + w.end * scale) });
    }
    const len = pcm.samples.length / sr;
    beats.push({ id: beat.id, speaker: beat.speaker, start: round(t), end: round(t + len) });
    t += len + cfg.beat_gap_seconds;
  });
  const speechEnd = Math.max(...words.map((w) => w.end), beats.at(-1)!.end);
  let duration = beats.at(-1)!.end + cfg.outro_hold_seconds;
  let padding = 0;
  if (duration < series.length.min_seconds) {
    padding = Math.min(cfg.max_outro_padding_seconds, series.length.min_seconds - duration + 0.1);
    duration += padding;
  }
  const frames = Math.ceil(duration * fps);
  duration = frames / fps;

  const mix = new Float32Array(Math.round(duration * sr));
  for (const p of pieces) mix.set(p.samples.subarray(0, Math.max(0, Math.min(p.samples.length, mix.length - p.at))), p.at);
  const rawMix = join(paths.chunks, "mix-raw.wav");
  writeWavFloat(rawMix, { sampleRate: sr, samples: mix });

  normalizeLoudness(rawMix, paths.wav, cfg.target_lufs, cfg.true_peak_max_db - 0.5, cfg.sample_rate);
  const loud = measureLoudness(paths.wav);
  const finalPcm = readWav(paths.wav);
  writeJson(paths.envelope, { fps, frames, values: loudnessEnvelope(finalPcm, fps, frames) });

  const timings: Timings = {
    version: VOICE_PIPELINE_VERSION,
    hash,
    fps,
    frames,
    duration: round(duration),
    speech_start: words[0]?.start ?? 0,
    speech_end: round(speechEnd),
    outro_padding: round(padding),
    words,
    beats,
    voices: Object.fromEntries(Object.entries(voices).map(([k, v]) => [k, { provider: v.provider, voice_id: v.voice_id, speed: v.speed, pitch_semitones: v.pitch_semitones, sentence_pause: v.sentence_pause, clause_pause: v.clause_pause }])),
    loudness: { integrated_lufs: loud.integratedLufs, true_peak_db: loud.truePeakDb },
  };
  writeJson(paths.timings, timings);
  if (duration > series.length.max_seconds) log(`  ⚠ the voiced episode is ${duration.toFixed(1)}s — longer than the series maximum (${series.length.max_seconds}s); QA will flag it`);
  return { duration, words: words.length, regenerated: true };
}

export interface KokoroChunk {
  id: string;
  voice: string;
  lang: string;
  speed: number;
  sentence_pause: number;
  clause_pause: number;
  /** One entry per caption word: what the voice says for it. */
  say: string[];
}

export interface KokoroResult {
  sample_rate: number;
  chunks: { id: string; file: string; duration: number; words: { i: number; start: number; end: number }[] }[];
}

/** Run the local Kokoro voice on some chunks (one WAV each, with exact word timings). */
export function runKokoro(ws: Workspace, chunks: KokoroChunk[], outDir: string): KokoroResult {
  const python = venvPython(ws);
  const modelDir = ws.path(ws.config.voice.providers.kokoro.dir ?? ".models/kokoro");
  const model = join(modelDir, "kokoro-v1.0.timed.onnx");
  if (!existsSync(python) || !existsSync(model)) throw new EngineError("The local voice engine (Kokoro) is not set up yet.", "Run: ./engine setup   (free; downloads ~350 MB once)");
  mkdirSync(outDir, { recursive: true });
  const request = { model, voices: join(modelDir, "voices-v1.0.bin"), out_dir: outDir, chunks };
  const res = spawnSync(python, [join(ENGINE_DIR, "src", "voice", "kokoro_tts.py")], { input: JSON.stringify(request), encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (res.status !== 0) throw new EngineError(`Kokoro failed:\n${(res.stderr || res.stdout).split("\n").slice(-12).join("\n")}`);
  return JSON.parse(res.stdout) as KokoroResult;
}

export { kokoroLang };

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Shift pitch without changing timing: rubberband when ffmpeg has it, otherwise resample + tempo. */
function pitchShift(file: string, semitones: number, sr: number): string {
  const ratio = Math.pow(2, semitones / 12);
  const out = file.replace(/\.wav$/, `.pitch.wav`);
  const filter = hasFilter("rubberband")
    ? `rubberband=pitch=${ratio.toFixed(5)}:formant=shifted:transients=crisp`
    : `asetrate=${Math.round(sr * ratio)},aresample=${sr},atempo=${(1 / ratio).toFixed(5)}`;
  runFfmpeg(["-y", "-i", file, "-af", filter, "-ar", String(sr), "-ac", "1", "-c:a", "pcm_f32le", out], "shifting pitch");
  return out;
}

/** Two-pass EBU R128 normalisation to the platform target (≈ -14 LUFS, true peak ≤ -1.5 dBTP). */
export function normalizeLoudness(input: string, output: string, targetLufs: number, truePeak: number, sampleRate: number): void {
  const m = measureLoudness(input);
  const filter = `loudnorm=I=${targetLufs}:TP=${truePeak}:LRA=11:measured_I=${m.integratedLufs}:measured_TP=${m.truePeakDb}:measured_LRA=${m.lra}:measured_thresh=${m.threshold}:linear=true`;
  runFfmpeg(["-y", "-i", input, "-af", filter, "-ar", String(sampleRate), "-ac", "1", "-c:a", "pcm_s16le", output], "normalising loudness");
}
