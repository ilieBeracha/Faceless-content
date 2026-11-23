/**
 * What a browser needs to draw a video's captions live over its clean render (the storefront's captions step,
 * assets/captions-live.js): the timed words, their pages for every size and letter case, and where the captions
 * sit. The same page building and geometry as Captions.tsx, so what is previewed is what gets drawn into the video.
 */
import { FONT_FACES } from "../../render/font-faces.ts";
import { regions } from "../../render/timeline.ts";
import type { EpisodeProps, Rect } from "../../render/types.ts";
import { buildPages, estimateWidth, FONT_SIZES, GAP, SINGLE_SIZES, SINGLE_WORD_Y } from "./pages.ts";

export interface LiveCaptions {
  width: number;
  height: number;
  rtl: boolean;
  style: "pages" | "single-word";
  /** Each word: text, start and end (seconds), beat id. */
  words: { t: string; s: number; e: number; b: string }[];
  /** `<size>:<case>` → pages: start, end, and lines of word indexes. Before hiding any beat. */
  pages: Record<string, { s: number; e: number; l: number[][] }[]>;
  /** The caption band at the bottom and in the middle. */
  regions: { bottom: Rect; middle: Rect };
  /** Single-word captions' centre line, by place (px). */
  singleY: { bottom: number; middle: number };
  sizes: typeof FONT_SIZES;
  singleSizes: typeof SINGLE_SIZES;
  gap: number;
  /** The channel's font and accent: what captions use when the person chose none. */
  font: string;
  accent: string;
  /** The colour of single-word captions when the person chose none. */
  singleColor: string;
  /** Font key → family and weight drawn. */
  fonts: Record<string, { family: string; weight: number }>;
}

export function liveCaptions(props: EpisodeProps): LiveCaptions {
  const r = regions(props.width, props.height, props.safeArea);
  const bottom = r.captions;
  const middle = { ...bottom, y: Math.round(props.height / 2 - bottom.h / 2) };
  const pages: LiveCaptions["pages"] = {};
  for (const size of Object.keys(FONT_SIZES) as (keyof typeof FONT_SIZES)[]) {
    for (const upper of [false, true]) {
      const px = FONT_SIZES[size];
      pages[`${size}:${upper ? "upper" : "normal"}`] = buildPages(props.words, (text) => estimateWidth(text, px, upper), bottom.w - 80, 2, GAP).map((p) => ({ s: p.start, e: p.end, l: p.lines.map((l) => l.words.map((w) => w.i)) }));
    }
  }
  return {
    width: props.width,
    height: props.height,
    rtl: props.direction === "rtl",
    style: props.captionStyle === "single-word" ? "single-word" : "pages",
    words: props.words.map((w) => ({ t: w.text, s: w.start, e: w.end, b: w.beat })),
    pages,
    regions: { bottom, middle },
    singleY: { bottom: bottom.y + bottom.h / 2, middle: props.height * SINGLE_WORD_Y },
    sizes: FONT_SIZES,
    singleSizes: SINGLE_SIZES,
    gap: GAP,
    font: props.brand.font,
    accent: props.brand.accent_color,
    singleColor: props.brand.caption_color ?? props.brand.accent_color,
    fonts: Object.fromEntries(Object.entries(FONT_FACES).map(([k, f]) => [k, { family: f.family, weight: f.heavy }])),
  };
}
