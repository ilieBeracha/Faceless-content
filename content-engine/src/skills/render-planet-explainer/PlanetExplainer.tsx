import React, { useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { FONTS } from "../../render/fonts.ts";
import { useQaProbe } from "../../render/qa-probe.ts";
import { clamp, easeInOut, easeOut, hash01, regions } from "../../render/timeline.ts";
import type { BeatSpan, EpisodeProps, Rect } from "../../render/types.ts";
import { beatVisualSchema, sceneSchema, type PePlanet, type PeView } from "./schema.ts";

/** Labels inside the scene use one clean sans, whatever the channel's headline font is. */
const LABEL_FONT = FONTS["space-grotesk"];
const DEFAULT_BG = { top: "#0b1026", bottom: "#04050b" };
const WARM_BG = { top: "#2a0d14", bottom: "#07040a" };

interface Timed {
  view: PeView;
  start: number;
  end: number;
  beatId: string;
}

interface Layout {
  cx: number;
  cy: number;
  r: number;
  rings: number; // 0..1 opacity of the planet's rings
  rotate: number; // degrees the planet (bands, rings) leans
  surface: number; // 0..1 how much of the outer surface shows (a cutaway fades it)
  warm: number; // 0..1 background tint toward red (cutaways)
}

/** Every view of every planet-explainer beat, on one clock. A view starts on its at_word's first sound. */
function timeline(props: EpisodeProps, spans: BeatSpan[]): Timed[] {
  const out: Timed[] = [];
  for (const span of spans) {
    if (span.beat.visual.skill !== "render-planet-explainer") continue;
    // Parse so the schema's defaults (zoom, labels, at_word…) are filled in.
    const visual = beatVisualSchema.parse(span.beat.visual);
    const words = props.words.filter((w) => w.beat === span.id);
    visual.views.forEach((view, i) => {
      const start = i === 0 ? span.start : Math.max(span.start, (words[view.at_word ?? 0]?.start ?? span.start) - 0.12);
      out.push({ view, start, end: span.end, beatId: span.id });
    });
  }
  for (let i = 0; i < out.length - 1; i++) out[i].end = Math.min(out[i].end, out[i + 1].start);
  return out;
}

function baseRadius(stage: Rect, planet: PePlanet): number {
  const ringFactor = planet.rings ? planet.rings.outer : 1.15;
  return Math.min((stage.w * 0.62) / ringFactor, stage.h * 0.3, stage.w * 0.4);
}

function layoutFor(view: PeView, stage: Rect, width: number, planet: PePlanet): Layout {
  const r0 = baseRadius(stage, planet);
  const cx = width / 2;
  const cy = stage.y + stage.h * 0.47;
  const hasRings = planet.rings ? 1 : 0;
  const l: Layout = { cx, cy, r: r0, rings: hasRings, rotate: planet.tilt_deg, surface: 1, warm: 0 };
  switch (view.view) {
    case "hero":
      return { ...l, r: r0 * view.zoom };
    case "cutaway": {
      // Planet on the left, labels in a column on the right.
      const rc = Math.min(stage.w * 0.3, stage.h * 0.25);
      return { ...l, cx: stage.x + rc + 10, r: rc, rings: 0, rotate: 0, surface: 0, warm: 1 };
    }
    case "rings":
      return { ...l, rings: hasRings };
    case "tilt":
      return { ...l, r: r0 * 0.9, rotate: view.degrees };
    case "stat":
      return { ...l, cy: stage.y + stage.h * 0.62, r: r0 * 0.78 };
    case "probe":
      return { ...l, r: r0 * 0.8, cx: cx + stage.w * 0.08 };
    case "compare":
      return { ...l, cx: cx + stage.w * 0.16, r: r0 * 0.8, rings: hasRings * 0.35 };
    case "spin":
      return { ...l };
    case "spot":
      return { ...l, r: r0 * 1.1, rings: hasRings * 0.6 };
    case "float":
      return { ...l, cy: stage.y + stage.h * 0.45, r: stage.w * 0.22, rings: 0, rotate: 0 };
  }
}

function mixLayout(a: Layout, b: Layout, k: number): Layout {
  const m = (x: number, y: number) => x + (y - x) * k;
  return { cx: m(a.cx, b.cx), cy: m(a.cy, b.cy), r: m(a.r, b.r), rings: m(a.rings, b.rings), rotate: m(a.rotate, b.rotate), surface: m(a.surface, b.surface), warm: m(a.warm, b.warm) };
}

function mixHex(a: string, b: string, k: number): string {
  const p = (h: string) => {
    const s = h.replace("#", "");
    const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
    return parseInt(full, 16);
  };
  const pa = p(a);
  const pb = p(b);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

/** HTML text in the scene (so the QA probe can check it stays in the safe area). */
const Text: React.FC<{ id: string; probe: boolean; x: number; y: number; size: number; weight?: number; color?: string; opacity?: number; anchor?: "center" | "left" | "right"; maxWidth?: number; children: React.ReactNode }> = ({ id, probe, x, y, size, weight, color, opacity = 1, anchor = "center", maxWidth, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  useQaProbe(probe && opacity > 0.9, ref, id, "text");
  const shift = anchor === "center" ? "-50%" : anchor === "right" ? "-100%" : "0";
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(${shift}, -50%)`,
        whiteSpace: maxWidth ? "normal" : "nowrap",
        width: maxWidth,
        lineHeight: 1.08,
        fontFamily: LABEL_FONT.family,
        fontWeight: weight ?? LABEL_FONT.heavy,
        fontSize: size,
        color: color ?? "#ffffff",
        opacity,
        letterSpacing: -0.5,
        textShadow: "0 4px 18px rgba(0,0,0,0.6)",
      }}
    >
      {children}
    </div>
  );
};

const Stars: React.FC<{ t: number; width: number; height: number }> = ({ t, width, height }) => (
  <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
    {Array.from({ length: 110 }, (_, i) => {
      const tw = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * (0.6 + hash01(i) * 1.6) + i * 1.7));
      return <circle key={i} cx={hash01(i * 3.1) * width} cy={hash01(i * 7.7) * height} r={0.8 + hash01(i * 5.3) * 2.2} fill="#ffffff" opacity={tw * (0.25 + 0.55 * hash01(i * 9.1))} />;
    })}
  </svg>
);

/** One ringlet ellipse split at the planet's equator line, so its back half can sit behind the disc. */
function ringPath(r: number, rx: number, ry: number, half: "back" | "front"): string {
  // Back half = the top arc (further from the viewer when the rings lean toward us).
  return half === "back" ? `M ${-rx} 0 A ${rx} ${ry} 0 0 1 ${rx} 0` : `M ${rx} 0 A ${rx} ${ry} 0 0 1 ${-rx} 0`;
}

const Rings: React.FC<{ planet: PePlanet; r: number; half: "back" | "front"; opacity: number; draw: number }> = ({ planet, r, half, opacity, draw }) => {
  const rings = planet.rings;
  if (!rings || opacity <= 0.01) return null;
  const n = rings.bands;
  return (
    <g opacity={opacity}>
      {Array.from({ length: n }, (_, i) => {
        const f = n === 1 ? 0.5 : i / (n - 1);
        const rx = r * (rings.inner + (rings.outer - rings.inner) * f);
        const ry = rx * 0.26;
        const len = Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
        const w = (r * (rings.outer - rings.inner)) / n * (0.55 + 0.4 * hash01(i * 4.2));
        return (
          <path
            key={i}
            d={ringPath(r, rx, ry, half)}
            fill="none"
            stroke={rings.color}
            strokeOpacity={0.35 + 0.5 * hash01(i * 2.7)}
            strokeWidth={w}
            strokeDasharray={len}
            strokeDashoffset={len * (1 - draw)}
            strokeLinecap="butt"
          />
        );
      })}
    </g>
  );
};

/** The planet's disc: base colour, latitude bands, drifting cloud streaks, shading and glow. */
const Disc: React.FC<{ planet: PePlanet; r: number; t: number; spin: number; surface: number; uid: string }> = ({ planet, r, t, spin, surface, uid }) => {
  const bands = planet.bands;
  const streaks = 14;
  return (
    <g>
      <defs>
        <clipPath id={`clip-${uid}`}>
          <circle r={r} />
        </clipPath>
        <radialGradient id={`shade-${uid}`} cx="0.34" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.82" stopColor="#000000" stopOpacity="0.35" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.7" />
        </radialGradient>
        <radialGradient id={`glow-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.72" stopColor={planet.glow ?? planet.color} stopOpacity="0.45" />
          <stop offset="1" stopColor={planet.glow ?? planet.color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r={r * 1.32} fill={`url(#glow-${uid})`} opacity={0.8 * surface} />
      <g clipPath={`url(#clip-${uid})`} opacity={surface}>
        <circle r={r} fill={planet.color} />
        {bands.map((c, i) => {
          const h = (2 * r) / bands.length;
          const y = -r + i * h;
          return <rect key={i} x={-r} y={y} width={2 * r} height={h * 1.02} fill={c} opacity={0.55 + 0.3 * hash01(i * 3.3)} />;
        })}
        {Array.from({ length: streaks }, (_, i) => {
          // Cloud streaks ride the rotation: phase moves them across the disc; they fade at the limb.
          const phase = (hash01(i * 1.9) * Math.PI * 2 + t * spin * (0.6 + 0.6 * hash01(i * 6.1))) % (Math.PI * 2);
          const y = -r * 0.85 + hash01(i * 8.3) * r * 1.7;
          const halfW = Math.sqrt(Math.max(0, r * r - y * y));
          const x = Math.sin(phase) * halfW;
          const vis = Math.max(0, Math.cos(phase));
          return <ellipse key={i} cx={x} cy={y} rx={r * (0.12 + 0.18 * hash01(i * 2.2)) * (0.3 + 0.7 * vis)} ry={r * 0.018 + r * 0.012 * hash01(i)} fill="#ffffff" opacity={0.16 * vis} />;
        })}
        <circle r={r} fill={`url(#shade-${uid})`} />
      </g>
    </g>
  );
};

function hexPoints(w: number, h: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${(Math.cos(a) * w).toFixed(1)},${(Math.sin(a) * h).toFixed(1)}`;
  }).join(" ");
}

const Spot: React.FC<{ v: Extract<PeView, { view: "spot" }>; r: number; k: number; accent: string }> = ({ v, r, k, accent }) => {
  const y = { "north-pole": -0.7, "south-pole": 0.7, upper: -0.45, middle: 0, lower: 0.45 }[v.at] * r;
  const polar = v.at.endsWith("pole");
  const w = v.size * r;
  const h = polar ? w * 0.42 : v.shape === "circle" ? w : w * 0.62;
  const stroke = v.color ?? accent;
  const draw = easeOut(k);
  return (
    <g transform={`translate(0, ${y})`} opacity={clamp(k * 3)}>
      {v.shape === "hexagon" ? (
        <polygon points={hexPoints(w, h)} fill={stroke} fillOpacity={0.35 * draw} stroke={stroke} strokeWidth={Math.max(6, r * 0.03)} strokeDasharray={w * 7} strokeDashoffset={w * 7 * (1 - draw)} strokeLinejoin="round" />
      ) : (
        <ellipse rx={w} ry={h} fill={stroke} fillOpacity={0.22 * draw} stroke={stroke} strokeWidth={Math.max(3, r * 0.015)} strokeDasharray={w * 7} strokeDashoffset={w * 7 * (1 - draw)} />
      )}
    </g>
  );
};

/** A small, generic spacecraft: body, dish, boom and panels. */
const Probe: React.FC<{ size: number }> = ({ size }) => (
  <g>
    <line x1={-size * 0.9} y1={0} x2={size * 0.9} y2={0} stroke="#cfd6e6" strokeWidth={size * 0.06} />
    <rect x={-size * 0.18} y={-size * 0.16} width={size * 0.36} height={size * 0.32} fill="#d9b25f" stroke="#7a6230" strokeWidth={size * 0.03} />
    <ellipse cx={0} cy={-size * 0.38} rx={size * 0.42} ry={size * 0.14} fill="#eef1f7" stroke="#9aa3b5" strokeWidth={size * 0.03} />
    <line x1={0} y1={-size * 0.38} x2={0} y2={-size * 0.6} stroke="#cfd6e6" strokeWidth={size * 0.04} />
    <rect x={-size * 1.25} y={-size * 0.1} width={size * 0.35} height={size * 0.2} fill="#3b5d9c" stroke="#9fb8e8" strokeWidth={size * 0.02} />
    <rect x={size * 0.9} y={-size * 0.1} width={size * 0.35} height={size * 0.2} fill="#3b5d9c" stroke="#9fb8e8" strokeWidth={size * 0.02} />
  </g>
);

/** render-planet-explainer: one hero planet whose view changes with the narration. */
export const PlanetExplainer: React.FC<{ props: EpisodeProps; spans: BeatSpan[]; from: number }> = ({ props, spans, from }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = (frame + from) / fps;
  const scene = sceneSchema.parse(props.script.visuals["render-planet-explainer"]);
  const planet = scene.planet;
  const stage = regions(width, height, props.safeArea).stage;
  const views = timeline(props, spans);
  if (!views.length) return null;
  const idx = Math.max(0, views.reduce((cur, v, i) => (t >= v.start ? i : cur), 0));
  const cur = views[idx];
  const prev = views[idx - 1];
  const lt = t - cur.start; // seconds since this view began
  const move = easeInOut(clamp(lt / 0.7));
  const layout = prev ? mixLayout(layoutFor(prev.view, stage, width, planet), layoutFor(cur.view, stage, width, planet), move) : layoutFor(cur.view, stage, width, planet);
  const fadeIn = easeOut(clamp((lt - 0.25) / 0.45));
  const out = clamp((cur.end - t) / 0.2);
  const accent = props.brand.accent_color;
  const probe = props.qaProbe;
  const bgBase = scene.background ?? DEFAULT_BG;
  const bgTop = mixHex(bgBase.top, WARM_BG.top, layout.warm);
  const bgBottom = mixHex(bgBase.bottom, WARM_BG.bottom, layout.warm);
  const breathe = 1 + 0.015 * Math.sin(t * 0.5);
  const v = cur.view;
  const spin = v.view === "spin" ? 3.2 : 0.35;
  const { cx, cy, r } = layout;
  const ringDraw = v.view === "rings" ? easeInOut(clamp((lt - 0.2) / 1.4)) : 1;
  const ringOpacity = v.view === "rings" ? Math.max(layout.rings, 1) : layout.rings;
  const captionY = Math.max(stage.y + 40, cy - r * (planet.rings && layout.rings > 0.5 ? 1.25 : 1.15) - 70);

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 42%, ${bgTop} 0%, ${bgBottom} 75%)`, overflow: "hidden" }}>
      {scene.stars && <Stars t={t} width={width} height={height} />}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, transform: `scale(${breathe})`, transformOrigin: `${cx}px ${cy}px` }}>
        <g transform={`translate(${cx} ${cy})`}>
          {v.view === "float" && <Tub r={r} level={r * (1 - 2 * v.submerged)} t={t} part="back" k={fadeIn} />}
          <g transform={`translate(0 ${v.view === "float" ? Math.sin(t * 2.2) * r * 0.05 : 0}) rotate(${layout.rotate})`}>
            <Rings planet={planet} r={r} half="back" opacity={ringOpacity} draw={ringDraw} />
            <Disc planet={planet} r={r} t={t} spin={spin} surface={layout.surface} uid="main" />
            {v.view === "spot" && <Spot v={v} r={r} k={clamp((lt - 0.3) / 0.9)} accent={accent} />}
            <Rings planet={planet} r={r} half="front" opacity={ringOpacity} draw={ringDraw} />
          </g>
          {v.view === "cutaway" && <Cutaway v={v} r={r} lt={lt} planet={planet} accent={accent} />}
          {v.view === "float" && <Tub r={r} level={r * (1 - 2 * v.submerged)} t={t} part="front" k={fadeIn} />}
          {v.view === "tilt" && <Tilt v={v} r={r} lt={lt} accent={accent} />}
          {v.view === "probe" && <ProbePass r={r} lt={lt} />}
          {v.view === "compare" && (
            <g opacity={fadeIn}>
              <circle cx={-r * 1.12 - r * v.other.ratio * 1.2 - 30} cy={0} r={r * v.other.ratio * easeOut(clamp((lt - 0.2) / 0.6))} fill={v.other.color} />
              <circle cx={-r * 1.12 - r * v.other.ratio * 1.2 - 30} cy={0} r={r * v.other.ratio * easeOut(clamp((lt - 0.2) / 0.6))} fill="url(#shade-main)" />
            </g>
          )}
          {v.view === "spin" && <Clock x={r * 0.95} y={-r * 0.95} size={r * 0.32} lt={lt} accent={accent} />}
        </g>
      </svg>

      {/* Text: caption above the planet, plus the view's own labels. */}
      {v.caption && (
        <Text id={`pe:${cur.beatId}:${idx}:caption`} probe={probe} x={width / 2} y={captionY} size={44} weight={LABEL_FONT.regular} color="#dfe6ff" opacity={fadeIn * out}>
          {v.caption}
        </Text>
      )}
      {v.view === "stat" && (
        <>
          <Text id={`pe:${cur.beatId}:${idx}:value`} probe={probe} x={width / 2} y={stage.y + stage.h * 0.18} size={150} opacity={fadeIn * out}>
            <span style={{ display: "inline-block", transform: `scale(${0.85 + 0.15 * fadeIn})` }}>{v.value}</span>
          </Text>
          {v.subtitle && (
            <Text id={`pe:${cur.beatId}:${idx}:subtitle`} probe={probe} x={width / 2} y={stage.y + stage.h * 0.18 + 105} size={38} weight={LABEL_FONT.regular} color="#c9d2f2" opacity={easeOut(clamp((lt - 0.6) / 0.4)) * out}>
              {v.subtitle}
            </Text>
          )}
        </>
      )}
      {v.view === "tilt" && (
        <Text id={`pe:${cur.beatId}:${idx}:deg`} probe={probe} x={cx} y={cy - r - 120} size={110} color={accent} opacity={fadeIn * out}>
          {`${Math.round(v.degrees * easeOut(clamp((lt - 0.3) / 1.2)) * 10) / 10}°`}
        </Text>
      )}
      {v.view === "tilt" && (
        <>
          <Text id={`pe:${cur.beatId}:${idx}:axis`} probe={probe} x={cx + Math.sin((v.degrees * Math.PI) / 180) * r * 1.45} y={cy - Math.cos((v.degrees * Math.PI) / 180) * r * 1.45 - 34} size={34} weight={LABEL_FONT.regular} color="#dfe6ff" opacity={fadeIn * out}>
            {v.axis_label}
          </Text>
          <Text id={`pe:${cur.beatId}:${idx}:orbit`} probe={probe} x={Math.max(stage.x + 10, cx - r * 1.55)} y={cy - 32} size={34} weight={LABEL_FONT.regular} color="#dfe6ff" opacity={fadeIn * out} anchor="left">
            {v.orbit_label}
          </Text>
        </>
      )}
      {v.view === "probe" && (
        <Text id={`pe:${cur.beatId}:${idx}:tag`} probe={probe} x={width / 2} y={cy + r + 110} size={44} color="#ffffff" opacity={fadeIn * out}>
          {v.tag}
        </Text>
      )}
      {v.view === "compare" && (
        <>
          <Text id={`pe:${cur.beatId}:${idx}:other`} probe={probe} x={cx - r - stage.w * 0.06 - r * v.other.ratio} y={cy + r + 60} size={36} weight={LABEL_FONT.regular} color="#dfe6ff" opacity={fadeIn * out}>
            {v.other.name}
          </Text>
          <Text id={`pe:${cur.beatId}:${idx}:self`} probe={probe} x={cx} y={cy + r + 60} size={36} weight={LABEL_FONT.regular} color="#dfe6ff" opacity={fadeIn * out}>
            {planet.name}
          </Text>
          {v.label && (
            <Text id={`pe:${cur.beatId}:${idx}:label`} probe={probe} x={width / 2} y={cy + r + 130} size={48} color={accent} opacity={easeOut(clamp((lt - 0.7) / 0.4)) * out}>
              {v.label}
            </Text>
          )}
        </>
      )}
      {(v.view === "spin" || v.view === "spot" || v.view === "float") && v.label && (
        <Text id={`pe:${cur.beatId}:${idx}:label`} probe={probe} x={width / 2} y={v.view === "float" ? cy - r * 1.3 - 20 : Math.min(stage.y + stage.h - 40, cy + r * 1.25 + 50)} size={48} color={accent} opacity={easeOut(clamp((lt - 0.6) / 0.4)) * out}>
          {v.label}
        </Text>
      )}
      {v.view === "cutaway" &&
        v.layers.map((layer, i) => {
          const y = cutLabelY(cy, r, i, v.layers.length);
          return (
            <Text key={i} id={`pe:${cur.beatId}:${idx}:layer${i}`} probe={probe} x={cx + r + 40} y={y} size={38} weight={LABEL_FONT.heavy} color="#ffe2c4" opacity={easeOut(clamp((lt - 1.0 - i * 0.3) / 0.35)) * out} anchor="left" maxWidth={stage.x + stage.w - (cx + r + 40)}>
              {layer.label}
            </Text>
          );
        })}
    </AbsoluteFill>
  );
};

