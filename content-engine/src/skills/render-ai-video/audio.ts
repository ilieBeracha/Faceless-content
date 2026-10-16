/**
 * Voice step for render-ai-video: the character's voice is already inside the clips (the video model
 * speaks each line). This cuts every clip to its spoken part, lays the clips end to end, finds each
 * word's timing (align.py) and writes the same files the Kokoro voice step writes:
 * audio/voice.wav, audio/timings.json (+ where each clip goes) and audio/envelope.json.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { EngineError } from "../../core/errors.ts";
import { measureLoudness, probe, runFfmpeg } from "../../core/ffmpeg.ts";
import { canonicalJson, readJson, sha256, writeJson } from "../../core/util.ts";
import type { Workspace } from "../../core/workspace.ts";
import { ENGINE_DIR } from "../../core/workspace.ts";
import type { EpisodeRef } from "../../pipeline/episode.ts";
import type { SeriesData } from "../../pipeline/script-check.ts";
import { kokoroLang, normalizeLoudness, runKokoro, venvPython, voicePaths, type BeatTiming, type Timings, type WordTiming } from "../../voice/synthesize.ts";
import { loudnessEnvelope, readWav, writeWavFloat } from "../../voice/wav.ts";
import { voiceTokens, type Script } from "../write-script/schema.ts";
import { clipAudio, footagePaths, planShots, type FootageState } from "./footage.ts";

export const CLIP_AUDIO_VERSION = 1;

interface Aligned {
  id: string;
  words: { start: number; end: number }[];
  speech_start: number;
  speech_end: number;
  cost: number;
  method: "dtw" | "energy";
  clip_seconds: number;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export async function voiceFromClips(ws: Workspace, ep: EpisodeRef, script: Script, opts: { force?: boolean; log?: (l: string) => void } = {}): Promise<{ duration: number; words: number; regenerated: boolean }> {
  const log = opts.log ?? (() => {});
  const paths = voicePaths(ep.dir);
  const fp = footagePaths(ep.dir);
  const cfg = ws.config.audio;
  const fps = ws.config.video.fps;
  const series = ep.channel.series.get(ep.series)!.data as unknown as SeriesData;
  const plan = planShots(ws, ep, script);
  const state = existsSync(fp.state) ? readJson<FootageState>(fp.state) : null;
  const missing = plan.filter((s) => !state?.shots[s.id]?.clip || !existsSync(join(fp.clips, `${s.id}.mp4`)));
  if (missing.length) throw new EngineError(`Footage is missing for ${missing.map((s) => s.id).join(", ")}.`, `Run: ./engine make episode --channel ${ep.channel.slug} --series ${ep.series}`);

  const score = ((script.visuals["render-ai-video"] ?? {}) as { score?: string }).score ?? "none";
  const hash = sha256(canonicalJson({ v: CLIP_AUDIO_VERSION, score, shots: plan.map((s) => [s.id, s.beat, s.line, state!.shots[s.id].clip!.sha]), audio: cfg, fps, len: series.length }));
  if (!opts.force && existsSync(paths.timings) && existsSync(paths.wav) && existsSync(paths.envelope)) {
    const existing = readJson<Timings>(paths.timings);
    if (existing.hash === hash) return { duration: existing.duration, words: existing.words.length, regenerated: false };
  }

  const work = join(paths.chunks, "clips");
  mkdirSync(work, { recursive: true });
  log(`  ↳ lining up ${plan.length} clips and timing every word…`);

  // Reference reading of every line (local, free) — only used to time the words.
  const ref = runKokoro(
    ws,
    plan.map((s) => ({ id: `ref-${s.id}`, voice: "af_heart", lang: kokoroLang("af_heart"), speed: 1, sentence_pause: 0.25, clause_pause: 0.1, say: voiceTokens(s.line) })),
    work,
  );
  const items = plan.map((s, k) => {
    const chunk = ref.chunks[k];
    const ref16 = join(work, `ref-${s.id}.16k.wav`);
    runFfmpeg(["-y", "-i", chunk.file, "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", ref16], "resampling the reference line");
    const clip16 = join(work, `${s.id}.16k.wav`);
    clipAudio(join(fp.clips, `${s.id}.mp4`), clip16);
    return { id: s.id, clip: clip16, ref: ref16, words: fillWords(chunk.words, voiceTokens(s.line).length, chunk.duration) };
  });
  const res = spawnSync(venvPython(ws), [join(ENGINE_DIR, "src", "skills", "render-ai-video", "align.py")], { input: JSON.stringify({ items }), encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (res.status !== 0) throw new EngineError(`Word alignment failed:\n${(res.stderr || res.stdout).split("\n").slice(-12).join("\n")}`);
  const aligned = (JSON.parse(res.stdout) as { items: Aligned[] }).items;

  // Cut each clip to its spoken part and lay them end to end.
  const sr = cfg.sample_rate;
  const words: WordTiming[] = [];
  const beats: BeatTiming[] = [];
  const clips: NonNullable<Timings["clips"]> = [];
  const pieces: { at: number; samples: Float32Array }[] = [];
  let t = 0;
  plan.forEach((shot, k) => {
    const a = aligned[k];
    const file = join(fp.clips, `${shot.id}.mp4`);
    const length = Math.min(probe(file).duration, a.clip_seconds);
    const last = k === plan.length - 1;
    const inT = Math.max(0, a.speech_start - (k === 0 ? cfg.lead_in_seconds : 0.15));
    const outT = Math.min(length, a.speech_end + (last ? cfg.outro_hold_seconds : 0.3));
    const dur = Math.max(0.2, outT - inT);
    const seg = join(work, `${shot.id}.seg.wav`);
    const fade = Math.min(0.02, dur / 4);
    runFfmpeg(["-y", "-ss", inT.toFixed(3), "-t", dur.toFixed(3), "-i", file, "-vn", "-ac", "1", "-ar", String(sr), "-af", `afade=t=in:d=${fade},afade=t=out:st=${(dur - fade).toFixed(3)}:d=${fade}`, "-c:a", "pcm_f32le", seg], "cutting clip audio");
    pieces.push({ at: Math.round(t * sr), samples: readWav(seg).samples });
    const tokens = voiceTokens(shot.line);
    a.words.forEach((w, i) => words.push({ i: words.length, beat: shot.beat, text: tokens[i], start: round(t + w.start - inT), end: round(t + w.end - inT) }));
    clips.push({ id: shot.id, beat: shot.beat, file: `clips/${shot.id}.mp4`, start: round(t), duration: round(dur), trim: round(inT), align: a.method, align_cost: a.cost });
    const prev = beats[beats.length - 1];
    const speechEnd = round(t + a.speech_end - inT);
    if (prev && prev.id === shot.beat) prev.end = speechEnd;
    else beats.push({ id: shot.beat, speaker: shot.speaker, start: round(t + a.speech_start - inT), end: speechEnd });
    t += dur;
  });

  const frames = Math.floor(t * fps);
  const duration = frames / fps;
  const mix = new Float32Array(Math.round(duration * sr));
  for (const p of pieces) mix.set(p.samples.subarray(0, Math.max(0, Math.min(p.samples.length, mix.length - p.at))), p.at);
  const rawMix = join(work, "mix-raw.wav");
  writeWavFloat(rawMix, { sampleRate: sr, samples: mix });
  const mixed = score === "space-drone" ? withScore(rawMix, join(work, "mix-scored.wav"), duration, sr, work) : rawMix;
  normalizeLoudness(mixed, paths.wav, cfg.target_lufs, cfg.true_peak_max_db - 0.5, sr);
  const loud = measureLoudness(paths.wav);
  writeJson(paths.envelope, { fps, frames, values: loudnessEnvelope(readWav(paths.wav), fps, frames) });

  const speakers = [...new Set(plan.map((s) => s.speaker))];
  const timings: Timings = {
    version: CLIP_AUDIO_VERSION,
    hash,
    fps,
    frames,
    duration: round(duration),
    speech_start: words[0]?.start ?? 0,
    speech_end: Math.max(...words.map((w) => w.end)),
    outro_padding: 0,
    words,
    beats,
    voices: Object.fromEntries(speakers.map((s) => [s, { provider: "veo", voice_id: ws.config.ai_video.video_model }])),
    loudness: { integrated_lufs: loud.integratedLufs, true_peak_db: loud.truePeakDb },
    clips,
  };
  writeJson(paths.timings, timings);
  const rough = clips.filter((c) => c.align !== "dtw");
  if (rough.length) log(`  ⚠ word timing is approximate in ${rough.map((c) => c.id).join(", ")} (alignment fell back to loudness)`);
  if (duration > series.length.max_seconds) log(`  ⚠ the cut is ${duration.toFixed(1)}s — longer than the series maximum (${series.length.max_seconds}s); QA will flag it`);
  if (duration < series.length.min_seconds) log(`  ⚠ the cut is ${duration.toFixed(1)}s — shorter than the series minimum (${series.length.min_seconds}s); QA will flag it`);
  return { duration, words: words.length, regenerated: true };
}

/** Kokoro gives timings for the words it could place; fill any gaps by interpolation. */
function fillWords(found: { i: number; start: number; end: number }[], count: number, duration: number): { start: number; end: number }[] {
  const byIndex = new Map(found.map((w) => [w.i, w]));
  const out: { start: number; end: number }[] = [];
  for (let i = 0; i < count; i++) {
    const w = byIndex.get(i);
    if (w) {
      out.push({ start: w.start, end: w.end });
      continue;
    }
    const prevEnd = out[i - 1]?.end ?? 0;
    const next = [...found].filter((x) => x.i > i).sort((a, b) => a.i - b.i)[0];
    const nextStart = next ? next.start : duration;
    const gap = next ? next.i - i : count - i;
    const step = (nextStart - prevEnd) / Math.max(1, gap);
    out.push({ start: prevEnd, end: prevEnd + step });
  }
  return out;
}

