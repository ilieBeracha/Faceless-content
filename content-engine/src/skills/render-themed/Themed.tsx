import React, { useRef } from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFor } from "../../render/fonts.ts";
import { useQaProbe } from "../../render/qa-probe.ts";
import { characterRect, clamp, easeInOut, easeOut, hash01, regions } from "../../render/timeline.ts";
import type { BeatSpan, EpisodeProps, Rect } from "../../render/types.ts";
import { FADE, shotCamera, shotTimeline, type ShotSpan } from "./shots.ts";
import { ShotMarks } from "./ShotMarks.tsx";
import { beatFrame, FACE, HEADING_SIZE, frameHostRect, frameTextRect, GAP, noteHeight, onStage, stackLayout } from "./frames.ts";
import { type CameraMove, type Drawing, type Role, type Theme, type ThBeatVisual, type ThElement, type ThScene } from "./schema.ts";

interface Ctx {
  /** Seconds since the element started appearing. */
  t: number;
  /** Absolute time. */
  now: number;
  /** Time as this theme moves: on twelves for stop-motion, smooth otherwise. */
  clock: number;
  th: Theme;
  probe: boolean;
  id: string;
  /** The channel writes right to left: a timeline runs from the right. */
  rtl: boolean;
}

const step = (now: number) => Math.floor(now * 12) / 12;
const backOut = (x: number) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);

/** 0 → 1 as a piece arrives, in the theme's own manner. */
function enter(th: Theme, t: number, dur = 0.34): number {
  if (th.motion === "stop-motion") return easeOut(step(t) / dur);
  if (th.motion === "snappy") return t <= 0 ? 0 : backOut(clamp(t / dur));
  return easeOut(t / dur);
}

/** Stop-motion pieces never lie perfectly still: a fraction of a degree, re-rolled four times a second. */
const wobble = (th: Theme, seed: number, now: number) => (th.motion === "stop-motion" ? (hash01(seed * 3.3 + Math.floor(now * 4)) - 0.5) * 0.9 : 0);

/** A torn edge: a box outline with every point pulled inwards by up to `px` pixels. */
function torn(seed: number, w: number, h: number, px: number): string {
  const rx = (px / w) * 100;
  const ry = (px / h) * 100;
  const nx = Math.max(4, Math.round(w / 45));
  const ny = Math.max(3, Math.round(h / 45));
  const pts: string[] = [];
  const j = (n: number) => hash01(seed * 9.1 + n);
  for (let i = 0; i <= nx; i++) pts.push(`${((i / nx) * 100).toFixed(2)}% ${(j(i) * ry).toFixed(2)}%`);
  for (let i = 1; i <= ny; i++) pts.push(`${(100 - j(100 + i) * rx).toFixed(2)}% ${((i / ny) * 100).toFixed(2)}%`);
  for (let i = nx - 1; i >= 0; i--) pts.push(`${((i / nx) * 100).toFixed(2)}% ${(100 - j(200 + i) * ry).toFixed(2)}%`);
  for (let i = ny - 1; i >= 1; i--) pts.push(`${(j(300 + i) * rx).toFixed(2)}% ${((i / ny) * 100).toFixed(2)}%`);
  return `polygon(${pts.join(", ")})`;
}

const BURST = `polygon(${Array.from({ length: 32 }, (_, i) => {
  const a = (i / 32) * Math.PI * 2;
  const r = i % 2 ? 41 : 50;
  return `${(50 + Math.cos(a) * r).toFixed(2)}% ${(50 + Math.sin(a) * r).toFixed(2)}%`;
}).join(", ")})`;

const HARD = "drop-shadow(0 7px 0 rgba(0,0,0,0.2))";
const SOFT = "0 14px 34px rgba(0,0,0,0.22)";
const fade = (colour: string, pct: number) => `color-mix(in srgb, ${colour} ${pct}%, transparent)`;
/** Draw a stroke on from its start: k = 0 (nothing) … 1 (all of it). */
const pen = (k: number) => ({ pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - clamp(k) });
const fold = (sx: number) => `translate(50 0) scale(${sx.toFixed(3)} 1) translate(-50 0)`;
const cased = (th: Theme): React.CSSProperties => ({ textTransform: th.casing === "upper" ? "uppercase" : "none" });

/** Lettering that types itself on (draw-on themes). Characters keep their place, so nothing reflows. */
const Typed: React.FC<{ text: string; t: number; rate: number; on: boolean }> = ({ text, t, rate, on }) =>
  on ? (
    <>
      {[...text].map((c, i) => (
        <span key={i} style={{ opacity: t > i * rate ? 1 : 0 }}>
          {c}
        </span>
      ))}
    </>
  ) : (
    <>{text}</>
  );

