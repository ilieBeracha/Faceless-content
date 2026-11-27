/**
 * Frames on screen: turns a frame's percent boxes into pixels on the stage, stands the host in its box, and
 * picks each beat's frame. Shared by the scene (render-themed) and the host layer (render-talking-character),
 * so both agree on where the host is.
 */
import { regions } from "../../render/timeline.ts";
import type { BeatSpan, EpisodeProps, Rect, SafeArea } from "../../render/types.ts";
import { frameFor, themeFrames, type Frame, type FrameBox, type Theme, type ThBeatVisual, type ThElement } from "./schema.ts";

/** Lettering drawn smaller than this, to fit a frame's box, is too small: the beat takes another frame. */
export const MIN_FIT = 0.75;
/** Space between stacked elements. */
export const GAP = 34;

/** Per face: size relative to Anton, and average glyph width in em (capitals), used to fit a line to its space. */
export const FACE: Record<string, { scale: number; wide: number }> = {
  anton: { scale: 1, wide: 0.5 },
  montserrat: { scale: 0.8, wide: 0.74 },
  "space-grotesk": { scale: 0.84, wide: 0.72 },
  fredoka: { scale: 0.88, wide: 0.66 },
  "baloo-2": { scale: 0.88, wide: 0.64 },
};

/** Full size of heading lettering, before a face's own scale. */
export const HEADING_SIZE = 92;
/** Notes narrower than this wrap into tall slivers; narrower boxes draw them at this width, scaled down. */
const NOTE_MIN_WIDTH = 560;

/** A percent box on the stage, in pixels. */
export function onStage(b: FrameBox, stage: Rect): Rect {
  return { x: stage.x + (b.x / 100) * stage.w, y: stage.y + (b.y / 100) * stage.h, w: (b.w / 100) * stage.w, h: (b.h / 100) * stage.h };
}

/**
 * Where the host stands in a frame: a square standing on the bottom of its box, centred.
 * `full` is as big as the box allows; `corner` is a small host in the same spot. Null when the frame has no host.
 */
export function frameHostRect(frame: Frame, placement: "full" | "corner", width: number, height: number, safe: SafeArea): Rect | null {
  if (!frame.host) return null;
  const { stage } = regions(width, height, safe);
  const b = onStage(frame.host, stage);
  const big = Math.min(b.w, b.h);
  const size = placement === "full" ? big : Math.min(big, stage.w * 0.3);
  return { x: b.x + (b.w - size) / 2, y: b.y + b.h - size, w: size, h: size };
}

/** The lettering's box in a frame; a box at the top of the stage also takes the space above it (videos have no headline). */
export function frameTextRect(frame: Frame, width: number, height: number, safe: SafeArea): Rect {
  const r = regions(width, height, safe);
  const area = onStage(frame.text, r.stage);
  return frame.text.y === 0 ? { ...area, y: r.headline.y, h: area.h + (r.stage.y - r.headline.y) } : area;
}

export function noteHeight(el: Extract<ThElement, { type: "note" }>, w: number): number {
  const perLine = Math.floor((w * 0.88 - 80) / (48 * 0.56));
  return 64 + (el.kicker ? 52 : 0) + Math.ceil(el.text.length / perLine) * 56 + 8;
}

/** How tall an element is drawn at width `w`. */
export function elementHeight(el: ThElement, th: Theme, w: number): number {
  switch (el.type) {
    case "heading":
      return el.lines.length * 118 + (th.surface === "ruled" ? 42 : 0);
    case "art":
      return 400;
    case "note":
      return noteHeight(el, w);
    case "marks":
      return 290;
  }
}

/** The narrowest box an element looks right in at full size: narrower, its lettering shrinks (headings), wraps thin (notes) or collides (marks). */
export function elementMinWidth(el: ThElement, th: Theme): number {
  switch (el.type) {
    case "marks":
      return (el.items.length * 270) / 0.92;
    case "note":
      return NOTE_MIN_WIDTH;
    case "heading":
      // A line is drawn at full size when it fits 82% of the width (see Plate in Themed.tsx); its face takes turns like there.
      return Math.max(
        ...el.lines.map((line, i) => {
          const face = FACE[th.display[(i + 2 + el.lines.length) % th.display.length]];
          return (HEADING_SIZE * face.scale * (line.length * face.wide + 0.9)) / 0.82;
        }),
      );
    case "art":
      return 0;
  }
}

/**
 * How each element of a stack is laid out in a box: drawn at width `w`, scaled by `k`, taking `h` of the box's height once scaled;
 * then `scale` shrinks the whole stack to fit. `widen` (frames only) draws marks at the width they need and scales them down,
 * so their values never collide; the classic arrangement always has room for them.
 */
export function stackLayout(elements: ThElement[], th: Theme, box: Rect, widen: boolean): { items: { w: number; k: number; h: number }[]; scale: number } {
  const items = elements.map((el) => {
    const w = widen && el.type === "marks" ? Math.max(box.w, elementMinWidth(el, th)) : box.w;
    const k = box.w / w;
    return { w, k, h: elementHeight(el, th, w) * k };
  });
  const total = items.reduce((a, b) => a + b.h, 0) + GAP * Math.max(0, items.length - 1);
  return { items, scale: total > 0 ? Math.min(1, box.h / total) : 1 };
}

/** How big a beat's lettering comes out in a frame (1 = full size), or 0 when the frame suits the beat badly (an empty picture box). */
export function frameFit(frame: Frame, elements: ThElement[], th: Theme, width: number, height: number, safe: SafeArea): number {
  const hasArt = elements.some((el) => el.type === "art");
  if (frame.picture && !hasArt) return 0;
  const flow = frame.picture ? elements.filter((el) => el.type !== "art") : elements;
  const box = frameTextRect(frame, width, height, safe);
  const { scale } = stackLayout(flow, th, box, true);
  return scale * Math.min(1, ...flow.map((el) => box.w / Math.max(box.w, elementMinWidth(el, th))));
}

/**
 * The frame a beat is drawn in, or null when the look has no frames. A beat that names a frame gets it. Otherwise the frames
 * take turns, skipping any its lettering would have to shrink in to fit (or whose picture box it would leave empty); when
 * none fits, the one that fits best.
 */
export function beatFrame(props: EpisodeProps, span: BeatSpan): Frame | null {
  const th = props.theme;
  const frames = th ? themeFrames(th) : null;
  if (!th || !frames) return null;
  const visual = span.beat.visual as ThBeatVisual;
  if (visual.frame) return frameFor(frames, { index: span.index, id: span.id, frame: visual.frame });
  const elements = visual.elements ?? [];
  let best: { frame: Frame; fit: number } | null = null;
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[(span.index + i) % frames.length];
    const fit = frameFit(frame, elements, th, props.width, props.height, props.safeArea);
    if (fit >= MIN_FIT) return frame;
    if (!best || fit > best.fit) best = { frame, fit };
  }
  return best!.frame;
}
