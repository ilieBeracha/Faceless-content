/**
 * Camera direction for the 3D explainer. Shots are described per beat ("establish", "fly-in",
 * "explode", "focus", "reassemble", "orbit"); framing is computed from the parts' sizes so a script
 * never needs camera coordinates. Every value is a pure function of time → deterministic renders.
 */
import * as THREE from "three";
import { clamp, easeInOut, lerp } from "../../render/timeline.ts";
import type { BeatSpan, Rect } from "../../render/types.ts";
import { rotatedHalfExtents } from "./geometry.ts";
import type { Beat3dVisual, Part, Scene3d } from "./schema.ts";

export const FOV = 30;

export interface CamPose {
  target: THREE.Vector3;
  distance: number;
  yaw: number; // degrees
  pitch: number; // degrees
  explode: number; // 0 assembled … 1 fully exploded
  focus: string | null;
  /** 0–1: how see-through shell parts are (1 = camera is inside the object). */
  inside: number;
}

interface Box {
  center: THREE.Vector3;
  half: THREE.Vector3;
}

export function staggered(explode: number, index: number, count: number): number {
  const s = 0.35;
  const k = count > 1 ? index / (count - 1) : 0;
  return easeInOut(clamp(explode * (1 + s) - s * k));
}

export function partOffset(part: Part, explode: number, index: number, count: number): THREE.Vector3 {
  const e = staggered(explode, index, count);
  return new THREE.Vector3(part.position[0] + part.explode[0] * e, part.position[1] + part.explode[1] * e, part.position[2] + part.explode[2] * e);
}

function boxOf(parts: Part[], explode: number, all: Part[]): Box {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const p of parts) {
    const c = partOffset(p, explode, all.indexOf(p), all.length);
    const h = rotatedHalfExtents(p);
    min.min(new THREE.Vector3(c.x - h[0], c.y - h[1], c.z - h[2]));
    max.max(new THREE.Vector3(c.x + h[0], c.y + h[1], c.z + h[2]));
  }
  return { center: min.clone().add(max).multiplyScalar(0.5), half: max.clone().sub(min).multiplyScalar(0.5) };
}

/** Distance at which a box fits inside the stage rectangle (with margin). */
function fitDistance(box: Box, stage: Rect, canvasH: number, margin: number): number {
  const tv = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const across = Math.max(box.half.x, box.half.z);
  const dV = (box.half.y * canvasH) / (tv * margin * stage.h);
  const dH = (across * canvasH) / (tv * margin * stage.w);
  return Math.max(dV, dH) + Math.max(box.half.x, box.half.z);
}

function shotPose(visual: Beat3dVisual, prev: CamPose, scene: Scene3d, stage: Rect, canvasH: number): CamPose {
  const parts = scene.parts;
  const byId = (id?: string) => parts.find((p) => p.id === id);
  switch (visual.shot) {
    case "establish": {
      const explode = visual.explode ?? 0;
      const box = boxOf(parts, explode, parts);
      return { target: box.center, distance: fitDistance(box, stage, canvasH, 0.78), yaw: 28, pitch: 10, explode, focus: null, inside: 0 };
    }
    case "explode": {
      const explode = visual.explode ?? 1;
      const box = boxOf(parts, explode, parts);
      return { target: box.center, distance: fitDistance(box, stage, canvasH, 0.82), yaw: prev.yaw + 22, pitch: 12, explode, focus: null, inside: 0 };
    }
    case "reassemble": {
      const explode = visual.explode ?? 0;
      const box = boxOf(parts, explode, parts);
      return { target: box.center, distance: fitDistance(box, stage, canvasH, 0.78), yaw: prev.yaw + 30, pitch: 10, explode, focus: null, inside: 0 };
    }
    case "fly-in":
    case "focus": {
      const part = byId(visual.target)!;
      const explode = visual.explode ?? prev.explode;
      const box = boxOf([part], explode, parts);
      const close = visual.shot === "fly-in";
      const distance = Math.max(fitDistance(box, stage, canvasH, close ? 0.55 : 0.35), close ? 1.2 : 2.5);
      return { target: box.center, distance, yaw: prev.yaw + (close ? 18 : 12), pitch: close ? 6 : 9, explode, focus: part.id, inside: close ? 1 : explode < 0.3 ? 0.8 : 0 };
    }
    case "orbit":
      return { ...prev, target: prev.target.clone(), yaw: prev.yaw + 50 };
  }
}

