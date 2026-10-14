import { z } from "zod";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be lowercase-with-dashes");
const color = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, 'must be a hex color like "#ff8800"');
const vec3 = z.tuple([z.number(), z.number(), z.number()]);

export const SHAPES = ["cylinder", "tube", "cone", "sphere", "box", "capsule", "torus", "spring", "disc"] as const;
export const MATERIALS = ["plastic", "metal", "glass", "rubber", "ink", "paper", "wood", "fabric"] as const;
export const SHOTS = ["establish", "fly-in", "explode", "focus", "reassemble", "orbit"] as const;

/** One low-poly part. Sizes and positions are in centimetres, object assembled, long axis = Y (up). */
export const partSchema = z
  .object({
    id: slug,
    label: z.string().min(1).max(26),
    note: z.string().max(34).optional().describe("small second line under the label"),
    shape: z.enum(SHAPES),
    radius: z.number().positive().optional().describe("cylinder, tube (outer), sphere, capsule, torus, spring, disc"),
    radius_top: z.number().min(0).optional().describe("cone/cylinder: radius at the top (+Y) end"),
    radius_bottom: z.number().min(0).optional().describe("cone/cylinder: radius at the bottom (-Y) end"),
    inner_radius: z.number().positive().optional().describe("tube: hole radius"),
    length: z.number().positive().optional().describe("cylinder, tube, cone, capsule, spring: size along Y"),
    width: z.number().positive().optional().describe("box: X"),
    height: z.number().positive().optional().describe("box: Y"),
    depth: z.number().positive().optional().describe("box: Z"),
    tube_radius: z.number().positive().optional().describe("torus thickness"),
    turns: z.number().positive().optional().describe("spring coils"),
    wire: z.number().positive().optional().describe("spring wire radius"),
    position: vec3,
    rotation: vec3.optional().describe("degrees around X, Y, Z"),
    color: color,
    material: z.enum(MATERIALS).default("plastic"),
    opacity: z.number().min(0.05).max(1).optional(),
    shell: z.boolean().default(false).describe("outer casing: turns see-through when the camera flies inside"),
    explode: vec3.describe("offset in cm when the object is fully exploded"),
    anchor: vec3.optional().describe("callout point relative to the part centre"),
  })
  .strict();

export const sceneSchema = z
  .object({
    object: z.string().min(2),
    background: z.object({ top: color, bottom: color }).strict().optional(),
    parts: z.array(partSchema).min(2).max(24),
  })
  .strict();

export const beatVisualSchema = z
  .object({
    skill: z.literal("render-3d-explainer"),
    shot: z.enum(SHOTS),
    target: slug.optional().describe("part the camera flies into / focuses on"),
    callouts: z.array(slug).max(4).default([]),
    explode: z.number().min(0).max(1).optional().describe("how exploded the object is by the end of the beat"),
  })
  .strict();

export type Part = z.infer<typeof partSchema>;
export type Scene3d = z.infer<typeof sceneSchema>;
export type Beat3dVisual = z.infer<typeof beatVisualSchema>;

const REQUIRED_DIMS: Record<(typeof SHAPES)[number], (keyof Part)[]> = {
  cylinder: ["radius", "length"],
  tube: ["radius", "inner_radius", "length"],
  cone: ["length"],
  sphere: ["radius"],
  box: ["width", "height", "depth"],
  capsule: ["radius", "length"],
  torus: ["radius", "tube_radius"],
  spring: ["radius", "length", "turns"],
  disc: ["radius"],
};

export function checkScene(scene: Scene3d): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const p of scene.parts) {
    if (ids.has(p.id)) problems.push(`part id "${p.id}" is used twice`);
    ids.add(p.id);
    for (const dim of REQUIRED_DIMS[p.shape]) if (p[dim] === undefined) problems.push(`part "${p.id}" (${p.shape}) needs "${dim}"`);
    if (p.shape === "cone" && p.radius_bottom === undefined && p.radius === undefined) problems.push(`part "${p.id}" (cone) needs "radius_bottom" (or "radius")`);
    if (p.shape === "tube" && p.inner_radius !== undefined && p.radius !== undefined && p.inner_radius >= p.radius) problems.push(`part "${p.id}": inner_radius must be smaller than radius`);
  }
  return problems;
}

export function checkBeatVisual(visual: Beat3dVisual, scene: Scene3d | undefined, beatId: string): string[] {
  const problems: string[] = [];
  const ids = new Set(scene?.parts.map((p) => p.id) ?? []);
  if ((visual.shot === "fly-in" || visual.shot === "focus") && !visual.target) problems.push(`beat "${beatId}": shot "${visual.shot}" needs a "target" part`);
  if (visual.target && !ids.has(visual.target)) problems.push(`beat "${beatId}": target "${visual.target}" is not a part (parts: ${[...ids].join(", ")})`);
  for (const c of visual.callouts) if (!ids.has(c)) problems.push(`beat "${beatId}": callout "${c}" is not a part`);
  return problems;
}

export function sceneText(scene: Scene3d): string[] {
  return scene.parts.flatMap((p) => [p.label, p.note ?? ""]).filter(Boolean);
}
