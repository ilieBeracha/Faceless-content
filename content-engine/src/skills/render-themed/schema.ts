import { z } from "zod";
import { voiceTokens } from "../write-script/schema.ts";

const color = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, 'must be a hex color like "#ff8800"');
const FONT_KEYS = ["anton", "montserrat", "space-grotesk", "fredoka", "baloo-2"] as const;

/** Where things sit. Every setting has a default, so a theme without `layout` looks as it always did. */
export const LAYOUT_CHOICES = {
  host: ["left", "right"],
  host_size: ["small", "medium", "large"],
  lettering: ["top", "middle", "low"],
  pictures: ["beside", "stacked"],
} as const;
/* ---- frames: open arrangements ---- */

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be lower-case words joined by dashes");
const onStage = (b: { x: number; y: number; w: number; h: number }) => b.x + b.w <= 100.001 && b.y + b.h <= 100.001;
const STAGE_MSG = { message: "the box must stay on the stage: x + w and y + h at most 100" };
/** A box on the stage, in percent of the stage (the space between the headline and the captions): x right, y down. */
const box = z
  .object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100), w: z.number().min(10).max(100), h: z.number().min(10).max(100) })
  .strict()
  .refine(onStage, STAGE_MSG);
export type FrameBox = z.infer<typeof box>;
const textBox = z
  .object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    w: z.number().min(35).max(100).describe("at least 35, so headings and notes stay readable"),
    h: z.number().min(15).max(100),
    align: z.enum(["top", "middle", "bottom"]).default("middle").describe("where the lettering sits inside its box"),
  })
  .strict()
  .refine(onStage, STAGE_MSG);

function overlaps(a: FrameBox, b: FrameBox): boolean {
  const eps = 0.001;
  return a.x + eps < b.x + b.w && b.x + eps < a.x + a.w && a.y + eps < b.y + b.h && b.y + eps < a.y + a.h;
}

/**
 * One arrangement of a beat: where the host stands, where the lettering goes and where the picture goes.
 * A look can carry several; beats switch between them.
 */
export const frameSchema = z
  .object({
    name: slug,
    host: box.nullable().describe("the host's box (it stands at the bottom, centred, as big as fits); null = the host steps out on these beats"),
    text: textBox.describe("headings, notes and marks; also the picture when `picture` is null"),
    picture: box.nullable().default(null).describe("the beat's artwork; null = it flows with the lettering"),
  })
  .strict()
  .superRefine((f, ctx) => {
    const boxes: [string, FrameBox | null][] = [["host", f.host], ["text", f.text], ["picture", f.picture]];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const [an, a] = boxes[i];
        const [bn, b] = boxes[j];
        if (a && b && overlaps(a, b)) ctx.addIssue({ code: "custom", path: [bn], message: `the ${bn} box overlaps the ${an} box` });
      }
  });
export type Frame = z.infer<typeof frameSchema>;

const frame = (name: string, host: FrameBox | null, text: Omit<Frame["text"], "align"> & { align?: Frame["text"]["align"] }, picture: FrameBox | null = null): Frame =>
  frameSchema.parse({ name, host, text, picture });

/** Ready-made arrangements a look can name instead of drawing its own boxes. */
export const FRAME_PRESETS = {
  "host-left": frame("host-left", { x: 0, y: 40, w: 52, h: 60 }, { x: 0, y: 0, w: 100, h: 38 }, { x: 54, y: 40, w: 46, h: 60 }),
  "host-right": frame("host-right", { x: 48, y: 40, w: 52, h: 60 }, { x: 0, y: 0, w: 100, h: 38 }, { x: 0, y: 40, w: 46, h: 60 }),
  "big-picture": frame("big-picture", null, { x: 0, y: 72, w: 100, h: 28, align: "top" }, { x: 0, y: 0, w: 100, h: 70 }),
  split: frame("split", { x: 0, y: 52, w: 40, h: 48 }, { x: 42, y: 52, w: 58, h: 48 }, { x: 0, y: 0, w: 100, h: 50 }),
  "host-centre": frame("host-centre", { x: 20, y: 38, w: 60, h: 62 }, { x: 0, y: 0, w: 100, h: 36, align: "bottom" }),
  "corner-host": frame("corner-host", { x: 72, y: 74, w: 28, h: 26 }, { x: 0, y: 0, w: 100, h: 30, align: "top" }, { x: 0, y: 32, w: 70, h: 68 }),
  "title-card": frame("title-card", null, { x: 4, y: 8, w: 92, h: 84 }),
  "host-top": frame("host-top", { x: 0, y: 0, w: 34, h: 36 }, { x: 36, y: 0, w: 64, h: 36 }, { x: 0, y: 38, w: 100, h: 62 }),
  columns: frame("columns", { x: 54, y: 56, w: 46, h: 44 }, { x: 0, y: 0, w: 52, h: 100 }, { x: 54, y: 0, w: 46, h: 54 }),
  "picture-in-picture": frame("picture-in-picture", { x: 0, y: 64, w: 36, h: 36 }, { x: 38, y: 64, w: 62, h: 36 }, { x: 0, y: 0, w: 100, h: 62 }),
} satisfies Record<string, Frame>;
export type FramePreset = keyof typeof FRAME_PRESETS;
export const FRAME_PRESET_NAMES = Object.keys(FRAME_PRESETS) as [FramePreset, ...FramePreset[]];

