/**
 * Character rigs: generic, parameterised character builders. A channel's character picks a rig in
 * characters/<name>/model.json and sets its parameters + expressions — no code per character.
 */
import { z } from "zod";

const color = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, 'must be a hex color like "#ff8800"');

/** Expression = small set of overrides applied on top of the neutral pose. */
export const expressionSchema = z
  .object({
    eye_scale: z.number().min(0.5).max(1.6).default(1),
    pupil_scale: z.number().min(0.4).max(1.6).default(1),
    lid: z.number().min(0).max(0.9).default(0).describe("0 = eye fully open, 0.9 = nearly closed"),
    tilt_deg: z.number().min(-25).max(25).default(0),
    look: z.tuple([z.number().min(-1).max(1), z.number().min(-1).max(1)]).default([0, 0]),
    bounce: z.number().min(0).max(1).default(0.3).describe("how much the body bobs while talking"),
    brow: z.enum(["flat", "up", "down", "worried"]).default("flat"),
    mouth_curve: z.number().min(-1).max(1).default(0.2).describe("-1 frown … 1 big smile (2D rigs)"),
    glow: z.number().min(0).max(1.5).default(1).describe("eye/LED glow multiplier (robot rigs)"),
  })
  .strict();

export type Expression = z.infer<typeof expressionSchema>;

const orbBot3d = z
  .object({
    rig: z.literal("orb-bot-3d"),
    params: z
      .object({
        body: z
          .object({
            shape: z.enum(["sphere", "capsule", "rounded-box"]).default("sphere"),
            color: color.default("#c8ced8"),
            metalness: z.number().min(0).max(1).default(1),
            roughness: z.number().min(0).max(1).default(0.2),
            facets: z.number().int().min(8).max(64).default(24).describe("lower = more low-poly"),
          })
          .strict()
          .default({ shape: "sphere", color: "#c8ced8", metalness: 1, roughness: 0.2, facets: 24 }),
        eye: z
          .object({
            count: z.union([z.literal(1), z.literal(2)]).default(1),
            size: z.number().min(0.15).max(0.7).default(0.42).describe("relative to body radius"),
            sclera: color.default("#f5f8fc"),
            iris: color.default("#29d3ff"),
            pupil: color.default("#0a0e14"),
            glow: z.number().min(0).max(2).default(0.7),
          })
          .strict()
          .default({ count: 1, size: 0.42, sclera: "#f5f8fc", iris: "#29d3ff", pupil: "#0a0e14", glow: 0.7 }),
        mouth: z
          .object({
            style: z.enum(["led-bar", "slit", "none"]).default("led-bar"),
            color: color.default("#29d3ff"),
            width: z.number().min(0.1).max(0.8).default(0.34),
          })
          .strict()
          .default({ style: "led-bar", color: "#29d3ff", width: 0.34 }),
        antenna: z
          .object({ enabled: z.boolean().default(true), color: color.default("#9aa3b0"), tip: color.default("#ff5a3c"), length: z.number().min(0.1).max(1).default(0.45) })
          .strict()
          .default({ enabled: true, color: "#9aa3b0", tip: "#ff5a3c", length: 0.45 }),
        accent: color.default("#ff5a3c").describe("ear bolts / small details"),
        arms: z.enum(["none", "stubs"]).default("stubs"),
        hover: z.number().min(0).max(0.3).default(0.05).describe("idle float amplitude"),
      })
      .strict(),
    expressions: z.record(z.string(), expressionSchema),
  })
  .strict();

const flat2d = z
  .object({
    rig: z.literal("flat-2d"),
    params: z
      .object({
        body: z
          .object({
            shape: z.enum(["circle", "blob", "rounded-rect", "drop", "star", "egg"]).default("blob"),
            color: color,
            shade: color.optional().describe("darker tone for the lower half; derived from color if omitted"),
            outline: color.default("#1d1b26"),
            outline_width: z.number().min(0).max(14).default(7),
          })
          .strict(),
        eyes: z
          .object({
            style: z.enum(["round", "dot", "oval", "sleepy"]).default("round"),
            white: color.default("#ffffff"),
            pupil: color.default("#1d1b26"),
            spacing: z.number().min(0.15).max(0.7).default(0.36),
            y: z.number().min(-0.5).max(0.3).default(-0.12).describe("vertical eye position, -0.5 = top"),
            size: z.number().min(0.08).max(0.35).default(0.17),
          })
          .strict()
          .default({ style: "round", white: "#ffffff", pupil: "#1d1b26", spacing: 0.36, y: -0.12, size: 0.17 }),
        mouth: z
          .object({ color: color.default("#3b1f2b"), tongue: color.default("#ff7a8a"), width: z.number().min(0.1).max(0.6).default(0.3), y: z.number().min(-0.2).max(0.5).default(0.2) })
          .strict()
          .default({ color: "#3b1f2b", tongue: "#ff7a8a", width: 0.3, y: 0.2 }),
        cheeks: color.optional(),
        accessories: z
          .array(
            z
              .object({
                type: z.enum(["tail", "ears", "antenna", "sparkles", "glasses", "leaf", "hat", "crown", "bow"]),
                color: color,
                accent: color.optional(),
              })
              .strict(),
          )
          .default([]),
      })
      .strict(),
    expressions: z.record(z.string(), expressionSchema),
  })
  .strict();

export const characterModelSchema = z.discriminatedUnion("rig", [orbBot3d, flat2d]);
export type CharacterModel = z.infer<typeof characterModelSchema>;
export type OrbBot3dModel = z.infer<typeof orbBot3d>;
export type Flat2dModel = z.infer<typeof flat2d>;
export const RIG_NAMES = ["orb-bot-3d", "flat-2d"] as const;

/** Problems with a model.json (empty list when valid). */
export function checkCharacterModel(raw: unknown): string[] {
  const result = characterModelSchema.safeParse(raw);
  const problems = result.success ? [] : result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
  if (result.success && !("neutral" in result.data.expressions)) problems.push('expressions: must include a "neutral" expression');
  return problems;
}

export function parseCharacterModel(raw: unknown): CharacterModel {
  return characterModelSchema.parse(raw);
}
