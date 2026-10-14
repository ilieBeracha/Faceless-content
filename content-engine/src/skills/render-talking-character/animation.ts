import { clamp, easeInOut, hash01, lerp } from "../../render/timeline.ts";
import type { BeatSpan } from "../../render/types.ts";
import { expressionSchema, type Expression } from "./rigs.ts";

const NEUTRAL: Expression = expressionSchema.parse({});

/** Expression at time t, blending into each beat's expression over 0.3 s. */
export function expressionAt(expressions: Record<string, Partial<Expression>>, spans: BeatSpan[], t: number, speaker: string | null): Expression {
  const resolve = (name: string): Expression => ({ ...NEUTRAL, ...(expressions.neutral ?? {}), ...(expressions[name] ?? {}) });
  let current = resolve("neutral");
  for (const span of spans) {
    if (t < span.start) break;
    const target = span.beat.speaker === speaker || speaker === null ? resolve(span.beat.character.expression) : resolve("neutral");
    const k = easeInOut((t - span.start) / 0.3);
    current = blend(current, target, k);
  }
  return current;
}

function blend(a: Expression, b: Expression, k: number): Expression {
  return {
    eye_scale: lerp(a.eye_scale, b.eye_scale, k),
    pupil_scale: lerp(a.pupil_scale, b.pupil_scale, k),
    lid: lerp(a.lid, b.lid, k),
    tilt_deg: lerp(a.tilt_deg, b.tilt_deg, k),
    look: [lerp(a.look[0], b.look[0], k), lerp(a.look[1], b.look[1], k)],
    bounce: lerp(a.bounce, b.bounce, k),
    brow: k < 0.5 ? a.brow : b.brow,
    mouth_curve: lerp(a.mouth_curve, b.mouth_curve, k),
    glow: lerp(a.glow, b.glow, k),
  };
}

/** 0 = open, 1 = closed. Blinks every ~2.5–5 s, deterministic per character. */
export function blinkAt(t: number, seed: number): number {
  let start = 0.8 + hash01(seed) * 1.5;
  for (let i = 0; start < t + 1; i++) {
    const d = t - start;
    if (d >= 0 && d < 0.16) return Math.sin((d / 0.16) * Math.PI);
    start += 2.5 + hash01(seed + i * 7.31) * 2.5;
  }
  return 0;
}

/** Mouth openness from the loudness envelope (only while this character is the one speaking). */
export function mouthAt(envelope: number[], frame: number, speaking: boolean): number {
  if (!speaking) return 0;
  const v = envelope[Math.min(envelope.length - 1, Math.max(0, frame))] ?? 0;
  return clamp(Math.pow(v, 0.8) * 1.15);
}

export function speakerAt(spans: BeatSpan[], t: number): string | null {
  for (const s of spans) if (t >= s.voiceStart && t <= s.voiceEnd + 0.05) return s.beat.speaker;
  return null;
}
