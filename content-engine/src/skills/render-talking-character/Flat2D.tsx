import React from "react";
import type { Flat2dModel } from "./rigs.ts";
import type { PoseInput } from "./OrbBot3D.tsx";

const C = 200; // centre of the 400×400 drawing
const R = 132; // body radius

function bodyPath(shape: Flat2dModel["params"]["body"]["shape"], t: number): string {
  switch (shape) {
    case "circle":
      return `M ${C - R} ${C} a ${R} ${R} 0 1 0 ${2 * R} 0 a ${R} ${R} 0 1 0 ${-2 * R} 0 Z`;
    case "egg":
      return `M ${C} ${C - R * 1.08} C ${C + R * 0.82} ${C - R * 1.08} ${C + R * 1.04} ${C + R * 0.2} ${C + R * 0.95} ${C + R * 0.55} C ${C + R * 0.8} ${C + R * 1.05} ${C - R * 0.8} ${C + R * 1.05} ${C - R * 0.95} ${C + R * 0.55} C ${C - R * 1.04} ${C + R * 0.2} ${C - R * 0.82} ${C - R * 1.08} ${C} ${C - R * 1.08} Z`;
    case "rounded-rect":
      return `M ${C - R + 60} ${C - R} H ${C + R - 60} Q ${C + R} ${C - R} ${C + R} ${C - R + 60} V ${C + R - 60} Q ${C + R} ${C + R} ${C + R - 60} ${C + R} H ${C - R + 60} Q ${C - R} ${C + R} ${C - R} ${C + R - 60} V ${C - R + 60} Q ${C - R} ${C - R} ${C - R + 60} ${C - R} Z`;
    case "drop":
      return `M ${C} ${C - R * 1.25} C ${C + R * 0.35} ${C - R * 0.75} ${C + R} ${C - R * 0.2} ${C + R} ${C + R * 0.3} A ${R} ${R * 0.92} 0 0 1 ${C - R} ${C + R * 0.3} C ${C - R} ${C - R * 0.2} ${C - R * 0.35} ${C - R * 0.75} ${C} ${C - R * 1.25} Z`;
    case "star": {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? R * 1.18 : R * 0.68;
        pts.push(`${(C + Math.cos(a) * r).toFixed(1)} ${(C + 10 + Math.sin(a) * r).toFixed(1)}`);
      }
      return `M ${pts.join(" L ")} Z`;
    }
    case "blob":
    default: {
      const n = 8;
      const pts = Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        const r = R * (1 + 0.045 * Math.sin(a * 3 + t * 1.6) + 0.03 * Math.cos(a * 2 - t * 1.1));
        return [C + Math.cos(a) * r, C + Math.sin(a) * r * 0.97];
      });
      let d = "";
      for (let i = 0; i < n; i++) {
        const p0 = pts[(i - 1 + n) % n];
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        const p3 = pts[(i + 2) % n];
        if (i === 0) d += `M ${p1[0].toFixed(1)} ${p1[1].toFixed(1)} `;
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += `C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)} `;
      }
      return d + "Z";
    }
  }
}

function shade(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 + amount))));
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

function starPath(x: number, y: number, r: number): string {
  return `M ${x} ${y - r} Q ${x} ${y} ${x + r} ${y} Q ${x} ${y} ${x} ${y + r} Q ${x} ${y} ${x - r} ${y} Q ${x} ${y} ${x} ${y - r} Z`;
}

