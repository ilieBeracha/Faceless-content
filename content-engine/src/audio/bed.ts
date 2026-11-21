/**
 * The sound under the voice: a music bed made for each video (fal, paid) and a few sound effects on the cuts.
 *
 *   audio/voice.wav   the voice alone; captions, the loudness envelope and QA's sync check read it (never changed here)
 *   audio/music.m4a   the music, made once per prompt and length (audio/music.json says what it cost)
 *   audio/mix.wav     voice + music (ducked under speech) + effects, at the platform loudness; this is what is rendered
 *
 * Effects: a low hit under the hook, a whoosh on every beat change, a riser into the last beat.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EngineError } from "../core/errors.ts";
import { downloadFal, runFal } from "../core/fal.ts";
import { measureLoudness, probe, runFfmpeg } from "../core/ffmpeg.ts";
import { nowIso } from "../core/util.ts";
import { ENGINE_DIR, type Workspace } from "../core/workspace.ts";
import type { Script } from "../skills/write-script/schema.ts";
import { normalizeLoudness, type BeatTiming } from "../voice/synthesize.ts";

export const SFX_DIR = join(ENGINE_DIR, "src", "audio", "sfx");

/** The engine's effects: made once with `./engine sfx`, then reused by every video. */
export const SFX = {
  hit: { seconds: 1.5, prompt: "Deep, soft cinematic impact hit with a short low boom tail. Clean, no music, no voice." },
  whoosh: { seconds: 0.8, prompt: "Short, clean, airy whoosh transition, a quick swish passing by. No music, no voice." },
  riser: { seconds: 1.6, prompt: "Short, soft cinematic riser that swells with airy noise and a rising tone and stops at its peak. No music, no voice." },
} as const;
export type SfxName = keyof typeof SFX;

export function sfxFile(name: SfxName): string {
  return join(SFX_DIR, `${name}.mp3`);
}

/** What the music model is asked for: the channel's feel and the video's topic, kept under a narrator. */
export function musicPrompt(tone: string[], title: string): string {
  return [
    `Instrumental background music for a short vertical video with a narrator speaking over it.`,
    `Feel: ${tone.join(", ")}. Topic: ${title}.`,
    `No vocals, no lyrics, no spoken words. Steady energy from the first second, no long silences or sudden drops, and a clean ending.`,
  ].join(" ");
}

export interface SfxCue {
  name: SfxName;
  /** When the effect starts playing, in seconds from the start of the video. */
  at: number;
}

/** Visuals switch this long before each beat's voice (as in render/timeline.ts), so the effects land on the cut. */
const VISUAL_LEAD = 0.12;

/**
 * Where the effects go: the hit at the very start (under the hook), a whoosh centred on every later beat's cut,
 * and, when there are three beats or more, a riser that ends on the last beat's cut instead of a whoosh.
 */
export function sfxCues(beats: Pick<BeatTiming, "start">[], lengths: Record<SfxName, number>): SfxCue[] {
  const cues: SfxCue[] = [{ name: "hit", at: 0 }];
  beats.forEach((b, i) => {
    if (i === 0) return;
    const cut = Math.max(0, b.start - VISUAL_LEAD);
    if (i === beats.length - 1 && beats.length >= 3) cues.push({ name: "riser", at: Math.max(0, cut - lengths.riser) });
    else cues.push({ name: "whoosh", at: Math.max(0, cut - lengths.whoosh / 2) });
  });
  return cues.map((c) => ({ ...c, at: Math.round(c.at * 1000) / 1000 }));
}

interface MusicRecord {
  prompt: string;
  seconds: number;
  endpoint: string;
  usd: number;
  made_at: string;
}

/** The video's music: made on fal for this prompt and length, or the one already made for them. */
export async function ensureMusic(ws: Workspace, episodeDir: string, prompt: string, seconds: number, log: (l: string) => void): Promise<string> {
  const cfg = ws.config.music;
  const dir = join(episodeDir, "audio");
  const file = join(dir, "music.m4a");
  const recordPath = join(dir, "music.json");
  const want = Math.ceil(seconds);
  if (existsSync(file) && existsSync(recordPath)) {
    const r = JSON.parse(readFileSync(recordPath, "utf8")) as MusicRecord;
    if (r.prompt === prompt && r.seconds === want && r.endpoint === cfg.endpoint) return file;
  }
  const usd = Math.max(want, cfg.min_billed_seconds) * cfg.usd_per_second;
  log(`  ↳ music via fal (paid, about $${usd.toFixed(3)}): ${want}s from ${cfg.endpoint}`);
  const out = await runFal<{ audio?: { url?: string } }>("The music", cfg.endpoint, { prompt, duration: want, num_samples: 1 });
  if (!out.audio?.url) throw new EngineError("The music model returned no audio.");
  mkdirSync(dir, { recursive: true });
  await downloadFal("the music", out.audio.url, file);
  const record: MusicRecord = { prompt, seconds: want, endpoint: cfg.endpoint, usd: Math.round(usd * 10000) / 10000, made_at: nowIso() };
  writeFileSync(recordPath, JSON.stringify(record, null, 2) + "\n");
  return file;
}

