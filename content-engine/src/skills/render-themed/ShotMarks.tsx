/**
 * The drawn animation over a painted shot, on the words: the camera pushes in on one thing, labels draw on with a
 * line to what they name, a big number counts up, a small title sits at the top. The picture stays as painted; only
 * the camera and the drawing over it move.
 */
import React, { useRef } from "react";
import { fontFor } from "../../render/fonts.ts";
import { useQaProbe } from "../../render/qa-probe.ts";
import { clamp, easeOut, safeRect } from "../../render/timeline.ts";
import type { EpisodeProps } from "../../render/types.ts";
import { countingValue } from "../render-subject/schema.ts";
import type { Theme } from "./schema.ts";
import type { Camera, ShotSpan } from "./shots.ts";

const INK = "rgba(22, 17, 15, 0.78)";

const Label: React.FC<{ id: string; probe: boolean; x: number; y: number; anchor: "left" | "right"; text: string; opacity: number; font: { family: string; heavy: number }; dir: "ltr" | "rtl" }> = ({ id, probe, x, y, anchor, text, opacity, font, dir }) => {
  const ref = useRef<HTMLDivElement>(null);
  useQaProbe(probe && opacity > 0.9, ref, id, "text");
  return (
    <div
      ref={ref}
      dir={dir}
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(${anchor === "left" ? "0" : "-100%"}, -50%) scale(${0.9 + 0.1 * opacity})`,
        transformOrigin: anchor === "left" ? "0 50%" : "100% 50%",
        opacity,
        whiteSpace: "nowrap",
        fontFamily: font.family,
        fontWeight: font.heavy,
        fontSize: 46,
        lineHeight: 1.1,
        color: "#ffffff",
        background: INK,
        borderRadius: 14,
        padding: "8px 18px",
      }}
    >
      {text}
    </div>
  );
};

const TopText: React.FC<{ id: string; probe: boolean; y: number; size: number; opacity: number; font: { family: string; heavy: number }; weight?: number; dir: "ltr" | "rtl"; width: number; children: React.ReactNode }> = ({ id, probe, y, size, opacity, font, weight, dir, width, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  useQaProbe(probe && opacity > 0.9, ref, id, "text");
  return (
    <div style={{ position: "absolute", left: 0, top: y, width, display: "flex", justifyContent: "center", transform: "translateY(-50%)" }}>
      <div
        ref={ref}
        dir={dir}
        style={{
          opacity,
          whiteSpace: "nowrap",
          fontFamily: font.family,
          fontWeight: weight ?? font.heavy,
          fontSize: size,
          lineHeight: 1.05,
          color: "#ffffff",
          background: INK,
          borderRadius: 18,
          padding: "6px 22px",
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** Labels, number and title over the shot on screen. */
export const ShotMarks: React.FC<{ s: ShotSpan; cam: Camera; now: number; props: EpisodeProps; th: Theme; W: number; H: number }> = ({ s, cam, now, props, th, W, H }) => {
  const safe = safeRect(W, H, props.safeArea);
  const font = fontFor(th.body);
  const dir = props.direction;
  const probe = props.qaProbe && s.end - now > 0.2;
  const out = clamp((s.end - now) / 0.2);
  const appear = (t: number) => easeOut(clamp((now - t) / 0.35)) * out;
  // Labels go at the side their thing is on, a little above it, kept apart and clear of the top and the captions.
  const placed = s.anim.labels
    .map((l, i) => {
      const px = cam.a * l.x * W + cam.bx;
      const py = cam.a * l.y * H + cam.by;
      return { ...l, i, px, py, left: px < W / 2 };
    })
    .sort((a, b) => a.py - b.py);
  const lowest = safe.y + safe.h - 330;
  let lastY = { left: -Infinity, right: -Infinity };
  const rows = placed.map((l) => {
    const side = l.left ? "left" : "right";
    const y = Math.min(lowest, Math.max(safe.y + 300, l.py - 90, lastY[side] + 90));
    lastY = { ...lastY, [side]: y };
    return { ...l, ty: y, tx: l.left ? safe.x + 10 : safe.x + safe.w - 10 };
  });
  return (
    <>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {rows.map((l) => {
          const k = appear(l.t);
          if (k <= 0) return null;
          const endX = l.left ? l.tx + 40 : l.tx - 40;
          const pts = `${l.px},${l.py} ${endX},${l.ty}`;
          const len = Math.hypot(endX - l.px, l.ty - l.py);
          return (
            <g key={l.i} opacity={Math.min(1, k * 1.5)}>
              <polyline points={pts} fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - k)} />
              <polyline points={pts} fill="none" stroke="#ffffff" strokeWidth={4} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - k)} />
              <circle cx={l.px} cy={l.py} r={13} fill="#ffffff" stroke={INK} strokeWidth={5} />
              <circle cx={l.px} cy={l.py} r={24 + 6 * Math.sin((now - l.t) * 4)} fill="none" stroke="#ffffff" strokeWidth={3} opacity={0.6 * k} />
            </g>
          );
        })}
      </svg>
      {rows.map((l) => {
        const k = appear(l.t + 0.15);
        return k > 0 ? <Label key={l.i} id={`th:${s.id}:label${l.i}`} probe={probe} x={l.tx} y={l.ty} anchor={l.left ? "left" : "right"} text={l.text} opacity={k} font={font} dir={dir} /> : null;
      })}
      {s.anim.title && appear(s.start + 0.1) > 0 && (
        <TopText id={`th:${s.id}:title`} probe={probe} y={safe.y + 40} size={44} weight={font.heavy} opacity={appear(s.start + 0.1)} font={font} dir={dir} width={W}>
          {s.anim.title}
        </TopText>
      )}
      {s.anim.stat && appear(s.anim.stat.t) > 0 && (
        <>
          <TopText id={`th:${s.id}:stat`} probe={probe} y={safe.y + 175} size={150} opacity={appear(s.anim.stat.t)} font={font} dir="ltr" width={W}>
            {countingValue(s.anim.stat.value, easeOut(clamp((now - s.anim.stat.t) / 0.9)))}
          </TopText>
          {s.anim.stat.subtitle && (
            <TopText id={`th:${s.id}:statsub`} probe={probe} y={safe.y + 305} size={42} opacity={appear(s.anim.stat.t + 0.4)} font={font} dir={dir} width={W}>
              {s.anim.stat.subtitle}
            </TopText>
          )}
        </>
      )}
    </>
  );
};