/** The flat-2d rig: an SVG character built from a body shape, face and accessories. */
export const Flat2D: React.FC<{ model: Flat2dModel; size: number; pose: PoseInput; id: string }> = ({ model, size, pose, id }) => {
  const p = model.params;
  const e = pose.expression;
  const t = pose.t;
  const outline = p.body.outline;
  const ow = p.body.outline_width;
  const lower = p.body.shade ?? shade(p.body.color, -0.18);
  const bob = Math.sin(t * 2.2) * 6 + pose.energy * e.bounce * -10;
  const squash = 1 + pose.energy * e.bounce * 0.05;
  const tilt = e.tilt_deg + Math.sin(t * 1.4) * 2.5;
  const eyeY = C + p.eyes.y * R;
  const eyeR = p.eyes.size * R * e.eye_scale;
  const lid = Math.min(0.95, Math.max(e.lid, pose.blink));
  const eyeXs = [C - p.eyes.spacing * R, C + p.eyes.spacing * R];
  const lookX = e.look[0] * eyeR * 0.35;
  const lookY = e.look[1] * eyeR * 0.3;
  const mouthY = C + p.mouth.y * R;
  const mw = p.mouth.width * R;
  const open = pose.mouth;
  const curve = e.mouth_curve;
  const path = bodyPath(p.body.shape, t);
  const has = (type: string) => p.accessories.find((a) => a.type === type);

  const brow = (x: number, side: -1 | 1) => {
    const y = eyeY - eyeR - 16;
    const w = eyeR * 0.9;
    const tiltBy = e.brow === "up" ? -8 : e.brow === "down" ? 10 * side * -1 : e.brow === "worried" ? -10 * side * -1 : 0;
    const lift = e.brow === "up" ? -10 : 0;
    return <path d={`M ${x - w} ${y + lift - tiltBy * side * -0.5} Q ${x} ${y + lift - 6} ${x + w} ${y + lift + tiltBy * side * -0.5}`} stroke={outline} strokeWidth={ow * 0.9} strokeLinecap="round" fill="none" />;
  };

  // Mouth: closed = curved line; open = rounded opening whose height follows loudness.
  const openH = 6 + open * 46;
  const smile = curve * 22;
  const mouth =
    open < 0.08 ? (
      <path d={`M ${C - mw * 0.75} ${mouthY} Q ${C} ${mouthY + smile} ${C + mw * 0.75} ${mouthY}`} stroke={outline} strokeWidth={ow} strokeLinecap="round" fill="none" />
    ) : (
      <g>
        <path d={`M ${C - mw} ${mouthY} Q ${C} ${mouthY + smile * 0.6 - 6} ${C + mw} ${mouthY} Q ${C} ${mouthY + openH + smile} ${C - mw} ${mouthY} Z`} fill={p.mouth.color} stroke={outline} strokeWidth={ow * 0.8} strokeLinejoin="round" />
        {open > 0.3 && <ellipse cx={C} cy={mouthY + openH * 0.62 + smile * 0.4} rx={mw * 0.45} ry={openH * 0.22} fill={p.mouth.tongue} />}
      </g>
    );

  const accessoriesBehind = (
    <>
      {has("tail") && (
        <g>
          <defs>
            <linearGradient id={`${id}-tail`} x1="1" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={has("tail")!.color} stopOpacity="0.95" />
              <stop offset="1" stopColor={has("tail")!.accent ?? has("tail")!.color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`M ${C - R * 0.55} ${C - R * 0.75} C ${C - R * 1.5} ${C - R * 0.6 + Math.sin(t * 3) * 8} ${C - R * 1.6} ${C + R * 0.9} ${C - R * 2.05} ${C + R * 1.35} C ${C - R * 1.2} ${C + R * 1.1} ${C - R * 0.8} ${C + R * 0.9} ${C - R * 0.62} ${C + R * 0.72} Z`} fill={`url(#${id}-tail)`} />
        </g>
      )}
      {has("ears") &&
        [-1, 1].map((s) => (
          <g key={s}>
            <ellipse cx={C + s * R * 0.62} cy={C - R * 0.86} rx={R * 0.3} ry={R * 0.34} fill={has("ears")!.color} stroke={outline} strokeWidth={ow} />
            <ellipse cx={C + s * R * 0.62} cy={C - R * 0.84} rx={R * 0.15} ry={R * 0.18} fill={has("ears")!.accent ?? shade(has("ears")!.color, 0.3)} />
          </g>
        ))}
      {has("antenna") && (
        <g>
          <path d={`M ${C + 10} ${C - R * 0.95} Q ${C + 30 + Math.sin(t * 3) * 6} ${C - R * 1.3} ${C + 22} ${C - R * 1.5}`} stroke={outline} strokeWidth={ow * 0.8} fill="none" strokeLinecap="round" />
          <circle cx={C + 22} cy={C - R * 1.5} r={14} fill={has("antenna")!.color} stroke={outline} strokeWidth={ow * 0.8} />
        </g>
      )}
    </>
  );

  const accessoriesFront = (
    <>
      {has("glasses") &&
        eyeXs.map((x, i) => <circle key={i} cx={x} cy={eyeY} r={eyeR * 1.45} fill="none" stroke={has("glasses")!.color} strokeWidth={ow * 1.1} />)}
      {has("glasses") && <path d={`M ${eyeXs[0] + eyeR * 1.45} ${eyeY} Q ${C} ${eyeY - 10} ${eyeXs[1] - eyeR * 1.45} ${eyeY}`} stroke={has("glasses")!.color} strokeWidth={ow * 1.1} fill="none" />}
      {has("leaf") && (
        <g transform={`rotate(${Math.sin(t * 2) * 6} ${C} ${C - R})`}>
          <path d={`M ${C} ${C - R + 4} q 2 -30 -6 -46`} stroke={outline} strokeWidth={ow * 0.7} fill="none" />
          <path d={`M ${C - 6} ${C - R - 40} C ${C + 30} ${C - R - 70} ${C + 60} ${C - R - 40} ${C + 52} ${C - R - 26} C ${C + 30} ${C - R - 18} ${C + 6} ${C - R - 26} ${C - 6} ${C - R - 40} Z`} fill={has("leaf")!.color} stroke={outline} strokeWidth={ow * 0.7} />
        </g>
      )}
      {has("hat") && <path d={`M ${C - R * 0.7} ${C - R * 0.7} Q ${C} ${C - R * 1.55} ${C + R * 0.7} ${C - R * 0.7} Z`} fill={has("hat")!.color} stroke={outline} strokeWidth={ow} strokeLinejoin="round" />}
      {has("crown") && (
        <path d={`M ${C - R * 0.45} ${C - R * 0.88} L ${C - R * 0.5} ${C - R * 1.28} L ${C - R * 0.22} ${C - R * 1.06} L ${C} ${C - R * 1.36} L ${C + R * 0.22} ${C - R * 1.06} L ${C + R * 0.5} ${C - R * 1.28} L ${C + R * 0.45} ${C - R * 0.88} Z`} fill={has("crown")!.color} stroke={outline} strokeWidth={ow * 0.8} strokeLinejoin="round" />
      )}
      {has("bow") && (
        <g transform={`translate(${C + R * 0.55} ${C - R * 0.85})`}>
          <path d="M 0 0 L -34 -20 L -34 20 Z M 0 0 L 34 -20 L 34 20 Z" fill={has("bow")!.color} stroke={outline} strokeWidth={ow * 0.7} strokeLinejoin="round" />
          <circle r={9} fill={has("bow")!.accent ?? has("bow")!.color} stroke={outline} strokeWidth={ow * 0.7} />
        </g>
      )}
      {has("sparkles") &&
        [0, 1, 2].map((i) => {
          const tw = 0.5 + 0.5 * Math.sin(t * 4 + i * 2.1);
          const pos = [
            [C + R * 1.15, C - R * 0.85],
            [C - R * 1.2, C - R * 0.4],
            [C + R * 1.25, C + R * 0.35],
          ][i];
          return <path key={i} d={starPath(pos[0], pos[1], 10 + tw * 10)} fill={has("sparkles")!.color} opacity={0.5 + tw * 0.5} />;
        })}
    </>
  );

  return (
    <svg width={size} height={size} viewBox="0 0 400 400" style={{ overflow: "visible" }}>
      <g transform={`translate(0 ${bob}) rotate(${tilt} ${C} ${C + R}) translate(${C} ${C + R}) scale(${1 / squash} ${squash}) translate(${-C} ${-C - R})`}>
        {accessoriesBehind}
        <defs>
          <clipPath id={`${id}-body`}>
            <path d={path} />
          </clipPath>
        </defs>
        <path d={path} fill={p.body.color} />
        <g clipPath={`url(#${id}-body)`}>
          <ellipse cx={C} cy={C + R * 0.95} rx={R * 1.4} ry={R * 0.62} fill={lower} />
          <ellipse cx={C - R * 0.35} cy={C - R * 0.55} rx={R * 0.32} ry={R * 0.16} fill="#ffffff" opacity={0.28} transform={`rotate(-25 ${C - R * 0.35} ${C - R * 0.55})`} />
        </g>
        <path d={path} fill="none" stroke={outline} strokeWidth={ow} strokeLinejoin="round" />
        {p.cheeks && eyeXs.map((x, i) => <ellipse key={i} cx={x + (i ? 10 : -10)} cy={eyeY + eyeR + 26} rx={eyeR * 0.75} ry={eyeR * 0.42} fill={p.cheeks} opacity={0.55} />)}
        {eyeXs.map((x, i) => (
          <g key={i} transform={`translate(${x} ${eyeY}) scale(1 ${Math.max(0.06, 1 - lid)}) translate(${-x} ${-eyeY})`}>
            {p.eyes.style === "dot" ? (
              <ellipse cx={x + lookX} cy={eyeY + lookY} rx={eyeR * 0.55} ry={eyeR * 0.62} fill={p.eyes.pupil} />
            ) : (
              <>
                <ellipse cx={x} cy={eyeY} rx={eyeR * (p.eyes.style === "oval" ? 0.82 : 1)} ry={eyeR * (p.eyes.style === "oval" ? 1.15 : 1)} fill={p.eyes.white} stroke={outline} strokeWidth={ow * 0.75} />
                <circle cx={x + lookX} cy={eyeY + lookY} r={eyeR * 0.5 * e.pupil_scale} fill={p.eyes.pupil} />
                <circle cx={x + lookX + eyeR * 0.18} cy={eyeY + lookY - eyeR * 0.2} r={eyeR * 0.16} fill="#ffffff" />
              </>
            )}
            {p.eyes.style === "sleepy" && <rect x={x - eyeR * 1.1} y={eyeY - eyeR * 1.1} width={eyeR * 2.2} height={eyeR * 0.9} fill={p.body.color} />}
          </g>
        ))}
        {e.brow !== "flat" && eyeXs.map((x, i) => <g key={i}>{brow(x, i === 0 ? -1 : 1)}</g>)}
        {mouth}
        {accessoriesFront}
      </g>
    </svg>
  );
};