const Probe: React.FC<{ ctx: Ctx; id: string; on: boolean; kind?: "text" | "headline"; style: React.CSSProperties; children: React.ReactNode }> = ({ ctx, id, on, kind = "text", style, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  useQaProbe(ctx.probe && on, ref, id, kind);
  return (
    <div ref={ref} style={style}>
      {children}
    </div>
  );
};

/** One line of display lettering, made the way the theme makes things. */
const Plate: React.FC<{ ctx: Ctx; text: string; seed: number; size: number; maxWidth: number; delay: number; probeSuffix?: string }> = ({ ctx, text, seed, size, maxWidth, delay, probeSuffix }) => {
  const { th } = ctx;
  const t = ctx.t - delay;
  const key = th.display[seed % th.display.length];
  const face = FACE[key];
  const font = fontFor(key);
  const fontSize = Math.min(size * face.scale, maxWidth / (text.length * face.wide + 0.9));
  const k = enter(th, t);
  const landed = t > 0.4;
  const hop = landed && th.motion !== "draw-on" ? -10 * Math.pow(Math.max(0, Math.sin(ctx.clock * 2.2 - seed * 0.9)), 6) : 0;
  const dir = hash01(seed * 5.1) > 0.5 ? 1 : -1;
  const tilt = th.surface === "torn" ? (hash01(seed * 2.3) - 0.5) * 6 : th.surface === "plain" ? (hash01(seed * 2.3) - 0.5) * 2 : 0;
  const w = fontSize * (text.length * face.wide + 0.9);
  let look: React.CSSProperties;
  if (th.surface === "torn") {
    const pairs = [
      [th.card, th.ink],
      [th.ink, th.card],
      [th.colors[2], th.ink],
    ];
    const [bg, fg] = pairs[Math.floor(hash01(seed * 1.7) * pairs.length)];
    look = { background: bg, color: fg, padding: `${fontSize * 0.08}px ${fontSize * 0.45}px`, clipPath: torn(seed, w, fontSize * 1.28, 4) };
  } else if (th.surface === "plain") {
    look = { background: th.card, color: th.ink, padding: `${fontSize * 0.1}px ${fontSize * 0.45}px`, borderRadius: fontSize * 0.24, boxShadow: SOFT };
  } else {
    const colour = seed % 2 ? th.accent : th.text;
    look = { color: colour, padding: `0 ${fontSize * 0.2}px`, letterSpacing: 1, ...(th.surface === "glow" ? { textShadow: `0 0 ${fontSize * 0.3}px ${colour}` } : {}) };
  }
  const move =
    th.motion === "stop-motion"
      ? `translate(${(1 - k) * dir * 150}px, ${(1 - k) * -70 + hop}px) rotate(${tilt + (1 - k) * dir * 10 + wobble(th, seed, ctx.now)}deg)`
      : th.motion === "snappy"
        ? `translateY(${(1 - k) * 40 + hop}px) scale(${0.6 + 0.4 * k}) rotate(${tilt}deg)`
        : `rotate(${tilt}deg)`;
  if (t < 0) return null;
  return (
    <div style={{ display: "inline-block", filter: th.surface === "torn" ? HARD : undefined, opacity: th.motion === "draw-on" ? 1 : clamp(k * 3), transform: move }}>
      <Probe ctx={ctx} id={`${ctx.id}:${probeSuffix}`} on={probeSuffix !== undefined && t > 0.6} style={{ whiteSpace: "nowrap", fontFamily: font.family, fontWeight: font.heavy, fontSize, lineHeight: 1.12, ...cased(th), ...look }}>
        <Typed text={text} t={t} rate={0.03} on={th.motion === "draw-on"} />
      </Probe>
    </div>
  );
};

/** A dimension line (ruled themes): grows from the middle, with dashes that keep marching. */
const Dimension: React.FC<{ ctx: Ctx; width: number }> = ({ ctx, width }) => {
  const half = (width / 2 - 14) * easeOut((ctx.t - 0.2) / 0.6);
  const cx = width / 2;
  return (
    <svg width={width} height={36} style={{ display: "block" }}>
      <path d={`M${cx - half} 18 H${cx + half}`} stroke={ctx.th.text} strokeWidth={3} strokeDasharray="16 10" strokeDashoffset={-ctx.now * 34} />
      <path d={`M${cx - half} 4 V32 M${cx + half} 4 V32`} stroke={ctx.th.text} strokeWidth={3} />
      <path d={`M${cx - half} 18 l16 -8 v16 z M${cx + half} 18 l-16 -8 v16 z`} fill={ctx.th.accent} />
    </svg>
  );
};

function Heading({ el, ctx, w }: { el: Extract<ThElement, { type: "heading" }>; ctx: Ctx; w: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      {el.lines.map((line, i) => (
        <div key={i} style={{ transform: ctx.th.surface === "torn" ? `translateX(${(hash01(i * 7.7 + line.length) - 0.5) * w * 0.08}px)` : undefined }}>
          <Plate ctx={ctx} text={line} seed={i + 2 + el.lines.length} size={HEADING_SIZE} maxWidth={w * 0.82} delay={i * 0.18} probeSuffix={`heading-${i}`} />
        </div>
      ))}
      {ctx.th.surface === "ruled" && <Dimension ctx={ctx} width={w * 0.86} />}
    </div>
  );
}

const Tape: React.FC<{ colour: string; left?: number; right?: number; rot: number }> = ({ colour, left, right, rot }) => (
  <div style={{ position: "absolute", top: -22, left, right, width: 150, height: 46, background: fade(colour, 76), transform: `rotate(${rot}deg)`, clipPath: torn(rot, 150, 46, 3) }} />
);

const Corner: React.FC<{ ctx: Ctx; style: React.CSSProperties; phase: number }> = ({ ctx, style, phase }) => (
  <svg width={30} height={30} style={{ position: "absolute", ...style, transform: `scale(${1 + 0.18 * Math.sin(ctx.now * 3 + phase)})` }}>
    <path d="M15 0 V30 M0 15 H30" stroke={ctx.th.accent} strokeWidth={3} />
  </svg>
);

/** One fact or quote. Torn: a taped scrap. Ruled: a specification box. Plain: a soft card. Glow: a lit outline. */
function Note({ el, ctx, w }: { el: Extract<ThElement, { type: "note" }>; ctx: Ctx; w: number }) {
  const { th } = ctx;
  const k = enter(th, ctx.t, 0.4);
  const width = w * 0.88;
  const body = fontFor(th.body);
  const onCard = th.surface === "torn" || th.surface === "plain";
  const edge = torn(el.text.length, width, noteHeight(el, w), 7);
  const sway = Math.sin(ctx.clock * 1.3) * (th.surface === "torn" ? 1.1 : 0);
  const move =
    th.motion === "stop-motion"
      ? `translateY(${(1 - k) * 120}px) rotate(${-1.6 + (1 - k) * -7 + wobble(th, el.text.length, ctx.now) + sway}deg)`
      : th.motion === "snappy"
        ? `translateY(${(1 - k) * 60 + Math.sin(ctx.now * 1.1) * 5}px) scale(${0.85 + 0.15 * k})`
        : `translateY(${Math.sin(ctx.now * 1.1) * 5}px)`;
  const shell: React.CSSProperties =
    th.surface === "torn"
      ? { background: th.card, clipPath: edge }
      : th.surface === "plain"
        ? { background: th.card, borderRadius: 26, boxShadow: SOFT }
        : th.surface === "ruled"
          ? { border: `3px solid ${th.text}`, background: fade(th.text, 7), clipPath: `inset(-30px ${(1 - easeOut(ctx.t / 0.5)) * 100}% -10px -10px)` }
          : { border: `3px solid ${th.accent}`, borderRadius: 18, background: fade(th.text, 5), boxShadow: `0 0 34px ${fade(th.accent, 55)}, inset 0 0 22px ${fade(th.accent, 18)}` };
  const kicker: React.CSSProperties = onCard
    ? { display: "inline-block", padding: "2px 14px", marginBottom: 12, background: th.colors[0], color: th.card, borderRadius: th.surface === "plain" ? 99 : 0 }
    : th.surface === "ruled"
      ? { position: "absolute", top: -20, left: 26, padding: "0 12px", background: th.paper, color: th.accent, lineHeight: "36px" }
      : { display: "block", marginBottom: 8, color: th.accent };
  return (
    <div style={{ width, margin: "0 auto", position: "relative", opacity: th.motion === "draw-on" ? 1 : clamp(k * 3), transform: move }}>
      {/* The torn shadow is its own sheet, not a CSS filter: a filter layer here intermittently dropped the whole note in video renders. */}
      {th.surface === "torn" && <div style={{ position: "absolute", inset: 0, transform: "translateY(7px)", background: "rgba(0,0,0,0.2)", clipPath: edge }} />}
      <div style={{ position: "relative", padding: th.surface === "ruled" ? "36px 38px 30px" : "32px 40px", boxSizing: "border-box", ...shell }}>
        {el.kicker && <div style={{ fontFamily: body.family, fontWeight: body.heavy, fontSize: 30, letterSpacing: 2, textTransform: "uppercase", ...kicker }}>{el.kicker}</div>}
        <Probe ctx={ctx} id={`${ctx.id}:note`} on={ctx.t > 0.6} style={{ fontFamily: body.family, fontWeight: body.heavy, fontSize: 48, lineHeight: 1.16, color: onCard ? th.ink : th.text }}>
          {el.text.split(" ").map((word, i) => (
            <span key={i} style={{ opacity: ctx.t > 0.3 + i * 0.07 ? 1 : 0 }}>
              {word}{" "}
            </span>
          ))}
          {th.surface === "ruled" && <span style={{ display: "inline-block", width: "0.45em", height: "0.85em", verticalAlign: "-0.06em", background: th.accent, opacity: ctx.t > 0.35 && Math.floor(ctx.now * 2.5) % 2 ? 1 : 0 }} />}
        </Probe>
      </div>
      {th.surface === "torn" && (
        <>
          <Tape colour={th.accent} left={-30} rot={-24} />
          <Tape colour={th.accent} right={-30} rot={19} />
        </>
      )}
      {th.surface === "ruled" && ctx.t > 0.5 && (
        <>
          <Corner ctx={ctx} style={{ left: -15, top: -15 }} phase={0} />
          <Corner ctx={ctx} style={{ right: -15, top: -15 }} phase={1.5} />
          <Corner ctx={ctx} style={{ left: -15, bottom: -15 }} phase={3} />
          <Corner ctx={ctx} style={{ right: -15, bottom: -15 }} phase={4.5} />
        </>
      )}
    </div>
  );
}

/** Values pinned along a line, with a marker that keeps travelling between the first and the last. */
function Marks({ el, ctx, w }: { el: Extract<ThElement, { type: "marks" }>; ctx: Ctx; w: number }) {
  const { th } = ctx;
  const width = w * 0.92;
  const onCard = th.surface === "torn" || th.surface === "plain";
  const display = fontFor(th.display[0]);
  const body = fontFor(th.body);
  const lineK = enter(th, ctx.t, 0.6);
  // Earlier marks come first in reading order: from the left, or from the right for a right-to-left channel.
  const xs = el.items.map((_, i) => ((ctx.rtl ? el.items.length - 1 - i : i) / (el.items.length - 1)) * (width - 280) + 140);
  const mx = xs[0] + (xs[xs.length - 1] - xs[0]) * (0.5 - 0.5 * Math.cos(ctx.clock * 1.3));
  return (
    <div style={{ position: "relative", width, height: 290, margin: "0 auto" }}>
      <svg width={width} height={290} style={{ position: "absolute", inset: 0 }}>
        <path d={ctx.rtl ? `M${width - 20} 118 H${width - 20 - (width - 40) * clamp(lineK)}` : `M20 118 H${20 + (width - 40) * clamp(lineK)}`} stroke={th.text} strokeWidth={th.surface === "torn" ? 10 : 4} strokeLinecap="round" />
        {!onCard && <path d={`M20 128 H${20 + (width - 40) * clamp(lineK)}`} stroke={th.text} strokeWidth={2} strokeDasharray="6 10" strokeDashoffset={-ctx.now * 26} opacity={0.6} />}
        {ctx.t > 1.2 && <path d={`M${mx} 102 l14 16 l-14 16 l-14 -16 z`} fill={th.accent} stroke={onCard ? th.text : "none"} strokeWidth={3} />}
      </svg>
      {el.items.map((item, i) => {
        const t = ctx.t - 0.3 - i * 0.4;
        const k = enter(th, t);
        const swing = th.motion === "stop-motion" ? (hash01(i * 4.1 + 2) - 0.5) * 7 + wobble(th, i + 40, ctx.now) + Math.sin(ctx.clock * 2.4 + i * 1.7) * 2.5 : 0;
        const value: React.CSSProperties = th.surface === "torn" ? { background: th.ink, color: th.card, padding: "0 22px", clipPath: torn(i + 11, 200, 88, 4) } : th.surface === "plain" ? { background: th.card, color: th.ink, padding: "0 22px", borderRadius: 18, boxShadow: SOFT } : { color: th.accent, ...(th.surface === "glow" ? { textShadow: `0 0 22px ${th.accent}` } : {}) };
        const label: React.CSSProperties = onCard ? { background: th.card, color: th.ink, padding: "6px 10px", ...(th.surface === "torn" ? { clipPath: torn(i + 21, 236, 110, 4) } : { borderRadius: 12 }) } : { color: th.text };
        return (
          <div key={i} style={{ position: "absolute", left: xs[i] - 130, width: 260, top: 0, display: "flex", flexDirection: "column", alignItems: "center", opacity: clamp(k * 3), transform: `translateY(${(1 - k) * -60}px) rotate(${swing}deg)`, transformOrigin: "50% 118px", filter: th.surface === "torn" ? HARD : undefined }}>
            <Probe ctx={ctx} id={`${ctx.id}:mark-v-${i}`} on={ctx.t > 1.1 + i * 0.4} style={{ height: 88, lineHeight: "88px", whiteSpace: "nowrap", fontFamily: display.family, fontWeight: display.heavy, fontSize: 76 * FACE[th.display[0]].scale, ...value }}>
              {item.value}
            </Probe>
            <div style={{ width: 26, height: 26, borderRadius: 13, background: onCard ? th.card : th.paper, border: `7px solid ${th.text}`, boxSizing: "border-box", marginTop: 17 }} />
            <Probe ctx={ctx} id={`${ctx.id}:mark-l-${i}`} on={ctx.t > 1.1 + i * 0.4} style={{ width: 236, marginTop: 14, boxSizing: "border-box", fontFamily: body.family, fontWeight: body.heavy, fontSize: 30, lineHeight: 1.14, textAlign: "center", ...label }}>
              {item.label}
            </Probe>
          </div>
        );
      })}
    </div>
  );
}

/** Artwork: the episode's own vector drawing, coloured and animated the theme's way. `box` is where it may sit. */
function Art({ el, drawing, ctx, box }: { el: Extract<ThElement, { type: "art" }>; drawing: Drawing; ctx: Ctx; box: Rect }) {
  const { th } = ctx;
  const labelH = el.label ? 74 : 0;
  const d = Math.min(box.w, box.h - labelH);
  const k = th.art === "line" ? easeInOut(ctx.t / 1.1) : enter(th, ctx.t, 0.4);
  const backK = clamp(enter(th, ctx.t - 0.1, 0.4));
  const landed = ctx.t > 0.5;
  const fx = landed ? Math.sin(ctx.clock * 1.7) * d * 0.045 : 0;
  const fy = landed ? Math.cos(ctx.clock * 2.3) * d * 0.04 : 0;
  const colour = (r: Role | undefined): string | undefined => (r === undefined ? undefined : r === "ink" ? (th.art === "cutout" ? th.ink : th.text) : r === "paper" ? th.card : r === "accent" ? th.accent : th.colors[r === "a" ? 0 : r === "b" ? 1 : 2]);
  const move =
    th.motion === "stop-motion"
      ? `translate(${(1 - k) * 220 + fx}px, ${(1 - k) * -160 + fy}px) rotate(${-12 + (1 - k) * 40 + wobble(th, el.id.length, ctx.now) * 2 + Math.sin(ctx.clock * 1.1) * 6}deg)`
      : th.motion === "snappy"
        ? `translate(${fx}px, ${fy}px) scale(${Math.max(0, k)}) rotate(${Math.sin(ctx.now * 1.1) * 5}deg)`
        : `translate(${fx}px, ${fy}px)`;
  return (
    <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: d, height: d }}>
        {th.art === "cutout" && (
          <>
            <div style={{ position: "absolute", inset: -d * 0.07, background: th.card, clipPath: BURST, transform: `scale(${backK}) rotate(${ctx.clock * 16}deg)` }} />
            <div style={{ position: "absolute", inset: d * 0.04, borderRadius: "50%", background: th.colors[2], filter: HARD, transform: `scale(${backK})` }} />
          </>
        )}
        {th.art === "flat" && <div style={{ position: "absolute", inset: -d * 0.04, borderRadius: "50%", background: fade(th.colors[1], 34), boxShadow: `0 0 ${d * 0.3}px ${fade(th.colors[1], 45)}`, transform: `scale(${backK * (1 + 0.05 * Math.sin(ctx.now * 2))})` }} />}
        <svg viewBox="-8 -8 116 116" width={d} height={d} style={{ position: "absolute", inset: 0, overflow: "visible", filter: th.art === "cutout" ? HARD : undefined, opacity: th.motion === "stop-motion" ? clamp(k * 3) : 1, transform: move }}>
          {th.art === "cutout" && (
            <defs>
              <filter id="th-sticker" x="-20%" y="-20%" width="140%" height="140%">
                <feMorphology in="SourceAlpha" operator="dilate" radius="3.2" result="fat" />
                <feFlood floodColor={th.card} />
                <feComposite in2="fat" operator="in" result="backing" />
                <feMerge>
                  <feMergeNode in="backing" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
          )}
          {th.art === "line" && (
            <g stroke={th.text} fill="none" strokeWidth="0.8" opacity={0.6 * easeOut(ctx.t / 0.5)}>
              <circle cx="50" cy="50" r="58" strokeDasharray="4 3" transform={`rotate(${ctx.now * 14} 50 50)`} />
              <circle cx="50" cy="50" r="52" strokeDasharray="1 5" transform={`rotate(${-ctx.now * 22} 50 50)`} />
              <path d="M50 -12 V112 M-12 50 H112" strokeDasharray="2 3" strokeDashoffset={-ctx.now * 4} />
            </g>
          )}
          <g filter={th.art === "cutout" ? "url(#th-sticker)" : undefined} strokeLinecap="round" strokeLinejoin="round">
            {drawing.shapes.map((s, i) => {
              const transform = s.anim === "flap" ? fold(0.72 + 0.28 * Math.cos(ctx.clock * Math.PI * 6)) : s.anim === "spin" && s.at ? `rotate(${ctx.clock * 150} ${s.at[0]} ${s.at[1]})` : undefined;
              const opacity = s.anim === "blink" && landed && Math.floor(ctx.now * 3 + i) % 2 ? 0.15 : 1;
              if (th.art === "line") {
                // A line drawing keeps only outlines: every shape is stroked, and "paper" shapes are filled with the sheet so they hide what is behind them.
                const accent = s.fill === "accent" || s.stroke === "accent" || s.fill === "c";
                return <path key={i} d={s.d} transform={transform} opacity={opacity} fill={s.fill === "paper" ? th.paper : "none"} stroke={accent ? th.accent : th.text} strokeWidth={s.width ?? 2.2} {...pen(k * 1.5 - i * 0.03)} />;
              }
              return <path key={i} d={s.d} transform={transform} opacity={opacity} fill={colour(s.fill) ?? "none"} stroke={colour(s.stroke) ?? "none"} strokeWidth={s.width ?? 2.4} />;
            })}
          </g>
        </svg>
      </div>
      {el.label && (
        <div style={{ height: labelH, display: "flex", alignItems: "center" }}>
          <Plate ctx={ctx} text={el.label} seed={el.label.length + 3} size={52} maxWidth={box.w * 0.9} delay={0.3} probeSuffix="art-label" />
        </div>
      )}
    </div>
  );
}

