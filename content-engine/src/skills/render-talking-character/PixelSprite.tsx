import React from "react";
import type { PoseInput } from "./OrbBot3D.tsx";
import type { PixelSpriteModel } from "./rigs.ts";

const GRID = 16;
const CELL = 22;
const OFFSET = (400 - GRID * CELL) / 2;

/** Which cells are body, row by row: [first column, last column] spans. */
const BODY: Record<number, [number, number][]> = {
  3: [[5, 10]],
  4: [[4, 11]],
  5: [[3, 12]],
  6: [[3, 12]],
  7: [[3, 12]],
  8: [[3, 12]],
  9: [[3, 12]],
  10: [[3, 12]],
  11: [[3, 12]],
  12: [[3, 12]],
  13: [[4, 11]],
  14: [[4, 6], [9, 11]],
};
const isBody = (x: number, y: number) => (BODY[y] ?? []).some(([a, b]) => x >= a && x <= b);

/** The pixel-sprite rig: a 16×16 game sprite. It moves in whole pixels, a few times a second, like an old console. */
export const PixelSprite: React.FC<{ model: PixelSpriteModel; size: number; pose: PoseInput }> = ({ model, size, pose }) => {
  const p = model.params;
  const e = pose.expression;
  const tick = Math.floor(pose.t * 6) / 6;
  const hop = pose.energy * e.bounce > 0.35 ? -1 : 0;
  const dy = Math.round(Math.sin(tick * 2.4)) + hop;
  const cells: { x: number; y: number; c: string }[] = [];
  const put = (x: number, y: number, c: string) => cells.push({ x, y, c });

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (isBody(x, y)) put(x, y, y >= 11 ? (p.shade ?? p.body) : p.body);
      else if (isBody(x - 1, y) || isBody(x + 1, y) || isBody(x, y - 1) || isBody(x, y + 1)) put(x, y, p.outline);
    }
  }
  put(5, 5, "#ffffff");
  put(6, 5, "#ffffff");
  if (p.feature === "horns") for (const [x, y] of [[4, 2], [3, 1], [11, 2], [12, 1]]) put(x, y, p.accent);
  if (p.feature === "antenna") for (const [x, y, c] of [[7, 2, p.outline], [7, 1, p.outline], [7, 0, p.accent], [8, 0, p.accent]] as const) put(x, y, c);
  if (p.feature === "cap") {
    for (let x = 4; x <= 11; x++) put(x, 2, p.accent);
    for (let x = 4; x <= 14; x++) put(x, 3, p.accent);
  }

  // Eyes: two pixels wide; taller when wide-eyed, a single dark row when shut.
  const shut = Math.max(e.lid, pose.blink) > 0.5;
  const tall = e.eye_scale > 1.2 ? 3 : 2;
  const lx = e.look[0] > 0.2 ? 1 : 0;
  const ly = e.look[1] > 0.2 ? 1 : 0;
  for (const ex of [5, 9]) {
    if (shut) {
      put(ex, 8, p.outline);
      put(ex + 1, 8, p.outline);
    } else {
      for (let r = 0; r < tall; r++) {
        put(ex, 8 - r, p.eye);
        put(ex + 1, 8 - r, p.eye);
      }
      put(ex + lx, 8 - (tall - 1) + Math.min(ly + (e.pupil_scale < 0.7 ? 1 : 0), tall - 1), p.pupil);
    }
  }
  // Brows: one row above the eyes; they lift, or slant inwards (down) or outwards (worried).
  const browY = 8 - tall - (e.brow === "up" ? 1 : 0);
  const slant = e.brow === "down" ? 1 : e.brow === "worried" ? -1 : 0;
  put(5, browY - Math.max(0, slant), p.outline);
  put(6, browY + Math.max(0, slant) - Math.max(0, -slant), p.outline);
  put(9, browY + Math.max(0, slant) - Math.max(0, -slant), p.outline);
  put(10, browY - Math.max(0, slant), p.outline);

  // Mouth: a row of four; corners turn up or down; it opens one to three pixels with the voice.
  const open = Math.round(pose.mouth * 3);
  if (open > 0) {
    for (let r = 0; r < open; r++) for (let x = 6; x <= 9; x++) put(x, 11 + r, r === open - 1 && open > 1 ? p.accent : p.outline);
  } else {
    for (let x = 6; x <= 9; x++) put(x, 11, p.outline);
    const corner = e.mouth_curve > 0.4 ? -1 : e.mouth_curve < -0.05 ? 1 : 0;
    if (corner) {
      put(5, 11 + corner, p.outline);
      put(10, 11 + corner, p.outline);
    }
  }

  return (
    <svg width={size} height={size} viewBox="0 0 400 400" shapeRendering="crispEdges">
      <g transform={`translate(${OFFSET} ${OFFSET + dy * CELL})`}>
        {cells.map((c, i) => (
          <rect key={i} x={c.x * CELL} y={c.y * CELL} width={CELL} height={CELL} fill={c.c} />
        ))}
      </g>
    </svg>
  );
};