/**
 * voice.wav + music + effects → audio/mix.wav (48 kHz stereo, at the platform loudness). The music sits
 * `under_voice_lu` under the voice and is ducked further by the voice itself; it fades out with the video.
 */
export function mixEpisodeAudio(ws: Workspace, episodeDir: string, voiceWav: string, music: string | null, beats: Pick<BeatTiming, "start">[], seconds: number): string {
  const cfg = ws.config.music;
  const audio = ws.config.audio;
  const sr = audio.sample_rate;
  const lengths = {} as Record<SfxName, number>;
  for (const name of Object.keys(SFX) as SfxName[]) {
    if (!existsSync(sfxFile(name))) throw new EngineError(`The sound effect ${name}.mp3 is missing from src/audio/sfx/, so the video can't be mixed.`, "Run: ./engine sfx   (paid, about $0.01, once for the whole engine)");
    lengths[name] = probe(sfxFile(name)).duration;
  }
  const cues = sfxCues(beats, lengths);
  const voiceLufs = measureLoudness(voiceWav).integratedLufs;
  const d = seconds.toFixed(3);
  const inputs = ["-i", voiceWav];
  const graph: string[] = ["[0]aformat=channel_layouts=stereo,asplit=2[v][key]"];
  const layers = ["[v]"];
  if (music) {
    const gain = voiceLufs - cfg.under_voice_lu - measureLoudness(music).integratedLufs;
    inputs.push("-i", music);
    graph.push(
      `[1]aresample=${sr},aformat=channel_layouts=stereo,atrim=0:${d},apad=whole_dur=${d},` +
        `afade=t=in:d=0.05,afade=t=out:st=${Math.max(0, seconds - 1.5).toFixed(3)}:d=1.5,volume=${gain.toFixed(2)}dB[bed]`,
      `[bed][key]sidechaincompress=threshold=0.03:ratio=2:attack=30:release=600[music]`,
    );
    layers.push("[music]");
  } else {
    graph.push("[key]anullsink");
  }
  const sfxGain = Object.fromEntries((Object.keys(SFX) as SfxName[]).map((n) => [n, voiceLufs - cfg.sfx_under_voice_lu - measureLoudness(sfxFile(n)).integratedLufs]));
  cues.forEach((c, k) => {
    const n = inputs.length / 2;
    inputs.push("-i", sfxFile(c.name));
    const ms = Math.round(c.at * 1000);
    graph.push(`[${n}]aresample=${sr},aformat=channel_layouts=stereo,volume=${sfxGain[c.name].toFixed(2)}dB,adelay=${ms}|${ms}[s${k}]`);
    layers.push(`[s${k}]`);
  });
  graph.push(`${layers.join("")}amix=inputs=${layers.length}:duration=first:normalize=0[o]`);
  const dir = join(episodeDir, "audio");
  const raw = join(dir, "mix-raw.wav");
  const out = join(dir, "mix.wav");
  runFfmpeg(["-y", ...inputs, "-filter_complex", graph.join(";"), "-map", "[o]", "-t", d, "-ar", String(sr), "-ac", "2", "-c:a", "pcm_f32le", raw], "mixing music and effects under the voice");
  normalizeLoudness(raw, out, audio.target_lufs, audio.true_peak_max_db - 0.5, sr, 2);
  return out;
}

/** Make the engine's effects on fal (paid, once): only the ones that are missing. */
export async function makeSfx(ws: Workspace, log: (l: string) => void): Promise<void> {
  const cfg = ws.config.music;
  mkdirSync(SFX_DIR, { recursive: true });
  for (const [name, s] of Object.entries(SFX) as [SfxName, (typeof SFX)[SfxName]][]) {
    const file = sfxFile(name);
    if (existsSync(file)) {
      log(`  ✓ ${name}.mp3 is already made`);
      continue;
    }
    log(`  ↳ ${name} via fal (paid, about $${(s.seconds * cfg.sfx_usd_per_second).toFixed(4)})`);
    const out = await runFal<{ audio?: { url?: string } }>(`The ${name} effect`, cfg.sfx_endpoint, { text: s.prompt, duration_seconds: s.seconds, prompt_influence: 0.6, output_format: "mp3_44100_128" });
    if (!out.audio?.url) throw new EngineError(`The ${name} effect came back with no audio.`);
    await downloadFal(`the ${name} effect`, out.audio.url, file);
  }
}

/** The script asked for the generated drone (render-ai-video's own score), which already sits under its voice. */
export function hasOwnScore(script: Script): boolean {
  return ((script.visuals["render-ai-video"] ?? {}) as { score?: string }).score === "space-drone";
}
