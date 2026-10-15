/**
 * The storybook prop library. Every prop is drawn in scene units (scene = 1000×1000) with sketchy
 * outlines and flat, slightly shaded fills. Ground props anchor at their bottom centre; sky props
 * at their centre.
 */
import React from "react";
import type { StoryProp } from "./schema.ts";
import { Circle, Curve, Ellipse, GroundShadow, INK, Line, rect, rnd, shade, Shape } from "./sketch.tsx";

export const HAND_FONT = "Patrick Hand";

const SKY_Y: Partial<Record<StoryProp["type"], number>> = { satellite: 0.2, sun: 0.17, moon: 0.17, planet: 0.24, globe: 0.24, question: 0.22, thought: 0.2, speech: 0.22, text: 0.24, dots: 0.22, arrow: 0.5, stars: 0.2 };

export function isSkyProp(type: StoryProp["type"]): boolean {
  return type in SKY_Y;
}

const Hand: React.FC<{ x: number; y: number; size: number; text: string; fill?: string; anchor?: "middle" | "start" | "end"; weight?: number; outline?: string }> = ({ x, y, size, text, fill = INK, anchor = "middle", outline }) => (
  <text x={x} y={y} fontFamily={HAND_FONT} fontSize={size} fill={fill} textAnchor={anchor} dominantBaseline="central" stroke={outline} strokeWidth={outline ? size * 0.08 : 0} paintOrder="stroke fill">
    {text}
  </text>
);

/** Small picture used inside thought bubbles and for held items. */
const Icon: React.FC<{ kind: string; x: number; y: number; s: number; seed: number }> = ({ kind, x, y, s, seed }) => {
  switch (kind) {
    case "globe":
      return <Globe x={x} y={y} r={38 * s} seed={seed} />;
    case "phone":
      return <Phone x={x} y={y + 40 * s} s={0.55 * s} seed={seed} />;
    case "satellite":
      return <Satellite x={x} y={y} s={0.5 * s} seed={seed} t={0} />;
    case "clock":
      return <ClockFace x={x} y={y} r={34 * s} seed={seed} />;
    case "sun":
      return <Circle cx={x} cy={y} r={30 * s} fill="#f2c14e" o={{ seed }} />;
    case "moon":
      return <Circle cx={x} cy={y} r={28 * s} fill="#efe3bd" o={{ seed }} />;
    case "planet":
      return (
        <g>
          <Circle cx={x} cy={y} r={30 * s} fill="#c98a5a" o={{ seed }} />
          <Ellipse cx={x} cy={y} rx={50 * s} ry={11 * s} o={{ seed: seed + 1, width: 2.5 }} />
        </g>
      );
    case "cards":
      return <CardFan x={x} y={y + 30 * s} s={0.6 * s} seed={seed} />;
    case "coins":
      return <CoinStack x={x} y={y + 26 * s} n={5} s={0.8 * s} seed={seed} />;
    case "drop":
      return <Drop x={x} y={y + 28 * s} s={0.7 * s} seed={seed} />;
    case "money":
      return <Shape d={rect(x - 40 * s, y - 18 * s, 80 * s, 36 * s, 4)} fill="#9fb98a" o={{ seed }} />;
    case "heart":
      return <Shape d={`M${x} ${y + 24 * s} C${x - 50 * s} ${y - 10 * s} ${x - 20 * s} ${y - 40 * s} ${x} ${y - 14 * s} C${x + 20 * s} ${y - 40 * s} ${x + 50 * s} ${y - 10 * s} ${x} ${y + 24 * s} Z`} fill="#d9695a" o={{ seed }} />;
    default:
      return <Hand x={x} y={y} size={70 * s} text="?" />;
  }
};

