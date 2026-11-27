/**
 * render-subject — one hero subject for the whole video, on a plain background, whose "view" changes on the word
 * that introduces each new fact: push in on a part of it, label its parts, put a big number over it, split it open to
 * show what is inside, swap it for another state of itself, set something beside it to scale, or tilt it. The subject
 * and its other states are painted once each by the image model (paid, a few cents); every motion is drawn by code,
 * so it is free, smooth and lands exactly on the word. Every label and number is on-screen text, so it is
 * fact-checked like the voiceover.
 */
import { z } from "zod";

const color = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, 'must be a hex color like "#ff8800"');
const label = (max: number) => z.string().trim().min(1).max(max);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be lower-case words joined by dashes");

/** The subject's own picture is always called this; `pictures` adds other states of it. */
export const MAIN = "main";

export const pictureSchema = z
  .object({
    id: slug.refine((id) => id !== MAIN, { message: `"${MAIN}" is the subject's own picture; give this one another id` }),
    show: z.string().trim().min(10).max(400).describe("what this picture shows: the same subject in another state, its inside, or a thing to compare it with"),
    name: label(24).optional().describe("shown under it in the compare view"),
  })
  .strict();

export const sceneSchema = z
  .object({
    subject: z
      .object({
        name: label(24).describe("what the subject is called (shown under it in the compare view)"),
        show: z.string().trim().min(10).max(400).describe("the subject's own picture: one thing, whole, seen clearly"),
      })
      .strict(),
    pictures: z.array(pictureSchema).max(4).default([]).describe("other pictures of the same subject the views switch to"),
    style: z.string().trim().min(10).max(600).describe("the art style every picture is painted in"),
    background: z.object({ top: color, bottom: color }).strict().default({ top: "#1b2130", bottom: "#07080d" }),
  })
  .strict()
  .superRefine((s, ctx) => {
    const seen = new Set<string>();
    s.pictures.forEach((p, i) => {
      if (seen.has(p.id)) ctx.addIssue({ code: "custom", path: ["pictures", i, "id"], message: `picture id "${p.id}" is used twice` });
      seen.add(p.id);
    });
  });

const picture = slug.default(MAIN).describe(`which picture: "${MAIN}" (the subject) or one of the scene's pictures`);
const point = { x: z.number().min(0).max(1).describe("0 = left edge of the picture, 1 = right"), y: z.number().min(0).max(1).describe("0 = top of the picture, 1 = bottom") };

const base = {
  at_word: z.number().int().min(0).default(0).describe("index of the beat's word where this view starts"),
  caption: label(32).optional().describe("small text above the subject, like a chart title"),
};

export const viewSchema = z.discriminatedUnion("view", [
  z.object({ view: z.literal("hero"), ...base, picture, zoom: z.number().min(0.6).max(1.6).default(1) }).strict(),
  z.object({ view: z.literal("focus"), ...base, picture, ...point, zoom: z.number().min(1.3).max(3).default(2) }).strict(),
  z
    .object({
      view: z.literal("labels"),
      ...base,
      picture,
      items: z.array(z.object({ text: label(24), ...point }).strict()).min(1).max(3).describe("each label is drawn beside the subject with a line to its point"),
    })
    .strict(),
  z.object({ view: z.literal("stat"), ...base, picture, value: label(14).describe('the big number, e.g. "-224 °C"'), subtitle: label(40).optional() }).strict(),
  z.object({ view: z.literal("reveal"), ...base, picture: slug.describe("the picture of what is inside") }).strict(),
  z.object({ view: z.literal("swap"), ...base, picture: slug.describe("the picture it turns into") }).strict(),
  z
    .object({
      view: z.literal("compare"),
      ...base,
      picture: slug.describe("the thing set beside the subject"),
      ratio: z.number().min(0.1).max(1).describe("its size ÷ the subject's size"),
      label: label(32).optional(),
    })
    .strict(),
  z.object({ view: z.literal("tilt"), ...base, picture, degrees: z.number().min(-180).max(180), label: label(24).optional() }).strict(),
]);

export type SubView = z.infer<typeof viewSchema>;

export const beatVisualSchema = z
  .object({
    skill: z.literal("render-subject"),
    views: z.array(viewSchema).min(1).max(4).describe("in order; each starts at its at_word"),
  })
  .strict();

export type SubBeatVisual = z.infer<typeof beatVisualSchema>;
export type SubScene = z.infer<typeof sceneSchema>;

/** Every piece of text a view puts on screen (fact-checked with the script). */
export function viewText(v: SubView): string[] {
  const out = [v.caption ?? ""];
  switch (v.view) {
    case "labels":
      out.push(...v.items.map((i) => i.text));
      break;
    case "stat":
      out.push(v.value, v.subtitle ?? "");
      break;
    case "compare":
      out.push(v.label ?? "");
      break;
    case "tilt":
      out.push(`${v.degrees}°`, v.label ?? "");
      break;
  }
  return out.filter(Boolean);
}

export function sceneText(scene: SubScene): string[] {
  return [scene.subject.name, ...scene.pictures.map((p) => p.name ?? "")].filter(Boolean);
}

export function checkBeat(visual: SubBeatVisual, scene: SubScene | undefined, beatId: string, voiceover: string): string[] {
  const words = voiceover.split(/\s+/).filter(Boolean).length;
  const ids = new Set([MAIN, ...(scene?.pictures ?? []).map((p) => p.id)]);
  const problems: string[] = [];
  let last = -1;
  visual.views.forEach((v, i) => {
    if (v.at_word >= words) problems.push(`beat "${beatId}" view ${i}: at_word ${v.at_word} is past the beat's last word (${words} words)`);
    if (v.at_word <= last) problems.push(`beat "${beatId}" view ${i}: at_word must increase (${v.at_word} after ${last})`);
    last = v.at_word;
    if (i === 0 && v.at_word !== 0) problems.push(`beat "${beatId}": the first view must start at word 0`);
    if (!ids.has(v.picture)) problems.push(`beat "${beatId}" view ${i}: picture "${v.picture}" is not in visuals["render-subject"].pictures`);
    if ((v.view === "reveal" || v.view === "swap" || v.view === "compare") && v.picture === MAIN) problems.push(`beat "${beatId}" view ${i}: a ${v.view} needs another picture than "${MAIN}"`);
  });
  return problems;
}

/** Every picture the episode's views use, in first-use order ("main" always first). */
export function picturesUsed(scene: SubScene, beats: { visual: unknown }[]): string[] {
  const used = new Set<string>([MAIN]);
  for (const b of beats) {
    const v = b.visual as { skill?: string; views?: { picture?: string }[] };
    if (v?.skill !== "render-subject") continue;
    for (const view of v.views ?? []) used.add(view.picture ?? MAIN);
  }
  const known = new Set([MAIN, ...scene.pictures.map((p) => p.id)]);
  return [...used].filter((id) => known.has(id));
}

/** A number that counts up to its value ("-224 °C" counts from 0 to -224); other values just appear. */
export function countingValue(value: string, k: number): string {
  const m = /^([-−+]?)(\d+(?:\.\d+)?)(.*)$/s.exec(value);
  if (!m) return value;
  const target = Number(m[2]);
  const decimals = m[2].includes(".") ? m[2].split(".")[1].length : 0;
  return `${m[1]}${(target * k).toFixed(decimals)}${m[3]}`;
}
