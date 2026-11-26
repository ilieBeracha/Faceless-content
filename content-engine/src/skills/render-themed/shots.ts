/** Where each painted shot of a story look sits on the video timeline (kept apart from the renderer so it can be tested without it). */
import type { BeatSpan, EpisodeProps } from "../../render/types.ts";
import { shotCuts, type CameraMove, type ThBeatVisual } from "./schema.ts";

/** Shots that don't choose a camera move take these in turn, so consecutive shots never move the same way. */
const CAMERA_TURNS: CameraMove[] = ["push-in", "pan-left", "rise", "pull-out", "pan-right", "sink"];
/** A later shot cuts in this long before its word, so the picture lands as the word is heard. */
const LEAD = 0.12;
/** Seconds a shot takes to dissolve into the next one. */
export const FADE = 0.3;

export interface ShotSpan {
  id: string;
  file: string;
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
    shots.forEach((shot, n) => {
      const id = `${span.id}-${n + 1}`;
      const file = props.shots?.[id];
      if (!file) throw new Error(`shot "${id}" has no painted picture.`);
      const start = n === 0 ? span.start : Math.max(span.start, words[cuts[n - 1]].start - LEAD);
      const clip = props.shotClips?.[id];
      out.push({ id, file, ...(clip ? { clip } : {}), move: shot.camera ?? CAMERA_TURNS[out.length % CAMERA_TURNS.length], start, end: span.end });
    });
  }
  for (let i = 0; i < out.length - 1; i++) out[i].end = out[i + 1].start;
  return out;
}