const layoutSchema = z
  .object({
    host: z.enum(LAYOUT_CHOICES.host).default("left").describe("the side the host stands on"),
    host_size: z.enum(LAYOUT_CHOICES.host_size).default("medium"),
    lettering: z.enum(LAYOUT_CHOICES.lettering).default("middle").describe("where notes and headings sit in the space above the host"),
    pictures: z.enum(LAYOUT_CHOICES.pictures).default("beside").describe("artwork beside the host, or stacked with the lettering above it"),
    frames: z
      .array(z.union([z.enum(FRAME_PRESET_NAMES), frameSchema]))
      .min(1)
      .max(10)
      .refine((fs) => new Set(fs.map((f) => (typeof f === "string" ? f : f.name))).size === fs.length, { message: "every frame needs its own name" })
      .optional()
      .describe("arrangements beats switch between: preset names or frames of your own. When set, host/host_size/lettering/pictures are not used"),
  })
  .strict();

/**
 * The world a channel's videos happen in, in words: what it is, its art style, its light. With a world, the look
 * tells each story in pictures: every line is acted out by shots painted in this world, with the host drawn in them.
 */
export const worldSchema = z
  .object({ description: z.string().trim().min(10).max(1500).describe("the world in words, as specific as you like: setting, materials, era, light, mood, art style") })
  .strict();
export type World = z.infer<typeof worldSchema>;

/** How the camera moves over a painted shot. */
export const CAMERA_MOVES = ["push-in", "pull-out", "pan-left", "pan-right", "rise", "sink", "drift"] as const;
export type CameraMove = (typeof CAMERA_MOVES)[number];

/**
 * A look, as data. One renderer draws every theme; a new look is a new JSON file, not new code.
 * A channel's look is its `theme.json`; ready-made ones live in the engine's `themes/` folder.
 */
export const themeSchema = z
  .object({
    name: z.string().min(1).max(40),
    paper: color.describe("the background"),
    card: color.describe("notes, plates and labels"),
    ink: color.describe("lettering on cards"),
    text: color.describe("lettering and lines drawn straight on the background"),
    colors: z.tuple([color, color, color]).describe("three supporting colours (artwork roles a, b, c)"),
    accent: color.describe("highlights: kickers, values, markers"),
    display: z.array(z.enum(FONT_KEYS)).min(1).max(4).describe("headline faces; more than one = lines alternate between them"),
    body: z.enum(FONT_KEYS),
    casing: z.enum(["upper", "normal"]),
    surface: z.enum(["torn", "ruled", "plain", "glow"]).describe("how plates and notes are made: torn paper, drafting lines, soft cards, glowing outlines"),
    backdrop: z.enum(["sheets", "grid", "blobs", "none"]).describe("what moves behind the content"),
    texture: z.enum(["grain", "none"]),
    motion: z.enum(["stop-motion", "draw-on", "snappy"]).describe("how things arrive and keep moving"),
    art: z.enum(["cutout", "line", "flat"]).describe("how artwork is drawn: paper stickers, line drawings, flat shapes"),
    layout: layoutSchema.default({ host: "left", host_size: "medium", lettering: "middle", pictures: "beside" }),
    world: worldSchema.optional().describe("a painted world: every line is acted out in shots painted by an image model, in this world, with the host drawn in them"),
  })
  .strict();
export type Theme = z.infer<typeof themeSchema>;

export function parseTheme(json: unknown, label: string): Theme {
  const r = themeSchema.safeParse(json);
  if (!r.success) throw new Error(`${label} is not a valid theme:\n${r.error.issues.map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n")}`);
  return r.data;
}

