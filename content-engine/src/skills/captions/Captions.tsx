import React, { useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFor } from "../../render/fonts.ts";
import { useQaProbe } from "../../render/qa-probe.ts";
import { clamp, easeOut, regions } from "../../render/timeline.ts";
import type { EpisodeProps } from "../../render/types.ts";
import { activeWordIndex, buildPages, estimateWidth, FONT_SIZES, GAP, pageAt, SINGLE_SIZES, SINGLE_WORD_Y } from "./pages.ts";

/** The beats a storyboard shows without captions. */
function hiddenBeats(props: EpisodeProps): Set<string> {
  return new Set(props.captionLayout?.hide_beats ?? []);
}

/**
 * Word-by-word captions: a short page of words at a time, the word being spoken highlighted.
 * Timing comes straight from audio/timings.json, so captions can't drift from the voice.
 */
export const Captions: React.FC<{ props: EpisodeProps }> = ({ props }) => (props.captionStyle === "single-word" ? <SingleWord props={props} /> : <Pages props={props} />);

/** One word at a time, small and centred on the picture (storybook style). */
const SingleWord: React.FC<{ props: EpisodeProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const active = activeWordIndex(props.words, t);
  const word = active >= 0 ? props.words[active] : null;
  const next = word ? props.words[active + 1] : null;
  const visible = word !== null && !hiddenBeats(props).has(word.beat) && (t <= word.end + 0.35 || (next !== null && next !== undefined && t < next.start && next.start - word.end < 0.35));
  const ref = useRef<HTMLDivElement>(null);
  useQaProbe(props.qaProbe && visible, ref, "captions", "caption", { word: visible ? active : -1 });
  if (!word || !visible) return null;
  const font = fontFor(props.captionLayout?.font ?? props.brand.font);
  const pop = easeOut((t - word.start) / 0.08);
  const upper = props.brand.caption_case === "upper";
  const r = regions(width, height, props.safeArea);
  const safe = r.safe;
  const centreY = props.captionLayout?.place === "bottom" ? r.captions.y + r.captions.h / 2 : height * SINGLE_WORD_Y;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: safe.x, width: safe.w, top: centreY - 50, height: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          ref={ref}
          style={{
            fontFamily: font.family,
            fontWeight: font.heavy,
            fontSize: SINGLE_SIZES[props.captionLayout?.size ?? "medium"],
            lineHeight: 1,
            whiteSpace: "nowrap",
            textTransform: upper ? "uppercase" : "none",
            color: props.brand.caption_color ?? props.brand.accent_color,
            WebkitTextStroke: "8px rgba(20,16,12,0.92)",
            paintOrder: "stroke fill",
            transform: `scale(${0.9 + 0.1 * pop})`,
          }}
        >
          {word.text.replace(/[,;:]$/, "")}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Pages: React.FC<{ props: EpisodeProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const font = fontFor(props.captionLayout?.font ?? props.brand.font);
  const low = regions(width, height, props.safeArea).captions;
  // "middle": the same band, centred on the picture instead of above the platform's buttons.
  const region = props.captionLayout?.place === "middle" ? { ...low, y: Math.round(height / 2 - low.h / 2) } : low;
  const FONT_SIZE = FONT_SIZES[props.captionLayout?.size ?? "medium"];
  const upper = props.brand.caption_case === "upper";
  const hideKey = (props.captionLayout?.hide_beats ?? []).join(" ");
  // A page never spans two beats, so a hidden beat's pages are simply left out.
  const pages = useMemo(() => {
    const hidden = new Set(hideKey.split(" ").filter(Boolean));
    return buildPages(props.words, (text) => estimateWidth(text, FONT_SIZE, upper), region.w - 80, 2, GAP).filter((p) => !hidden.has(p.lines[0].words[0].beat));
  }, [props.words, upper, region.w, FONT_SIZE, hideKey]);
  const page = pageAt(pages, t, props.words.length);
  const active = activeWordIndex(props.words, t);
  const ref = useRef<HTMLDivElement>(null);
  const onPage = page ? page.lines.flatMap((l) => l.words).some((w) => w.i === active) : false;
  useQaProbe(props.qaProbe && Boolean(page), ref, "captions", "caption", { word: onPage ? active : -1 });
  if (!page) return null;

  // The first page is already up on the first frame; later pages ease in.
  const appear = page.lines[0].words[0].i === 0 ? 1 : easeOut((t - page.start + 0.05) / 0.12);
  // The words are white unless the person chose a colour; the spoken one sits on the highlight, in dark or white to stay readable.
  const text = props.captionLayout?.text_color ?? "#ffffff";
  const highlight = props.captionLayout?.highlight ?? props.brand.accent_color;
  const activeText = luminance(highlight) > 0.45 ? "#121418" : "#ffffff";
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: region.x,
          top: region.y,
          width: region.w,
          height: region.h,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          ref={ref}
          style={{
            maxWidth: region.w,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            transform: `scale(${0.92 + 0.08 * appear})`,
            opacity: clamp(appear * 1.5),
          }}
        >
          {page.lines.map((line, li) => (
            <div key={li} style={{ display: "flex", gap: GAP, flexWrap: "nowrap", justifyContent: "center", padding: "0 10px" /* room for the highlight pill's negative margins */ }}>
              {line.words.map((w) => {
                const isActive = w.i === active;
                const spoken = w.i < active;
                const pop = isActive ? easeOut((t - w.start) / 0.09) : 0;
                return (
                  <span
                    key={w.i}
                    style={{
                      fontFamily: font.family,
                      fontWeight: font.heavy,
                      fontSize: FONT_SIZE,
                      lineHeight: 1.08,
                      letterSpacing: upper ? 0.5 : -0.5,
                      textTransform: upper ? "uppercase" : "none",
                      whiteSpace: "nowrap",
                      color: isActive ? activeText : spoken ? text : withAlpha(text, 0.82),
                      background: isActive ? highlight : "transparent",
                      borderRadius: 18,
                      padding: "2px 10px",
                      margin: "0 -10px",
                      transform: `scale(${1 + Math.min(0.07, 14 / Math.max(1, estimateWidth(w.text, FONT_SIZE, upper))) * pop})`, // grows ≤ ~7px per side, so long words don't hit their neighbours
                      WebkitTextStroke: isActive ? "0px" : "10px rgba(0,0,0,0.85)",
                      paintOrder: "stroke fill",
                      textShadow: "0 6px 18px rgba(0,0,0,0.45)",
                    }}
                  >
                    {w.text}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Relative luminance (0 dark … 1 light), used to keep the highlighted word readable on any accent colour. */
export function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
