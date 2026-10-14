import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { fontFor } from "../../render/fonts.ts";
import { useQaProbe } from "../../render/qa-probe.ts";
import { characterRect, clamp, easeOut, regions } from "../../render/timeline.ts";
import type { BeatSpan, EpisodeProps, Rect } from "../../render/types.ts";
import { StudioEnvironment } from "../render-talking-character/OrbBot3D.tsx";
import { cameraFor, partOffset, poseAt, project, staggered, type CamPose } from "./camera.ts";
import { MATERIAL_LOOK, partGeometry } from "./geometry.ts";
import type { Beat3dVisual, Part, Scene3d } from "./schema.ts";

export interface SceneProps {
  props: EpisodeProps;
  spans: BeatSpan[];
  /** Frame offset of the enclosing <Sequence>, so absolute time can be recovered. */
  from: number;
}

/** The stage the object is framed into depends on whether the character takes the lower half. */
export function stageFor(span: BeatSpan, props: EpisodeProps): Rect {
  const r = regions(props.width, props.height, props.safeArea);
  if (span.beat.character.placement === "full" && props.renderSkills.includes("render-talking-character")) {
    const ch = characterRect("full", props.width, props.height, props.safeArea);
    return { x: r.stage.x, y: r.stage.y, w: r.stage.w, h: Math.max(240, ch.y - r.stage.y + 40) };
  }
  return { x: r.stage.x + 40, y: r.stage.y + 10, w: r.stage.w - 80, h: r.stage.h - 30 };
}

const CameraRig: React.FC<{ pose: CamPose; stage: Rect; width: number; height: number }> = ({ pose, stage, width, height }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  cameraFor(pose, width, height, stage, camera);
  return null;
};

const PartMesh: React.FC<{ part: Part; index: number; count: number; pose: CamPose; t: number; accent: string }> = ({ part, index, count, pose, t, accent }) => {
  const geometry = useMemo(() => partGeometry(part), [part]);
  const look = MATERIAL_LOOK[part.material] ?? MATERIAL_LOOK.plastic;
  const pos = partOffset(part, pose.explode, index, count);
  const e = staggered(pose.explode, index, count);
  pos.y += Math.sin(t * 1.4 + index * 1.7) * 0.06 * e * Math.max(0.5, Math.abs(part.explode[1]) / 4);
  let opacity = part.opacity ?? look.opacity ?? 1;
  if (part.shell) opacity = Math.min(opacity, 1 - pose.inside * 0.86);
  const focused = pose.focus === part.id;
  if (pose.focus && !focused && !part.shell) opacity *= 0.55;
  const rot = (part.rotation ?? [0, 0, 0]).map((d) => THREE.MathUtils.degToRad(d)) as [number, number, number];
  return (
    <mesh geometry={geometry} position={pos} rotation={rot} renderOrder={part.shell ? 2 : 1}>
      <meshStandardMaterial
        color={part.color}
        metalness={look.metalness}
        roughness={look.roughness}
        flatShading
        transparent={opacity < 0.999}
        opacity={opacity}
        depthWrite={opacity >= 0.999}
        emissive={focused ? accent : "#000000"}
        emissiveIntensity={focused ? 0.22 + 0.08 * Math.sin(t * 5) : 0}
        side={part.shell && opacity < 0.999 ? THREE.DoubleSide : THREE.FrontSide}
      />
    </mesh>
  );
};

interface Placed {
  part: Part;
  anchor: { x: number; y: number };
  side: "left" | "right";
  y: number;
  appear: number;
}

const LABEL_W = 330;
const LABEL_H = 92;

function layoutCallouts(callouts: Part[], anchors: { x: number; y: number }[], area: Rect, avoid: Rect | null, centreX: number): Placed[] {
  const placed: Placed[] = callouts.map((part, i) => ({ part, anchor: anchors[i], side: anchors[i].x < centreX ? "left" : "right", y: anchors[i].y - LABEL_H / 2, appear: 0 }));
  // Balance sides when everything sits on one side of the object.
  const left = placed.filter((p) => p.side === "left").length;
  if (placed.length > 1 && (left === 0 || left === placed.length)) placed.forEach((p, i) => (p.side = i % 2 === 0 ? "left" : "right"));
  for (const side of ["left", "right"] as const) {
    const group = placed.filter((p) => p.side === side).sort((a, b) => a.y - b.y);
    const maxBottom = side === "left" && avoid ? Math.min(area.y + area.h, avoid.y - 8) : area.y + area.h;
    let cursor = area.y;
    for (const p of group) {
      p.y = Math.max(p.y, cursor);
      cursor = p.y + LABEL_H + 14;
    }
    let overflow = cursor - 14 - maxBottom;
    for (let i = group.length - 1; i >= 0 && overflow > 0; i--) {
      group[i].y -= overflow;
      overflow = i > 0 ? group[i - 1].y + LABEL_H + 14 - group[i].y : 0;
    }
    for (const p of group) p.y = clamp(p.y, area.y, maxBottom - LABEL_H);
  }
  return placed;
}

