import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useMemo } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Expression, OrbBot3dModel } from "./rigs.ts";

export interface PoseInput {
  t: number;
  mouth: number;
  blink: number;
  expression: Expression;
  /** Extra bob from speech energy, 0–1. */
  energy: number;
}

/** Studio reflections for chrome without loading any files. */
export const StudioEnvironment: React.FC<{ intensity?: number }> = ({ intensity = 1 }) => {
  const { gl, scene } = useThree();
  useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = intensity;
    pmrem.dispose();
  }, [gl, scene, intensity]);
  return null;
};

const Camera: React.FC = () => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.fov = 30;
  camera.position.set(0, 0.15, 6.2);
  camera.lookAt(0, 0.05, 0);
  camera.updateProjectionMatrix();
  return null;
};

/** The orb-bot rig: round body, one or two big eyes, LED mouth, antenna, stubby arms. */
const OrbBot: React.FC<{ model: OrbBot3dModel; pose: PoseInput }> = ({ model, pose }) => {
  const p = model.params;
  const e = pose.expression;
  const R = 1;
  const facets = p.body.facets;
  const hover = Math.sin(pose.t * 2.1) * p.hover;
  const talkBob = pose.energy * e.bounce * 0.08;
  const tilt = THREE.MathUtils.degToRad(e.tilt_deg + Math.sin(pose.t * 1.3) * 2);
  const eyeR = R * p.eye.size * e.eye_scale;
  const lid = Math.min(0.95, Math.max(e.lid, pose.blink));
  const look = new THREE.Vector2(e.look[0] * eyeR * 0.3, e.look[1] * eyeR * 0.25);
  const eyes = p.eye.count === 1 ? [0] : [-0.42, 0.42];
  const mouthCount = 7;

  const body = useMemo(() => {
    if (p.body.shape === "capsule") return new THREE.CapsuleGeometry(R * 0.82, R * 0.5, 6, facets);
    if (p.body.shape === "rounded-box") return new THREE.BoxGeometry(R * 1.7, R * 1.7, R * 1.6, 2, 2, 2);
    return new THREE.SphereGeometry(R, facets, Math.round(facets * 0.75));
  }, [p.body.shape, facets]);

  const chrome = <meshStandardMaterial color={p.body.color} metalness={p.body.metalness} roughness={p.body.roughness} flatShading={facets < 20} envMapIntensity={1.2} />;
  return (
    <group position={[0, hover + talkBob - 0.05, 0]} rotation={[0, Math.sin(pose.t * 0.7) * 0.12, tilt]} scale={1 - pose.energy * 0.02}>
      <mesh geometry={body}>{chrome}</mesh>
      {/* eye(s): dark socket ring standing out of the body, white, glowing iris, pupil, shutter lid */}
      {eyes.map((x, i) => {
        const front = R * 0.93 + 0.1;
        return (
          <group key={i} position={[0, 0.16 * R, 0]} rotation={[-0.06, x * 0.55, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, R * 0.93]}>
              <cylinderGeometry args={[eyeR * 1.16, eyeR * 1.22, 0.2, 40]} />
              <meshStandardMaterial color="#161a21" metalness={0.5} roughness={0.35} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, front + 0.004]}>
              <cylinderGeometry args={[eyeR, eyeR, 0.01, 40]} />
              <meshStandardMaterial color={p.eye.sclera} roughness={0.25} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[look.x, look.y, front + 0.012]}>
              <cylinderGeometry args={[eyeR * 0.56, eyeR * 0.56, 0.01, 36]} />
              <meshStandardMaterial color={p.eye.iris} emissive={p.eye.iris} emissiveIntensity={p.eye.glow * e.glow * 0.9} roughness={0.3} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[look.x * 1.12, look.y * 1.12, front + 0.02]}>
              <cylinderGeometry args={[eyeR * 0.27 * e.pupil_scale, eyeR * 0.27 * e.pupil_scale, 0.01, 28]} />
              <meshStandardMaterial color={p.eye.pupil} roughness={0.2} />
            </mesh>
            <mesh position={[look.x + eyeR * 0.24, look.y + eyeR * 0.26, front + 0.03]}>
              <sphereGeometry args={[eyeR * 0.11, 12, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh visible={lid > 0.02} position={[0, eyeR * 1.2 - eyeR * 1.2 * lid, front + 0.045]}>
              <boxGeometry args={[eyeR * 2.4, Math.max(0.001, eyeR * 2.4 * lid), 0.05]} />
              <meshStandardMaterial color={p.body.color} metalness={p.body.metalness} roughness={p.body.roughness + 0.1} />
            </mesh>
          </group>
        );
      })}
      {/* LED mouth: bars grow with loudness */}
      {p.mouth.style !== "none" && (
        <group position={[0, -0.42 * R, R * 0.9]} rotation={[0.42, 0, 0]}>
          <mesh position={[0, 0, -0.03]}>
            <boxGeometry args={[p.mouth.width * 2 * R + 0.1, 0.2, 0.05]} />
            <meshStandardMaterial color="#14171d" metalness={0.5} roughness={0.5} />
          </mesh>
          {p.mouth.style === "led-bar"
            ? Array.from({ length: mouthCount }, (_, i) => {
                const x = (i / (mouthCount - 1) - 0.5) * p.mouth.width * 2 * R * 0.9;
                const centre = 1 - Math.abs(i / (mouthCount - 1) - 0.5) * 1.4;
                const h = 0.03 + pose.mouth * 0.16 * (0.55 + 0.45 * centre);
                return (
                  <mesh key={i} position={[x, 0, 0.01]}>
                    <boxGeometry args={[0.05, h, 0.03]} />
                    <meshStandardMaterial color={p.mouth.color} emissive={p.mouth.color} emissiveIntensity={0.6 + pose.mouth * 1.4} />
                  </mesh>
                );
              })
            : (
              <mesh position={[0, 0, 0.01]} scale={[1, 0.15 + pose.mouth * 1.8, 1]}>
                <boxGeometry args={[p.mouth.width * 2 * R * 0.8, 0.06, 0.03]} />
                <meshStandardMaterial color={p.mouth.color} emissive={p.mouth.color} emissiveIntensity={0.8} />
              </mesh>
            )}
        </group>
      )}
      {/* ear bolts */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * R * 0.98, 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.16, 0.2, 0.16, 12]} />
          <meshStandardMaterial color={p.accent} metalness={0.3} roughness={0.35} />
        </mesh>
      ))}
      {p.antenna.enabled && (
        <group position={[0.15, R * 0.92, 0]} rotation={[0, 0, -0.2 + Math.sin(pose.t * 3) * 0.06 + pose.energy * 0.1]}>
          <mesh position={[0, p.antenna.length / 2, 0]}>
            <cylinderGeometry args={[0.025, 0.035, p.antenna.length, 8]} />
            <meshStandardMaterial color={p.antenna.color} metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, p.antenna.length + 0.06, 0]}>
            <sphereGeometry args={[0.09, 12, 10]} />
            <meshStandardMaterial color={p.antenna.tip} emissive={p.antenna.tip} emissiveIntensity={0.5 + pose.mouth * 0.8} />
          </mesh>
        </group>
      )}
      {p.arms === "stubs" &&
        [-1, 1].map((s) => (
          <mesh key={s} position={[s * R * 0.92, -0.45, 0.15]} rotation={[0.2, 0, s * (0.9 + Math.sin(pose.t * 2.4 + s) * 0.12 + pose.energy * 0.25)]}>
            <capsuleGeometry args={[0.11, 0.32, 4, 8]} />
            <meshStandardMaterial color={p.body.color} metalness={p.body.metalness} roughness={p.body.roughness + 0.05} />
          </mesh>
        ))}
    </group>
  );
};

export const OrbBot3D: React.FC<{ model: OrbBot3dModel; size: number; pose: PoseInput }> = ({ model, size, pose }) => {
  return (
    <ThreeCanvas width={size} height={size} gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }} style={{ background: "transparent" }}>
      <Camera />
      <StudioEnvironment intensity={1.1} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[2.5, 3, 4]} intensity={2.2} />
      <directionalLight position={[-3, 1, -2]} intensity={1.4} color="#9fd8ff" />
      <OrbBot model={model} pose={pose} />
    </ThreeCanvas>
  );
};
