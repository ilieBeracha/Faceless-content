import React, { useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFor } from "../../render/fonts.ts";
import { useQaProbe } from "../../render/qa-probe.ts";
import { clamp, easeOut, regions } from "../../render/timeline.ts";
import type { EpisodeProps } from "../../render/types.ts";
import { activeWordIndex, buildPages, estimateWidth, pageAt } from "./pages.ts";

const FONT_SIZE = 74;
const GAP = 22;

/**
 * Word-by-word captions: a short page of words at a time, the word being spoken highlighted.
 * Timing comes straight from audio/timings.json, so captions can't drift from the voice.
 */
export const Captions: React.FC<{ props: EpisodeProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const font = fontFor(props.brand.font);
  const region = regions(width, height, props.safeArea).captions;
  const upper = props.brand.caption_case === "upper";
  const pages = useMemo(() => buildPages(props.words, (text) => estimateWidth(text, FONT_SIZE, upper), region.w - 80, 2, GAP), [props.words, upper, region.w]);
  const page = pageAt(pages, t);
  const active = activeWordIndex(props.words, t);
  const ref = useRef<HTMLDivElement>(null);
  const onPage = page ? page.lines.flatMap((l) => l.words).some((w) => w.i === active) : false;
  useQaProbe(props.qaProbe && Boolean(page), ref, "captions", "caption", { word: onPage ? active : -1 });
  if (!page) return null;

  const appear = easeOut((t - page.start + 0.05) / 0.12);
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
            <div key={li} style={{ display: "flex", gap: GAP, flexWrap: "nowrap", justifyContent: "center" }}>
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
                      color: isActive ? props.brand.text_color : spoken ? props.brand.text_color : withAlpha(props.brand.text_color, 0.82),
                      background: isActive ? props.brand.accent_color : "transparent",
                      borderRadius: 18,
                      padding: "2px 10px",
                      margin: "0 -10px",
                      transform: `scale(${1 + 0.07 * pop})`,
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

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