/** The look's frames, presets filled in; null when the look uses the classic host/lettering/pictures settings. */
export function themeFrames(theme: Theme): Frame[] | null {
  const fs = theme.layout.frames;
  return fs ? fs.map((f) => (typeof f === "string" ? FRAME_PRESETS[f] : f)) : null;
}

/** The frame a beat is drawn in: the one it names, otherwise the frames take turns beat by beat. Throws on a name the look lacks. */
export function frameFor(frames: Frame[], beat: { index: number; id: string; frame?: string }): Frame {
  if (!beat.frame) return frames[beat.index % frames.length];
  const found = frames.find((f) => f.name === beat.frame);
  if (!found) throw new Error(`beat "${beat.id}": frame "${beat.frame}" is not one of the look's frames (${frames.map((f) => f.name).join(", ")})`);
  return found;
}

/** Problems with the frames beats name, against the channel's look. */
export function checkFrames(beats: { id: string; visual: unknown }[], theme: Theme): string[] {
  const frames = themeFrames(theme);
  const errors: string[] = [];
  for (const b of beats) {
    const name = (b.visual as Partial<ThBeatVisual>).frame;
    if (!name) continue;
    if (!frames) errors.push(`beat "${b.id}": names frame "${name}", but the channel's theme.json has no layout.frames`);
    else if (!frames.some((f) => f.name === name)) errors.push(`beat "${b.id}": frame "${name}" is not one of the look's frames (${frames.map((f) => f.name).join(", ")})`);
  }
  return errors;
}

/** Artwork is drawn per episode as plain vector data on a 100×100 board. Colours are roles, so it follows any theme. */
export const ROLES = ["ink", "paper", "a", "b", "c", "accent"] as const;
export type Role = (typeof ROLES)[number];
const role = z.enum(ROLES);
const shape = z
  .object({
    d: z.string().min(2).max(600).regex(/^[MmLlHhVvCcSsQqTtAaZz0-9\s,.\-]+$/, "must be SVG path data only (move, line, curve and arc commands with numbers)"),
    fill: role.optional(),
    stroke: role.optional(),
    width: z.number().min(0.5).max(8).optional(),
    anim: z.enum(["flap", "spin", "blink"]).optional().describe("flap = fold towards the centre line (wings, pages); spin = turn around `at`; blink = on and off"),
    at: z.tuple([z.number().min(0).max(100), z.number().min(0).max(100)]).optional(),
  })
  .strict()
  .refine((s) => s.fill || s.stroke, { message: "a shape needs a fill or a stroke" })
  .refine((s) => s.anim !== "spin" || s.at, { message: 'anim "spin" needs `at`: the point to turn around' });
const drawing = z.object({ shapes: z.array(shape).min(1).max(40) }).strict();
export type Drawing = z.infer<typeof drawing>;

const heading = z.object({ type: z.literal("heading"), lines: z.array(z.string().min(1).max(18)).min(1).max(3) }).strict();
const art = z.object({ type: z.literal("art"), id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), label: z.string().max(24).optional() }).strict();
const note = z.object({ type: z.literal("note"), kicker: z.string().max(24).optional(), text: z.string().min(1).max(90) }).strict();
const marks = z.object({ type: z.literal("marks"), items: z.array(z.object({ value: z.string().min(1).max(12), label: z.string().min(1).max(28) }).strict()).min(2).max(3) }).strict();

export const elementSchema = z.discriminatedUnion("type", [heading, art, note, marks]);
export type ThElement = z.infer<typeof elementSchema>;

/**
 * A painted shot (looks with a world): a picture that acts out what is being said, with the host drawn in it when it says "the host".
 * The first shot of a beat starts with the beat; each later one cuts in on the word `at`, as it is spoken.
 */
const shot = z
  .object({
    at: z.string().trim().min(1).max(40).optional().describe("the word of the beat's voiceover this shot cuts in on (leave out on the first shot)"),
    show: z.string().trim().min(10).max(500).describe("what we see, acting out the words: who does what, where. Say \"the host\" to put the host in the shot; leave it out for a shot of the story alone. The world's style is added by the engine"),
    camera: z.enum(CAMERA_MOVES).optional().describe("how the camera moves over the shot; leave out to take the next move in turn"),
  })
  .strict();
export type Shot = z.infer<typeof shot>;

