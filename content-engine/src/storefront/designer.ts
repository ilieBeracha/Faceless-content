/**
 * The designer on the create page: a customer builds their own look and host from settings instead of
 * taking a ready-made one. This file turns the form's fields into a theme and a character model (both
 * checked by the engine's own schemas) and back, so any ready-made look or host can be a starting point.
 */
import { checkCharacterModel, parseCharacterModel, type CharacterModel } from "../skills/render-talking-character/rigs.ts";
import { LAYOUT_CHOICES, themeSchema, type Theme } from "../skills/render-themed/schema.ts";

type Fields = Record<string, string>;

/* ---- the look ---- */

const COLOURS = { l_paper: "paper", l_card: "card", l_ink: "ink", l_text: "text", l_accent: "accent" } as const;
const CHOICES = { l_body: "body", l_casing: "casing", l_surface: "surface", l_backdrop: "backdrop", l_texture: "texture", l_motion: "motion", l_art: "art" } as const;
const LAYOUT = { l_host: "host", l_host_size: "host_size", l_lettering: "lettering", l_pictures: "pictures" } as const;
/** `l_frames`: the look's frames as JSON (preset names or frames of its own), or empty for the classic arrangement. */
export const LOOK_FIELDS = [...Object.keys(COLOURS), "l_a", "l_b", "l_c", "l_display", ...Object.keys(CHOICES), ...Object.keys(LAYOUT), "l_frames"];

/** What each choice offers, read from the theme schema so the form can never offer something the renderer rejects. */
export const LOOK_CHOICES: Record<keyof typeof CHOICES | keyof typeof LAYOUT | "l_display", readonly string[]> = {
  l_host: LAYOUT_CHOICES.host,
  l_host_size: LAYOUT_CHOICES.host_size,
  l_lettering: LAYOUT_CHOICES.lettering,
  l_pictures: LAYOUT_CHOICES.pictures,
  l_display: themeSchema.shape.display.element.options,
  l_body: themeSchema.shape.body.options,
  l_casing: themeSchema.shape.casing.options,
  l_surface: themeSchema.shape.surface.options,
  l_backdrop: themeSchema.shape.backdrop.options,
  l_texture: themeSchema.shape.texture.options,
  l_motion: themeSchema.shape.motion.options,
  l_art: themeSchema.shape.art.options,
};

export function hasLook(form: Fields): boolean {
  return LOOK_FIELDS.some((f) => (form[f] ?? "") !== "");
}

/** `l_display` holds one face, or several joined by commas (lines then alternate between them). */
export function lookFields(theme: Theme): Fields {
  const out: Fields = { l_a: theme.colors[0], l_b: theme.colors[1], l_c: theme.colors[2], l_display: theme.display.join(",") };
  for (const [field, key] of Object.entries(COLOURS)) out[field] = theme[key];
  for (const [field, key] of Object.entries(CHOICES)) out[field] = theme[key];
  for (const [field, key] of Object.entries(LAYOUT)) out[field] = theme.layout[key];
  out.l_frames = theme.layout.frames ? JSON.stringify(theme.layout.frames) : "";
  return out;
}

export function buildLook(form: Fields, name: string): { theme: Theme; problems: null } | { theme: null; problems: string[] } {
  const raw: Record<string, unknown> = { name, colors: [form.l_a, form.l_b, form.l_c], display: (form.l_display ?? "").split(",").filter(Boolean) };
  for (const [field, key] of Object.entries(COLOURS)) raw[key] = form[field];
  for (const [field, key] of Object.entries(CHOICES)) raw[key] = form[field];
  raw.layout = Object.fromEntries(Object.entries(LAYOUT).map(([field, key]) => [key, form[field]]));
  const frames = form.l_frames ?? "";
  if (frames) {
    try {
      (raw.layout as Record<string, unknown>).frames = JSON.parse(frames);
    } catch {
      return { theme: null, problems: ["layout.frames: the scene layouts could not be read"] };
    }
  }
  const r = themeSchema.safeParse(raw);
  if (r.success) return { theme: r.data, problems: null };
  return { theme: null, problems: r.error.issues.map((i) => `${i.path.join(".") || "look"}: ${i.message}`) };
}

