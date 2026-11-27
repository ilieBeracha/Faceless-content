import type { TimedWord } from "../../render/types.ts";

/** Caption type sizes (px on the 1080-wide frame) for "pages" captions and for one word at a time. */
export const FONT_SIZES = { small: 58, medium: 74, large: 88 } as const;
export const SINGLE_SIZES = { small: 48, medium: 60, large: 72 } as const;
/** The space between words on a caption line (px). */
export const GAP = 30;
/** Where single-word captions sit: the upper middle of the frame, above where faces usually are. */
export const SINGLE_WORD_Y = 0.42;
/** "chunks" captions: at most this many words, on one line, centred at this height (under render-subject's subject). */
export const CHUNK_WORDS = 3;
export const CHUNK_Y = 0.655;

export interface CaptionLine {
  words: TimedWord[];
}

export interface CaptionPage {
  start: number;
  end: number;
  lines: CaptionLine[];
}

/** Approximate rendered width of a word in a heavy display font (deterministic, no DOM needed). */
export function estimateWidth(text: string, fontSize: number, upper: boolean): number {
  let em = 0;
  for (const ch of upper ? text.toUpperCase() : text) {
    if (/[A-Z0-9]/.test(ch)) em += /[MW]/.test(ch) ? 0.95 : 0.74;
    else if (/[a-z]/.test(ch)) em += /[mw]/.test(ch) ? 0.9 : /[iljtf]/.test(ch) ? 0.36 : 0.62;
    // Hebrew letters (Fredoka's, drawn for every font) are about as wide as Latin lower case; vowel points take no room.
    else if (/[\u05D0-\u05EA\uFB1D-\uFB4F]/.test(ch)) em += /[ויןך]/.test(ch) ? 0.34 : 0.64;
    else if (/[\u0591-\u05C7]/.test(ch)) em += 0;
    else em += 0.34;
  }
  return em * fontSize;
}

/**
 * Group timed words into short caption pages (≤ maxLines lines no wider than maxWidth px, ≤ maxWords words).
 * A page never spans two beats and breaks after sentence-ending punctuation.
 */
export function buildPages(words: TimedWord[], measure: (text: string) => number, maxWidth: number, maxLines: number, gap = 18, hold = 0.35, maxWords = Infinity): CaptionPage[] {
  const pages: CaptionPage[] = [];
  let lines: CaptionLine[] = [{ words: [] }];
  const lineWidth = (l: CaptionLine) => l.words.reduce((n, w) => n + measure(w.text), 0) + Math.max(0, l.words.length - 1) * gap;
  const flush = () => {
    const ws = lines.flatMap((l) => l.words);
    if (ws.length) pages.push({ start: ws[0].start, end: ws[ws.length - 1].end, lines: lines.filter((l) => l.words.length) });
    lines = [{ words: [] }];
  };
  words.forEach((word, i) => {
    const prev = words[i - 1];
    if (prev && prev.beat !== word.beat) flush();
    if (lines.reduce((n, l) => n + l.words.length, 0) >= maxWords) flush();
    let line = lines[lines.length - 1];
    if (line.words.length && lineWidth(line) + gap + measure(word.text) > maxWidth) {
      if (lines.length >= maxLines) flush();
      else lines.push({ words: [] });
      line = lines[lines.length - 1];
    }
    line.words.push(word);
    if (/[.!?]["”')]?$/.test(word.text) && i < words.length - 1) flush();
  });
  flush();
  // Each page stays up until the next one starts, through any pause (the last one briefly after its last word).
  for (let i = 0; i < pages.length; i++) {
    const next = pages[i + 1];
    pages[i].end = next ? next.start : pages[i].end + hold;
  }
  return pages;
}

/**
 * The page on screen at time t, out of pages built from `wordCount` words (some may be left out for hidden beats).
 * Captions are always visible: the page with the first word shows from the very first frame, and the page with the
 * last word stays to the end. Only a hidden beat shows nothing.
 */
export function pageAt(pages: CaptionPage[], t: number, wordCount: number): CaptionPage | null {
  if (!pages.length) return null;
  const first = pages[0];
  const last = pages[pages.length - 1];
  if (t < first.start) return first.lines[0].words[0].i === 0 ? first : null;
  for (const p of pages) if (t >= p.start - 0.05 && t < p.end) return p;
  return t >= last.end && last.lines.at(-1)!.words.at(-1)!.i === wordCount - 1 ? last : null;
}

/** Index of the word being spoken at time t (the last one that has started), or -1. */
export function activeWordIndex(words: TimedWord[], t: number): number {
  let active = -1;
  for (const w of words) {
    if (w.start <= t) active = w.i;
    else break;
  }
  return active;
}
