/**
 * The stick-figure rig: a round head, dot eyes, a mouth that opens with the voice, stick limbs.
 * Poses are joint angles (0° = down, 90° = forward, 180° = up), mirrored when facing left.
 */
import React from "react";
import type { Expression, StickFigureModel } from "../render-talking-character/rigs.ts";
import { HeldProp } from "./props.tsx";
import type { Figure } from "./schema.ts";
import { Circle, Curve, Ellipse, GroundShadow, Line, Shape, shade } from "./sketch.tsx";

type Limb = [number, number];
interface PoseDef {
  back: Limb;
  front: Limb;
  legBack: Limb;
  legFront: Limb;
  head: number;
  lookUp?: number;
}

const STAND: PoseDef = { back: [-14, -8], front: [14, 8], legBack: [-7, -4], legFront: [7, 4], head: 0 };

function poseAt(name: Figure["pose"], t: number): PoseDef {
  const s = Math.sin(t * 6.2);
  switch (name) {
    case "point":
      return { ...STAND, front: [96, 84], head: -4 };
    case "wave":
      return { ...STAND, front: [140, 170 + Math.sin(t * 9) * 18] };
    case "think":
      return { ...STAND, back: [-16, -10], front: [28, 152], head: 8 };
    case "shrug":
      return { ...STAND, back: [-42, -102], front: [42, 102], head: 6 };
    case "cheer":
      return { ...STAND, back: [-152, -168], front: [152, 168], legBack: [-12, -8], legFront: [12, 8], head: -6 };
    case "hold":
      return { ...STAND, back: [52, 96], front: [66, 100] };
    case "walk":
      return { back: [-22 * s, -12 * s], front: [22 * s, 30 * s], legBack: [-24 * s, -24 * s - 10 * Math.max(0, s)], legFront: [24 * s, 24 * s - 10 * Math.max(0, -s)], head: 0 };
    case "sit":
      return { back: [24, 70], front: [30, 74], legBack: [82, 6], legFront: [88, 10], head: 0 };
    case "look-up":
      return { ...STAND, head: -20, lookUp: 1 };
    case "facepalm":
      return { ...STAND, back: [-10, -6], front: [36, 165], head: 12 };
    case "stand":
    default:
      return STAND;
  }
}

export interface FigureDrawProps {
  figure: Figure;
  model: StickFigureModel;
  expression: Expression;
  groundY: number;
  t: number;
  mouth: number;
  blink: number;
  seed: number;
}

