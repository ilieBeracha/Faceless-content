/**
 * Node-side registry of render skills: how to validate their script payloads and which of their
 * text is factual (shown on screen, so it is fact-checked). The React components live next to
 * these schemas and are registered for Remotion in src/render/registry.tsx.
 */
import type { z } from "zod";
import * as explainer from "./render-3d-explainer/schema.ts";
import * as motion from "./render-motion-graphics/schema.ts";

export interface RenderSkillSpec {
  name: string;
  layer: "scene" | "overlay";
  /** Schema for script.visuals[<skill>] (shared scene data), if the skill has one. */
  sceneSchema?: z.ZodType;
  sceneRequired: boolean;
  /** Schema for beat.visual when a beat uses this skill as its scene. */
  beatVisualSchema?: z.ZodType;
  check?(scene: unknown, beats: { id: string; visual: unknown }[]): string[];
  text?(scene: unknown, beats: { id: string; visual: unknown }[]): string[];
}

export const RENDER_SKILLS: Record<string, RenderSkillSpec> = {
  "render-3d-explainer": {
    name: "render-3d-explainer",
    layer: "scene",
    sceneSchema: explainer.sceneSchema,
    sceneRequired: true,
    beatVisualSchema: explainer.beatVisualSchema,
    check(scene, beats) {
      const s = scene as explainer.Scene3d;
      return [
        ...explainer.checkScene(s),
        ...beats.flatMap((b) => explainer.checkBeatVisual(b.visual as explainer.Beat3dVisual, s, b.id)),
      ];
    },
    text: (scene) => explainer.sceneText(scene as explainer.Scene3d),
  },
  "render-motion-graphics": {
    name: "render-motion-graphics",
    layer: "scene",
    sceneSchema: motion.sceneSchema,
    sceneRequired: false,
    beatVisualSchema: motion.beatVisualSchema,
    text: (_scene, beats) => beats.flatMap((b) => (b.visual as motion.MgBeatVisual).elements.flatMap(motion.elementText)).filter(Boolean),
  },
  "render-talking-character": {
    name: "render-talking-character",
    layer: "overlay",
    sceneRequired: false,
  },
};