/**
 * A free, generated music bed: an open-fifth A drone (A1, E2, A2, E3, A3) with a slow swell, soft pink-noise
 * "air" and a long echo, about 16 LU under the voice and ducked further whenever she speaks.
 */
export function withScore(voiceWav: string, out: string, seconds: number, sr: number, work: string): string {
  const d = (seconds + 1).toFixed(2);
  const drone = join(work, "score-drone.wav");
  const tones = [55, 82.41, 110, 164.81, 220].map((f) => `sine=frequency=${f}:sample_rate=${sr}:duration=${d}`);
  const inputs = [...tones, `anoisesrc=color=pink:amplitude=0.4:sample_rate=${sr}:duration=${d}`].flatMap((src) => ["-f", "lavfi", "-i", src]);
  runFfmpeg(
    [
      "-y", ...inputs,
      "-filter_complex",
      `[5]lowpass=f=500,volume=0.25[air];[0][1][2][3][4][air]amix=inputs=6:weights='1 0.8 0.6 0.35 0.2 1':normalize=1,` +
        `tremolo=f=0.12:d=0.45,aecho=0.8:0.6:700|1400:0.35|0.25,lowpass=f=1400,` +
        `afade=t=in:d=2.5,afade=t=out:st=${Math.max(0, seconds - 2.5).toFixed(2)}:d=2.5[m]`,
      "-map", "[m]", "-t", seconds.toFixed(3), "-ac", "1", "-ar", String(sr), "-c:a", "pcm_f32le", drone,
    ],
    "making the score",
  );
  const gain = measureLoudness(voiceWav).integratedLufs - 16 - measureLoudness(drone).integratedLufs;
  runFfmpeg(
    [
      "-y", "-i", voiceWav, "-i", drone,
      "-filter_complex",
      `[0]asplit=2[v][key];[1]volume=${gain.toFixed(2)}dB[bed];[bed][key]sidechaincompress=threshold=0.02:ratio=6:attack=40:release=700[duck];` +
        `[v][duck]amix=inputs=2:weights='1 1':normalize=0[o]`,
      "-map", "[o]", "-ac", "1", "-ar", String(sr), "-c:a", "pcm_f32le", out,
    ],
    "mixing the score under the voice",
  );
  return out;
}