/** Two torn sheets per beat; each beat lays them out differently. */
const SHEETS = [
  [
    { x: -0.1, y: -0.04, w: 0.8, h: 0.42, rot: -3, c: 0, dx: -1 },
    { x: 0.26, y: 0.6, w: 0.86, h: 0.46, rot: 4, c: 1, dx: 1 },
  ],
  [
    { x: 0.3, y: -0.05, w: 0.8, h: 0.34, rot: 5, c: 1, dx: 1 },
    { x: -0.12, y: 0.54, w: 0.8, h: 0.52, rot: -4, c: 2, dx: -1 },
  ],
  [
    { x: -0.2, y: 0.24, w: 0.72, h: 0.5, rot: -8, c: 2, dx: -1 },
    { x: 0.38, y: -0.06, w: 0.72, h: 0.3, rot: 3, c: 0, dx: 1 },
  ],
];

/** What moves behind the content. `lane` is the stretch of the width loose pieces may drift in (clear of the character's column). */
const Backdrop: React.FC<{ th: Theme; now: number; clock: number; beatT: number; index: number; spanId: string; width: number; height: number; lane: [number, number] }> = ({ th, now, clock, beatT, index, spanId, width, height, lane }) => {
  if (th.backdrop === "sheets") {
    const palette = [...th.colors, th.ink, th.card];
    return (
      <>
        {SHEETS[index % SHEETS.length].map((s, i) => {
          const k = clamp(enter(th, beatT - i * 0.08, 0.4));
          const w = s.w * width;
          const h = s.h * height;
          return (
            <div key={`${spanId}-sheet-${i}`} style={{ position: "absolute", left: s.x * width, top: s.y * height, width: w, height: h, filter: "drop-shadow(0 10px 0 rgba(0,0,0,0.12))", transform: `translate(${(1 - k) * s.dx * width * 0.7 + Math.sin(clock * 0.5 + i * 2) * 20}px, ${Math.cos(clock * 0.4 + i) * 16}px) rotate(${s.rot + (1 - k) * s.dx * 6 + wobble(th, i + index * 5, now) * 0.5 + Math.sin(clock * 0.35 + i * 3) * 1.3}deg)` }}>
              <div style={{ width: "100%", height: "100%", background: th.colors[s.c], clipPath: torn(index * 10 + i, w, h, 26) }} />
            </div>
          );
        })}
        {Array.from({ length: 10 }, (_, i) => {
          const seed = index * 20 + i;
          const size = 26 + hash01(seed * 1.9) * 38;
          const x = lane[0] + hash01(seed * 1.3) * (lane[1] - lane[0]) + Math.sin(clock * 0.8 + seed) * 30;
          const y = (((hash01(seed * 2.9) * (height + 200) - clock * (22 + hash01(seed * 4.3) * 34)) % (height + 200)) + height + 200) % (height + 200) - 100;
          return <div key={`${spanId}-scrap-${i}`} style={{ position: "absolute", left: x, top: y, width: size, height: size, background: palette[seed % palette.length], borderRadius: i % 3 === 0 ? "50%" : 0, clipPath: i % 3 === 1 ? "polygon(50% 0, 100% 100%, 0 100%)" : undefined, transform: `rotate(${clock * (40 + hash01(seed) * 60) * (i % 2 ? 1 : -1)}deg)` }} />;
        })}
      </>
    );
  }
  if (th.backdrop === "grid") {
    const grid = (size: number): React.CSSProperties => ({ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${th.text} 2px, transparent 2px), linear-gradient(90deg, ${th.text} 2px, transparent 2px)`, backgroundSize: `${size}px ${size}px`, backgroundPosition: `${now * 8}px ${now * 12}px` });
    const cx = width * (index % 2 ? 0.2 : 0.82);
    const cy = height * (0.14 + (index % 3) * 0.3);
    const scanY = ((now * 170) % (height + 240)) - 120;
    return (
      <>
        <div style={{ ...grid(54), opacity: 0.08 }} />
        <div style={{ ...grid(270), opacity: 0.18 }} />
        <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
          <g stroke={th.text} fill="none" opacity={0.22}>
            <circle cx={cx} cy={cy} r={250} strokeWidth={3} strokeDasharray="26 16" transform={`rotate(${now * 9} ${cx} ${cy})`} />
            <circle cx={cx} cy={cy} r={370} strokeWidth={2} strokeDasharray="6 14" transform={`rotate(${-now * 6} ${cx} ${cy})`} />
            <circle cx={cx} cy={cy} r={120} strokeWidth={2} />
          </g>
        </svg>
        <div style={{ position: "absolute", left: 0, top: scanY, width, height: 3, background: th.text, opacity: 0.3 }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(0,0,0,0.38) 100%)" }} />
        {beatT < 0.4 && <div style={{ position: "absolute", top: 0, left: (beatT / 0.4) * (width + 40) - 20, width: 8, height, background: th.accent, boxShadow: `0 0 40px 10px ${th.accent}`, opacity: 0.8 }} />}
      </>
    );
  }
  if (th.backdrop === "blobs") {
    return (
      <>
        {th.colors.map((c, i) => {
          const r = width * (0.5 + 0.12 * i);
          const x = width * (0.15 + 0.35 * ((i + index) % 3)) + Math.sin(now * 0.35 + i * 2.1) * width * 0.16;
          const y = height * (0.16 + 0.3 * ((i * 2 + index) % 3)) + Math.cos(now * 0.28 + i * 1.3) * height * 0.08;
          return <div key={i} style={{ position: "absolute", left: x - r / 2, top: y - r / 2, width: r, height: r, borderRadius: "50%", background: c, opacity: 0.4, filter: "blur(110px)" }} />;
        })}
      </>
    );
  }
  return null;
};

/** Seconds a shot dissolves into the next. */
/** Where the camera is over a shot, `p` of the way through it (0 → 1): a scale and an offset in fractions of the frame. */
function cameraAt(move: CameraMove, p: number, clock: number): { scale: number; x: number; y: number } {
  const k = easeInOut(p);
  switch (move) {
    case "push-in":
      return { scale: 1.06 + 0.14 * k, x: 0, y: 0 };
    case "pull-out":
      return { scale: 1.2 - 0.14 * k, x: 0, y: 0 };
    case "pan-left":
      return { scale: 1.16, x: 0.05 - 0.1 * k, y: 0 };
    case "pan-right":
      return { scale: 1.16, x: -0.05 + 0.1 * k, y: 0 };
    case "rise":
      return { scale: 1.16, x: 0, y: 0.05 - 0.1 * k };
    case "sink":
      return { scale: 1.16, x: 0, y: -0.05 + 0.1 * k };
    case "drift":
      return { scale: 1.12 + 0.03 * Math.sin(clock * 0.3), x: 0.02 * Math.sin(clock * 0.21), y: 0.02 * Math.cos(clock * 0.17) };
  }
}

/**
 * The painted story: the shot on screen, filmed with its camera move, or played as its moving clip when the shots
 * were animated (a still camera: the clip moves by itself); the shot before dissolves out under it.
 */
const World: React.FC<{ shots: ShotSpan[]; th: Theme; now: number; clock: number; width: number; height: number; props: EpisodeProps }> = ({ shots, th, now, clock, width, height, props }) => {
  const { fps } = useVideoConfig();
  const at = shots.reduce((cur, s, i) => (now >= s.start ? i : cur), 0);
  const draw = (s: ShotSpan, opacity: number) => {
    if (s.clip) {
      const onScreen = s.end - s.start + FADE;
      return (
        <Sequence key={s.id} from={Math.round(s.start * fps)} durationInFrames={Math.max(1, Math.round(onScreen * fps) + 1)} layout="none">
          <OffthreadVideo src={staticFile(s.clip.file)} muted playbackRate={Math.min(1, s.clip.seconds / onScreen)} style={{ position: "absolute", left: 0, top: 0, width, height, objectFit: "cover", opacity }} />
        </Sequence>
      );
    }
    const cam = shotCamera(s, now, (m, p) => cameraAt(m, p, clock), width, height);
    return (
      <Img
        key={s.id}
        src={staticFile(s.file)}
        style={{ position: "absolute", left: 0, top: 0, width, height, objectFit: "cover", opacity, transform: `translate(${cam.bx}px, ${cam.by}px) scale(${cam.a})`, transformOrigin: "0 0" }}
      />
    );
  };
  const cur = shots[at];
  const before = at > 0 ? shots[at - 1] : null;
  const fadeIn = before ? clamp((now - cur.start) / FADE) : 1;
  // A light wash in the look's paper colour, only under the lettering: behind the captions.
  const paper = th.paper.length === 4 ? `#${th.paper[1]}${th.paper[1]}${th.paper[2]}${th.paper[2]}${th.paper[3]}${th.paper[3]}` : th.paper;
  const wash = (a: number) => `${paper}${Math.round(a * 255).toString(16).padStart(2, "0")}`;
  return (
    <>
      {before && fadeIn < 1 && draw(before, 1)}
      {draw(cur, fadeIn)}
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, ${wash(0)} 0%, ${wash(0)} 64%, ${wash(0.42)} 100%)` }} />
      {/* The shot's drawn animation; a moving clip has no camera of its own, so its points stay where they were painted. */}
      <ShotMarks s={cur} cam={cur.clip ? { a: 1, bx: 0, by: 0 } : shotCamera(cur, now, (m, p) => cameraAt(m, p, clock), width, height)} now={now} props={props} th={th} W={width} H={height} />
    </>
  );
};

const Grain: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <svg width={width} height={height} style={{ position: "absolute", inset: 0, mixBlendMode: "multiply", pointerEvents: "none" }}>
    <filter id="th-grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" />
      <feColorMatrix type="matrix" values="0.3 0 0 0 0.74  0.3 0 0 0 0.74  0.3 0 0 0 0.74  0 0 0 0 1" />
    </filter>
    <rect width={width} height={height} filter="url(#th-grain)" />
  </svg>
);

/** render-themed: one renderer for every look. The channel's theme.json decides how it is drawn and how it moves. */
export const Themed: React.FC<{ props: EpisodeProps; spans: BeatSpan[]; from: number }> = ({ props, spans, from }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const now = (frame + from) / fps;
  const th = props.theme;
  if (!th) throw new Error("render-themed needs a theme: the channel has no theme.json.");
  const clock = th.motion === "stop-motion" ? step(now) : now;
  const scene = (props.script.visuals["render-themed"] as ThScene | undefined) ?? {};
  const r = regions(width, height, props.safeArea);
  const span = spans.reduce((cur, s) => (now >= s.start ? s : cur), spans[0]);
  const visual = span.beat.visual as ThBeatVisual;
  // A look with a world tells the story in painted shots: no lettering over them, and the host is drawn inside them.
  const story = Boolean(th.world);
  const elements = visual.skill === "render-themed" && !story ? (visual.elements ?? []) : [];
  const hostShown = !story && props.renderSkills.includes("render-talking-character") && span.beat.character.placement !== "hidden";
  const fr = story ? null : beatFrame(props, span);
  let area: Rect;
  let side: Rect | null;
  let lane: [number, number];
  let align: "top" | "middle" | "bottom";
  if (fr) {
    // The look's frames say where everything goes (see frames.ts for how a beat gets its frame).
    area = frameTextRect(fr, width, height, props.safeArea);
    side = fr.picture ? onStage(fr.picture, r.stage) : null;
    const host = hostShown ? frameHostRect(fr, span.beat.character.placement === "full" ? "full" : "corner", width, height, props.safeArea) : null;
    lane = !host ? [0, width] : host.x > width - (host.x + host.w) ? [0, host.x - 60] : [host.x + host.w + 60, width];
    align = fr.text.align;
  } else {
    const ch = hostShown ? characterRect(span.beat.character.placement as "full" | "corner", width, height, props.safeArea, th.layout) : null;
    // Lettering stacks above the character; the artwork takes the spot beside it, unless the look stacks it with the lettering.
    const top = r.headline.y;
    area = { x: r.stage.x, y: top, w: r.stage.w, h: (ch ? ch.y - 16 : r.stage.y + r.stage.h) - top };
    const beside: Rect | null = !ch ? null : th.layout.host === "left" ? { x: ch.x + ch.w + 20, y: ch.y, w: r.stage.x + r.stage.w - (ch.x + ch.w + 20), h: ch.h } : { x: r.stage.x, y: ch.y, w: ch.x - 20 - r.stage.x, h: ch.h };
    // A big host leaves too little room above it to stack a picture with the lettering, so there the picture stays beside it.
    side = th.layout.pictures === "beside" || span.beat.character.placement === "full" ? beside : null;
    lane = !ch ? [0, width] : th.layout.host === "left" ? [ch.x + ch.w + 60, width] : [0, ch.x - 60];
    align = th.layout.lettering === "top" ? "top" : th.layout.lettering === "low" ? "bottom" : "middle";
  }
  const flow = elements.map((el, i) => ({ el, i })).filter(({ el }) => !(side && el.type === "art"));
  // Each element is drawn at its own width (an element too wide for the box is drawn wider and scaled down), then the stack is scaled to fit.
  const { items, scale } = stackLayout(flow.map(({ el }) => el), th, area, Boolean(fr));
  const total = items.reduce((a, b) => a + b.h, 0) + GAP * Math.max(0, items.length - 1);
  const probe = props.qaProbe && span.end - now > 0.2;
  const startOf = (i: number) => (i === 0 ? span.start + 0.05 : span.voiceStart) + i * 0.35;
  const ctxFor = (i: number): Ctx => ({ t: now - startOf(i), now, clock, th, probe, id: `th:${span.id}:${i}`, rtl: props.direction === "rtl" });
  const spare = area.h - total * scale;
  let y = area.y + (align === "top" ? 0 : align === "bottom" ? spare : spare / 2);

  return (
    <AbsoluteFill style={{ background: th.paper, overflow: "hidden" }}>
      {story ? <World shots={shotTimeline(props, spans)} th={th} now={now} clock={clock} width={width} height={height} props={props} /> : <Backdrop th={th} now={now} clock={clock} beatT={now - span.start} index={span.index} spanId={span.id} width={width} height={height} lane={lane} />}
      {flow.map(({ el, i }, n) => {
        const topPx = y;
        y += (items[n].h + GAP) * scale;
        const it = items[n];
        const natural = it.h / it.k;
        const ctx = ctxFor(i);
        if (ctx.t < 0) return null;
        return (
          <div key={`${span.id}-${i}`} style={{ position: "absolute", left: area.x + (area.w - it.w) / 2, top: topPx, width: it.w, height: natural, transform: `scale(${scale * it.k})`, transformOrigin: "50% 0" }}>
            {el.type === "heading" && <Heading el={el} ctx={ctx} w={it.w} />}
            {el.type === "note" && <Note el={el} ctx={ctx} w={it.w} />}
            {el.type === "marks" && <Marks el={el} ctx={ctx} w={it.w} />}
            {el.type === "art" && scene.art?.[el.id] && <Art el={el} drawing={scene.art[el.id]} ctx={ctx} box={{ x: 0, y: 0, w: it.w, h: natural }} />}
          </div>
        );
      })}
      {side &&
        elements.map((el, i) => {
          const ctx = ctxFor(i);
          return el.type === "art" && scene.art?.[el.id] && ctx.t >= 0 ? <Art key={`${span.id}-${i}`} el={el} drawing={scene.art[el.id]} ctx={ctx} box={side} /> : null;
        })}
      {th.texture === "grain" && <Grain width={width} height={height} />}
    </AbsoluteFill>
  );
};
