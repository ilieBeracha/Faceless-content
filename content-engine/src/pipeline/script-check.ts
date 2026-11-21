import { existsSync } from "node:fs";
import { join } from "node:path";
import { checkFrames, checkShots, parseTheme } from "../skills/render-themed/schema.ts";
import { seriesDoc, type Channel } from "../core/channels.ts";
import { canonicalJson, readJson, sha256 } from "../core/util.ts";
import type { Workspace } from "../core/workspace.ts";
import { EngineError } from "../core/errors.ts";
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
  /** The language the voice speaks (ISO 639-1); English when not set. Must be the channel's language. */
  language?: string;
}

export interface ScriptCheck {
  script?: Script;
  errors: string[];
  warnings: string[];
  estimatedSeconds?: number;
}

/**
 * Words per second Kokoro speaks at speed 1.0, not counting the pauses it adds at sentence ends and clause breaks
 * (those are counted on their own, by the voice's settings). Fitted 2026-11-19 to 7 scripts voiced the way the
 * voice step does it (each speaker turn in one flowing pass) at speeds 0.95–1.1: every estimate was within 8%.
 */
export const WORDS_PER_SECOND = 3.38;
/** The worst error of a length estimate against the recording; a script is kept this far inside the series length. */
export const LENGTH_MARGIN = 0.08;

/** Runs of consecutive beats by the same speaker, as beat indexes: the voice says each run in one pass. */
export function speakerTurns(speakers: string[]): number[][] {
  const turns: number[][] = [];
  speakers.forEach((s, i) => {
    const last = turns.at(-1);
    if (last && speakers[last[0]] === s) last.push(i);
    else turns.push([i]);
  });
  return turns;
}

/** Video time around the speech: the lead-in, a gap between speaker turns, and the outro hold. */
export function voiceOverhead(ws: Workspace, turns: number): number {
  const a = ws.config.audio;
  return Math.max(0, turns - 1) * a.beat_gap_seconds + a.lead_in_seconds + a.outro_hold_seconds;
}
/** The pauses the voice adds when a character's voice doesn't set them (the voice step uses the same). */
export const DEFAULT_SENTENCE_PAUSE = 0.25;
export const DEFAULT_CLAUSE_PAUSE = 0.1;
/** Pauses per word in recorded scripts (sentence ends 0.15, clause breaks 0.06), for word budgets before a script exists. */
const SENTENCE_ENDS_PER_WORD = 0.15;
const CLAUSE_BREAKS_PER_WORD = 0.06;

/**
 * Seconds Kokoro takes per spoken syllable at speed 1.0, measured on real hooks (2026-11: 0.20–0.25 s a syllable;
 * this is the slow end, because a hook that runs long fails QA after the whole video is made).
 */
export const SECONDS_PER_SYLLABLE = 0.25;

