import * as THREE from "three";
import type { Part } from "./schema.ts";

/** Low-poly geometry for one part. Long axis is Y; sizes in cm (1 world unit = 1 cm). */
export function partGeometry(part: Part): THREE.BufferGeometry {
  const r = part.radius ?? 0.5;
  const L = part.length ?? 1;
  switch (part.shape) {
    case "cylinder":
      return new THREE.CylinderGeometry(part.radius_top ?? r, part.radius_bottom ?? r, L, 12, 1);
    case "cone":
      return new THREE.CylinderGeometry(part.radius_top ?? 0, part.radius_bottom ?? r, L, 12, 1);
    case "tube": {
      const inner = part.inner_radius ?? r * 0.7;
      const pts = [new THREE.Vector2(inner, -L / 2), new THREE.Vector2(r, -L / 2), new THREE.Vector2(r, L / 2), new THREE.Vector2(inner, L / 2), new THREE.Vector2(inner, -L / 2)];
      return new THREE.LatheGeometry(pts, 14);
    }
    case "sphere":
      return new THREE.IcosahedronGeometry(r, 1);
    case "box":
      return new THREE.BoxGeometry(part.width ?? 1, part.height ?? 1, part.depth ?? 1);
    case "capsule":
      return new THREE.CapsuleGeometry(r, Math.max(0.001, L - 2 * r), 3, 10);
    case "torus": {
      const g = new THREE.TorusGeometry(r, part.tube_radius ?? r * 0.2, 8, 18);
      g.rotateX(Math.PI / 2); // ring around the Y axis, like a washer on a shaft
      return g;
    }
    case "disc":
      return new THREE.CylinderGeometry(r, r, part.length ?? Math.max(0.05, r * 0.12), 16, 1);
    case "spring": {
      const turns = part.turns ?? 8;
      const wire = part.wire ?? Math.max(0.02, r * 0.12);
      const curve = new HelixCurve(r, L, turns);
      return new THREE.TubeGeometry(curve, Math.round(turns * 14), wire, 6, false);
    }
  }
}

class HelixCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private readonly radius: number,
    private readonly length: number,
    private readonly turns: number,
  ) {
    super();
  }
  getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const a = t * this.turns * Math.PI * 2;
    return target.set(Math.cos(a) * this.radius, (t - 0.5) * this.length, Math.sin(a) * this.radius);
  }
}

/** Half-size of a part's bounding box in its own frame (before rotation). */
export function partHalfExtents(part: Part): [number, number, number] {
  const r = part.radius ?? 0.5;
  const L = part.length ?? 1;
  switch (part.shape) {
    case "cylinder":
    case "cone": {
      const rr = Math.max(part.radius_top ?? 0, part.radius_bottom ?? r, part.radius ?? 0);
      return [rr, L / 2, rr];
    }
    case "tube":
      return [r, L / 2, r];
    case "sphere":
      return [r, r, r];
    case "box":
      return [(part.width ?? 1) / 2, (part.height ?? 1) / 2, (part.depth ?? 1) / 2];
    case "capsule":
      return [r, L / 2, r];
    case "torus": {
      const tr = part.tube_radius ?? r * 0.2;
      return [r + tr, tr, r + tr];
    }
    case "disc":
      return [r, (part.length ?? Math.max(0.05, r * 0.12)) / 2, r];
    case "spring": {
      const w = part.wire ?? Math.max(0.02, r * 0.12);
      return [r + w, L / 2 + w, r + w];
    }
  }
}

/** Axis-aligned half extents after the part's rotation (conservative when rotated). */
export function rotatedHalfExtents(part: Part): [number, number, number] {
  const h = partHalfExtents(part);
  if (!part.rotation || part.rotation.every((d) => Math.abs(d) < 0.01)) return h;
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...part.rotation.map((d) => THREE.MathUtils.degToRad(d)) as [number, number, number]));
  const e = m.elements;
  // |R| * h gives the extents of a rotated box.
  return [
    Math.abs(e[0]) * h[0] + Math.abs(e[4]) * h[1] + Math.abs(e[8]) * h[2],
    Math.abs(e[1]) * h[0] + Math.abs(e[5]) * h[1] + Math.abs(e[9]) * h[2],
    Math.abs(e[2]) * h[0] + Math.abs(e[6]) * h[1] + Math.abs(e[10]) * h[2],
  ];
}

export const MATERIAL_LOOK: Record<string, { metalness: number; roughness: number; opacity?: number }> = {
  plastic: { metalness: 0.0, roughness: 0.42 },
  metal: { metalness: 1.0, roughness: 0.22 },
  glass: { metalness: 0.0, roughness: 0.05, opacity: 0.3 },
  rubber: { metalness: 0.0, roughness: 0.9 },
  ink: { metalness: 0.1, roughness: 0.15 },
  paper: { metalness: 0.0, roughness: 0.95 },
  wood: { metalness: 0.0, roughness: 0.75 },
  fabric: { metalness: 0.0, roughness: 1.0 },
};