/* ---- the host ---- */

interface RigOptions {
  label: string;
  /** Empty list = this kind of host has no such setting. */
  shape: string[];
  extra: string[];
  hair: string[];
  eyes: string[];
  /** What the three colours paint on this kind of host. */
  colours: [string, string, string];
  shapeLabel: string;
}

/** The kinds of host that can be built from settings and previewed as you go. */
export const HOST_RIGS: Record<string, RigOptions> = {
  "flat-2d": { label: "Cartoon creature", shapeLabel: "Shape", shape: ["blob", "circle", "rounded-rect", "drop", "star", "egg"], extra: ["none", "tail", "ears", "antenna", "sparkles", "glasses", "leaf", "hat", "crown", "bow"], hair: [], eyes: ["round", "dot", "oval", "sleepy"], colours: ["Body", "Outline", "Accessory"] },
  "stick-figure": { label: "Sketch person", shapeLabel: "Body", shape: ["stick", "tunic"], extra: ["none", "glasses", "beanie", "chef-hat", "helmet", "scarf", "bow", "cap"], hair: ["tuft", "none", "curl", "spiky", "bun"], eyes: [], colours: ["Skin", "Clothes", "Accessory"] },
  "pixel-sprite": { label: "Pixel sprite", shapeLabel: "Shape", shape: [], extra: ["none", "horns", "antenna", "cap"], hair: [], eyes: [], colours: ["Body", "Outline", "Feature"] },
  "neon-line": { label: "Neon face", shapeLabel: "Shape", shape: ["hex", "circle", "diamond", "square"], extra: [], hair: [], eyes: [], colours: ["Outline", "Eyes and mouth", "Panel behind"] },
};
/** 3D robots are taken as they are: they cannot be drawn as you go, so they are not built from settings. */
export const READY_RIG = "orb-bot-3d";
export const MOODS = ["cheerful", "calm", "grumpy"] as const;
export const HOST_FIELDS = ["h_rig", "h_shape", "h_extra", "h_hair", "h_eyes", "h_main", "h_second", "h_accent", "h_mood"];

const MOOD: Record<(typeof MOODS)[number], { mouth_curve: number; brow: "flat" | "down" }> = { cheerful: { mouth_curve: 0.5, brow: "flat" }, calm: { mouth_curve: 0.15, brow: "flat" }, grumpy: { mouth_curve: -0.25, brow: "down" } };

function expressions(mood: (typeof MOODS)[number]) {
  return {
    neutral: { eye_scale: 1, pupil_scale: 1, bounce: 0.3, ...MOOD[mood] },
    curious: { eye_scale: 1.15, pupil_scale: 1.1, tilt_deg: 10, look: [0.3, -0.2], bounce: 0.3, brow: "up", mouth_curve: 0.1 },
    excited: { eye_scale: 1.3, pupil_scale: 1.2, bounce: 0.8, brow: "up", mouth_curve: 0.9 },
    surprised: { eye_scale: 1.5, pupil_scale: 0.5, bounce: 0.5, brow: "up", mouth_curve: 0 },
    thinking: { eye_scale: 0.95, lid: 0.3, tilt_deg: -8, look: [-0.4, -0.5], bounce: 0.15, brow: "down", mouth_curve: -0.1 },
  };
}

/** A darker tone of a colour, for the lower rows of a pixel sprite. */
function darker(hex: string): string {
  const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  return `#${[1, 3, 5].map((i) => Math.round(parseInt(full.slice(i, i + 2), 16) * 0.74).toString(16).padStart(2, "0")).join("")}`;
}

export function hasHost(form: Fields): boolean {
  return (form.h_rig ?? "") !== "";
}

