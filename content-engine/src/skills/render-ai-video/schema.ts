/**
 * render-ai-video — realistic footage from a video model (Google Veo through the Gemini API, paid).
 * A beat is 1–4 shots; in each shot the photoreal character says one line, either on camera (lip-synced)
 * or from behind the phone while it films the place (camera "pov"). Scripts describe shots in words; the engine turns them into prompts.
 */
import { z } from "zod";
import { voiceTokens } from "../write-script/schema.ts";

export const CAMERAS = ["selfie", "selfie-walk", "over-shoulder", "wide", "pov", "closeup", "establishing", "silhouette"] as const;
/** Cameras that don't show the character's face: the line is narrated off screen (voice-over). */
export const OFF_CAMERA: readonly Shot["camera"][] = ["pov", "establishing", "silhouette"];

export const shotSchema = z
  .object({
    place: z.string().min(12).max(400).describe("where the shot is and what is visible, concrete and period-accurate"),
    action: z.string().min(4).max(240).describe("what the character does while talking (pov: what the camera does, e.g. tilts up to the ceiling)"),
    camera: z.enum(CAMERAS).default("selfie"),
    line: z.string().min(1).max(200).describe("exactly what the character says in this shot (a slice of the beat's voiceover)"),
    others: z.string().max(240).optional().describe("other people in the shot (they don't speak)"),
    sound: z.string().max(160).optional().describe("ambient sound (no music)"),
    expression: z.string().optional().describe("a key from the character's model.json → expressions"),
  })
  .strict();

export const beatVisualSchema = z
  .object({
    skill: z.literal("render-ai-video"),
    shots: z.array(shotSchema).min(1).max(4).describe("in order; their lines together are the beat's voiceover"),
  })
  .strict();

export const worldSchema = z
  .object({
    world: z.string().min(12).max(400).describe("when and where the whole episode happens (era, city, season, light)"),
    look: z.string().max(240).default("handheld smartphone vlog footage, natural light, realistic skin texture, shallow depth of field"),
    grade: z.enum(["natural", "cinematic"]).default("natural").describe("cinematic: film grade, vignette, grain and a slow push-in on every shot"),
    score: z.enum(["none", "space-drone"]).default("none").describe("a generated music bed under the voice (free, made locally)"),
  })
  .strict();

export type Shot = z.infer<typeof shotSchema>;
export type AiBeatVisual = z.infer<typeof beatVisualSchema>;
export type AiWorld = z.infer<typeof worldSchema>;

const norm = (s: string) => voiceTokens(s).join(" ");

/** The longest line a clip can hold: the longest clip minus a little air, at the model's speaking rate. */
export function maxWordsPerShot(clipSeconds: number[], wordsPerSecond: number): number {
  return Math.floor((Math.max(...clipSeconds) - 1) * wordsPerSecond);
}

export function checkAiBeat(visual: AiBeatVisual, beatId: string, voiceover: string, maxWords: number): string[] {
  const problems: string[] = [];
  const joined = visual.shots.map((s) => norm(s.line)).join(" ");
  if (joined !== norm(voiceover)) {
    problems.push(`beat "${beatId}": the shots' lines together must be exactly the voiceover ("${voiceover}"), got "${visual.shots.map((s) => s.line).join(" ")}"`);
  }
  visual.shots.forEach((s, i) => {
    const n = voiceTokens(s.line).length;
    if (n > maxWords) problems.push(`beat "${beatId}" shot ${i + 1}: ${n} words — a clip holds at most ${maxWords}; split the line into two shots`);
    if (/["“”]/.test(s.line)) problems.push(`beat "${beatId}" shot ${i + 1}: no double quotes inside a line (they break the prompt)`);
  });
  return problems;
}