/** Split the planet open: a bright slit, then the layers grow out from the centre with leader lines. */
const Cutaway: React.FC<{ v: Extract<PeView, { view: "cutaway" }>; r: number; lt: number; planet: PePlanet; accent: string }> = ({ v, r, lt, planet }) => {
  const slit = easeInOut(clamp(lt / 0.5));
  const open = easeOut(clamp((lt - 0.35) / 0.8));
  return (
    <g>
      <defs>
        {v.layers.map((l, i) => (
          <radialGradient key={i} id={`layer-${i}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.55" stopColor={l.color} />
            <stop offset="1" stopColor={mixHex(l.color, "#000000", 0.35)} />
          </radialGradient>
        ))}
      </defs>
      {/* the outer shell stays as a rim */}
      <circle r={r} fill="none" stroke={planet.color} strokeWidth={r * 0.06 * open} opacity={open} />
      {v.layers.map((l, i) => (
        <circle key={i} r={r * l.radius * open} fill={`url(#layer-${i})`} />
      ))}
      {/* the slit that opens it */}
      <rect x={-r * 0.03 * (1 - open)} y={-r * slit} width={r * 0.06 * (1 - open)} height={2 * r * slit} rx={r * 0.03} fill="#ffcf8a" opacity={(1 - open) * 0.95} />
      {v.layers.map((l, i) => {
        const y = cutLabelY(0, r, i, v.layers.length);
        const k = easeOut(clamp((lt - 0.9 - i * 0.3) / 0.35));
        // from a point inside this layer's ring, out to the label column
        const inner = i + 1 < v.layers.length ? v.layers[i + 1].radius : 0;
        const rr = r * (l.radius + inner) / 2;
        const ang = Math.asin(Math.max(-0.95, Math.min(0.95, y / Math.max(rr, 1))));
        const px = Math.cos(ang) * rr;
        const py = Math.sin(ang) * rr;
        return (
          <g key={i} opacity={k}>
            <circle cx={px} cy={py} r={6} fill="#ffe2c4" />
            <polyline points={`${px},${py} ${r + 10},${y} ${r + 30},${y}`} fill="none" stroke="#ffe2c4" strokeWidth={3} />
          </g>
        );
      })}
    </g>
  );
};

/** Axis tilt: orbit line, the upright reference, the real spin axis and the angle between them. */
const Tilt: React.FC<{ v: Extract<PeView, { view: "tilt" }>; r: number; lt: number; accent: string }> = ({ v, r, lt, accent }) => {
  const k = easeOut(clamp((lt - 0.3) / 1.2));
  const deg = v.degrees * k;
  const rad = (deg * Math.PI) / 180;
  const L = r * 1.45;
  const arcR = r * 1.18;
  const large = deg > 180 ? 1 : 0;
  return (
    <g opacity={clamp(lt / 0.4)}>
      <line x1={-r * 1.7} y1={0} x2={r * 1.7} y2={0} stroke="#9fb0e0" strokeWidth={3} strokeDasharray="10 10" opacity={0.7} />
      <line x1={0} y1={-L} x2={0} y2={L} stroke="#9fb0e0" strokeWidth={2} strokeDasharray="4 10" opacity={0.5} />
      <line x1={-Math.sin(rad) * L} y1={Math.cos(rad) * L} x2={Math.sin(rad) * L} y2={-Math.cos(rad) * L} stroke="#ffffff" strokeWidth={5} strokeLinecap="round" />
      <path d={`M 0 ${-arcR} A ${arcR} ${arcR} 0 ${large} 1 ${Math.sin(rad) * arcR} ${-Math.cos(rad) * arcR}`} fill="none" stroke={accent} strokeWidth={6} strokeLinecap="round" />
    </g>
  );
};

const ProbePass: React.FC<{ r: number; lt: number }> = ({ r, lt }) => {
  const k = clamp((lt + 0.6) / 4.5);
  const path = (kk: number) => ({ x: -r * 2.1 + kk * r * 4.2, y: -r * 0.2 - Math.sin(kk * Math.PI) * r * 0.9 });
  const { x, y } = path(k);
  const trail = Array.from({ length: 16 }, (_, i) => path(Math.max(0, k - i * 0.02)));
  return (
    <g opacity={clamp(lt / 0.3)}>
      {trail.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#ffffff" opacity={0.5 - i * 0.04} />
      ))}
      <g transform={`translate(${x} ${y}) rotate(${-20 + k * 40})`}>
        <Probe size={r * 0.32} />
      </g>
    </g>
  );
};

