import React from "react";
import { hash01 } from "../../render/timeline.ts";
import type { PoseInput } from "./OrbBot3D.tsx";
import type { NeonLineModel } from "./rigs.ts";

const C = 200;
const R = 138;

function outline(shape: NeonLineModel["params"]["shape"]): string {
  if (shape === "circle") return `M ${C - R} ${C} a ${R} ${R} 0 1 0 ${2 * R} 0 a ${R} ${R} 0 1 0 ${-2 * R} 0 Z`;
  const sides = shape === "hex" ? 6 : 4;
  const start = shape === "hex" ? Math.PI / 6 : shape === "diamond" ? 0 : Math.PI / 4;
  const r = shape === "square" ? R * 1.25 : R * 1.08;
  return `M ${Array.from({ length: sides }, (_, i) => {
    const a = start + (i / sides) * Math.PI * 2;
    return `${(C + Math.cos(a) * r).toFixed(1)} ${(C + Math.sin(a) * r).toFixed(1)}`;
  }).join(" L ")} Z`;
}

/** The neon-line rig: a face drawn only in glowing lines, like a sign or a vector display. */
export const NeonLine: React.FC<{ model: NeonLineModel; size: number; pose: PoseInput; id: string }> = ({ model, size, pose, id }) => {
  const p = model.params;
  const e = pose.expression;
  const t = pose.t;
  const w = p.line_width;
  const bob = Math.sin(t * 2) * 6 + pose.energy * e.bounce * -10;
  const tilt = e.tilt_deg + Math.sin(t * 1.3) * 2;
  // A tube flickers now and then.
  const flicker = hash01(Math.floor(t * 14)) > 0.94 ? 0.55 : 1;
  const eyeR = 30 * e.eye_scale;
  const lid = Math.min(0.95, Math.max(e.lid, pose.blink));
  const eyeY = C - 28;
  const lookX = e.look[0] * eyeR * 0.4;
  const lookY = e.look[1] * eyeR * 0.35;
  const mouthY = C + 58;
  const open = pose.mouth;
  // Brows stay inside the outline: just above the lit eye, however wide it opens.
  const browY = eyeY - Math.min(eyeR, 34) * (1 - lid * 0.5) - 14;
  const browLift = e.brow === "up" ? -8 : 0;
  const slant = e.brow === "down" ? 10 : e.brow === "worried" ? -10 : 0;
  const lines = (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={outline(p.shape)} stroke={p.line} strokeWidth={w} fill={p.backing} />
      {[-1, 1].map((side) => {
        const x = C + side * 50;
        return (
          <g key={side}>
            <ellipse cx={x} cy={eyeY} rx={Math.min(eyeR, 38)} ry={Math.max(2, Math.min(eyeR, 34) * (1 - lid))} stroke={p.glow} strokeWidth={w} />
            {lid < 0.6 && <circle cx={x + lookX} cy={eyeY + lookY} r={7 * e.pupil_scale} fill={p.glow} />}
            <path d={`M ${x - eyeR * 0.7} ${browY + browLift + slant * side} L ${x + eyeR * 0.7} ${browY + browLift - slant * side}`} stroke={p.line} strokeWidth={w} />
          </g>
        );
      })}
      {open < 0.08 ? (
        <path d={`M ${C - 44} ${mouthY} Q ${C} ${mouthY + e.mouth_curve * 30} ${C + 44} ${mouthY}`} stroke={p.glow} strokeWidth={w} />
      ) : (
        <ellipse cx={C} cy={mouthY + 6} rx={36} ry={6 + open * 30} stroke={p.glow} strokeWidth={w} />
      )}
      <circle cx={C} cy={C} r={R * 1.3} stroke={p.line} strokeWidth={w * 0.35} strokeDasharray="6 22" transform={`rotate(${t * 26} ${C} ${C})`} opacity={0.7} />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 400 400" style={{ overflow: "visible" }}>
      <defs>
        <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <g transform={`translate(0 ${bob}) rotate(${tilt} ${C} ${C})`} opacity={flicker}>
        <g filter={`url(#${id}-glow)`} opacity={0.9 * e.glow}>
          {lines}
        </g>
        {lines}
      </g>
    </svg>
  );
};
