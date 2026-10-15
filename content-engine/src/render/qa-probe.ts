import { useLayoutEffect, type RefObject } from "react";
import { useCurrentFrame } from "remotion";

/**
 * Layout probes for automated QA. While rendering, text elements report their on-screen box once
 * per frame through the browser console; render-episode.ts collects them and qa.ts checks that
 * nothing is outside the safe area or cut off, and that captions highlight the right word.
 */
export const QA_PREFIX = "__qa__";

export interface ProbeRecord {
  f: number;
  id: string;
  kind: "caption" | "headline" | "label" | "text";
  x: number;
  y: number;
  w: number;
  h: number;
  /** Text overflows its own box (it would be clipped or wrap badly). */
  overflow: boolean;
  /** For captions: index of the highlighted word (-1 = none). */
  word?: number;
}

export function useQaProbe(enabled: boolean, ref: RefObject<HTMLElement | null>, id: string, kind: ProbeRecord["kind"], extra?: { word?: number }): void {
  const frame = useCurrentFrame();
  const word = extra?.word;
  useLayoutEffect(() => {
    if (!enabled || !ref.current) return;
    const el = ref.current;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    // Captions scale the spoken word up ~7% ("pop"), which the browser counts as scrollable overflow.
    const tol = kind === "caption" ? 16 : 2;
    const record: ProbeRecord = {
      f: frame,
      id,
      kind,
      x: Math.round(r.left),
      y: Math.round(r.top),
      w: Math.round(r.width),
      h: Math.round(r.height),
      overflow: el.scrollWidth > el.clientWidth + tol || el.scrollHeight > el.clientHeight + tol,
      ...(word !== undefined ? { word } : {}),
    };
    console.log(QA_PREFIX + JSON.stringify(record));
  }, [enabled, frame, id, kind, word, ref]);
}
