/**
 * script.json — what the write-script skill produces and every other step consumes.
 * Channel-agnostic: beats follow the series, speakers come from the series' characters,
 * visuals are payloads for the render skills the series names.
 */
import { z } from "zod";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be lowercase-with-dashes");

export const claimSchema = z
  .object({
    id: z.string().regex(/^c\d+$/, 'claim ids are "c1", "c2", …'),
    claim: z.string().min(8).describe("the factual statement, in plain words"),
    beat: slug.describe("id of the beat where it is said or shown"),
    source: z.string().min(3).describe("URL or precise citation that supports it"),
    confidence: z.enum(["high", "medium", "low"]),
    note: z.string().optional(),
  })
  .strict();

export const beatSchema = z
  .object({
    id: slug,
    speaker: slug,
    voiceover: z.string().min(1),
    on_screen_text: z.string().max(48).optional(),
    visual: z.object({ skill: z.string() }).passthrough(),
    character: z
      .object({
        placement: z.enum(["full", "corner", "hidden"]).default("corner"),
        expression: z.string().default("neutral"),
      })
      .strict()
      .default({ placement: "corner", expression: "neutral" }),
  })
  .strict();

export const scriptSchema = z
  .object({
    schema: z.literal("script/v1"),
    channel: slug,
    series: slug,
    idea: slug,
    title: z.string().min(3).max(90),
    language: z.string().default("en"),
    beats: z.array(beatSchema).min(2),
    visuals: z.record(z.string(), z.unknown()).default({}),
    claims: z.array(claimSchema),
    pronunciations: z.record(z.string(), z.string()).default({}).describe('how the voice should say tricky words, e.g. {"1938": "nineteen thirty-eight"}'),
    publish: z
      .object({
        title: z.string().min(3).max(100),
        description: z.string().max(2200),
        hashtags: z.array(z.string().regex(/^#\w+$/)).max(8),
      })
      .strict(),
  })
  .strict();

export type Script = z.infer<typeof scriptSchema>;
export type Beat = z.infer<typeof beatSchema>;
export type Claim = z.infer<typeof claimSchema>;

/**
 * The words of a voiceover as the voice and the captions both see them: split on whitespace, with
 * punctuation-only tokens ("—", "…") glued to the previous word so they keep their pause.
 */
export function voiceTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const raw of text.trim().split(/\s+/)) {
    if (!raw) continue;
    if (!/[\p{L}\p{N}]/u.test(raw) && tokens.length) tokens[tokens.length - 1] += ` ${raw}`;
    else tokens.push(raw);
  }
  return tokens;
}

/** First sentence of a voiceover (used for the 2-second hook check). */
export function firstSentence(text: string): string {
  const m = /^(.+?[.!?…])(\s|$)/u.exec(text.trim());
  return m ? m[1] : text.trim();
}
