/**
 * storyboard.json — a person looks at an episode's painted shots and its captions before it is voiced and
 * rendered, and approves them. The approval is bound to what they saw: the shots (words and pictures), the
 * on-screen text, the caption settings and the speaking speed. Change any of them and it must be approved again.
 *
 * The caption settings also apply to episodes that never stop for a storyboard: they are read at render time.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { EngineError } from "../core/errors.ts";
import { canonicalJson, nowIso, readJson, sha256, writeJson } from "../core/util.ts";
import { paintPaths } from "../skills/render-themed/paint.ts";
import { shotsUsed } from "../skills/render-themed/schema.ts";
import type { Script } from "../skills/write-script/schema.ts";

export const CAPTION_SIZES = ["small", "medium", "large"] as const;
export const CAPTION_PLACES = ["bottom", "middle"] as const;
export type CaptionSize = (typeof CAPTION_SIZES)[number];
export type CaptionPlace = (typeof CAPTION_PLACES)[number];
/** The fonts captions can be drawn in (keys of render/fonts.ts FONTS), with the name a person sees. The first three have their own Hebrew letters. */
export const CAPTION_FONTS = { rubik: "Rubik", heebo: "Heebo", "secular-one": "Secular One", fredoka: "Fredoka", montserrat: "Montserrat", anton: "Anton", "baloo-2": "Baloo 2", "space-grotesk": "Space Grotesk" } as const;
export type CaptionFont = keyof typeof CAPTION_FONTS;

/** How fast the voice speaks in one video, against the voice's own pace. */
export const PACES = ["slower", "normal", "faster", "fastest"] as const;
export type Pace = (typeof PACES)[number];
export const PACE_FACTOR: Record<Pace, number> = { slower: 0.9, normal: 1, faster: 1.1, fastest: 1.2 };

/** The speed an episode is voiced at: its storyboard's pace, or 1 when it has none. */
export function episodePace(episodeDir: string): number {
  return PACE_FACTOR[readStoryboard(episodeDir)?.pace ?? "normal"];
}

export const captionSettingsSchema = z
  .object({
    show: z.boolean().describe("false = no captions in this video"),
    size: z.enum(CAPTION_SIZES),
    place: z.enum(CAPTION_PLACES).describe("bottom = above the platform's buttons; middle = the centre of the picture"),
    case: z.enum(["normal", "upper"]),
    color: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i, 'must be a hex colour like "#ff8800"')
      .optional()
      .describe("the spoken word's highlight; leave out for the channel's accent colour"),
    text_color: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i, 'must be a hex colour like "#ffffff"')
      .optional()
      .describe("the other words' colour; leave out for white"),
    font: z
      .enum(Object.keys(CAPTION_FONTS) as [CaptionFont, ...CaptionFont[]])
      .optional()
      .describe("leave out for the channel's font"),
    hide_beats: z.array(z.string()).describe("beats shown without captions"),
  })
  .strict();
export type CaptionSettings = z.infer<typeof captionSettingsSchema>;

export const storyboardSchema = z
  .object({
    schema: z.literal("storyboard/v1"),
    captions: captionSettingsSchema,
    pace: z.enum(PACES).optional().describe("how fast the voice speaks in this video; leave out for normal"),
    status: z.enum(["pending", "approved"]),
    /** What was approved (storyboardHash); absent until approved. */
    hash: z.string().optional(),
    approved_by: z.string().optional(),
    approved_at: z.string().optional(),
  })
  .strict();
export type Storyboard = z.infer<typeof storyboardSchema>;

export function storyboardPath(episodeDir: string): string {
  return join(episodeDir, "storyboard.json");
}

export function readStoryboard(episodeDir: string): Storyboard | null {
  const path = storyboardPath(episodeDir);
  if (!existsSync(path)) return null;
  const r = storyboardSchema.safeParse(readJson(path));
  if (!r.success) throw new EngineError(`${path} is not a valid storyboard:\n${r.error.issues.map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n")}`);
  return r.data;
}

export function writeStoryboard(episodeDir: string, board: Storyboard): void {
  writeJson(storyboardPath(episodeDir), storyboardSchema.parse(board));
}

/** A fresh storyboard waiting for approval, with these caption settings. */
export function newStoryboard(captions: CaptionSettings): Storyboard {
  return { schema: "storyboard/v1", captions: captionSettingsSchema.parse(captions), status: "pending" };
}