const Callout: React.FC<{ p: Placed; area: Rect; font: ReturnType<typeof fontFor>; accent: string; probe: boolean }> = ({ p, area, font, accent, probe }) => {
  const ref = useRef<HTMLDivElement>(null);
  useQaProbe(probe && p.appear > 0.5, ref, `label:${p.part.id}`, "label");
  const x = p.side === "left" ? area.x : area.x + area.w - LABEL_W;
  const edgeX = p.side === "left" ? x + LABEL_W : x;
  const edgeY = p.y + LABEL_H / 2;
  const k = easeOut(p.appear);
  const lineEnd = { x: edgeX + (p.anchor.x - edgeX) * k, y: edgeY + (p.anchor.y - edgeY) * k };
  return (
    <>
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: clamp(p.appear * 2) }} width={1} height={1}>
        <line x1={edgeX} y1={edgeY} x2={lineEnd.x} y2={lineEnd.y} stroke={accent} strokeWidth={5} strokeLinecap="round" />
        <circle cx={p.anchor.x} cy={p.anchor.y} r={12 * k} fill={accent} stroke="#ffffff" strokeWidth={4} />
      </svg>
      <div
        ref={ref}
        style={{
          position: "absolute",
          left: x,
          top: p.y,
          width: LABEL_W,
          height: LABEL_H,
          boxSizing: "border-box",
          padding: "10px 18px",
          borderRadius: 22,
          background: "rgba(10, 14, 24, 0.82)",
          border: `4px solid ${accent}`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: p.side === "left" ? "flex-end" : "flex-start",
          textAlign: p.side === "left" ? "right" : "left",
          overflow: "hidden",
          opacity: clamp(p.appear * 1.6),
          transform: `translateX(${(1 - k) * (p.side === "left" ? -40 : 40)}px)`,
        }}
      >
        <div style={{ fontFamily: font.family, fontWeight: font.heavy, fontSize: p.part.label.length > 16 ? 34 : 40, color: "#ffffff", lineHeight: 1.05, whiteSpace: "nowrap" }}>{p.part.label}</div>
        {p.part.note && <div style={{ fontFamily: font.family, fontWeight: font.regular, fontSize: 25, color: "rgba(255,255,255,0.78)", marginTop: 4, whiteSpace: "nowrap" }}>{p.part.note}</div>}
      </div>
    </>
  );
};

/** render-3d-explainer: the camera flies into an everyday object, it explodes, callouts label the parts. */
export const Scene3D: React.FC<SceneProps> = ({ props, spans, from }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = (frame + from) / fps;
  const scene = props.script.visuals["render-3d-explainer"] as Scene3d;
  const span = spans.reduce((cur, s) => (t >= s.start ? s : cur), spans[0]);
  const stage = stageFor(span, props);
  const pose = poseAt(t, spans, scene, (s) => stageFor(s, props), height);
  const camera = cameraFor(pose, width, height, stage);
  const font = fontFor(props.brand.font);
  const accent = props.brand.accent_color;
  const bg = scene.background ?? { top: props.brand.background[0], bottom: props.brand.background[1] };

  const visual = span.beat.visual as Beat3dVisual;
  const callouts = visual.skill === "render-3d-explainer" ? visual.callouts.map((id) => scene.parts.find((p) => p.id === id)!).filter(Boolean) : [];
  const anchors = callouts.map((part) => {
    const idx = scene.parts.indexOf(part);
    const c = partOffset(part, pose.explode, idx, scene.parts.length);
    if (part.anchor) c.add(new THREE.Vector3(...part.anchor));
    return project(c, camera, width, height);
  });
  const r = regions(width, height, props.safeArea);
  const area: Rect = { x: r.safe.x, y: r.stage.y, w: r.safe.w, h: r.stage.h };
  const avoid = props.renderSkills.includes("render-talking-character") && span.beat.character.placement === "corner" ? characterRect("corner", width, height, props.safeArea) : null;
  const placed = layoutCallouts(callouts, anchors, area, avoid, width / 2);
  placed.forEach((p, i) => {
    const appearAt = span.voiceStart + 0.35 + i * 0.45;
    const fadeOut = clamp((span.end - t) / 0.2);
    p.appear = clamp((t - appearAt) / 0.3) * fadeOut;
  });

  const fadeIn = clamp((frame + 1) / 6);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${bg.top} 0%, ${bg.bottom} 100%)`, opacity: fadeIn }}>
      <div
        style={{
          position: "absolute",
          left: stage.x + stage.w / 2 - 480,
          top: stage.y + stage.h / 2 - 480,
          width: 960,
          height: 960,
          borderRadius: "50%",
          background: `radial-gradient(closest-side, ${accent}33, ${accent}00)`,
        }}
      />
      <ThreeCanvas width={width} height={height} gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }} style={{ position: "absolute", left: 0, top: 0 }}>
        <CameraRig pose={pose} stage={stage} width={width} height={height} />
        <StudioEnvironment intensity={0.9} />
        <hemisphereLight args={["#dfe9ff", "#3a2f2a", 0.55]} />
        <directionalLight position={[6, 10, 8]} intensity={2.4} />
        <directionalLight position={[-8, 3, 5]} intensity={0.9} color="#bcd7ff" />
        <directionalLight position={[0, 5, -10]} intensity={1.3} color="#ffe2c4" />
        {scene.parts.map((part, i) => (
          <PartMesh key={part.id} part={part} index={i} count={scene.parts.length} pose={pose} t={t} accent={accent} />
        ))}
      </ThreeCanvas>
      {placed.map((p) => (
        <Callout key={p.part.id} p={p} area={area} font={font} accent={accent} probe={props.qaProbe} />
      ))}
    </AbsoluteFill>
  );
};
