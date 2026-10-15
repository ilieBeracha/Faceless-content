import React from "react";
import type { StoryScene } from "./schema.ts";
import { Circle, Curve, INK, Line, rect, rnd, shade, Shape } from "./sketch.tsx";

export const GROUND_Y: Record<StoryScene["setting"], number> = { hills: 830, beach: 845, sea: 860, plain: 830, desert: 830, snow: 830, night: 830, space: 820, room: 845, city: 845, rome: 850, baths: 740 };

const SKY: Record<StoryScene["time"], [string, string]> = {
  day: ["#dfe0d2", "#efe7d2"],
  dusk: ["#d6b598", "#f1dcc0"],
  night: ["#1f2a44", "#3a4864"],
};

function tone(color: string, time: StoryScene["time"]): string {
  if (time === "night") return shade(color, -0.55);
  if (time === "dusk") return shade(color, -0.12);
  return color;
}

const Grass: React.FC<{ y: number; seed: number; color: string; count?: number }> = ({ y, seed, color, count = 16 }) => (
  <g>
    {Array.from({ length: count }, (_, i) => {
      const x = rnd(seed + i * 3.7) * 1000;
      const yy = y + rnd(seed + i * 1.3) * (1000 - y) * 0.8;
      return (
        <g key={i} opacity={0.75}>
          <Line x1={x} y1={yy} x2={x - 6} y2={yy - 18} o={{ stroke: color, width: 2, seed: seed + i }} />
          <Line x1={x + 4} y1={yy} x2={x + 7} y2={yy - 22} o={{ stroke: color, width: 2, seed: seed + i + 50 }} />
        </g>
      );
    })}
  </g>
);

const SmallTree: React.FC<{ x: number; y: number; s: number; color: string; seed: number }> = ({ x, y, s, color, seed }) => (
  <g>
    <line x1={x} y1={y} x2={x} y2={y - 40 * s} stroke={shade(color, -0.4)} strokeWidth={4 * s} />
    <Shape d={`M${x - 22 * s} ${y - 36 * s} C${x - 30 * s} ${y - 70 * s} ${x + 30 * s} ${y - 76 * s} ${x + 22 * s} ${y - 36 * s} Z`} fill={color} o={{ seed, width: 2 }} />
  </g>
);

