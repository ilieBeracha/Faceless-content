import { z } from "zod";

const color = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, 'must be a hex color like "#ff8800"');

const title = z.object({ type: z.literal("title"), text: z.string().min(1).max(40), size: z.enum(["xl", "lg", "md"]).default("lg") }).strict();
const counter = z
  .object({
    type: z.literal("counter"),
    from: z.number().default(0),
    to: z.number(),
    decimals: z.number().int().min(0).max(3).default(0),
    prefix: z.string().max(4).default(""),
    suffix: z.string().max(12).default(""),
    label: z.string().max(40).optional(),
  })
  .strict();
const compare = z
  .object({
    type: z.literal("compare"),
    mode: z.enum(["circles", "bars"]).default("circles"),
    unit: z.string().max(12).optional(),
    show_values: z.boolean().default(false),
    items: z.array(z.object({ label: z.string().min(1).max(18), value: z.number().positive(), color: color.optional() }).strict()).min(2).max(4),
  })
  .strict();
const list = z.object({ type: z.literal("list"), numbered: z.boolean().default(false), items: z.array(z.string().min(1).max(36)).min(1).max(4) }).strict();
const orb = z
  .object({
    type: z.literal("orb"),
    color: color,
    accent: color.optional(),
    label: z.string().max(24).optional(),
    ring: z.boolean().default(false),
    bands: z.boolean().default(false).describe("stripes, like Jupiter"),
    size: z.enum(["s", "m", "l"]).default("m"),
    glow: z.boolean().default(false),
  })
  .strict();
const timeline = z.object({ type: z.literal("timeline"), items: z.array(z.object({ label: z.string().min(1).max(28), value: z.string().min(1).max(12) }).strict()).min(2).max(4) }).strict();
const factCard = z.object({ type: z.literal("fact-card"), kicker: z.string().max(24).optional(), text: z.string().min(1).max(90) }).strict();
const iconRow = z
  .object({ type: z.literal("icon-row"), symbol: z.enum(["dot", "star", "circle", "square", "heart", "bolt", "drop"]), count: z.number().int().min(1).max(30), color: color.optional(), label: z.string().max(40).optional() })
  .strict();
const arrowFlow = z.object({ type: z.literal("arrow-flow"), steps: z.array(z.string().min(1).max(20)).min(2).max(4) }).strict();

export const elementSchema = z.discriminatedUnion("type", [title, counter, compare, list, orb, timeline, factCard, iconRow, arrowFlow]);
export type MgElement = z.infer<typeof elementSchema>;

export const beatVisualSchema = z
  .object({
    skill: z.literal("render-motion-graphics"),
    elements: z.array(elementSchema).min(1).max(3),
  })
  .strict();

export const sceneSchema = z
  .object({
    background: z.object({ top: color, bottom: color }).strict().optional(),
    texture: z.enum(["none", "stars", "grid", "dots", "paper"]).default("none"),
  })
  .strict();

export type MgBeatVisual = z.infer<typeof beatVisualSchema>;
export type MgScene = z.infer<typeof sceneSchema>;

export function elementText(el: MgElement): string[] {
  switch (el.type) {
    case "title":
      return [el.text];
    case "counter":
      return [`${el.prefix}${el.to}${el.suffix}`, el.label ?? ""];
    case "compare":
      return el.items.map((i) => `${i.label}: ${i.value}${el.unit ? " " + el.unit : ""}`);
    case "list":
      return el.items;
    case "orb":
      return [el.label ?? ""];
    case "timeline":
      return el.items.map((i) => `${i.value} ${i.label}`);
    case "fact-card":
      return [el.kicker ?? "", el.text];
    case "icon-row":
      return [`${el.count} × ${el.symbol}`, el.label ?? ""];
    case "arrow-flow":
      return el.steps;
  }
}