/**
 * captions.json — how a finished video's captions look, changed after it is made (the storefront's captions step).
 * It overrides the storyboard's caption settings, and is not part of the storyboard's approval: changing it only
 * draws the captions onto the video again (render-episode.ts bakeCaptions), nothing else is made again.
 */
export function videoCaptionsPath(episodeDir: string): string {
  return join(episodeDir, "captions.json");
}

/** The caption settings a video is drawn with: its captions.json, else its storyboard's, else null (the channel's). */
export function videoCaptions(episodeDir: string): CaptionSettings | null {
  const path = videoCaptionsPath(episodeDir);
  if (existsSync(path)) {
    const r = captionSettingsSchema.safeParse(readJson(path));
    if (!r.success) throw new EngineError(`${path} is not valid caption settings:\n${r.error.issues.map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n")}`);
    return r.data;
  }
  return readStoryboard(episodeDir)?.captions ?? null;
}

/** Set how a video's captions look (captions.json). Throws when they hide a beat the script doesn't have. */
export function setVideoCaptions(episodeDir: string, script: Script, captions: CaptionSettings): void {
  const parsed = captionSettingsSchema.parse(captions);
  const problems = checkCaptions(parsed, script);
  if (problems.length) throw new EngineError(problems.join("\n"));
  writeJson(videoCaptionsPath(episodeDir), parsed);
}

/** Problems with caption settings against a script: beats it hides that the script doesn't have. */
export function checkCaptions(captions: CaptionSettings, script: Script): string[] {
  const ids = new Set(script.beats.map((b) => b.id));
  return captions.hide_beats.filter((id) => !ids.has(id)).map((id) => `captions: hide_beats names "${id}", which is not a beat of this script`);
}

/** What a storyboard approval covers: every beat's on-screen text and visual, each painted picture, the captions, and the speaking speed when it is not normal. */
export function storyboardHash(episodeDir: string, script: Script, captions: CaptionSettings, pace: Pace = "normal"): string {
  const pictures = shotsUsed(script.beats).map(({ id }) => {
    const file = join(paintPaths(episodeDir).dir, `${id}.jpg`);
    if (!existsSync(file)) throw new EngineError(`Shot "${id}" has no painted picture yet, so the storyboard can't be checked.`);
    return [id, sha256(readFileSync(file))];
  });
  return sha256(
    canonicalJson({
      beats: script.beats.map((b) => ({ id: b.id, on_screen_text: b.on_screen_text ?? "", visual: b.visual, character: b.character })),
      pictures,
      captions,
      ...(pace !== "normal" ? { pace } : {}),
    }),
  );
}

/** True when the storyboard was approved exactly as the episode is now. */
export function storyboardApproved(episodeDir: string, script: Script): boolean {
  const board = readStoryboard(episodeDir);
  return board?.status === "approved" && board.hash === storyboardHash(episodeDir, script, board.captions, board.pace);
}

/** A person approved the storyboard as it is now. */
export function approveStoryboard(episodeDir: string, script: Script, by: string): void {
  const board = readStoryboard(episodeDir);
  if (!board) throw new EngineError("This episode has no storyboard yet.");
  if (!by.trim()) throw new EngineError('Say who is approving: --by "<your name>".');
  const problems = checkCaptions(board.captions, script);
  if (problems.length) throw new EngineError(problems.join("\n"));
  writeStoryboard(episodeDir, { ...board, status: "approved", hash: storyboardHash(episodeDir, script, board.captions, board.pace), approved_by: by.trim(), approved_at: nowIso() });
}

/** Change the caption settings; the storyboard then waits for approval again. */
export function setCaptions(episodeDir: string, script: Script, captions: CaptionSettings): void {
  const board = readStoryboard(episodeDir);
  if (!board) throw new EngineError("This episode has no storyboard yet.");
  const parsed = captionSettingsSchema.parse(captions);
  const problems = checkCaptions(parsed, script);
  if (problems.length) throw new EngineError(problems.join("\n"));
  writeStoryboard(episodeDir, { schema: "storyboard/v1", captions: parsed, ...(board.pace ? { pace: board.pace } : {}), status: "pending" });
}

/** Change how fast the voice speaks in this video; the storyboard then waits for approval again. Nothing changes when it is already that speed. */
export function setPace(episodeDir: string, pace: Pace): void {
  const board = readStoryboard(episodeDir);
  if (!board) throw new EngineError("This episode has no storyboard yet.");
  if ((board.pace ?? "normal") === pace) return;
  writeStoryboard(episodeDir, { schema: "storyboard/v1", captions: board.captions, ...(pace !== "normal" ? { pace } : {}), status: "pending" });
}
