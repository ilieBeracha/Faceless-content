/**
 * Node-side registry of render skills: how to validate their script payloads and which of their
 * text is factual (shown on screen, so it is fact-checked). The React components live next to
 * these schemas and are registered for Remotion in src/render/registry.tsx.
 */
import type { z } from "zod";
import * as explainer from "./render-3d-explainer/schema.ts";
import * as motion from "./render-motion-graphics/schema.ts";
import * as ai from "./render-ai-video/schema.ts";
import * as story from "./render-storybook/schema.ts";
import * as planet from "./render-planet-explainer/schema.ts";
import type { EngineConfig } from "../core/workspace.ts";

export interface RenderSkillSpec {
  name: string;
  layer: "scene" | "overlay";
  /** Schema for script.visuals[<skill>] (shared scene data), if the skill has one. */
  sceneSchema?: z.ZodType;
  sceneRequired: boolean;
  /** Schema for beat.visual when a beat uses this skill as its scene. */
  beatVisualSchema?: z.ZodType;
  check?(scene: unknown, beats: { id: string; visual: unknown; voiceover?: string }[], ctx: { config: EngineConfig }): string[];
  text?(scene: unknown, beats: { id: string; visual: unknown }[]): string[];
  /** Expression names a beat's visual uses (checked against the speaker's model.json). */
  expressionsUsed?(visual: unknown): string[];
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
    text: (_scene, beats) => beats.flatMap((b) => ((b.visual as motion.MgBeatVisual).elements ?? []).flatMap((el) => (el && typeof el === "object" ? motion.elementText(el) : []))).filter(Boolean),
  },
  "render-storybook": {
    name: "render-storybook",
    layer: "scene",
    sceneSchema: story.storybookSchema,
    sceneRequired: true,
    beatVisualSchema: story.beatVisualSchema,
    check: (_scene, beats) =>
      beats.flatMap((b) => {
        const sentences = (b.voiceover ?? "").split(/(?<=[.!?])\s+/).filter((s) => s.trim()).length;
        return story.checkStoryBeat(b.visual as story.StoryBeatVisual, b.id, Math.max(1, sentences));
      }),
    text: (scene, beats) => story.storyText(scene as story.Storybook | undefined, beats),
    expressionsUsed: (visual) => ((visual as story.StoryBeatVisual).scenes ?? []).flatMap((s) => [s.character?.expression, ...(s.others ?? []).map((o) => o.expression)]).filter((e): e is string => Boolean(e)),
  },
  "render-ai-video": {
    name: "render-ai-video",
    layer: "scene",
    sceneSchema: ai.worldSchema,
    sceneRequired: true,
    beatVisualSchema: ai.beatVisualSchema,
    check: (_scene, beats, { config }) => {
      const max = ai.maxWordsPerShot(config.ai_video.clip_seconds, config.ai_video.words_per_second);
      return beats.flatMap((b) => ai.checkAiBeat(b.visual as ai.AiBeatVisual, b.id, b.voiceover ?? "", max));
    },
    // The footage has no lettering (the prompts forbid it); captions and the headline are checked elsewhere.
    text: () => [],
    expressionsUsed: (visual) => ((visual as ai.AiBeatVisual).shots ?? []).map((s) => s.expression).filter((e): e is string => Boolean(e)),
  },
  "render-planet-explainer": {
    name: "render-planet-explainer",
    layer: "scene",
    sceneSchema: planet.sceneSchema,
    sceneRequired: true,
    beatVisualSchema: planet.beatVisualSchema,
    check: (_scene, beats) => beats.flatMap((b) => planet.checkBeat(b.visual as planet.PeBeatVisual, b.id, b.voiceover ?? "")),
    text: (scene, beats) => [
      (scene as planet.PeScene).planet.name,
      ...beats.flatMap((b) => ((b.visual as planet.PeBeatVisual).views ?? []).flatMap((v) => planet.viewText(v))),
    ],
  },
  "render-talking-character": {
    name: "render-talking-character",
    layer: "overlay",
    sceneRequired: false,
  },
};