/** One stick figure, drawn in scene units (the scene is 1000×1000). */
export const StickFigure: React.FC<FigureDrawProps> = ({ figure, model, expression: e, groundY, t, mouth, blink, seed }) => {
  const p = model.params;
  const k = figure.scale;
  const dir = figure.facing === "left" ? -1 : 1;
  const R = 52 * p.head_size * k;
  const UA = 58 * k;
  const FA = 54 * k;
  const TH = 74 * k;
  const SH = 72 * k;
  const T = 118 * k;
  const pose = poseAt(figure.pose, t + seed);
  const pt = (bx: number, by: number, deg: number, len: number): [number, number] => [bx + len * Math.sin((deg * Math.PI) / 180) * dir, by + len * Math.cos((deg * Math.PI) / 180)];

  // Legs first, then lift the hips so the lowest foot touches the ground.
  const hip0: [number, number] = [figure.x * 1000, 0];
  const legs = [pose.legBack, pose.legFront].map((l) => {
    const knee = pt(hip0[0], hip0[1], l[0], TH);
    const foot = pt(knee[0], knee[1], l[1], SH);
    return { knee, foot };
  });
  const sitting = figure.pose === "sit";
  const lowest = Math.max(...legs.map((l) => l.foot[1]));
  const breathe = Math.sin(t * 2.4 + seed) * 1.2 * k;
  const talk = mouth * e.bounce * 7 * k;
  const dy = (sitting ? groundY - 20 * k : groundY - lowest) - talk * 0.5;
  const hip: [number, number] = [hip0[0], hip0[1] + dy];
  const L = legs.map((l) => ({ knee: [l.knee[0], l.knee[1] + dy] as [number, number], foot: [l.foot[0], l.foot[1] + dy] as [number, number] }));
  const neck: [number, number] = [hip[0], hip[1] - T + breathe];
  const shoulder: [number, number] = [neck[0], neck[1] + 16 * k];
  const arms = [pose.back, pose.front].map((a) => {
    const elbow = pt(shoulder[0], shoulder[1], a[0], UA);
    const hand = pt(elbow[0], elbow[1], a[1], FA);
    return { elbow, hand };
  });

  // Head (tilted around the neck)
  const tilt = (pose.head + e.tilt_deg * 0.6) * dir;
  const head: [number, number] = [neck[0], neck[1] - R * 0.92 - talk * 0.4];
  const lw = p.line_width * Math.max(0.6, k);
  const o = (n: number) => ({ stroke: p.line, width: lw, roughness: 0.7, seed: seed * 31 + n });
  const lookY = (pose.lookUp ? -0.7 : 0) + e.look[1] * -0.5;
  const eyeR = R * 0.085 * e.eye_scale;
  const eyeDx = R * 0.32;
  const ex = (side: number) => head[0] + side * eyeDx + (dir * 0.12 + e.look[0] * 0.18) * R;
  const ey = head[1] - R * 0.1 + lookY * R * 0.16;
  const lid = Math.min(0.95, Math.max(e.lid, blink));
  const mouthX = head[0] + dir * 0.1 * R;
  const mouthY = head[1] + R * 0.38 + lookY * R * 0.08;
  const mw = R * 0.18;
  const open = Math.min(1, mouth);

  return (
    <g>
      {!sitting && <GroundShadow cx={hip[0]} cy={groundY + 4} rx={62 * k} />}
      {/* legs */}
      {L.map((l, i) => (
        <g key={`leg${i}`}>
          <Curve points={[hip, l.knee, l.foot]} o={o(10 + i)} />
          <Line x1={l.foot[0]} y1={l.foot[1]} x2={l.foot[0] + 16 * k * dir} y2={l.foot[1] + 1} o={o(20 + i)} />
        </g>
      ))}
      {/* body */}
      {p.body_style === "tunic" ? (
        <Shape d={`M${neck[0] - 18 * k} ${neck[1] + 10 * k} L${neck[0] + 18 * k} ${neck[1] + 10 * k} L${hip[0] + 30 * k} ${hip[1] + 6 * k} L${hip[0] - 30 * k} ${hip[1] + 6 * k} Z`} fill={p.body_color} o={o(30)} />
      ) : (
        <Line x1={neck[0]} y1={neck[1]} x2={hip[0]} y2={hip[1]} o={o(30)} />
      )}
      {/* arms */}
      {arms.map((a, i) => (
        <Curve key={`arm${i}`} points={[shoulder, a.elbow, a.hand]} o={o(40 + i)} />
      ))}
      {figure.hold && <HeldProp type={figure.hold} x={arms[1].hand[0]} y={arms[1].hand[1]} scale={k} text={figure.hold_text} seed={seed} />}
      {/* head */}
      <g transform={`rotate(${tilt} ${neck[0]} ${neck[1]})`}>
        {p.accessory === "helmet" && <circle cx={head[0]} cy={head[1]} r={R * 1.35} fill="rgba(200,225,240,0.35)" stroke={p.line} strokeWidth={lw * 0.6} />}
        <Circle cx={head[0]} cy={head[1]} r={R} fill={p.head} o={o(50)} />
        <ellipse cx={head[0] - R * 0.3} cy={head[1] - R * 0.35} rx={R * 0.32} ry={R * 0.18} fill="#ffffff" opacity={0.18} />
        <Hair kind={p.hair} color={p.hair_color} head={head} R={R} lw={lw} seed={seed} />
        {[-1, 1].map((side) => (
          <g key={side} transform={`translate(${ex(side)} ${ey}) scale(1 ${Math.max(0.08, 1 - lid)}) translate(${-ex(side)} ${-ey})`}>
            <ellipse cx={ex(side)} cy={ey} rx={eyeR * 0.9} ry={eyeR * 1.15} fill={p.line} />
            <circle cx={ex(side) + eyeR * 0.3} cy={ey - eyeR * 0.4} r={eyeR * 0.3} fill="#ffffff" opacity={0.85} />
          </g>
        ))}
        {e.brow !== "flat" &&
          [-1, 1].map((side) => {
            const bx = ex(side);
            const by = ey - R * 0.27 - (e.brow === "up" ? R * 0.08 : 0);
            const slope = e.brow === "down" ? -side * 0.1 : e.brow === "worried" ? side * 0.12 : 0;
            return <Line key={side} x1={bx - R * 0.13} y1={by + slope * R} x2={bx + R * 0.13} y2={by - slope * R} o={{ ...o(60 + side), width: lw * 0.7 }} />;
          })}
        {open < 0.06 ? (
          <Curve points={[[mouthX - mw, mouthY], [mouthX, mouthY + e.mouth_curve * R * 0.16], [mouthX + mw, mouthY]]} o={{ ...o(70), width: lw * 0.75 }} />
        ) : (
          <Ellipse cx={mouthX} cy={mouthY + R * 0.04} rx={mw * (0.75 + open * 0.2)} ry={R * (0.05 + open * 0.17)} fill={shade(p.line, 0.15)} o={{ ...o(71), width: lw * 0.6 }} />
        )}
        <Accessory kind={p.accessory} color={p.accessory_color} head={head} R={R} lw={lw} line={p.line} eyes={[ex(-1), ex(1)]} ey={ey} seed={seed} />
      </g>
    </g>
  );
};

