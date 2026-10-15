/**
 * render-storybook — hand-drawn storybook scenes, one per sentence: a setting, the channel's
 * stick-figure character in a pose, and props from a fixed library. Everything is drawn in code
 * (free, deterministic); scripts describe scenes, never pixels.
 */
import { z } from "zod";

const color = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, 'must be a hex color like "#ff8800"');
const unit = z.number().min(0).max(1);

export const SETTINGS = ["hills", "beach", "sea", "plain", "desert", "snow", "night", "space", "room", "city"] as const;
export const TIMES = ["day", "dusk", "night"] as const;
export const CAMERAS = ["still", "push-in", "pull-out", "pan-left", "pan-right"] as const;
export const POSES = ["stand", "point", "wave", "think", "shrug", "cheer", "hold", "walk", "sit", "look-up", "facepalm"] as const;
export const PROPS = [
  "sign", "pile", "globe", "sun", "moon", "stars", "planet", "clock", "calendar", "jars", "cards", "coins", "money",
  "book", "paper", "tree", "palm", "bush", "mountain", "house", "footprints", "arrow", "question", "thought", "speech",
  "text", "dots", "drop", "bucket", "rocket", "car", "table", "sack", "box", "hourglass", "candle",
  "satellite", "phone", "dish", "telescope",
] as const;
/** Things a character can hold in its hands (drawn small at the hand). */
export const HOLDABLE = ["cards", "paper", "book", "clock", "coins", "drop", "globe", "sign", "candle", "phone"] as const;

export const figureSchema = z
  .object({
    pose: z.enum(POSES).default("stand"),
    x: unit.default(0.35).describe("horizontal position, 0 = left edge, 1 = right edge"),
    scale: z.number().min(0.3).max(2.5).default(1).describe("1 ≈ 37% of the scene height"),
    facing: z.enum(["left", "right"]).default("right"),
    expression: z.string().default("neutral"),
    hold: z.enum(HOLDABLE).optional(),
    hold_text: z.string().max(12).optional().describe("text on the held sign/paper/book"),
  })
  .strict();

export const propSchema = z
  .object({
    type: z.enum(PROPS),
    x: unit.default(0.65),
    y: unit.optional().describe("0 = top, 1 = bottom; defaults to the ground for ground things, the sky for sky things"),
    x2: unit.optional().describe("end point for arrow / footprints"),
    y2: unit.optional(),
    scale: z.number().min(0.2).max(4).default(1),
    text: z.string().max(28).optional().describe("words or numbers drawn on the prop (sign, calendar, clock, paper, text, speech, thought, arrow)"),
    count: z.number().int().min(1).max(400).optional().describe("jars, coins, dots, stars, footprints"),
    color: color.optional(),
    content: z.enum(["globe", "clock", "question", "cards", "coins", "sun", "moon", "planet", "drop", "money", "heart", "phone", "satellite"]).optional().describe("small picture inside a thought bubble"),
  })
  .strict();

export const storySceneSchema = z
  .object({
    setting: z.enum(SETTINGS),
    time: z.enum(TIMES).default("day"),
    camera: z.enum(CAMERAS).default("still"),
    character: figureSchema.nullable().default({ pose: "stand", x: 0.35, scale: 1, facing: "right", expression: "neutral" }),
    others: z.array(figureSchema).max(4).default([]).describe("extra background figures (same rig, don't speak)"),
    props: z.array(propSchema).max(8).default([]),
  })
  .strict();

export const beatVisualSchema = z
  .object({
    skill: z.literal("render-storybook"),
    scenes: z.array(storySceneSchema).min(1).max(6).describe("one scene per sentence of the voiceover, in order"),
  })
  .strict();

export const storybookSchema = z
  .object({
    title: z.string().min(3).max(64).describe("title bar shown above the scene for the whole video"),
    highlight: z.array(z.string().min(1)).max(4).default([]).describe("parts of the title drawn in the accent colour"),
  })
  .strict();

export type StoryScene = z.infer<typeof storySceneSchema>;
export type Figure = z.infer<typeof figureSchema>;
export type StoryProp = z.infer<typeof propSchema>;
export type StoryBeatVisual = z.infer<typeof beatVisualSchema>;
export type Storybook = z.infer<typeof storybookSchema>;

export function storyText(book: Storybook | undefined, beats: { visual: unknown }[]): string[] {
  const out: string[] = book ? [book.title] : [];
  for (const b of beats) {
    for (const scene of ((b.visual as StoryBeatVisual).scenes ?? []) as StoryScene[]) {
      for (const p of scene.props ?? []) if (p.text) out.push(p.text);
      for (const f of [scene.character, ...(scene.others ?? [])]) if (f?.hold_text) out.push(f.hold_text);
    }
  }
  return out.filter(Boolean);
}

export function checkStoryBeat(visual: StoryBeatVisual, beatId: string, sentences: number): string[] {
  const problems: string[] = [];
  if (visual.scenes.length > sentences + 2) problems.push(`beat "${beatId}": ${visual.scenes.length} scenes for ${sentences} sentence(s) — use about one scene per sentence`);
  visual.scenes.forEach((s, i) => {
    for (const p of s.props) {
      if ((p.type === "arrow" || p.type === "footprints") && p.x2 === undefined) problems.push(`beat "${beatId}" scene ${i + 1}: ${p.type} needs x2 (where it ends)`);
      if (["sign", "calendar", "speech", "text"].includes(p.type) && !p.text) problems.push(`beat "${beatId}" scene ${i + 1}: ${p.type} needs "text"`);
    }
  });
  return problems;
}
