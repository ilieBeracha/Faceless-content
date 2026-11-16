import { z } from "zod";

const color = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, 'must be a hex color like "#ff8800"');
const FONT_KEYS = ["anton", "montserrat", "space-grotesk", "fredoka", "baloo-2"] as const;

/** Where things sit. Every setting has a default, so a theme without `layout` looks as it always did. */
export const LAYOUT_CHOICES = {
  host: ["left", "right"],
  host_size: ["small", "medium", "large"],
  lettering: ["top", "middle", "low"],
  pictures: ["beside", "stacked"],
} as const;
const layoutSchema = z
  .object({
    host: z.enum(LAYOUT_CHOICES.host).default("left").describe("the side the host stands on"),
    host_size: z.enum(LAYOUT_CHOICES.host_size).default("medium"),
    lettering: z.enum(LAYOUT_CHOICES.lettering).default("middle").describe("where notes and headings sit in the space above the host"),
    pictures: z.enum(LAYOUT_CHOICES.pictures).default("beside").describe("artwork beside the host, or stacked with the lettering above it"),
  })
  .strict();

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
  })
  .strict();
export type Theme = z.infer<typeof themeSchema>;

export function parseTheme(json: unknown, label: string): Theme {
  const r = themeSchema.safeParse(json);
  if (!r.success) throw new Error(`${label} is not a valid theme:\n${r.error.issues.map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n")}`);
  return r.data;
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

export const beatVisualSchema = z.object({ skill: z.literal("render-themed"), elements: z.array(elementSchema).min(1).max(3) }).strict();
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
