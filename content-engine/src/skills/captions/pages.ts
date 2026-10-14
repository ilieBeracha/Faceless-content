import type { TimedWord } from "../../render/types.ts";

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
    else em += 0.34;
  }
  return em * fontSize;
}

/**
 * Group timed words into short caption pages (≤ maxLines lines no wider than maxWidth px).
 * A page never spans two beats and breaks after sentence-ending punctuation.
 */
export function buildPages(words: TimedWord[], measure: (text: string) => number, maxWidth: number, maxLines: number, gap = 18, hold = 0.35): CaptionPage[] {
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
    let line = lines[lines.length - 1];
    if (line.words.length && lineWidth(line) + gap + measure(word.text) > maxWidth) {
      if (lines.length >= maxLines) flush();
      else lines.push({ words: [] });
      line = lines[lines.length - 1];
    }
    line.words.push(word);
    if (/[.!?…]["”']?$/.test(word.text) && i < words.length - 1) flush();
  });
  flush();
  // Each page stays up until the next one starts (or briefly after its last word).
  for (let i = 0; i < pages.length; i++) {
    const next = pages[i + 1];
    pages[i].end = next ? Math.min(next.start, pages[i].end + 1.2) : pages[i].end + hold;
  }
  return pages;
}

export function pageAt(pages: CaptionPage[], t: number): CaptionPage | null {
  for (const p of pages) if (t >= p.start - 0.05 && t < p.end) return p;
  return null;
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
