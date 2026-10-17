/**
 * render-planet-explainer — one hero planet, drawn by code, whose "view" changes with the narration:
 * split it open (cutaway), draw its rings, show its axis tilt, a big number, a probe flyby, a size
 * comparison, a fast spin, a surface feature or a float test. Every label and number is on-screen text, so
 * it is fact-checked like the voiceover.
 */
import { z } from "zod";

const color = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, 'must be a hex color like "#ff8800"');
const label = (max: number) => z.string().min(1).max(max);

export const planetSchema = z
  .object({
    name: label(24),
    color: color.describe("main body colour"),
    bands: z.array(color).max(6).default([]).describe("latitude stripes, top to bottom (gas giants)"),
    glow: color.optional().describe("soft atmosphere glow around the disc"),
    rings: z
      .object({
        color: color,
        inner: z.number().min(1.05).max(2).default(1.25).describe("inner edge, in planet radii"),
        outer: z.number().min(1.1).max(3).default(2.2).describe("outer edge, in planet radii"),
        bands: z.number().int().min(1).max(8).default(4).describe("how many ringlets are drawn"),
      })
      .strict()
      .optional(),
    tilt_deg: z.number().min(-180).max(180).default(0).describe("how the disc and rings lean on screen (not a fact; see the tilt view for that)"),
  })
  .strict();

export const sceneSchema = z
  .object({
    planet: planetSchema,
    background: z.object({ top: color, bottom: color }).strict().optional(),
    stars: z.boolean().default(true),
  })
  .strict();

const layer = z.object({ label: label(22), color: color, radius: z.number().min(0.05).max(1).describe("outer edge, as a fraction of the planet radius") }).strict();

const base = {
  at_word: z.number().int().min(0).default(0).describe("index of the beat's word where this view starts"),
  caption: label(32).optional().describe("small text above the planet, like a chart title"),
};

export const viewSchema = z.discriminatedUnion("view", [
  z.object({ view: z.literal("hero"), ...base, zoom: z.number().min(0.6).max(1.6).default(1) }).strict(),
  z.object({ view: z.literal("cutaway"), ...base, layers: z.array(layer).min(1).max(4).describe("outside to inside") }).strict(),
  z.object({ view: z.literal("rings"), ...base }).strict(),
  z
    .object({
      view: z.literal("tilt"),
      ...base,
      degrees: z.number().min(0).max(180),
      axis_label: label(16).default("Spin axis"),
      orbit_label: label(16).default("Orbit"),
    })
    .strict(),
  z.object({ view: z.literal("stat"), ...base, value: label(14).describe('the big number, e.g. "-224 °C"'), subtitle: label(40).optional() }).strict(),
  z.object({ view: z.literal("probe"), ...base, tag: label(32).describe('e.g. "Cassini · 2004–2017"') }).strict(),
  z
    .object({
      view: z.literal("compare"),
      ...base,
      other: z.object({ name: label(16), color: color, ratio: z.number().positive().max(1).describe("its diameter ÷ the planet's diameter") }).strict(),
      label: label(32).optional(),
    })
    .strict(),
  z.object({ view: z.literal("spin"), ...base, label: label(24).describe('e.g. "1 day = 10 h 33 min"') }).strict(),
  z
    .object({
      view: z.literal("spot"),
      ...base,
      shape: z.enum(["hexagon", "oval", "circle"]),
      at: z.enum(["north-pole", "south-pole", "upper", "middle", "lower"]).default("middle"),
      size: z.number().min(0.1).max(0.9).default(0.45).describe("as a fraction of the planet radius"),
      color: color.optional(),
      label: label(28).optional(),
    })
    .strict(),
  z.object({ view: z.literal("float"), ...base, label: label(32).optional(), submerged: z.number().min(0.05).max(0.95).default(0.7).describe("fraction under water") }).strict(),
]);

export type PeView = z.infer<typeof viewSchema>;

export const beatVisualSchema = z
  .object({
    skill: z.literal("render-planet-explainer"),
    views: z.array(viewSchema).min(1).max(4).describe("in order; each starts at its at_word"),
  })
  .strict();

export type PeBeatVisual = z.infer<typeof beatVisualSchema>;
export type PeScene = z.infer<typeof sceneSchema>;
export type PePlanet = z.infer<typeof planetSchema>;

/** Every piece of text the views put on screen (fact-checked with the script). */
export function viewText(v: PeView): string[] {
  const out = [v.caption ?? ""];
  switch (v.view) {
    case "cutaway":
      out.push(...v.layers.map((l) => l.label));
      break;
    case "tilt":
      out.push(`${v.degrees}°`, v.axis_label, v.orbit_label);
      break;
    case "stat":
      out.push(v.value, v.subtitle ?? "");
      break;
    case "probe":
      out.push(v.tag);
      break;
    case "compare":
      out.push(v.other.name, v.label ?? "");
      break;
    case "spin":
      out.push(v.label);
      break;
    case "spot":
    case "float":
      out.push(v.label ?? "");
      break;
  }
  return out.filter(Boolean);
}

export function checkBeat(visual: PeBeatVisual, beatId: string, voiceover: string): string[] {
  const words = voiceover.split(/\s+/).filter(Boolean).length;
  const problems: string[] = [];
  let last = -1;
  visual.views.forEach((v, i) => {
    if (v.at_word >= words) problems.push(`beat "${beatId}" view ${i}: at_word ${v.at_word} is past the beat's last word (${words} words)`);
    if (v.at_word <= last) problems.push(`beat "${beatId}" view ${i}: at_word must increase (${v.at_word} after ${last})`);
    last = v.at_word;
    if (i === 0 && v.at_word !== 0) problems.push(`beat "${beatId}": the first view must start at word 0`);
    if (v.view === "cutaway") {
      for (let k = 1; k < v.layers.length; k++) if (v.layers[k].radius >= v.layers[k - 1].radius) problems.push(`beat "${beatId}" view ${i}: cutaway layers go outside to inside (radius must shrink)`);
    }
  });
  return problems;
}