const Globe: React.FC<{ x: number; y: number; r: number; seed: number }> = ({ x, y, r, seed }) => {
  const id = `g${seed}${Math.round(x)}${Math.round(y)}`;
  const blob = (cx: number, cy: number, w: number, h: number) => `M${x + cx * r - w * r} ${y + cy * r} C${x + cx * r - w * r} ${y + cy * r - h * r} ${x + cx * r + w * r * 0.6} ${y + cy * r - h * r * 1.2} ${x + cx * r + w * r} ${y + cy * r - h * r * 0.2} C${x + cx * r + w * r * 1.2} ${y + cy * r + h * r} ${x + cx * r - w * r * 0.4} ${y + cy * r + h * r * 1.1} ${x + cx * r - w * r} ${y + cy * r} Z`;
  return (
    <g>
      <defs>
        <clipPath id={id}>
          <circle cx={x} cy={y} r={r} />
        </clipPath>
        <radialGradient id={`${id}s`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.28" />
        </radialGradient>
      </defs>
      <circle cx={x} cy={y} r={r} fill="#47708f" />
      <g clipPath={`url(#${id})`}>
        <path d={blob(-0.35, -0.25, 0.32, 0.4)} fill="#7f9a62" />
        <path d={blob(0.25, 0.05, 0.26, 0.55)} fill="#a99a6a" />
        <path d={blob(0.38, -0.45, 0.22, 0.22)} fill="#7f9a62" />
        <path d={blob(-0.2, 0.55, 0.25, 0.2)} fill="#8ea56d" />
      </g>
      <circle cx={x} cy={y} r={r} fill={`url(#${id}s)`} />
      <Circle cx={x} cy={y} r={r} o={{ seed, width: 3.2 }} />
    </g>
  );
};

const ClockFace: React.FC<{ x: number; y: number; r: number; seed: number; text?: string; t?: number }> = ({ x, y, r, seed, text, t = 0 }) => (
  <g>
    <Shape d={rect(x - r * 0.18, y - r * 1.32, r * 0.36, r * 0.28, 3)} fill="#c9c2b5" o={{ seed: seed + 3 }} />
    <Circle cx={x} cy={y} r={r * 1.08} fill="#c9c2b5" o={{ seed: seed + 1 }} />
    <Circle cx={x} cy={y} r={r * 0.92} fill="#f7f2e6" o={{ seed: seed + 2, width: 2.4 }} />
    {Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return <line key={i} x1={x + Math.sin(a) * r * 0.78} y1={y - Math.cos(a) * r * 0.78} x2={x + Math.sin(a) * r * 0.86} y2={y - Math.cos(a) * r * 0.86} stroke={INK} strokeWidth={2.5} strokeLinecap="round" />;
    })}
    {text ? (
      <Hand x={x} y={y + r * 0.02} size={r * (text.length > 3 ? 0.55 : 0.9)} text={text} />
    ) : (
      <g>
        <Line x1={x} y1={y} x2={x + Math.sin(t * 0.8) * r * 0.45} y2={y - Math.cos(t * 0.8) * r * 0.45} o={{ seed: seed + 4, width: 4 }} />
        <Line x1={x} y1={y} x2={x + Math.sin(t * 6) * r * 0.7} y2={y - Math.cos(t * 6) * r * 0.7} o={{ seed: seed + 5, width: 2.6 }} />
      </g>
    )}
  </g>
);

const CardFan: React.FC<{ x: number; y: number; s: number; seed: number }> = ({ x, y, s, seed }) => (
  <g>
    {[-24, -12, 0, 12, 24].map((deg, i) => (
      <g key={i} transform={`rotate(${deg} ${x} ${y})`}>
        <Shape d={rect(x - 32 * s, y - 100 * s, 64 * s, 92 * s, 7 * s)} fill="#fbf7ee" o={{ seed: seed + i, width: 2.4 }} />
        <text x={x - 20 * s} y={y - 78 * s} fontSize={20 * s} fontFamily={HAND_FONT} fill={i % 2 ? "#b8443a" : INK}>
          {["A", "7", "Q", "3", "K"][i]}
        </text>
        <text x={x} y={y - 46 * s} fontSize={30 * s} textAnchor="middle" fill={i % 2 ? "#b8443a" : INK}>
          {["♠", "♥", "♣", "♦", "♠"][i]}
        </text>
      </g>
    ))}
  </g>
);

const CoinStack: React.FC<{ x: number; y: number; n: number; s: number; seed: number }> = ({ x, y, n, s, seed }) => (
  <g>
    {Array.from({ length: n }, (_, i) => (
      <Ellipse key={i} cx={x} cy={y - i * 9 * s} rx={30 * s} ry={9 * s} fill={i % 2 ? "#e0b84f" : "#d4a63f"} o={{ seed: seed + i, width: 2 }} />
    ))}
  </g>
);

const Drop: React.FC<{ x: number; y: number; s: number; seed: number }> = ({ x, y, s, seed }) => (
  <Shape d={`M${x} ${y - 80 * s} C${x + 12 * s} ${y - 52 * s} ${x + 40 * s} ${y - 32 * s} ${x + 40 * s} ${y - 6 * s} A${40 * s} ${40 * s} 0 0 1 ${x - 40 * s} ${y - 6 * s} C${x - 40 * s} ${y - 32 * s} ${x - 12 * s} ${y - 52 * s} ${x} ${y - 80 * s} Z`} fill="#6f9fc0" o={{ seed }} />
);

/** Something held in a character's hand. */
export const HeldProp: React.FC<{ type: string; x: number; y: number; scale: number; text?: string; seed: number }> = ({ type, x, y, scale: s, text, seed }) => {
  if (type === "sign" || type === "paper" || type === "book") {
    const w = (type === "book" ? 90 : 110) * s;
    const h = (type === "book" ? 120 : 140) * s;
    return (
      <g>
        <Shape d={rect(x - w / 2, y - h * 0.75, w, h, 4)} fill={type === "book" ? "#a8553e" : "#f6f0e1"} o={{ seed: seed + 91 }} />
        {text && <Hand x={x} y={y - h * 0.25} size={Math.min(38, (w * 1.6) / Math.max(3, text.length)) * (s > 1 ? 1 : 1)} text={text} fill={type === "book" ? "#f6f0e1" : INK} />}
      </g>
    );
  }
  if (type === "candle") return <Candle x={x} y={y + 40 * s} s={0.7 * s} seed={seed} t={0} />;
  return <Icon kind={type} x={x} y={y - 10 * s} s={0.75 * s} seed={seed + 92} />;
};

