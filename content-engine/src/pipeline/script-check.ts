import { existsSync } from "node:fs";
import { seriesDoc, type Channel } from "../core/channels.ts";
import { canonicalJson, readJson, sha256 } from "../core/util.ts";
import type { Workspace } from "../core/workspace.ts";
import { RENDER_SKILLS } from "../skills/registry.ts";
import { parseCharacterModel } from "../skills/render-talking-character/rigs.ts";
import { firstSentence, scriptSchema, voiceTokens, type Script } from "../skills/write-script/schema.ts";

export interface SeriesData {
  slug: string;
  name: string;
  status: string;
  characters: string[];
  length: { min_seconds: number; max_seconds: number };
  beats: { id: string; seconds: number; purpose: string }[];
  skills: { script: string; render: string[]; captions: string };
  hook_pattern?: string;
}

export interface CharacterVoice {
  provider: string;
  voice_id: string;
  speed?: number;
  pitch_semitones?: number;
  sentence_pause?: number;
  clause_pause?: number;
}

export interface ScriptCheck {
  script?: Script;
  errors: string[];
  warnings: string[];
  estimatedSeconds?: number;
}

/** Roughly how many words per second Kokoro speaks at speed 1.0 (measured: ~3.0 w/s). */
export const WORDS_PER_SECOND = 3.0;

export function checkScript(ws: Workspace, raw: unknown, ctx: { channel: Channel; series: string; idea: string }): ScriptCheck {
  const parsed = scriptSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`), warnings: [] };
  }
  const script = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];
  const series = seriesDoc(ctx.channel, ctx.series).data as unknown as SeriesData;

  if (script.channel !== ctx.channel.slug) errors.push(`"channel" is "${script.channel}" but this episode belongs to "${ctx.channel.slug}"`);
  if (script.series !== ctx.series) errors.push(`"series" is "${script.series}" but this episode is for "${ctx.series}"`);
  if (script.idea !== ctx.idea) errors.push(`"idea" is "${script.idea}" but this episode was created for idea "${ctx.idea}"`);

  const expected = series.beats.map((b) => b.id);
  const got = script.beats.map((b) => b.id);
  if (expected.join("|") !== got.join("|")) errors.push(`beats must follow the series structure in order: ${expected.join(" → ")} (got ${got.join(" → ")})`);

  const renderSkills = series.skills.render;
  for (const beat of script.beats) {
    if (!series.characters.includes(beat.speaker)) errors.push(`beat "${beat.id}": speaker "${beat.speaker}" is not a character of this series (${series.characters.join(", ")})`);
    const character = ctx.channel.characters.get(beat.speaker);
    if (character && existsSync(character.modelPath)) {
      const model = parseCharacterModel(readJson(character.modelPath));
      if (!(beat.character.expression in model.expressions)) {
        errors.push(`beat "${beat.id}": expression "${beat.character.expression}" is not defined for ${beat.speaker} (has: ${Object.keys(model.expressions).join(", ")})`);
      }
    }
    if (beat.character.placement !== "hidden" && !renderSkills.includes("render-talking-character")) {
      warnings.push(`beat "${beat.id}": character placement "${beat.character.placement}" is ignored — the series doesn't use render-talking-character`);
    }
    const skill = beat.visual.skill;
    if (skill === "none") continue;
    if (!renderSkills.includes(skill)) {
      errors.push(`beat "${beat.id}": visual.skill "${skill}" is not one of this series' render skills (${renderSkills.join(", ")})`);
      continue;
    }
    const spec = RENDER_SKILLS[skill];
    if (!spec || spec.layer !== "scene" || !spec.beatVisualSchema) {
      errors.push(`beat "${beat.id}": "${skill}" can't be a beat's main visual (it is an overlay); use a scene skill or "none"`);
      continue;
    }
    const r = spec.beatVisualSchema.safeParse(beat.visual);
    if (!r.success) errors.push(...r.error.issues.map((i) => `beat "${beat.id}" visual.${i.path.join(".")}: ${i.message}`));
    else {
      beat.visual = r.data as typeof beat.visual;
      const used = spec.expressionsUsed?.(r.data) ?? [];
      if (used.length && character && existsSync(character.modelPath)) {
        const model = parseCharacterModel(readJson(character.modelPath));
        for (const name of new Set(used)) if (!(name in model.expressions)) errors.push(`beat "${beat.id}": scene expression "${name}" is not defined for ${beat.speaker} (has: ${Object.keys(model.expressions).join(", ")})`);
      }
    }
  }

  for (const skill of renderSkills) {
    const spec = RENDER_SKILLS[skill];
    if (!spec) {
      errors.push(`series render skill "${skill}" has no implementation in src/skills/registry.ts`);
      continue;
    }
    const beatsUsing = script.beats.filter((b) => b.visual.skill === skill);
    if (!spec.sceneSchema) continue;
    const payload = script.visuals[skill];
    if (payload === undefined) {
      if (spec.sceneRequired && beatsUsing.length) errors.push(`visuals["${skill}"] is required because beats ${beatsUsing.map((b) => b.id).join(", ")} use it`);
      continue;
    }
    const r = spec.sceneSchema.safeParse(payload);
    if (!r.success) {
      errors.push(...r.error.issues.map((i) => `visuals["${skill}"].${i.path.join(".")}: ${i.message}`));
      continue;
    }
    script.visuals[skill] = r.data;
    errors.push(...(spec.check?.(r.data, beatsUsing) ?? []));
  }
  for (const key of Object.keys(script.visuals)) if (!renderSkills.includes(key)) warnings.push(`visuals["${key}"] is ignored — not a render skill of this series`);

  const beatIds = new Set(got);
  const claimIds = new Set<string>();
  for (const claim of script.claims) {
    if (!beatIds.has(claim.beat)) errors.push(`claim ${claim.id}: beat "${claim.beat}" doesn't exist`);
    if (claimIds.has(claim.id)) errors.push(`claim id ${claim.id} is used twice`);
    claimIds.add(claim.id);
    if (claim.confidence === "low") warnings.push(`claim ${claim.id} has low confidence — find a better source or cut it`);
  }

  // Length and hook, estimated from word counts (measured exactly after the voice step).
  const speaker = ctx.channel.characters.get(script.beats[0].speaker);
  const speed = Number((speaker?.data.voice as CharacterVoice | undefined)?.speed ?? 1);
  const wps = WORDS_PER_SECOND * speed;
  const words = script.beats.reduce((n, b) => n + voiceTokens(b.voiceover).length, 0);
  const cfg = ws.config.audio;
  const estimate = words / wps + script.beats.length * cfg.beat_gap_seconds + cfg.lead_in_seconds + cfg.outro_hold_seconds;
  const { min_seconds: min, max_seconds: max } = series.length;
  if (estimate < min * 0.85 || estimate > max * 1.08) {
    errors.push(`the script has ${words} words ≈ ${estimate.toFixed(1)}s of video, but the series needs ${min}–${max}s (aim for ~${Math.round(((min + max) / 2 - 2) * wps)} words)`);
  }
  const hookWords = voiceTokens(firstSentence(script.beats[0].voiceover)).length;
  const hookSeconds = cfg.lead_in_seconds + hookWords / wps;
  if (hookSeconds > ws.config.hook.hook_line_ends_by_seconds + 0.25) {
    errors.push(`the first sentence has ${hookWords} words (≈${hookSeconds.toFixed(1)}s) — the hook must land within ${ws.config.hook.hook_line_ends_by_seconds}s, keep it to ~${Math.floor((ws.config.hook.hook_line_ends_by_seconds - cfg.lead_in_seconds) * wps)} words`);
  }
  if (!script.beats[0].on_screen_text) warnings.push("the first beat has no on_screen_text — a visible hook in the first frames helps retention");

  const banned = bannedTopicHits(ctx.channel, allText(script));
  for (const hit of banned) warnings.push(`possible banned topic "${hit.topic}" — matched "${hit.match}" (the QA review must confirm it's a false positive)`);

  return { script, errors, warnings, estimatedSeconds: estimate };
}