export const beatVisualSchema = z
  .object({
    skill: z.literal("render-themed"),
    frame: slug.optional().describe("one of the look's frames, by name; leave out to take the next frame in turn"),
    shots: z.array(shot).min(1).max(3).optional().describe("looks with a world: 1–3 painted shots that act out this beat's words"),
    elements: z.array(elementSchema).min(1).max(3).optional().describe("lettering and artwork over the scene; looks without a world need them, looks with one take none"),
  })
  .strict();
export const sceneSchema = z.object({ art: z.record(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), drawing).optional() }).strict();
export type ThBeatVisual = z.infer<typeof beatVisualSchema>;
export type ThScene = z.infer<typeof sceneSchema>;

/** One artwork per beat (it sits beside the character), and every artwork a beat names must be drawn in the scene. */
export function checkBeat(visual: ThBeatVisual, scene: ThScene | undefined, beatId: string): string[] {
  const used = (visual.elements ?? []).filter((el) => el.type === "art");
  const errors = used.length > 1 ? [`beat "${beatId}": render-themed takes one artwork per beat (found ${used.length})`] : [];
  for (const el of used) if (!scene?.art?.[el.id]) errors.push(`beat "${beatId}": artwork "${el.id}" is not drawn in visuals["render-themed"].art`);
  return errors;
}

/** A word as it is matched against the spoken words: lower case, letters and digits only. */
export function wordKey(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * Where each later shot of a beat cuts in: the index (in `words`) of its `at` word, searched in order after the
 * previous cut. Returns an error instead when a word is not spoken there.
 */
export function shotCuts(shots: Shot[], words: string[]): { cuts: number[]; error: null } | { cuts: null; error: string } {
  const keys = words.map(wordKey);
  const cuts: number[] = [];
  let from = 0;
  for (const [n, s] of shots.entries()) {
    if (n === 0) continue;
    if (!s.at) return { cuts: null, error: `shot ${n + 1} needs \`at\`: the word it cuts in on` };
    const k = wordKey(s.at);
    const i = keys.indexOf(k, from);
    if (!k || i < 0) return { cuts: null, error: `shot ${n + 1} cuts in on "${s.at}", which is not spoken${n > 1 ? " after the previous cut" : ""} in this beat's voiceover` };
    cuts.push(i);
    from = i + 1;
  }
  return { cuts, error: null };
}

/** Every painted shot of a script, in order: `<beat id>-<n>` (n from 1). */
export function shotsUsed(beats: { id: string; speaker: string; voiceover: string; visual: unknown }[]): { id: string; beat: string; speaker: string; line: string; shot: Shot }[] {
  return beats
    .filter((b) => (b.visual as { skill?: string }).skill === "render-themed")
    .flatMap((b) => ((b.visual as ThBeatVisual).shots ?? []).map((shot, n) => ({ id: `${b.id}-${n + 1}`, beat: b.id, speaker: b.speaker, line: b.voiceover, shot })));
}

/** Shots against the channel's look: with a world every beat tells its words in shots and draws no lettering; without one, no shots. */
export function checkShots(beats: { id: string; voiceover: string; visual: unknown }[], theme: Theme): string[] {
  const errors: string[] = [];
  for (const b of beats) {
    const v = b.visual as Partial<ThBeatVisual>;
    if (theme.world) {
      if (!v.shots?.length) errors.push(`beat "${b.id}": the look has a world, so the beat needs \`shots\` that act out its words`);
      if (v.elements?.length) errors.push(`beat "${b.id}": the look has a world, so the pictures tell the story; take out \`elements\``);
      if (v.shots?.length) {
        if (v.shots[0].at) errors.push(`beat "${b.id}": the first shot starts with the beat, so it takes no \`at\``);
        const r = shotCuts(v.shots, voiceTokens(b.voiceover));
        if (r.error) errors.push(`beat "${b.id}": ${r.error}`);
      }
    } else {
      if (v.shots?.length) errors.push(`beat "${b.id}": has shots, but the channel's theme.json has no world to paint them in`);
      if (!v.elements?.length) errors.push(`beat "${b.id}": needs \`elements\` (the look has no world to tell it in pictures)`);
    }
  }
  return errors;
}

export function elementText(el: ThElement): string[] {
  switch (el.type) {
    case "heading":
      return [el.lines.join(" ")];
    case "art":
      return [el.label ?? ""];
    case "note":
      return [el.kicker ?? "", el.text];
    case "marks":
      return el.items.map((i) => `${i.value} ${i.label}`);
  }
}