const Candle: React.FC<{ x: number; y: number; s: number; seed: number; t: number }> = ({ x, y, s, seed, t }) => (
  <g>
    <Shape d={rect(x - 14 * s, y - 90 * s, 28 * s, 90 * s, 3)} fill="#f3ead2" o={{ seed }} />
    <Shape d={`M${x} ${y - 132 * s - Math.sin(t * 12) * 3} C${x + 12 * s} ${y - 112 * s} ${x + 10 * s} ${y - 96 * s} ${x} ${y - 94 * s} C${x - 10 * s} ${y - 96 * s} ${x - 12 * s} ${y - 112 * s} ${x} ${y - 132 * s - Math.sin(t * 12) * 3} Z`} fill="#f2b14e" o={{ seed: seed + 1, width: 2 }} />
  </g>
);

const Phone: React.FC<{ x: number; y: number; s: number; seed: number; text?: string }> = ({ x, y, s, seed, text }) => (
  <g>
    <Shape d={rect(x - 60 * s, y - 220 * s, 120 * s, 220 * s, 18 * s)} fill="#2f3340" o={{ seed }} />
    <rect x={x - 50 * s} y={y - 202 * s} width={100 * s} height={180 * s} rx={6 * s} fill="#cfe3d2" />
    <path d={`M${x - 50 * s} ${y - 150 * s} L${x + 50 * s} ${y - 120 * s} M${x - 20 * s} ${y - 202 * s} L${x + 10 * s} ${y - 22 * s}`} stroke="#f7f1e3" strokeWidth={8 * s} />
    <path d={`M${x} ${y - 95 * s} C${x - 22 * s} ${y - 120 * s} ${x - 22 * s} ${y - 150 * s} ${x} ${y - 150 * s} C${x + 22 * s} ${y - 150 * s} ${x + 22 * s} ${y - 120 * s} ${x} ${y - 95 * s} Z`} fill="#c2553a" />
    <circle cx={x} cy={y - 135 * s} r={7 * s} fill="#f7f1e3" />
    {text && <Hand x={x} y={y - 45 * s} size={Math.min(26 * s, (180 * s) / Math.max(2, text.length))} text={text} />}
  </g>
);

const Satellite: React.FC<{ x: number; y: number; s: number; seed: number; t: number }> = ({ x, y, s, seed, t }) => (
  <g transform={`rotate(${-12 + Math.sin(t * 0.6) * 4} ${x} ${y})`}>
    {[-1, 1].map((side) => (
      <g key={side}>
        <line x1={x + side * 45 * s} y1={y} x2={x + side * 70 * s} y2={y} stroke={INK} strokeWidth={4 * s} />
        <Shape d={rect(side < 0 ? x - 190 * s : x + 70 * s, y - 32 * s, 120 * s, 64 * s, 3)} fill="#3d5a8a" o={{ seed: seed + side + 2 }} />
        {[1, 2].map((k) => (
          <line key={k} x1={(side < 0 ? x - 190 * s : x + 70 * s) + k * 40 * s} y1={y - 32 * s} x2={(side < 0 ? x - 190 * s : x + 70 * s) + k * 40 * s} y2={y + 32 * s} stroke="#8fb7cf" strokeWidth={2.5 * s} />
        ))}
      </g>
    ))}
    <Shape d={rect(x - 45 * s, y - 45 * s, 90 * s, 90 * s, 6)} fill="#d9b97e" o={{ seed: seed + 5 }} />
    <Curve points={[[x - 26 * s, y + 70 * s], [x, y + 52 * s], [x + 26 * s, y + 70 * s]]} o={{ seed: seed + 6, width: 3 }} />
    <line x1={x} y1={y + 45 * s} x2={x} y2={y + 60 * s} stroke={INK} strokeWidth={4 * s} />
  </g>
);

