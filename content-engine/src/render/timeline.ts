import type { BeatSpan, EpisodeProps, Rect, SafeArea } from "./types.ts";

/** Visuals switch slightly before each beat's voice starts, so the picture leads the words. */
const LEAD = 0.12;

export function beatSpans(props: Pick<EpisodeProps, "script" | "beats" | "durationInFrames" | "fps">): BeatSpan[] {
  const total = props.durationInFrames / props.fps;
  return props.script.beats.map((beat, index) => {
    const timing = props.beats[index];
    const next = props.beats[index + 1];
    return {
      index,
      id: beat.id,
      beat,
      start: index === 0 ? 0 : Math.max(0, timing.start - LEAD),
      end: next ? Math.max(0, next.start - LEAD) : total,
      voiceStart: timing.start,
      voiceEnd: timing.end,
    };
  });
}

export function spanAt(spans: BeatSpan[], t: number): BeatSpan {
  for (let i = spans.length - 1; i >= 0; i--) if (t >= spans[i].start) return spans[i];
  return spans[0];
}

export function clamp(v: number, lo = 0, hi = 1): number {
  return Math.min(hi, Math.max(lo, v));
}

export function easeInOut(t: number): number {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function easeOut(t: number): number {
  return 1 - Math.pow(1 - clamp(t), 3);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Deterministic pseudo-random in [0, 1) — renders must be identical every time. */
export function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** The inner rectangle that must contain every piece of text. */
export function safeRect(width: number, height: number, safe: SafeArea): Rect {
  return { x: safe.left, y: safe.top, w: width - safe.left - safe.right, h: height - safe.top - safe.bottom };
}

/**
 * Fixed screen regions (1080×1920 reference, scaled for other sizes):
 * headline at the top of the safe area, captions in the lower part, the stage for visuals between.
 */
export function regions(width: number, height: number, safe: SafeArea) {
  const s = safeRect(width, height, safe);
  const cx = width / 2;
  const half = Math.min(cx - s.x, s.x + s.w - cx);
  const centred = (y: number, h: number): Rect => ({ x: cx - half, y, w: half * 2, h });
  const headline = centred(s.y + 10, 190);
  const captions = centred(s.y + s.h - 250, 240);
  const stage: Rect = { x: s.x, y: headline.y + headline.h + 10, w: s.w, h: captions.y - (headline.y + headline.h) - 20 };
  return { safe: s, headline, captions, stage, centreX: cx };
}

/** Where the talking character sits for each placement. */
export function characterRect(placement: "full" | "corner" | "hidden", width: number, height: number, safe: SafeArea): Rect {
  const r = regions(width, height, safe);
  if (placement === "full") {
    // Big, bottom-left: the scene gets the space to its right (and above it).
    const size = Math.min(r.stage.w * 0.56, r.stage.h * 0.66);
    return { x: r.safe.x - 10, y: r.stage.y + r.stage.h - size + 10, w: size, h: size };
  }
  const size = Math.min(300, r.stage.w * 0.3);
  return { x: r.safe.x - 10, y: r.stage.y + r.stage.h - size + 10, w: size, h: size };
}