function mix(a: CamPose, b: CamPose, k: number): CamPose {
  return {
    target: a.target.clone().lerp(b.target, k),
    distance: Math.exp(lerp(Math.log(a.distance), Math.log(b.distance), k)),
    yaw: lerp(a.yaw, b.yaw, k),
    pitch: lerp(a.pitch, b.pitch, k),
    explode: lerp(a.explode, b.explode, k),
    focus: k < 0.5 ? a.focus : b.focus,
    inside: lerp(a.inside, b.inside, k),
  };
}

/**
 * Camera pose at absolute time t. Each beat glides from where the previous beat ended to its own
 * shot during its first ~1.2 s, then drifts slowly so the frame never freezes.
 */
export function poseAt(t: number, spans: BeatSpan[], scene: Scene3d, stageFor: (span: BeatSpan) => Rect, canvasH: number): CamPose {
  const first = spans[0];
  const box = boxOf(scene.parts, 0, scene.parts);
  let pose: CamPose = { target: box.center, distance: fitDistance(box, stageFor(first), canvasH, 0.6) * 1.5, yaw: 10, pitch: 8, explode: 0, focus: null, inside: 0 };
  for (const span of spans) {
    if (t < span.start) break;
    const visual = span.beat.visual as Beat3dVisual;
    if (visual.skill !== "render-3d-explainer") continue;
    const dur = span.end - span.start;
    const glide = clamp(dur * 0.45, 0.6, 1.3);
    const target = shotPose(visual, pose, scene, stageFor(span), canvasH);
    const local = Math.min(t, span.end) - span.start;
    const k = easeInOut(local / glide);
    const drift = visual.shot === "orbit" ? 0 : Math.max(0, local - glide) * (visual.shot === "establish" ? 9 : 5);
    const orbit = visual.shot === "orbit" ? (local / Math.max(0.1, dur)) * 50 : 0;
    const moved = mix(pose, target, k);
    moved.yaw += drift + orbit - (visual.shot === "orbit" ? 50 * k : 0);
    pose = moved;
  }
  return pose;
}

/** A three.js camera matching a pose, with the view shifted so the target sits at the stage centre. */
export function cameraFor(pose: CamPose, width: number, height: number, stage: Rect, camera = new THREE.PerspectiveCamera()): THREE.PerspectiveCamera {
  const yaw = THREE.MathUtils.degToRad(pose.yaw);
  const pitch = THREE.MathUtils.degToRad(pose.pitch);
  camera.fov = FOV;
  camera.aspect = width / height;
  camera.near = Math.max(0.01, pose.distance / 200);
  camera.far = pose.distance * 50 + 100;
  camera.position.set(
    pose.target.x + pose.distance * Math.sin(yaw) * Math.cos(pitch),
    pose.target.y + pose.distance * Math.sin(pitch),
    pose.target.z + pose.distance * Math.cos(yaw) * Math.cos(pitch),
  );
  camera.lookAt(pose.target);
  const cx = stage.x + stage.w / 2;
  const cy = stage.y + stage.h / 2;
  camera.setViewOffset(width, height, width / 2 - cx, height / 2 - cy, width, height);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

/** Screen position (px) of a world point. */
export function project(point: THREE.Vector3, camera: THREE.PerspectiveCamera, width: number, height: number): { x: number; y: number; behind: boolean } {
  const v = point.clone().project(camera);
  return { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height, behind: v.z > 1 };
}
