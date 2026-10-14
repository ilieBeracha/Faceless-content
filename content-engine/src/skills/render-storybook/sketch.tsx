/**
 * Hand-drawn primitives for storybook scenes: flat watercolour-ish fills with sketchy rough.js outlines.
 * Every stroke has a fixed seed, so a drawing looks identical on every frame (no line "boil").
 */
import React from "react";
import rough from "roughjs";

const gen = rough.generator();
export const INK = "#3a332d";

export interface StrokeOpts {
  stroke?: string;
  width?: number;
  roughness?: number;
  seed?: number;
  bowing?: number;
}

function toEls(drawable: ReturnType<typeof gen.path>, key: string): React.ReactElement[] {
  return gen.toPaths(drawable).map((p, i) => <path key={`${key}-${i}`} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} fill={p.fill ?? "none"} strokeLinecap="round" strokeLinejoin="round" />);
}

function opts(o: StrokeOpts) {
  return { stroke: o.stroke ?? INK, strokeWidth: o.width ?? 3.2, roughness: o.roughness ?? 0.9, seed: o.seed ?? 7, bowing: o.bowing ?? 0.8, preserveVertices: false };
}

/** A filled SVG path with a sketchy outline on top. */
export const Shape: React.FC<{ d: string; fill?: string; o?: StrokeOpts; opacity?: number; outline?: boolean }> = ({ d, fill, o = {}, opacity = 1, outline = true }) => (
  <g opacity={opacity}>
    {fill && <path d={d} fill={fill} />}
    {outline && toEls(gen.path(d, opts(o)), `s${o.seed ?? 7}`)}
  </g>
);

export const Line: React.FC<{ x1: number; y1: number; x2: number; y2: number; o?: StrokeOpts }> = ({ x1, y1, x2, y2, o = {} }) => <g>{toEls(gen.line(x1, y1, x2, y2, opts(o)), `l${o.seed ?? 7}`)}</g>;

export const Circle: React.FC<{ cx: number; cy: number; r: number; fill?: string; o?: StrokeOpts; outline?: boolean }> = ({ cx, cy, r, fill, o = {}, outline = true }) => (
  <g>
    {fill && <circle cx={cx} cy={cy} r={r} fill={fill} />}
    {outline && toEls(gen.circle(cx, cy, r * 2, opts(o)), `c${o.seed ?? 7}`)}
  </g>
);

export const Ellipse: React.FC<{ cx: number; cy: number; rx: number; ry: number; fill?: string; o?: StrokeOpts; outline?: boolean }> = ({ cx, cy, rx, ry, fill, o = {}, outline = true }) => (
  <g>
    {fill && <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={fill} />}
    {outline && toEls(gen.ellipse(cx, cy, rx * 2, ry * 2, opts(o)), `e${o.seed ?? 7}`)}
  </g>
);

export const Curve: React.FC<{ points: [number, number][]; o?: StrokeOpts }> = ({ points, o = {} }) => <g>{toEls(gen.curve(points, opts(o)), `cv${o.seed ?? 7}`)}</g>;

export function rect(x: number, y: number, w: number, h: number, r = 0): string {
  if (!r) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
  return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
}

/** Soft contact shadow on the ground. */
export const GroundShadow: React.FC<{ cx: number; cy: number; rx: number }> = ({ cx, cy, rx }) => <ellipse cx={cx} cy={cy} rx={rx} ry={rx * 0.16} fill="rgba(60,45,30,0.18)" />;

export function shade(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Deterministic pseudo-random in [0, 1). */
export function rnd(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
