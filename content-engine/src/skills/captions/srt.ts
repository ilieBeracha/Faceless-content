import type { TimedWord } from "../../render/types.ts";
import { buildPages } from "./pages.ts";

/** "hh:mm:ss,mmm", as SubRip writes a time. */
function stamp(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3_600_000))}:${p(Math.floor(ms / 60_000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}

/**
 * The video's captions as a SubRip (.srt) file, to lay over the video on a platform or in an editor instead of
 * drawing them into it: the same short pages the captions skill shows (a page never spans two beats and breaks after
 * a sentence), at most `maxLines` lines of `maxChars` characters each.
 */
export function captionsSrt(words: TimedWord[], maxChars: number, maxLines: number): string {
  const pages = buildPages(words, (text) => [...text].length, maxChars, maxLines, 1);
  return pages.map((p, i) => `${i + 1}\n${stamp(p.start)} --> ${stamp(p.end)}\n${p.lines.map((l) => l.words.map((w) => w.text).join(" ")).join("\n")}\n`).join("\n");
}
