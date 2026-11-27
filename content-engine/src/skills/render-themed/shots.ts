/** Where each painted shot of a story look sits on the video timeline (kept apart from the renderer so it can be tested without it). */
import { clamp, easeInOut } from "../../render/timeline.ts";
import type { BeatSpan, EpisodeProps } from "../../render/types.ts";
import { animWord, shotCuts, shotRanges, type CameraMove, type Shot, type ThBeatVisual } from "./schema.ts";

/** Shots that don't choose a camera move take these in turn, so consecutive shots never move the same way. */
const CAMERA_TURNS: CameraMove[] = ["push-in", "pan-left", "rise", "pull-out", "pan-right", "sink"];
/** A later shot cuts in this long before its word, so the picture lands as the word is heard. */
const LEAD = 0.12;
/** Seconds a shot takes to dissolve into the next one. */
export const FADE = 0.3;

/** A shot's drawn animation, each part with the second it starts (on its word). Points are fractions of the picture. */
export interface ShotAnim {
  title?: string;
  focus?: { x: number; y: number; zoom: number; t: number };
  labels: { text: string; x: number; y: number; t: number }[];
  stat?: { value: string; subtitle?: string; t: number };
}

export interface ShotSpan {
  id: string;
  file: string;
  anim: ShotAnim;
  /** The shot as a moving clip (staged next to its picture), when the episode's shots were animated. */
  clip?: { file: string; seconds: number };
  move: CameraMove;
  start: number;
  end: number;
}

/** Every painted shot on the timeline: a beat's first shot starts with it, each later one just before its `at` word is spoken. */
export function shotTimeline(props: EpisodeProps, spans: BeatSpan[]): ShotSpan[] {
  const out: ShotSpan[] = [];
  for (const span of spans) {
    const visual = span.beat.visual as ThBeatVisual;
    if (visual.skill !== "render-themed") continue;
    const shots = visual.shots ?? [];
    if (!shots.length) throw new Error(`beat "${span.id}": the look has a world, but the beat has no shots.`);
    const words = props.words.filter((w) => w.beat === span.id);
    const r = shotCuts(shots, words.map((w) => w.text));
    if (r.cuts === null) throw new Error(`beat "${span.id}": ${r.error}`);
    const cuts = r.cuts;
    const ranges = shotRanges(cuts, words.length);
    shots.forEach((shot, n) => {
      const id = `${span.id}-${n + 1}`;
      const file = props.shots?.[id];
      if (!file) throw new Error(`shot "${id}" has no painted picture.`);
      const start = n === 0 ? span.start : Math.max(span.start, words[cuts[n - 1]].start - LEAD);
      const clip = props.shotClips?.[id];
      const anim = shotAnim(shot, id, words.map((w) => w.text), words.map((w) => w.start), ranges[n], start, props.shotPoints?.[id] ?? {});
      out.push({ id, file, anim, ...(clip ? { clip } : {}), move: shot.camera ?? CAMERA_TURNS[out.length % CAMERA_TURNS.length], start, end: span.end });
    });
  }
  for (let i = 0; i < out.length - 1; i++) out[i].end = out[i + 1].start;
  return out;
}

/** When each part of a shot's animation starts (just before its word) and where its things are in the picture. */
export function shotAnim(shot: Shot, id: string, words: string[], starts: number[], [from, to]: [number, number], shotStart: number, points: Record<string, { x: number; y: number }>): ShotAnim {
  const when = (at: string | undefined) => {
    if (!at) return shotStart + 0.15;
    const i = animWord(words, from, to, at);
    if (i === null) throw new Error(`shot "${id}": "${at}" is not spoken while the shot is on screen.`);
    return Math.max(shotStart, starts[i] - LEAD);
  };
  const point = (thing: string) => {
    const p = points[thing];
    if (!p) throw new Error(`shot "${id}": "${thing}" was not found in its picture.`);
    return p;
  };
  return {
    ...(shot.title ? { title: shot.title } : {}),
    ...(shot.focus ? { focus: { ...point(shot.focus.on), zoom: shot.focus.zoom, t: when(shot.focus.at) } } : {}),
    labels: (shot.labels ?? []).map((l) => ({ text: l.text, ...point(l.on), t: when(l.at) })),
    ...(shot.stat ? { stat: { value: shot.stat.value, ...(shot.stat.subtitle ? { subtitle: shot.stat.subtitle } : {}), t: when(shot.stat.at) } } : {}),
  };
}

/** Seconds the camera takes to push in on its thing. */
const PUSH = 0.8;

/** The camera over a picture: a point p (px, in the picture) lands on screen at a·p + b. */
export interface Camera {
  a: number;
  bx: number;
  by: number;
}

/** The camera that brings point (x, y) to the middle at `zoom`, held so the picture still fills the frame. */
export function focusCamera(x: number, y: number, zoom: number, W: number, H: number): Camera {
  const fit = (b: number, size: number) => Math.min(0, Math.max(size - zoom * size, b));
  return { a: zoom, bx: fit(W / 2 - x * W * zoom, W), by: fit(H / 2 - y * H * zoom, H) };
}

/** Where the camera is over a shot at `now`: its move, until its push-in starts; then easing into the push-in. */
export function shotCamera(s: ShotSpan, now: number, move: (m: CameraMove, p: number) => { scale: number; x: number; y: number }, W: number, H: number): Camera {
  const p = clamp((now - s.start) / Math.max(0.1, s.end - s.start));
  const f = s.anim.focus;
  // Before its push-in, the camera moves as usual; from the push-in on, the usual move stops where it was.
  const pm = f && now >= f.t ? clamp((f.t - s.start) / Math.max(0.1, s.end - s.start)) : p;
  const m = move(s.move, pm);
  const base: Camera = { a: m.scale, bx: (W / 2) * (1 - m.scale) + m.x * W, by: (H / 2) * (1 - m.scale) + m.y * H };
  if (!f || now < f.t) return base;
  const k = easeInOut(clamp((now - f.t) / PUSH));
  const to = focusCamera(f.x, f.y, f.zoom, W, H);
  return { a: base.a + (to.a - base.a) * k, bx: base.bx + (to.bx - base.bx) * k, by: base.by + (to.by - base.by) * k };
}
