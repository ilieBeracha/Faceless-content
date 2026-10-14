import { readFileSync, writeFileSync } from "node:fs";
import { EngineError } from "../core/errors.ts";

export interface Pcm {
  sampleRate: number;
  /** Mono samples in [-1, 1]. Multi-channel files are mixed down. */
  samples: Float32Array;
}

/** Read a PCM16 / PCM24 / PCM32 / float32 WAV file. */
export function readWav(path: string): Pcm {
  const buf = readFileSync(path);
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") throw new EngineError(`${path} is not a WAV file.`);
  let offset = 12;
  let format = 0;
  let channels = 1;
  let sampleRate = 0;
  let bits = 16;
  let data: Buffer | null = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt ") {
      format = buf.readUInt16LE(body);
      channels = buf.readUInt16LE(body + 2);
      sampleRate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
      if (format === 0xfffe) format = buf.readUInt16LE(body + 24); // WAVE_FORMAT_EXTENSIBLE sub-format
    } else if (id === "data") {
      data = buf.subarray(body, Math.min(body + size, buf.length));
    }
    offset = body + size + (size % 2);
  }
  if (!data || !sampleRate) throw new EngineError(`${path}: missing fmt or data chunk.`);
  const bytes = bits / 8;
  const frames = Math.floor(data.length / (bytes * channels));
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      const at = (i * channels + c) * bytes;
      let v: number;
      if (format === 3 && bits === 32) v = data.readFloatLE(at);
      else if (format === 3 && bits === 64) v = data.readDoubleLE(at);
      else if (bits === 16) v = data.readInt16LE(at) / 32768;
      else if (bits === 24) v = data.readIntLE(at, 3) / 8388608;
      else if (bits === 32) v = data.readInt32LE(at) / 2147483648;
      else throw new EngineError(`${path}: unsupported WAV format (${format}, ${bits} bits).`);
      sum += v;
    }
    samples[i] = sum / channels;
  }
  return { sampleRate, samples };
}

/** Write mono float32 WAV. */
export function writeWavFloat(path: string, pcm: Pcm): void {
  const dataBytes = pcm.samples.length * 4;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(3, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(pcm.sampleRate, 24);
  buf.writeUInt32LE(pcm.sampleRate * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(32, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < pcm.samples.length; i++) buf.writeFloatLE(pcm.samples[i], 44 + i * 4);
  writeFileSync(path, buf);
}

/**
 * Loudness envelope for mouth animation: one value per video frame in [0, 1].
 * RMS over a short window, mapped from -50 dBFS (closed) to -12 dBFS (wide open), lightly smoothed.
 */
export function loudnessEnvelope(pcm: Pcm, fps: number, frames: number): number[] {
  const hop = pcm.sampleRate / fps;
  const win = Math.round(pcm.sampleRate * 0.04);
  const raw: number[] = [];
  for (let f = 0; f < frames; f++) {
    const center = Math.round((f + 0.5) * hop);
    const a = Math.max(0, center - win);
    const b = Math.min(pcm.samples.length, center + win);
    let sum = 0;
    for (let i = a; i < b; i++) sum += pcm.samples[i] * pcm.samples[i];
    const rms = b > a ? Math.sqrt(sum / (b - a)) : 0;
    const db = 20 * Math.log10(rms + 1e-9);
    raw.push(Math.min(1, Math.max(0, (db + 50) / 38)));
  }
  // Fast attack, slower release, like a real jaw.
  const out: number[] = [];
  let level = 0;
  for (const v of raw) {
    level = v > level ? level + (v - level) * 0.75 : level + (v - level) * 0.35;
    out.push(Math.round(level * 1000) / 1000);
  }
  return out;
}