/** Draw one scene prop. */
export const PropView: React.FC<{ p: StoryProp; groundY: number; seed: number; t: number; accent: string }> = ({ p, groundY, seed, t, accent }) => {
  const s = p.scale;
  const x0 = p.x * 1000;
  const x = x0;
  const y = p.y !== undefined ? p.y * 1000 : (SKY_Y[p.type] ?? -1) >= 0 ? SKY_Y[p.type]! * 1000 : groundY;
  const o = (n: number, extra: object = {}) => ({ seed: seed * 13 + n, ...extra });
  const c = p.color;
  switch (p.type) {
    case "sign": {
      const text = p.text ?? "";
      const w = Math.max(150, text.length * 34 + 60) * s;
      const h = 110 * s;
      // Long boards are kept inside the picture (with room for the slow camera moves).
      const x = Math.min(Math.max(x0, w / 2 + 50), 1000 - w / 2 - 50);
      return (
        <g>
          <GroundShadow cx={x} cy={y + 2} rx={40 * s} />
          <Shape d={rect(x - 9 * s, y - 250 * s, 18 * s, 250 * s, 2)} fill="#8a6a46" o={o(1)} />
          <Shape d={rect(x - w / 2, y - 260 * s, w, h, 6)} fill={c ?? "#c9a777"} o={o(2)} />
          <path d={`M${x - w / 2 + 10} ${y - 230 * s}H${x + w / 2 - 14}M${x - w / 2 + 18} ${y - 178 * s}H${x + w / 2 - 22}`} stroke={shade(c ?? "#c9a777", -0.18)} strokeWidth={2} opacity={0.6} />
          <Hand x={x} y={y - 205 * s} size={Math.min(70, (w * 1.5) / Math.max(2, text.length)) } text={text} />
        </g>
      );
    }
    case "pile": {
      const w = 140 * s;
      return (
        <g>
          <GroundShadow cx={x} cy={y + 2} rx={w * 1.05} />
          <Shape d={`M${x - w} ${y} C${x - w * 0.8} ${y - 70 * s} ${x - w * 0.3} ${y - 118 * s} ${x} ${y - 120 * s} C${x + w * 0.35} ${y - 118 * s} ${x + w * 0.8} ${y - 70 * s} ${x + w} ${y} Z`} fill={c ?? "#e6dcc0"} o={o(3)} />
          {Array.from({ length: 70 }, (_, i) => {
            const u = rnd(seed + i) * 2 - 1;
            const v = rnd(seed + i * 3.3);
            const top = 120 * s * (1 - u * u) * 0.95;
            return <ellipse key={i} cx={x + u * w * 0.92} cy={y - v * top} rx={3.4 * s} ry={2.2 * s} fill={shade(c ?? "#e6dcc0", -0.22 - rnd(i) * 0.15)} transform={`rotate(${rnd(i * 7) * 180} ${x + u * w * 0.92} ${y - v * top})`} />;
          })}
        </g>
      );
    }
    case "globe":
      return (
        <g>
          <circle cx={x} cy={y} r={128 * s} fill="#fff8e6" opacity={0.35} />
          <Globe x={x} y={y} r={110 * s} seed={seed} />
        </g>
      );
    case "sun":
      return (
        <g>
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2 + t * 0.15;
            return <Line key={i} x1={x + Math.cos(a) * 82 * s} y1={y + Math.sin(a) * 82 * s} x2={x + Math.cos(a) * 112 * s} y2={y + Math.sin(a) * 112 * s} o={o(10 + i, { stroke: "#c98f2e", width: 3 })} />;
          })}
          <Circle cx={x} cy={y} r={66 * s} fill={c ?? "#f2c14e"} o={o(4, { stroke: "#b07a22" })} />
        </g>
      );
    case "moon":
      return (
        <g>
          <circle cx={x} cy={y} r={60 * s} fill={c ?? "#efe3bd"} />
          <circle cx={x + 26 * s} cy={y - 12 * s} r={52 * s} fill="rgba(31,42,68,0.9)" />
          <Circle cx={x} cy={y} r={60 * s} o={o(5, { width: 2 })} />
        </g>
      );
    case "stars": {
      const n = p.count ?? 24;
      return (
        <g>
          {Array.from({ length: n }, (_, i) => {
            const sx = rnd(seed + i * 1.7) * 1000;
            const sy = rnd(seed + i * 2.9) * (groundY - 220);
            const r = (3 + rnd(i * 5.1) * 5) * s;
            const tw = 0.55 + 0.45 * Math.sin(t * 2 + i);
            return <path key={i} d={`M${sx} ${sy - r * 2}Q${sx} ${sy} ${sx + r * 2} ${sy}Q${sx} ${sy} ${sx} ${sy + r * 2}Q${sx} ${sy} ${sx - r * 2} ${sy}Q${sx} ${sy} ${sx} ${sy - r * 2}Z`} fill="#f4ecd0" opacity={tw} />;
          })}
        </g>
      );
    }
    case "planet": {
      const col = c ?? "#c98a5a";
      return (
        <g>
          <Circle cx={x} cy={y} r={90 * s} fill={col} o={o(6)} />
          {[-0.4, -0.1, 0.25].map((b, i) => (
            <path key={i} d={`M${x - 86 * s} ${y + b * 90 * s} Q${x} ${y + b * 90 * s + 14 * s} ${x + 86 * s} ${y + b * 90 * s}`} stroke={shade(col, -0.25)} strokeWidth={9 * s} fill="none" opacity={0.55} />
          ))}
          <Ellipse cx={x} cy={y + 8 * s} rx={150 * s} ry={30 * s} o={o(7, { width: 3.5, stroke: shade(col, -0.45) })} />
        </g>
      );
    }
    case "clock":
      return (
        <g>
          {p.y === undefined && <GroundShadow cx={x} cy={y + 2} rx={70 * s} />}
          <ClockFace x={x} y={p.y === undefined ? y - 92 * s : y} r={80 * s} seed={seed} text={p.text} t={t} />
        </g>
      );
    case "calendar": {
      const w = 190 * s;
      const h = 210 * s;
      const top = p.y === undefined ? y - h : y - h / 2;
      return (
        <g>
          <Shape d={rect(x - w / 2, top, w, h, 8)} fill="#f7f1e3" o={o(8)} />
          <Shape d={rect(x - w / 2, top, w, h * 0.24, 8)} fill={c ?? "#c2553a"} o={o(9)} />
          {[-0.28, 0, 0.28].map((dx, i) => (
            <circle key={i} cx={x + dx * w} cy={top + 6} r={6 * s} fill={INK} />
          ))}
          <Hand x={x} y={top + h * 0.62} size={Math.min(64 * s, (w * 1.7) / Math.max(2, (p.text ?? "").length))} text={p.text ?? ""} />
        </g>
      );
    }
    case "jars": {
      const n = Math.min(p.count ?? 6, 40);
      const perRow = Math.min(n, 12);
      const rows = Math.ceil(n / perRow);
      const w = 52 * s;
      const total = perRow * w * 1.1;
      return (
        <g>
          <GroundShadow cx={x} cy={y + 2} rx={total * 0.55} />
          {Array.from({ length: n }, (_, i) => {
            const row = Math.floor(i / perRow);
            const col = i % perRow;
            const jx = x - total / 2 + col * w * 1.1 + w / 2;
            const jy = y - row * 74 * s;
            return (
              <g key={i}>
                <Shape d={rect(jx - w / 2, jy - 70 * s, w, 70 * s, 10 * s)} fill="rgba(210,228,236,0.55)" o={o(20 + i, { width: 2 })} />
                <rect x={jx - w / 2 + 4} y={jy - 70 * s * (0.3 + rnd(i) * 0.5)} width={w - 8} height={70 * s * (0.3 + rnd(i) * 0.5) - 4} rx={6 * s} fill={c ?? "#6f9fc0"} opacity={0.75} />
                <Shape d={rect(jx - w / 2 - 2, jy - 80 * s, w + 4, 12 * s, 3)} fill="#8a6a46" o={o(60 + i, { width: 1.8 })} />
              </g>
            );
          })}
          {rows > 1 && null}
        </g>
      );
    }
    case "cards":
      return (
        <g>
          {p.y === undefined && <GroundShadow cx={x} cy={y + 2} rx={60 * s} />}
          <CardFan x={x} y={y} s={s} seed={seed} />
        </g>
      );
    case "coins": {
      const stacks = Math.max(1, Math.min(6, Math.ceil((p.count ?? 10) / 8)));
      return (
        <g>
          <GroundShadow cx={x} cy={y + 2} rx={(stacks * 34 + 20) * s} />
          {Array.from({ length: stacks }, (_, i) => (
            <CoinStack key={i} x={x + (i - (stacks - 1) / 2) * 64 * s} y={y - 9 * s} n={4 + Math.round(rnd(seed + i) * 8)} s={s} seed={seed + i * 20} />
          ))}
        </g>
      );
    }
    case "money":
      return (
        <g>
          <GroundShadow cx={x} cy={y + 2} rx={90 * s} />
          {Array.from({ length: 6 }, (_, i) => (
            <Shape key={i} d={rect(x - 80 * s + rnd(seed + i) * 6, y - (i + 1) * 13 * s, 160 * s, 13 * s, 2)} fill={i % 2 ? "#9fb98a" : "#8daa77"} o={o(30 + i, { width: 1.8 })} />
          ))}
        </g>
      );
    case "book":
      return (
        <g>
          <GroundShadow cx={x} cy={y + 2} rx={70 * s} />
          <Shape d={rect(x - 70 * s, y - 34 * s, 140 * s, 34 * s, 4)} fill={c ?? "#a8553e"} o={o(31)} />
          <rect x={x - 64 * s} y={y - 28 * s} width={128 * s} height={8 * s} fill="#f6f0e1" />
        </g>
      );
    case "paper":
      return (
        <g>
          <Shape d={`M${x - 70 * s} ${y} L${x + 60 * s} ${y - 6 * s} L${x + 80 * s} ${y - 40 * s} L${x - 50 * s} ${y - 34 * s} Z`} fill="#f7f1e3" o={o(32)} />
          {p.text && <Hand x={x + 4 * s} y={y - 20 * s} size={22 * s} text={p.text} />}
        </g>
      );
    case "tree":
      return (
        <g>
          <GroundShadow cx={x} cy={y + 2} rx={90 * s} />
          <Shape d={rect(x - 14 * s, y - 150 * s, 28 * s, 150 * s, 4)} fill="#7a5a3c" o={o(33)} />
          <Shape d={`M${x - 100 * s} ${y - 170 * s} C${x - 130 * s} ${y - 260 * s} ${x - 40 * s} ${y - 330 * s} ${x + 10 * s} ${y - 300 * s} C${x + 80 * s} ${y - 340 * s} ${x + 150 * s} ${y - 240 * s} ${x + 100 * s} ${y - 170 * s} C${x + 60 * s} ${y - 120 * s} ${x - 60 * s} ${y - 120 * s} ${x - 100 * s} ${y - 170 * s} Z`} fill={c ?? "#7f9a62"} o={o(34)} />
        </g>
      );
    case "palm":
      return (
        <g>
          <Curve points={[[x, y], [x + 20 * s, y - 150 * s], [x + 50 * s, y - 280 * s]]} o={o(35, { width: 14 * s, stroke: "#7a5a3c" })} />
          {[-150, -110, -60, -20, 20].map((deg, i) => {
            const a = (deg * Math.PI) / 180;
            const tipX = x + 50 * s + Math.cos(a) * 140 * s;
            const tipY = y - 280 * s + Math.sin(a) * 70 * s + 40 * s;
            return <Shape key={i} d={`M${x + 50 * s} ${y - 280 * s} Q${(x + 50 * s + tipX) / 2} ${y - 330 * s} ${tipX} ${tipY} Q${(x + 50 * s + tipX) / 2} ${y - 290 * s} ${x + 50 * s} ${y - 280 * s} Z`} fill={c ?? "#6f845a"} o={o(36 + i, { width: 2.4 })} />;
          })}
        </g>
      );
    case "bush":
      return <Shape d={`M${x - 80 * s} ${y} C${x - 100 * s} ${y - 60 * s} ${x - 40 * s} ${y - 90 * s} ${x} ${y - 70 * s} C${x + 40 * s} ${y - 95 * s} ${x + 100 * s} ${y - 60 * s} ${x + 80 * s} ${y} Z`} fill={c ?? "#7f9a62"} o={o(41)} />;
    case "mountain":
      return (
        <g>
          <Shape d={`M${x - 260 * s} ${y} L${x} ${y - 330 * s} L${x + 260 * s} ${y} Z`} fill={c ?? "#8d9a8a"} o={o(42)} />
          <Shape d={`M${x - 70 * s} ${y - 241 * s} L${x} ${y - 330 * s} L${x + 70 * s} ${y - 241 * s} L${x + 30 * s} ${y - 255 * s} L${x} ${y - 235 * s} L${x - 30 * s} ${y - 255 * s} Z`} fill="#f4f0e4" o={o(43, { width: 2 })} />
        </g>
      );
    case "house":
      return (
        <g>
          <GroundShadow cx={x} cy={y + 2} rx={120 * s} />
          <Shape d={rect(x - 100 * s, y - 150 * s, 200 * s, 150 * s)} fill={c ?? "#e8d6b3"} o={o(44)} />
          <Shape d={`M${x - 125 * s} ${y - 145 * s} L${x} ${y - 250 * s} L${x + 125 * s} ${y - 145 * s} Z`} fill="#b8604a" o={o(45)} />
          <Shape d={rect(x - 25 * s, y - 80 * s, 50 * s, 80 * s, 3)} fill="#8a6a46" o={o(46)} />
          <Shape d={rect(x + 40 * s, y - 120 * s, 40 * s, 40 * s)} fill="#cfe0e8" o={o(47, { width: 2 })} />
        </g>
      );
    case "footprints": {
      const x2 = (p.x2 ?? p.x) * 1000;
      const y2 = p.y2 !== undefined ? p.y2 * 1000 : y;
      const n = p.count ?? 9;
      return (
        <g>
          {Array.from({ length: n }, (_, i) => {
            const k = i / Math.max(1, n - 1);
            const fx = x + (x2 - x) * k + (i % 2 ? 8 : -8) * s;
            const fy = y + (y2 - y) * k + (i % 2 ? 6 : -6) * s;
            const sc = s * (0.6 + 0.4 * (1 - Math.abs(y2 - y) / 1000) * (y2 < y ? 1 - k * 0.5 : 1));
            return <ellipse key={i} cx={fx} cy={fy} rx={10 * sc} ry={5 * sc} fill="rgba(70,55,40,0.45)" />;
          })}
        </g>
      );
    }
    case "arrow": {
      const x2 = (p.x2 ?? p.x + 0.2) * 1000;
      const y2 = (p.y2 ?? p.y ?? 0.45) * 1000;
      const mx = (x + x2) / 2;
      const my = Math.min(y, y2) - 60 * s;
      const ang = Math.atan2(y2 - my, x2 - mx);
      const head = 22 * s;
      return (
        <g>
          <Curve points={[[x, y], [mx, my], [x2, y2]]} o={o(48, { width: 4, stroke: c ?? accent })} />
          <Line x1={x2} y1={y2} x2={x2 - Math.cos(ang - 0.5) * head} y2={y2 - Math.sin(ang - 0.5) * head} o={o(49, { width: 4, stroke: c ?? accent })} />
          <Line x1={x2} y1={y2} x2={x2 - Math.cos(ang + 0.5) * head} y2={y2 - Math.sin(ang + 0.5) * head} o={o(50, { width: 4, stroke: c ?? accent })} />
          {p.text && <Hand x={mx} y={my - 26 * s} size={40 * s} text={p.text} fill={c ?? accent} />}
        </g>
      );
    }
    case "question":
      return <Hand x={x} y={y} size={150 * s} text="?" fill={c ?? INK} outline="#f6f0e1" />;
    case "thought": {
      const w = 170 * s;
      const h = 120 * s;
      const cloud = `M${x - w * 0.5} ${y + h * 0.1} C${x - w * 0.7} ${y - h * 0.4} ${x - w * 0.2} ${y - h * 0.7} ${x} ${y - h * 0.45} C${x + w * 0.2} ${y - h * 0.75} ${x + w * 0.75} ${y - h * 0.4} ${x + w * 0.52} ${y + h * 0.05} C${x + w * 0.75} ${y + h * 0.5} ${x + w * 0.1} ${y + h * 0.7} ${x} ${y + h * 0.45} C${x - w * 0.2} ${y + h * 0.75} ${x - w * 0.75} ${y + h * 0.55} ${x - w * 0.5} ${y + h * 0.1} Z`;
      return (
        <g>
          <Shape d={cloud} fill="#fbf7ee" o={o(51)} />
          <Circle cx={x - w * 0.42} cy={y + h * 0.78} r={13 * s} fill="#fbf7ee" o={o(52, { width: 2 })} />
          <Circle cx={x - w * 0.56} cy={y + h * 1.05} r={8 * s} fill="#fbf7ee" o={o(53, { width: 2 })} />
          {p.content ? <Icon kind={p.content} x={x} y={y} s={1.15 * s} seed={seed} /> : <Hand x={x} y={y} size={Math.min(54 * s, (w * 1.5) / Math.max(2, (p.text ?? "?").length))} text={p.text ?? "?"} />}
        </g>
      );
    }
    case "speech": {
      const text = p.text ?? "";
      const w = Math.max(160, text.length * 26 + 50) * s;
      const h = 100 * s;
      return (
        <g>
          <Shape d={`${rect(x - w / 2, y - h / 2, w, h, 40 * s)} M${x - w * 0.15} ${y + h / 2 - 2} L${x - w * 0.3} ${y + h / 2 + 40 * s} L${x} ${y + h / 2 - 2}`} fill="#fbf7ee" o={o(54)} />
          <Hand x={x} y={y} size={Math.min(52 * s, (w * 1.7) / Math.max(2, text.length))} text={text} />
        </g>
      );
    }
    case "text":
      return <Hand x={x} y={y} size={86 * s} text={p.text ?? ""} fill={c ?? INK} outline="#f6f0e1" />;
    case "dots": {
      const n = Math.min(p.count ?? 100, 400);
      const cols = Math.ceil(Math.sqrt(n * 1.6));
      const gap = 16 * s;
      const w = cols * gap;
      return (
        <g>
          {Array.from({ length: n }, (_, i) => (
            <circle key={i} cx={x - w / 2 + (i % cols) * gap + (rnd(seed + i) - 0.5) * 3} cy={y - (Math.floor(n / cols) * gap) / 2 + Math.floor(i / cols) * gap + (rnd(i * 3) - 0.5) * 3} r={4.2 * s} fill={c ?? INK} opacity={0.8} />
          ))}
        </g>
      );
    }
    case "drop":
      return <Drop x={x} y={y} s={s} seed={seed} />;
    case "bucket":
      return (
        <g>
          <GroundShadow cx={x} cy={y + 2} rx={60 * s} />
          <Shape d={`M${x - 55 * s} ${y - 110 * s} L${x + 55 * s} ${y - 110 * s} L${x + 42 * s} ${y} L${x - 42 * s} ${y} Z`} fill={c ?? "#9aa7ad"} o={o(55)} />
          <Ellipse cx={x} cy={y - 110 * s} rx={55 * s} ry={12 * s} fill="#6f9fc0" o={o(56, { width: 2 })} />
          <Curve points={[[x - 55 * s, y - 110 * s], [x, y - 175 * s], [x + 55 * s, y - 110 * s]]} o={o(57, { width: 2.4 })} />
        </g>
      );
    case "rocket":
      return (
        <g>
          <Shape d={`M${x} ${y - 260 * s} C${x + 45 * s} ${y - 210 * s} ${x + 48 * s} ${y - 120 * s} ${x + 40 * s} ${y - 50 * s} L${x - 40 * s} ${y - 50 * s} C${x - 48 * s} ${y - 120 * s} ${x - 45 * s} ${y - 210 * s} ${x} ${y - 260 * s} Z`} fill={c ?? "#efe8da"} o={o(58)} />
          <Shape d={`M${x - 40 * s} ${y - 100 * s} L${x - 75 * s} ${y - 30 * s} L${x - 38 * s} ${y - 50 * s} Z M${x + 40 * s} ${y - 100 * s} L${x + 75 * s} ${y - 30 * s} L${x + 38 * s} ${y - 50 * s} Z`} fill="#c2553a" o={o(59)} />
          <Circle cx={x} cy={y - 170 * s} r={18 * s} fill="#8fb7cf" o={o(60, { width: 2 })} />
          <Shape d={`M${x - 24 * s} ${y - 50 * s} Q${x} ${y + 20 * s + Math.sin(t * 20) * 8} ${x + 24 * s} ${y - 50 * s} Z`} fill="#f2b14e" o={o(61, { width: 1.6 })} />
        </g>
      );
    case "car":
      return (
        <g>
          <GroundShadow cx={x} cy={y + 2} rx={120 * s} />
          <Shape d={`M${x - 120 * s} ${y - 30 * s} L${x - 115 * s} ${y - 70 * s} L${x - 60 * s} ${y - 80 * s} L${x - 30 * s} ${y - 125 * s} L${x + 50 * s} ${y - 125 * s} L${x + 85 * s} ${y - 80 * s} L${x + 120 * s} ${y - 70 * s} L${x + 120 * s} ${y - 30 * s} Z`} fill={c ?? "#c2553a"} o={o(62)} />
          <Shape d={`M${x - 20 * s} ${y - 115 * s} L${x + 44 * s} ${y - 115 * s} L${x + 68 * s} ${y - 82 * s} L${x - 45 * s} ${y - 82 * s} Z`} fill="#cfe0e8" o={o(63, { width: 2 })} />
          <Circle cx={x - 70 * s} cy={y - 26 * s} r={26 * s} fill="#3a332d" o={o(64)} />
          <Circle cx={x + 70 * s} cy={y - 26 * s} r={26 * s} fill="#3a332d" o={o(65)} />
        </g>
      );
    case "table":
      return (
        <g>
          <GroundShadow cx={x} cy={y + 2} rx={150 * s} />
          <Shape d={rect(x - 150 * s, y - 130 * s, 300 * s, 22 * s, 4)} fill={c ?? "#8a6a46"} o={o(66)} />
          <Shape d={rect(x - 135 * s, y - 108 * s, 16 * s, 108 * s)} fill={shade(c ?? "#8a6a46", -0.15)} o={o(67)} />
          <Shape d={rect(x + 119 * s, y - 108 * s, 16 * s, 108 * s)} fill={shade(c ?? "#8a6a46", -0.15)} o={o(68)} />
        </g>
      );
    case "sack":
      return (
        <g>
          <GroundShadow cx={x} cy={y + 2} rx={70 * s} />
          <Shape d={`M${x - 70 * s} ${y} C${x - 90 * s} ${y - 80 * s} ${x - 50 * s} ${y - 140 * s} ${x - 20 * s} ${y - 150 * s} L${x - 35 * s} ${y - 180 * s} L${x + 35 * s} ${y - 180 * s} L${x + 20 * s} ${y - 150 * s} C${x + 50 * s} ${y - 140 * s} ${x + 90 * s} ${y - 80 * s} ${x + 70 * s} ${y} Z`} fill={c ?? "#b89d72"} o={o(69)} />
          <Line x1={x - 26 * s} y1={y - 150 * s} x2={x + 26 * s} y2={y - 150 * s} o={o(70, { width: 4 })} />
        </g>
      );
    case "box":
      return (
        <g>
          <GroundShadow cx={x} cy={y + 2} rx={90 * s} />
          <Shape d={rect(x - 80 * s, y - 120 * s, 160 * s, 120 * s)} fill={c ?? "#c9a777"} o={o(71)} />
          <Line x1={x - 80 * s} y1={y - 90 * s} x2={x + 80 * s} y2={y - 90 * s} o={o(72, { width: 2 })} />
          {p.text && <Hand x={x} y={y - 45 * s} size={34 * s} text={p.text} />}
        </g>
      );
    case "hourglass":
      return (
        <g>
          <GroundShadow cx={x} cy={y + 2} rx={60 * s} />
          <Shape d={rect(x - 55 * s, y - 16 * s, 110 * s, 16 * s, 3)} fill="#8a6a46" o={o(73)} />
          <Shape d={rect(x - 55 * s, y - 196 * s, 110 * s, 16 * s, 3)} fill="#8a6a46" o={o(74)} />
          <Shape d={`M${x - 42 * s} ${y - 180 * s} L${x + 42 * s} ${y - 180 * s} L${x + 6 * s} ${y - 100 * s} L${x + 42 * s} ${y - 16 * s} L${x - 42 * s} ${y - 16 * s} L${x - 6 * s} ${y - 100 * s} Z`} fill="rgba(210,228,236,0.6)" o={o(75, { width: 2.2 })} />
          <path d={`M${x - 30 * s} ${y - 16 * s} L${x} ${y - 52 * s} L${x + 30 * s} ${y - 16 * s} Z M${x - 20 * s} ${y - 150 * s} L${x + 20 * s} ${y - 150 * s} L${x} ${y - 112 * s} Z`} fill="#d9b97e" />
        </g>
      );
    case "satellite":
      return <Satellite x={x} y={y} s={s} seed={seed} t={t} />;
    case "phone":
      return (
        <g>
          {p.y === undefined && <GroundShadow cx={x} cy={y + 2} rx={70 * s} />}
          <Phone x={x} y={y} s={s * 1.2} seed={seed} text={p.text} />
        </g>
      );
    case "dish":
      return (
        <g>
          <GroundShadow cx={x} cy={y + 2} rx={110 * s} />
          <Shape d={`M${x - 40 * s} ${y} L${x} ${y - 120 * s} L${x + 40 * s} ${y} Z`} fill="#b9b2a4" o={o(80)} />
          <g transform={`rotate(-28 ${x} ${y - 150 * s})`}>
            <Shape d={`M${x - 130 * s} ${y - 190 * s} Q${x} ${y - 60 * s} ${x + 130 * s} ${y - 190 * s} Z`} fill="#efe8da" o={o(81)} />
            <line x1={x} y1={y - 120 * s} x2={x} y2={y - 250 * s} stroke={INK} strokeWidth={5 * s} />
            <circle cx={x} cy={y - 255 * s} r={9 * s} fill={c ?? "#c2553a"} />
          </g>
        </g>
      );
    case "telescope":
      return (
        <g>
          <GroundShadow cx={x} cy={y + 2} rx={80 * s} />
          <Line x1={x} y1={y - 120 * s} x2={x - 60 * s} y2={y} o={o(82, { width: 5 })} />
          <Line x1={x} y1={y - 120 * s} x2={x + 60 * s} y2={y} o={o(83, { width: 5 })} />
          <Line x1={x} y1={y - 120 * s} x2={x} y2={y} o={o(84, { width: 5 })} />
          <g transform={`rotate(-32 ${x} ${y - 125 * s})`}>
            <Shape d={rect(x - 110 * s, y - 150 * s, 220 * s, 50 * s, 10)} fill={c ?? "#3d5a8a"} o={o(85)} />
            <Shape d={rect(x + 100 * s, y - 160 * s, 30 * s, 70 * s, 6)} fill="#d9b97e" o={o(86)} />
          </g>
        </g>
      );
    case "candle":
      return <Candle x={x} y={y} s={s} seed={seed} t={t} />;
  }
};