/** Every piece of text a viewer hears or sees. */
export function allText(script: Script): string[] {
  const out = [script.title, script.publish.title, script.publish.description];
  for (const b of script.beats) out.push(b.voiceover, b.on_screen_text ?? "");
  const skills = new Set([...Object.keys(script.visuals), ...script.beats.map((b) => b.visual.skill)]);
  for (const skill of skills) {
    const spec = RENDER_SKILLS[skill];
    out.push(...(spec?.text?.(script.visuals[skill], script.beats.filter((b) => b.visual.skill === skill)) ?? []));
  }
  return out.filter(Boolean);
}

/**
 * The parts of a script a fact-check approval covers: everything said or shown, plus the claims.
 * Changing camera moves or colours doesn't need re-approval; changing any word or number does.
 */
export function factualHash(script: Script): string {
  const content = {
    title: script.title,
    beats: script.beats.map((b) => ({ id: b.id, speaker: b.speaker, voiceover: b.voiceover, on_screen_text: b.on_screen_text ?? "" })),
    shown: allText(script).sort(),
    claims: script.claims,
    publish: script.publish,
  };
  return sha256(canonicalJson(content));
}

const STOPWORDS = new Set(["and", "the", "for", "with", "about", "any", "that", "this", "from", "into", "real", "kids", "content", "topics", "other", "their"]);

export interface BannedHit {
  topic: string;
  match: string;
}

/** Keyword screen for the channel's banned topics (a first pass; the QA review checks meaning). */
export function bannedTopicHits(channel: Channel, texts: string[]): BannedHit[] {
  const topics = (channel.doc.data.banned_topics as string[] | undefined) ?? [];
  const hits: BannedHit[] = [];
  const sentences = texts.flatMap((t) => t.split(/(?<=[.!?…])\s+/));
  for (const topic of topics) {
    const keys = topic
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w))
      .map((w) => w.slice(0, Math.max(4, Math.min(6, w.length - 1))));
    if (!keys.length) continue;
    for (const sentence of sentences) {
      const words = sentence.toLowerCase().split(/[^a-z0-9]+/);
      const matched = keys.map((k) => words.find((w) => w.startsWith(k)));
      if (matched.every(Boolean)) {
        hits.push({ topic, match: matched.join(" ") });
        break;
      }
    }
  }
  return hits;
}