/** Roughly how many syllables a word has when spoken (vowel groups, less silent endings; numbers by their digits). */
export function wordSyllables(word: string): number {
  const t = word.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9']/g, "");
  if (!t) return 0;
  // A number is said in words ("1947" = "nineteen forty-seven"): about one and a half syllables a digit.
  if (/\d/.test(t)) return Math.ceil(t.replace(/\D/g, "").length * 1.5);
  const possessive = /'s$/.test(t);
  const base = t.replace(/'s$/, "").replace(/'/g, "");
  let n = (base.match(/[aeiouy]+/g) ?? []).length;
  if (n > 1 && /[^aeiouy]e$/.test(base) && !/[^aeiouy]le$/.test(base)) n--; // phone, stone (not table)
  else if (n > 1 && /[^sxzhcg]es$/.test(base)) n--; // makes, does (not boxes, pages)
  else if (n > 1 && /[^td]ed$/.test(base)) n--; // jammed (not landed)
  // "doesn't", "isn't", "couldn't": the n't after s, d or z is a syllable of its own (not in "don't", "can't").
  if (/[sdz]n't$/.test(t)) n++;
  // "Venus's", "box's": the 's after a hissing sound is a syllable of its own.
  if (possessive && /(s|x|z|ch|sh|ce|ge)$/.test(base)) n++;
  return Math.max(1, n);
}

export function syllables(text: string): number {
  return text.split(/[\s-]+/).reduce((n, w) => n + wordSyllables(w), 0);
}

/** Letters spoken, for a language written without most vowels (Hebrew); a digit counts as five letters (a year is said in long words). */
export function letters(text: string): number {
  return (text.match(/\p{L}/gu) ?? []).length + (text.match(/\p{N}/gu) ?? []).length * 5;
}

/**
 * A hosted voice that sets its own pace and pauses (its provider's entry in engine.config.json says how fast it
 * speaks): the character's speed and pause settings don't apply to it. Null for Kokoro (English) and the video model.
 * A voice speaking another language uses that language's measured rates, counted in letters (Hebrew is written without
 * most vowels, so syllables can't be counted from the text). A language with no measured rates is an error.
 */
function ownPace(ws: Workspace, voice: CharacterVoice | undefined): { words_per_second: number; unit: "syllables" | "letters"; seconds_per_unit: number; seconds_per_letter?: number } | null {
  const p = voice ? ws.config.voice.providers[voice.provider] : undefined;
  const lang = voice?.language ?? "en";
  if (lang !== "en") {
    const rates = p?.languages?.[lang];
    if (!rates) throw new EngineError(`The ${voice!.provider} voice has no measured speaking rate for the language "${lang}", so a script's length can't be estimated.`, `Add voice.providers.${voice!.provider}.languages.${lang} to engine.config.json (words a second and seconds a letter, measured on a recording). Languages other than English need an elevenlabs voice.`);
    return { words_per_second: rates.words_per_second, unit: "letters", seconds_per_unit: rates.hook_seconds_per_letter, seconds_per_letter: rates.seconds_per_letter };
  }
  return p?.words_per_second && p.seconds_per_syllable ? { words_per_second: p.words_per_second, unit: "syllables", seconds_per_unit: p.seconds_per_syllable } : null;
}

/** How long a hook may be for a character: in syllables (letters for Hebrew) for voices, in words for the video model. */
export function hookLimit(ws: Workspace, characterData: Record<string, unknown> | undefined): { unit: "syllables" | "letters" | "words"; max: number } {
  const voice = characterData?.voice as CharacterVoice | undefined;
  const room = ws.config.hook.hook_line_ends_by_seconds - ws.config.audio.lead_in_seconds;
  if (voice?.provider === "veo") return { unit: "words", max: Math.floor(room * ws.config.ai_video.words_per_second) };
  const own = ownPace(ws, voice);
  if (own) return { unit: own.unit, max: Math.floor(room / own.seconds_per_unit) };
  return { unit: "syllables", max: Math.floor((room * Number(voice?.speed ?? 1)) / SECONDS_PER_SYLLABLE) };
}

/** When a first sentence will have been spoken, estimated before the voice exists, and the latest it may end. */
export function hookTiming(ws: Workspace, characterData: Record<string, unknown> | undefined, sentence: string): { count: number; unit: "syllables" | "letters" | "words"; seconds: number; limit: number } {
  const voice = characterData?.voice as CharacterVoice | undefined;
  const lead = ws.config.audio.lead_in_seconds;
  const limit = ws.config.hook.hook_line_ends_by_seconds;
  if (voice?.provider === "veo") {
    const count = voiceTokens(sentence).length;
    // The video model's speech is not measured per syllable; its estimate keeps the margin it always had.
    return { count, unit: "words", seconds: lead + count / ws.config.ai_video.words_per_second, limit: limit + 0.25 };
  }
  const own = ownPace(ws, voice);
  if (own) {
    const count = own.unit === "letters" ? letters(sentence) : syllables(sentence);
    return { count, unit: own.unit, seconds: lead + count * own.seconds_per_unit, limit };
  }
  const count = syllables(sentence);
  return { count, unit: "syllables", seconds: lead + (count * SECONDS_PER_SYLLABLE) / Number(voice?.speed ?? 1), limit };
}

/** Spoken words per second for a character: Kokoro's measured rate × speed, or the video model's rate. */
export function speechRate(ws: Workspace, characterData: Record<string, unknown> | undefined): number {
  const voice = characterData?.voice as CharacterVoice | undefined;
  if (voice?.provider === "veo") return ws.config.ai_video.words_per_second;
  return ownPace(ws, voice)?.words_per_second ?? WORDS_PER_SECOND * Number(voice?.speed ?? 1);
}

/** The pauses a character's voice adds to `text`: one at each sentence end, a shorter one at each clause break. The video model's pauses are in its rate. */
export function pauseSeconds(ws: Workspace, characterData: Record<string, unknown> | undefined, text: string): number {
  const voice = characterData?.voice as CharacterVoice | undefined;
  if (voice?.provider === "veo" || ownPace(ws, voice)) return 0;
  const sentences = (text.match(/[.!?…]+(?=\s|$)/g) ?? []).length;
  const clauses = (text.match(/[,;:—–]/g) ?? []).length;
  return sentences * (voice?.sentence_pause ?? DEFAULT_SENTENCE_PAUSE) + clauses * (voice?.clause_pause ?? DEFAULT_CLAUSE_PAUSE);
}

/** How long a character takes to say `text`, pauses included (estimated before the voice exists). */
export function speechSeconds(ws: Workspace, characterData: Record<string, unknown> | undefined, text: string): number {
  // A language counted in letters (Hebrew): its measured seconds a letter, pauses included.
  const own = ownPace(ws, characterData?.voice as CharacterVoice | undefined);
  if (own?.seconds_per_letter) return letters(text) * own.seconds_per_letter;
  return voiceTokens(text).length / speechRate(ws, characterData) + pauseSeconds(ws, characterData, text);
}

/** Words per second for a word budget, with the pauses a typical script has: a voice with long pauses fits fewer words. */
export function budgetWordsPerSecond(ws: Workspace, characterData: Record<string, unknown> | undefined): number {
  const voice = characterData?.voice as CharacterVoice | undefined;
  if (voice?.provider === "veo" || ownPace(ws, voice)) return speechRate(ws, characterData);
  const pausePerWord = SENTENCE_ENDS_PER_WORD * (voice?.sentence_pause ?? DEFAULT_SENTENCE_PAUSE) + CLAUSE_BREAKS_PER_WORD * (voice?.clause_pause ?? DEFAULT_CLAUSE_PAUSE);
  return 1 / (1 / speechRate(ws, characterData) + pausePerWord);
}

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
    errors.push(...(spec.check?.(r.data, beatsUsing, { config: ws.config }) ?? []));
  }
  // Frames a beat names must be the look's; a look with a world tells every beat in painted shots, one without in lettering.
  const themedBeats = script.beats.filter((b) => b.visual.skill === "render-themed");
  if (renderSkills.includes("render-themed") && themedBeats.length) {
    const themePath = join(ctx.channel.dir, "theme.json");
    if (!existsSync(themePath)) errors.push(`render-themed beats need the channel's look, but channels/${ctx.channel.slug}/theme.json does not exist`);
    else {
      const theme = parseTheme(readJson(themePath), `channels/${ctx.channel.slug}/theme.json`);
      errors.push(...checkFrames(themedBeats, theme), ...checkShots(themedBeats, theme));
    }
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

  // Length (from word counts) and hook (from syllables), estimated now and measured exactly after the voice step.
  // Each beat at its speaker's pace, with the pauses its voice adds; kept LENGTH_MARGIN inside the series, the estimate's worst error.
  const overhead = voiceOverhead(ws, speakerTurns(script.beats.map((b) => b.speaker)).length);
  const words = script.beats.reduce((n, b) => n + voiceTokens(b.voiceover).length, 0);
  const estimate = script.beats.reduce((s, b) => s + speechSeconds(ws, ctx.channel.characters.get(b.speaker)?.data, b.voiceover), 0) + overhead;
  const { min_seconds: min, max_seconds: max } = series.length;
  const [lo, hi] = [min * (1 + LENGTH_MARGIN), max * (1 - LENGTH_MARGIN)];
  if (estimate < lo || estimate > hi) {
    const wps = budgetWordsPerSecond(ws, ctx.channel.characters.get(script.beats[0].speaker)?.data);
    errors.push(
      `the script has ${words} words ≈ ${estimate.toFixed(1)}s of video with the voice's pauses, but the series needs ${min}–${max}s, so aim for ${lo.toFixed(1)}–${hi.toFixed(1)}s (about ${Math.round((lo - overhead) * wps)}–${Math.round((hi - overhead) * wps)} words; every sentence end and comma adds a pause)`,
    );
  }
  const hookSpeaker = ctx.channel.characters.get(script.beats[0].speaker)?.data;
  const hook = hookTiming(ws, hookSpeaker, firstSentence(script.beats[0].voiceover));
  if (hook.seconds > hook.limit) {
    const room = hookLimit(ws, hookSpeaker);
    errors.push(`the first sentence has ${hook.count} ${hook.unit} (≈${hook.seconds.toFixed(2)}s) — the hook must land within ${ws.config.hook.hook_line_ends_by_seconds}s, keep it to ${room.max} ${room.unit} or fewer`);
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
    // Latin words are matched by their stem at the start; Hebrew words carry prefixes (ו, ה, ב, ל…) at the start
    // and endings at the end, so a Hebrew key is the word less its last letter, found anywhere in a word.
    const latin = (w: string) => /^[a-z0-9]+$/.test(w);
    const keys = topic
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => (latin(w) ? w.length > 3 && !STOPWORDS.has(w) : w.length > 2))
      .map((w) => (latin(w) ? w.slice(0, Math.max(4, Math.min(6, w.length - 1))) : w.length > 3 ? w.slice(0, -1) : w));
    if (!keys.length) continue;
    for (const sentence of sentences) {
      const words = sentence.toLowerCase().split(/[^\p{L}\p{N}]+/u);
      const matched = keys.map((k) => words.find((w) => (latin(k) ? w.startsWith(k) : w.includes(k))));
      if (matched.every(Boolean)) {
        hits.push({ topic, match: matched.join(" ") });
        break;
      }
    }
  }
  return hits;
}