/** The background for a scene, drawn in scene units (1000×1000). */
export const SettingView: React.FC<{ setting: StoryScene["setting"]; time: StoryScene["time"]; seed: number; t: number }> = ({ setting, time, seed, t }) => {
  const tm = setting === "night" || setting === "space" ? "night" : time;
  const [top, bottom] = setting === "space" ? ["#0f1424", "#1d2540"] : SKY[tm];
  const id = `sky${seed}`;
  const c = (hex: string) => tone(hex, tm);
  const stars =
    tm === "night"
      ? Array.from({ length: setting === "space" ? 70 : 30 }, (_, i) => {
          const r = 1.5 + rnd(seed + i * 2.2) * 2.5;
          return <circle key={i} cx={rnd(seed + i * 1.1) * 1000} cy={rnd(seed + i * 4.7) * (setting === "space" ? 1000 : 520)} r={r} fill="#f4ecd0" opacity={0.45 + 0.5 * Math.abs(Math.sin(t * 1.5 + i))} />;
        })
      : null;
  let land: React.ReactNode = null;
  switch (setting) {
    case "hills":
    case "night":
      land = (
        <g>
          <Shape d="M0 600 C150 545 300 590 450 568 C600 545 800 600 1000 560 L1000 1000 L0 1000 Z" fill={c("#b9bfa6")} o={{ seed: seed + 1, width: 2, stroke: shade(INK, 0.35) }} />
          <SmallTree x={180} y={628} s={0.9} color={c("#8fa074")} seed={seed + 2} />
          <SmallTree x={770} y={598} s={0.7} color={c("#8fa074")} seed={seed + 3} />
          <Shape d="M0 700 C200 650 380 712 560 680 C740 650 880 700 1000 668 L1000 1000 L0 1000 Z" fill={c("#9fae86")} o={{ seed: seed + 4, width: 2.4 }} />
          <Shape d="M0 790 C250 770 600 800 1000 778 L1000 1000 L0 1000 Z" fill={c("#8a9d6e")} o={{ seed: seed + 5, width: 2.6 }} />
          <Grass y={800} seed={seed + 6} color={c("#5f7048")} />
        </g>
      );
      break;
    case "beach":
      land = (
        <g>
          <Shape d="M0 520 C80 470 180 470 260 520 Z" fill={c("#9aa58c")} o={{ seed: seed + 1, width: 2 }} />
          <rect x={0} y={520} width={1000} height={150} fill={c("#617e8d")} />
          {Array.from({ length: 6 }, (_, i) => (
            <Curve key={i} points={[[60 + i * 160, 560 + (i % 3) * 30], [110 + i * 160, 552 + (i % 3) * 30], [160 + i * 160, 560 + (i % 3) * 30]]} o={{ stroke: c("#a9c0c8"), width: 2, seed: seed + 10 + i }} />
          ))}
          <Shape d="M0 668 C300 640 700 690 1000 650 L1000 1000 L0 1000 Z" fill={c("#e2d1ab")} o={{ seed: seed + 2, width: 2.4 }} />
          <path d="M0 668 C300 640 700 690 1000 650 L1000 690 C700 730 300 680 0 708 Z" fill={c("#cdbb93")} opacity={0.6} />
          <Grass y={900} seed={seed + 6} color={c("#8a8d5e")} count={6} />
        </g>
      );
      break;
    case "sea":
      land = (
        <g>
          <rect x={0} y={480} width={1000} height={340} fill={c("#5b7887")} />
          {Array.from({ length: 9 }, (_, i) => (
            <Curve key={i} points={[[(i * 137) % 1000, 520 + i * 30], [((i * 137) % 1000) + 60, 512 + i * 30 + Math.sin(t + i) * 3], [((i * 137) % 1000) + 120, 520 + i * 30]]} o={{ stroke: c("#a4bcc5"), width: 2.2, seed: seed + 20 + i }} />
          ))}
          <Shape d={`M0 800 C200 ${780 + Math.sin(t * 1.3) * 6} 450 ${820 + Math.sin(t * 1.1) * 6} 1000 790 L1000 1000 L0 1000 Z`} fill={c("#e2d1ab")} o={{ seed: seed + 3, width: 2.4 }} />
          <Curve points={[[0, 806], [300, 792], [600, 818], [1000, 796]]} o={{ stroke: "#f6f2e6", width: 5, seed: seed + 4 }} />
        </g>
      );
      break;
    case "plain":
      land = (
        <g>
          <Shape d="M0 640 C200 610 420 640 640 616 C800 600 900 630 1000 612 L1000 1000 L0 1000 Z" fill={c("#b6b997")} o={{ seed: seed + 1, width: 2 }} />
          <Shape d="M0 760 C300 748 700 772 1000 752 L1000 1000 L0 1000 Z" fill={c("#cbc39b")} o={{ seed: seed + 2, width: 2.4 }} />
          <Grass y={780} seed={seed + 6} color={c("#7f8456")} count={12} />
        </g>
      );
      break;
    case "desert":
      land = (
        <g>
          <Shape d="M0 640 C220 580 380 650 560 610 C760 570 880 640 1000 600 L1000 1000 L0 1000 Z" fill={c("#d9bb8a")} o={{ seed: seed + 1, width: 2 }} />
          <Shape d="M0 770 C260 730 560 800 1000 750 L1000 1000 L0 1000 Z" fill={c("#e6c999")} o={{ seed: seed + 2, width: 2.4 }} />
        </g>
      );
      break;
    case "snow":
      land = (
        <g>
          <Shape d="M60 640 L250 430 L440 640 Z M520 640 L720 400 L930 640 Z" fill={c("#a9b4ba")} o={{ seed: seed + 1, width: 2 }} />
          <Shape d="M196 490 L250 430 L304 490 L276 480 L250 500 L224 480 Z M664 466 L720 400 L776 466 L748 456 L720 478 L692 456 Z" fill="#f6f4ee" o={{ seed: seed + 2, width: 1.6 }} />
          <Shape d="M0 700 C300 670 700 720 1000 690 L1000 1000 L0 1000 Z" fill={c("#f2efe8")} o={{ seed: seed + 3, width: 2.4 }} />
        </g>
      );
      break;
    case "room":
      land = (
        <g>
          <rect x={0} y={0} width={1000} height={780} fill={c("#e6d6b8")} />
          <Shape d={rect(620, 170, 260, 230, 6)} fill={c("#cfe0e4")} o={{ seed: seed + 1 }} />
          <Line x1={750} y1={170} x2={750} y2={400} o={{ seed: seed + 2 }} />
          <Line x1={620} y1={285} x2={880} y2={285} o={{ seed: seed + 3 }} />
          <Shape d={rect(110, 200, 170, 130, 4)} fill={c("#d9b97e")} o={{ seed: seed + 4 }} />
          <Circle cx={195} cy={265} r={36} fill={c("#c2553a")} o={{ seed: seed + 5, width: 2 }} />
          <rect x={0} y={772} width={1000} height={16} fill={c("#c9b08a")} />
          <rect x={0} y={788} width={1000} height={212} fill={c("#a98563")} />
          {[880, 930, 980].map((y, i) => (
            <line key={i} x1={0} y1={y} x2={1000} y2={y} stroke={c("#8f6c4c")} strokeWidth={2} opacity={0.5} />
          ))}
        </g>
      );
      break;
    case "city":
      land = (
        <g>
          {Array.from({ length: 9 }, (_, i) => {
            const w = 80 + rnd(seed + i) * 60;
            const h = 140 + rnd(seed + i * 2.3) * 220;
            const x = i * 115 - 20;
            return <Shape key={i} d={rect(x, 700 - h, w, h)} fill={c(i % 2 ? "#a7aeb0" : "#b6bcbb")} o={{ seed: seed + 30 + i, width: 2 }} />;
          })}
          {Array.from({ length: 30 }, (_, i) => (
            <rect key={i} x={20 + (i % 10) * 98} y={420 + Math.floor(i / 10) * 70} width={14} height={20} fill={tm === "night" ? "#f2d27a" : "#d7dde0"} opacity={0.8} />
          ))}
          <Shape d="M0 700 L1000 700 L1000 1000 L0 1000 Z" fill={c("#bdb5a2")} o={{ seed: seed + 3, width: 2 }} />
          <rect x={0} y={760} width={1000} height={10} fill={c("#a59c88")} />
        </g>
      );
      break;
    case "rome": {
      // A Roman street: a temple front with columns, an arch, cypress trees, paving.
      const col = (x: number, h: number, w: number, k: number) => (
        <g key={k}>
          <Shape d={rect(x - w / 2, 620 - h, w, h)} fill={c("#efe2c6")} o={{ seed: seed + 40 + k, width: 2 }} />
          <rect x={x - w / 2 - 6} y={620 - h - 12} width={w + 12} height={12} fill={c("#e2d2b0")} />
          {[0.3, 0.55, 0.8].map((f, j) => <line key={j} x1={x - w / 2 + w * f} y1={620 - h + 6} x2={x - w / 2 + w * f} y2={614} stroke={c("#cdb98f")} strokeWidth={2} />)}
        </g>
      );
      land = (
        <g>
          <Shape d="M520 300 L760 210 L1000 300 Z" fill={c("#e9d8b6")} o={{ seed: seed + 1, width: 2.2 }} />
          <rect x={520} y={300} width={480} height={26} fill={c("#dcc7a0")} />
          {[560, 650, 740, 830, 920].map((x, k) => col(x, 294, 46, k))}
          <Shape d="M120 620 L120 380 C120 300 330 300 330 380 L330 620 L280 620 L280 400 C280 350 170 350 170 400 L170 620 Z" fill={c("#d8b98c")} o={{ seed: seed + 2, width: 2.2 }} />
          {[40, 400].map((x, k) => (
            <Shape key={k} d={`M${x} 640 C${x - 26} 560 ${x - 14} 470 ${x} 430 C${x + 14} 470 ${x + 26} 560 ${x} 640 Z`} fill={c("#6f8256")} o={{ seed: seed + 60 + k, width: 2 }} />
          ))}
          <Shape d="M0 620 L1000 620 L1000 1000 L0 1000 Z" fill={c("#d9c7a3")} o={{ seed: seed + 3, width: 2.2 }} />
          {Array.from({ length: 5 }, (_, i) => <line key={i} x1={0} y1={680 + i * 70} x2={1000} y2={672 + i * 72} stroke={c("#bfa982")} strokeWidth={2} opacity={0.7} />)}
          {Array.from({ length: 9 }, (_, i) => <line key={`v${i}`} x1={60 + i * 115} y1={620} x2={30 + i * 118} y2={1000} stroke={c("#bfa982")} strokeWidth={1.6} opacity={0.5} />)}
        </g>
      );
      break;
    }
    case "baths": {
      // Inside a Roman bathhouse: a huge vaulted hall, columns, a pool with steam.
      land = (
        <g>
          <rect x={0} y={0} width={1000} height={1000} fill={c("#e7d3b0")} />
          <Shape d="M60 700 L60 260 C60 40 940 40 940 260 L940 700 Z" fill={c("#d9c09a")} o={{ seed: seed + 1, width: 2.4 }} />
          <Shape d="M200 700 L200 330 C200 170 800 170 800 330 L800 700 Z" fill={c("#c7d8d6")} o={{ seed: seed + 2, width: 2.2 }} />
          {[110, 890].map((x, k) => (
            <g key={k}>
              <Shape d={rect(x - 32, 230, 64, 470)} fill={c("#b98f6a")} o={{ seed: seed + 10 + k, width: 2 }} />
              <rect x={x - 42} y={218} width={84} height={16} fill={c("#a87e5c")} />
            </g>
          ))}
          <rect x={0} y={700} width={1000} height={300} fill={c("#cdb48c")} />
          <Shape d="M120 760 L880 760 L940 900 L60 900 Z" fill={c("#7fa9b4")} o={{ seed: seed + 3, width: 2.4 }} />
          {Array.from({ length: 4 }, (_, i) => (
            <Curve key={i} points={[[180 + i * 170, 820], [230 + i * 170, 812 + Math.sin(t * 1.4 + i) * 3], [280 + i * 170, 820]]} o={{ stroke: c("#cfe2e6"), width: 2.2, seed: seed + 20 + i }} />
          ))}
          {Array.from({ length: 5 }, (_, i) => {
            const x = 180 + i * 150;
            const rise = (t * 22 + i * 37) % 120;
            return <ellipse key={`st${i}`} cx={x + Math.sin(t + i) * 12} cy={740 - rise} rx={46} ry={20} fill="#ffffff" opacity={0.18 * (1 - rise / 120)} />;
          })}
          {Array.from({ length: 12 }, (_, i) => <line key={`t${i}`} x1={i * 90} y1={900} x2={i * 90 - 30} y2={1000} stroke={c("#b39a73")} strokeWidth={1.6} opacity={0.6} />)}
        </g>
      );
      break;
    }
    case "space":
      land = <circle cx={880} cy={1180} r={420} fill="#33405f" opacity={0.9} />;
      break;
  }
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={1000} height={1000} fill={`url(#${id})`} />
      {stars}
      {setting === "night" && <Circle cx={820} cy={150} r={46} fill="#efe3bd" o={{ seed: seed + 9, width: 2 }} />}
      {land}
    </g>
  );
};
