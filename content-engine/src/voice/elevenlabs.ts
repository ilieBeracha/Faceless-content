/**
 * ElevenLabs voices through fal.ai (paid, per character): a hosted voice with natural phrasing. The API returns
 * when every character is spoken, so caption words are timed from the voice itself, as with Kokoro.
 *
 * Needs FAL_KEY in .env. Never used unless a character's voice names this provider (the person chose it).
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { EngineError } from "../core/errors.ts";
import { runFfmpeg } from "../core/ffmpeg.ts";
import type { Workspace } from "../core/workspace.ts";
import { readWav } from "./wav.ts";

/** A run of characters and when each is spoken, in seconds from the start of the audio (the API returns several runs). */
export interface CharTimings {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface HostedChunk {
  id: string;
  voice: string;
  /** One entry per caption word, as it is written. */
  say: string[];
  /** How much faster than the voice's own pace it is played (1 = as spoken). The pitch stays. */
  tempo: number;
}

export interface HostedResult {
  sample_rate: number;
  chunks: { id: string; file: string; duration: number; words: { i: number; start: number; end: number }[] }[];
}

/** What is sent to the voice for a list of caption words. */
export function spokenText(say: string[]): string {
  return say.join(" ");
}

/**
 * Each caption word's start and end, from the characters' timings: a word starts with its first character and ends
 * with its last letter or digit (the punctuation after it belongs to the pause). Throws when the timings are not
 * for exactly the text that was sent, because then no word can be placed.
 */
export function wordTimings(say: string[], runs: CharTimings[]): { i: number; start: number; end: number }[] {
  const chars = runs.flatMap((r) => r.characters);
  const starts = runs.flatMap((r) => r.character_start_times_seconds);
  const ends = runs.flatMap((r) => r.character_end_times_seconds);
  const text = spokenText(say);
  if (chars.join("") !== text || starts.length !== chars.length || ends.length !== chars.length) {
    throw new EngineError(`The voice's timings are for ${chars.length} characters, but ${text.length} were sent, so the caption words can't be timed.`);
  }
  const words: { i: number; start: number; end: number }[] = [];
  let at = 0;
  say.forEach((word, i) => {
    let last = at + word.length - 1;
    while (last > at && !/[\p{L}\p{N}]/u.test(chars[last])) last--;
    words.push({ i, start: round(starts[at]), end: round(Math.max(ends[last], starts[at])) });
    at += word.length + 1;
  });
  return words;
}

const QUEUE = "https://queue.fal.run";
const SAMPLE_RATE = 24000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function falKey(): string {
  const key = process.env.FAL_KEY;
  if (!key) throw new EngineError("The ElevenLabs voice needs FAL_KEY in .env.", "It is a paid API (fal.ai): only set it if you've chosen this voice. The default Kokoro voice is free.");
  return key;
}

async function call<T>(method: "GET" | "POST", url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { Authorization: `Key ${falKey()}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new EngineError(`fal ${method} ${url.replace(QUEUE, "")} failed (${res.status}): ${text.slice(0, 400)}`, res.status === 401 || res.status === 403 ? "Check that FAL_KEY is valid and the fal account has credit." : undefined);
  return JSON.parse(text) as T;
}

/** Voice each chunk with ElevenLabs (one WAV each, with exact word timings). */
export async function runElevenLabs(ws: Workspace, chunks: HostedChunk[], outDir: string, log: (l: string) => void = () => {}): Promise<HostedResult> {
  const cfg = ws.config.voice.providers.elevenlabs;
  if (!cfg?.endpoint) throw new EngineError('engine.config.json has no voice.providers.elevenlabs.endpoint, so the "elevenlabs" voice can\'t be used.');
  const result: HostedResult = { sample_rate: SAMPLE_RATE, chunks: [] };
  for (const chunk of chunks) {
    const text = spokenText(chunk.say);
    log(`  ↳ ElevenLabs via fal (paid): ${text.length} characters in the voice "${chunk.voice}"`);
    const job = await call<{ status_url: string; response_url: string }>("POST", `${QUEUE}/${cfg.endpoint}`, { text, voice: chunk.voice, timestamps: true, output_format: "mp3_44100_128" });
    let status = "IN_QUEUE";
    for (let waited = 0; status !== "COMPLETED"; waited += 2) {
      if (waited > 300) throw new EngineError(`The ElevenLabs voice did not finish in 5 minutes (last status: ${status}).`);
      await sleep(2000);
      status = (await call<{ status: string }>("GET", job.status_url)).status;
      if (status !== "COMPLETED" && status !== "IN_QUEUE" && status !== "IN_PROGRESS") throw new EngineError(`The ElevenLabs voice stopped with status "${status}".`);
    }
    const out = await call<{ audio?: { url?: string }; timestamps?: CharTimings[] | null }>("GET", job.response_url);
    if (!out.audio?.url || !out.timestamps?.length) throw new EngineError("The ElevenLabs voice returned no audio or no timings.");
    // The API has no speed setting, so the audio is played faster or slower (same pitch) and the words move with it.
    const words = wordTimings(chunk.say, out.timestamps).map((w) => ({ i: w.i, start: round(w.start / chunk.tempo), end: round(w.end / chunk.tempo) }));
    const audio = await fetch(out.audio.url);
    if (!audio.ok) throw new EngineError(`Downloading the ElevenLabs audio failed (${audio.status}).`);
    const mp3 = join(outDir, `${chunk.id}.mp3`);
    writeFileSync(mp3, Buffer.from(await audio.arrayBuffer()));
    const file = join(outDir, `${chunk.id}.wav`);
    runFfmpeg(["-y", "-i", mp3, ...(chunk.tempo === 1 ? [] : ["-filter:a", `atempo=${chunk.tempo}`]), "-ar", String(SAMPLE_RATE), "-ac", "1", "-c:a", "pcm_f32le", file], "converting the voice");
    result.chunks.push({ id: chunk.id, file, duration: readWav(file).samples.length / SAMPLE_RATE, words });
  }
  return result;
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}