const Clock: React.FC<{ x: number; y: number; size: number; lt: number; accent: string }> = ({ x, y, size, lt, accent }) => {
  const a = lt * 540;
  return (
    <g transform={`translate(${x} ${y})`} opacity={clamp(lt / 0.4)}>
      <circle r={size} fill="#0d1430" stroke="#dfe6ff" strokeWidth={4} />
      <line x1={0} y1={0} x2={0} y2={-size * 0.75} stroke={accent} strokeWidth={6} strokeLinecap="round" transform={`rotate(${a})`} />
      <line x1={0} y1={0} x2={0} y2={-size * 0.5} stroke="#dfe6ff" strokeWidth={5} strokeLinecap="round" transform={`rotate(${a / 12})`} />
      <circle r={5} fill="#dfe6ff" />
    </g>
  );
};

/** Where the cutaway's i-th label sits: spread evenly down the right of the disc. */
function cutLabelY(cy: number, r: number, i: number, n: number): number {
  return cy - r * 0.75 + (n === 1 ? r * 0.75 : (i * r * 1.5) / (n - 1));
}

/** A big bathtub for the float test: back wall behind the planet, water and front wall in front of it. */
const Tub: React.FC<{ r: number; level: number; t: number; part: "back" | "front"; k: number }> = ({ r, level, t, part, k }) => {
  const w = r * 1.75;
  const bottom = r * 1.35;
  const top = level - r * 0.35;
  if (part === "back") {
    return <path d={`M ${-w} ${top} L ${-w * 0.9} ${bottom} Q 0 ${bottom + r * 0.12} ${w * 0.9} ${bottom} L ${w} ${top} Z`} fill="#dfe8f5" opacity={0.18 * k} />;
  }
  const wave = Array.from({ length: 41 }, (_, i) => {
    const x = -w * 0.97 + (i * w * 1.94) / 40;
    return `L ${x.toFixed(1)} ${(level + Math.sin(i * 0.8 + t * 3) * r * 0.025).toFixed(1)}`;
  }).join(" ");
  return (
    <g opacity={k}>
      <path d={`M ${-w * 0.97} ${level} ${wave} L ${w * 0.91} ${bottom} Q 0 ${bottom + r * 0.12} ${-w * 0.91} ${bottom} Z`} fill="#3a9be0" opacity={0.6} />
      <path d={`M ${-w * 0.97} ${level} ${wave}`} fill="none" stroke="#bfe6ff" strokeWidth={4} opacity={0.9} />
      <path d={`M ${-w} ${top} L ${-w * 0.9} ${bottom} Q 0 ${bottom + r * 0.12} ${w * 0.9} ${bottom} L ${w} ${top}`} fill="none" stroke="#f4f7fb" strokeWidth={r * 0.06} strokeLinejoin="round" strokeLinecap="round" />
      <rect x={-w * 0.7} y={bottom + r * 0.04} width={r * 0.12} height={r * 0.22} rx={r * 0.04} fill="#f4f7fb" />
      <rect x={w * 0.58} y={bottom + r * 0.04} width={r * 0.12} height={r * 0.22} rx={r * 0.04} fill="#f4f7fb" />
    </g>
  );
};