const Hair: React.FC<{ kind: StickFigureModel["params"]["hair"]; color: string; head: [number, number]; R: number; lw: number; seed: number }> = ({ kind, color, head, R, lw, seed }) => {
  const [cx, cy] = head;
  const o = (n: number) => ({ stroke: color, width: lw * 0.8, roughness: 0.6, seed: seed * 17 + n });
  if (kind === "none") return null;
  if (kind === "tuft")
    return (
      <g>
        {[-0.18, 0, 0.2].map((dx, i) => (
          <Curve key={i} points={[[cx + dx * R, cy - R * 0.98], [cx + dx * R * 1.6 - R * 0.06, cy - R * 1.25], [cx + dx * R * 2.2 + R * 0.04, cy - R * 1.42]]} o={o(i)} />
        ))}
      </g>
    );
  if (kind === "spiky")
    return (
      <g>
        {[-0.45, -0.15, 0.15, 0.45].map((dx, i) => (
          <Line key={i} x1={cx + dx * R} y1={cy - R * 0.9} x2={cx + dx * R * 1.5} y2={cy - R * 1.35} o={o(i)} />
        ))}
      </g>
    );
  if (kind === "curl") return <Curve points={[[cx - R * 0.1, cy - R], [cx + R * 0.15, cy - R * 1.32], [cx + R * 0.32, cy - R * 1.1], [cx + R * 0.12, cy - R * 1.02]]} o={o(0)} />;
  return <Circle cx={cx} cy={cy - R * 1.1} r={R * 0.28} fill={color} o={o(1)} />; // bun
};

const Accessory: React.FC<{ kind: StickFigureModel["params"]["accessory"]; color: string; head: [number, number]; R: number; lw: number; line: string; eyes: number[]; ey: number; seed: number }> = ({ kind, color, head, R, lw, line, eyes, ey, seed }) => {
  const [cx, cy] = head;
  const o = (n: number) => ({ stroke: line, width: lw * 0.7, roughness: 0.6, seed: seed * 23 + n });
  switch (kind) {
    case "glasses":
      return (
        <g>
          {eyes.map((x, i) => (
            <Circle key={i} cx={x} cy={ey} r={R * 0.2} o={o(i)} />
          ))}
          <Line x1={eyes[0] + R * 0.2} y1={ey} x2={eyes[1] - R * 0.2} y2={ey} o={o(5)} />
        </g>
      );
    case "beanie":
      return <Shape d={`M${cx - R * 0.98} ${cy - R * 0.25} Q${cx} ${cy - R * 1.65} ${cx + R * 0.98} ${cy - R * 0.25} Z`} fill={color} o={o(6)} />;
    case "cap":
      return <Shape d={`M${cx - R * 0.95} ${cy - R * 0.35} Q${cx} ${cy - R * 1.45} ${cx + R * 0.95} ${cy - R * 0.35} L${cx + R * 1.5} ${cy - R * 0.3} Z`} fill={color} o={o(7)} />;
    case "chef-hat":
      return <Shape d={`M${cx - R * 0.6} ${cy - R * 0.8} C${cx - R * 1.1} ${cy - R * 1.6} ${cx - R * 0.2} ${cy - R * 2.0} ${cx} ${cy - R * 1.6} C${cx + R * 0.2} ${cy - R * 2.0} ${cx + R * 1.1} ${cy - R * 1.6} ${cx + R * 0.6} ${cy - R * 0.8} Z`} fill="#fbf7ee" o={o(8)} />;
    case "scarf":
      return <Shape d={`M${cx - R * 0.6} ${cy + R * 0.95} Q${cx} ${cy + R * 1.25} ${cx + R * 0.6} ${cy + R * 0.95} L${cx + R * 0.5} ${cy + R * 1.5} L${cx + R * 0.25} ${cy + R * 1.45} Z`} fill={color} o={o(9)} />;
    case "bow":
      return <Shape d={`M${cx + R * 0.55} ${cy - R * 0.8} l${R * 0.38} ${-R * 0.22} l0 ${R * 0.44} Z M${cx + R * 0.55} ${cy - R * 0.8} l${-R * 0.38} ${-R * 0.22} l0 ${R * 0.44} Z`} fill={color} o={o(10)} />;
    default:
      return null;
  }
};