export function buildHost(form: Fields): { model: CharacterModel; problems: null } | { model: null; problems: string[] } {
  const rig = form.h_rig ?? "";
  const options = HOST_RIGS[rig];
  if (!options) return { model: null, problems: [`"${rig}" is not a kind of host that can be designed here.`] };
  const problems: string[] = [];
  const pick = (field: "h_shape" | "h_extra" | "h_hair" | "h_eyes", list: string[]) => {
    if (!list.length) return "";
    if (!list.includes(form[field] ?? "")) problems.push(`${field.slice(2)}: "${form[field] ?? ""}" is not offered for a ${options.label.toLowerCase()}`);
    return form[field] ?? "";
  };
  const [shape, extra, hair, eyes] = [pick("h_shape", options.shape), pick("h_extra", options.extra), pick("h_hair", options.hair), pick("h_eyes", options.eyes)];
  if (!(MOODS as readonly string[]).includes(form.h_mood ?? "")) problems.push(`mood: "${form.h_mood ?? ""}" is not offered`);
  for (const c of ["h_main", "h_second", "h_accent"]) if (!/^#[0-9a-f]{6}$/i.test(form[c] ?? "")) problems.push(`${c.slice(2)} colour: must be a hex colour like #ff8800`);
  if (problems.length) return { model: null, problems };
  const { h_main: main, h_second: second, h_accent: accent } = form;
  const params =
    rig === "flat-2d"
      ? { body: { shape, color: main, outline: second }, eyes: { style: eyes }, accessories: extra === "none" ? [] : [{ type: extra, color: accent }] }
      : rig === "stick-figure"
        ? { head: main, hair, body_style: shape, body_color: second, accessory: extra, accessory_color: accent }
        : rig === "pixel-sprite"
          ? { body: main, shade: darker(main), outline: second, pupil: second, accent, feature: extra }
          : { line: main, glow: second, backing: accent, shape };
  const raw = { rig, params, expressions: expressions(form.h_mood as (typeof MOODS)[number]) };
  const found = checkCharacterModel(raw);
  return found.length ? { model: null, problems: found } : { model: parseCharacterModel(raw), problems: null };
}

/** The settings that rebuild a host as closely as the designer can. A 3D robot has none beyond its kind. */
export function hostFields(model: CharacterModel): Fields {
  const blank = { h_shape: "", h_extra: "", h_hair: "", h_eyes: "", h_main: "#888888", h_second: "#222222", h_accent: "#ffcc33", h_mood: "calm" };
  if (model.rig === "photoreal" || model.rig === "orb-bot-3d") return { ...blank, h_rig: model.rig };
  const curve = model.expressions.neutral?.mouth_curve ?? 0.2;
  const h_mood = curve >= 0.35 ? "cheerful" : curve < 0 ? "grumpy" : "calm";
  switch (model.rig) {
    case "flat-2d": {
      const q = model.params;
      return { ...blank, h_rig: model.rig, h_mood, h_shape: q.body.shape, h_eyes: q.eyes.style, h_extra: q.accessories[0]?.type ?? "none", h_main: q.body.color, h_second: q.body.outline, h_accent: q.accessories[0]?.color ?? blank.h_accent };
    }
    case "stick-figure": {
      const q = model.params;
      return { ...blank, h_rig: model.rig, h_mood, h_shape: q.body_style, h_hair: q.hair, h_extra: q.accessory, h_main: q.head, h_second: q.body_color, h_accent: q.accessory_color };
    }
    case "pixel-sprite": {
      const q = model.params;
      return { ...blank, h_rig: model.rig, h_mood, h_extra: q.feature, h_main: q.body, h_second: q.outline, h_accent: q.accent };
    }
    case "neon-line": {
      const q = model.params;
      return { ...blank, h_rig: model.rig, h_mood, h_shape: q.shape, h_main: q.line, h_second: q.glow, h_accent: q.backing };
    }
  }
}
