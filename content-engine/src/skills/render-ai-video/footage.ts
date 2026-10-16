/**
 * Footage step for render-ai-video (runs after the fact-check, before the voice step):
 *
 *   1. plan      one shot per `visual.shots[]` entry → prompts, clip length, cost estimate
 *   2. stills    a first frame per shot (Gemini image model + the character's approved reference photos)
 *   3. STOP      a person looks at the stills and the cost estimate: ./engine approve footage
 *   4. clips     Veo image-to-video per shot; the character says the shot's line on camera
 *   5. check     Gemini listens to each clip; a clip that says the wrong words is regenerated once
 *
 * Every paid call is written to footage/ledger.json first. Spending stops (and asks) before an episode
 * would go over its budget, retries included. Nothing is deleted: replaced stills and clips move to
 * footage/rejected/.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { EngineError, PipelinePause } from "../../core/errors.ts";
import { probe, runFfmpeg } from "../../core/ffmpeg.ts";
import { canonicalJson, nowIso, readJson, sha256, writeJson, writeText } from "../../core/util.ts";
import type { Workspace } from "../../core/workspace.ts";
import type { EpisodeRef } from "../../pipeline/episode.ts";
import type { SeriesData } from "../../pipeline/script-check.ts";
import { parseCharacterModel, type PhotorealModel } from "../render-talking-character/rigs.ts";
import { voiceTokens, type Script } from "../write-script/schema.ts";
import { kokoroLang, runKokoro, sayFor } from "../../voice/synthesize.ts";
import * as gemini from "./gemini.ts";
import { OFF_CAMERA, type AiBeatVisual, type AiWorld, type Shot } from "./schema.ts";

export const FOOTAGE_VERSION = 1;

export function footagePaths(episodeDir: string) {
  const dir = join(episodeDir, "footage");
  return {
    dir,
    state: join(dir, "footage.json"),
    ledger: join(dir, "ledger.json"),
    stills: join(dir, "stills"),
    clips: join(dir, "clips"),
    rejected: join(dir, "rejected"),
    storyboard: join(dir, "storyboard.md"),
    sheet: join(dir, "storyboard.jpg"),
    work: join(episodeDir, "audio", "chunks", "footage"),
  };
}

export interface PlannedShot {
  id: string;
  beat: string;
  beatIndex: number;
  shotIndex: number;
  speaker: string;
  line: string;
  words: number;
  seconds: number;
  /** false for pov shots: the character narrates from behind the phone and is not in the picture. */
  onCamera: boolean;
  imagePrompt: string;
  videoPrompt: string;
  negativePrompt: string;
}

interface ShotState {
  still_variant: number;
  clip_variant: number;
  still?: { file: string; sha: string; key: string; at: string; fake?: boolean };
  clip?: { file: string; sha: string; key: string; at: string; seconds: number; fake?: boolean; attempts: number; speech?: gemini.SpeechCheck };
}

export interface FootageState {
  version: number;
  shots: Record<string, ShotState>;
  /** Hash of the stills a person approved (shot ids + still hashes + the clip plan). */
  approval?: { hash: string; by: string; at: string };
  /** Set when the pipeline stopped for approval: what `approve footage` will approve. */
  pending?: { hash: string; estimate_usd: number };
}

export interface LedgerEntry {
  at: string;
  shot: string;
  kind: "image" | "video" | "check" | "identity";
  model: string;
  seconds?: number;
  usd: number;
  ok: boolean;
  fake?: boolean;
  note?: string;
}

export interface Ledger {
  budget_usd: number;
  budget_changes: { at: string; usd: number; by: string }[];
  entries: LedgerEntry[];
}

const NEGATIVE = "subtitles, captions, on-screen text, letters, watermark, logo, music, cartoon, animation, CGI, illustration, deformed face, extra fingers, morphing, flicker";

/** Prompt text is written with {She}/{she}/{her}/{is}; swapped for the character's pronoun. */
export function withPronoun(text: string, pronoun: string): string {
  const p = pronoun.toLowerCase();
  const [subj, poss, verb] = p === "he" ? ["he", "his", "is"] : p === "they" ? ["they", "their", "are"] : p === "it" ? ["it", "its", "is"] : ["she", "her", "is"];
  return text
    .replace(/\{She\}/g, subj[0].toUpperCase() + subj.slice(1))
    .replace(/\{she\}/g, subj)
    .replace(/\{her\}/g, poss)
    .replace(/\{is\}/g, verb);
}

const CAMERA: Record<Shot["camera"], { still: string; video: string }> = {
  selfie: {
    still: "Selfie photo: {she} holds the phone at arm's length; {her} face and shoulders fill the middle of the frame, eyes level a little above centre, the place visible behind",
    video: "Selfie vlog shot, phone held at arm's length with natural hand shake",
  },
  "selfie-walk": {
    still: "Walking selfie: phone at arm's length, {she} {is} mid-step, {her} face a little above centre, the street moving behind",
    video: "Walking selfie vlog shot, phone at arm's length, gentle walking bounce",
  },
  "over-shoulder": {
    still: "Shot from just behind, {she} looks back over {her} shoulder into the lens, the place in front filling most of the frame",
    video: "Handheld shot from just behind {her} shoulder; {she} glances back into the lens while talking",
  },
  wide: {
    still: "Handheld photo taken by a companion: {her} full upper body in the place, facing the camera, the surroundings clearly visible",
    video: "Handheld medium-wide shot filmed by a companion",
  },
  closeup: {
    still: "Cinematic medium close-up of {her}, chest up, face a little above centre, {she} speaks to the lens like a documentary host, the setting softly out of focus behind {her}, soft key light and a warm rim light",
    video: "Cinematic medium close-up on a slow, steady dolly push-in (not handheld), shallow depth of field",
  },
  establishing: {
    still: "Cinematic establishing shot of the setting at epic scale: the subject fills the frame, nobody in the foreground, no phone, screen or hand in the picture",
    video: "Cinematic establishing shot with a smooth, slow, steady camera move (dolly, orbit or crane), epic scale, nobody in the shot",
  },
  silhouette: {
    still: "Cinematic wide shot from behind {her}: {she} is a small figure seen only from the back, near the bottom of the frame, dwarfed by the view in front of {her}; {her} face is not visible",
    video: "Cinematic wide shot from behind, slow steady push-in toward the view, the figure stays seen from the back and never turns around",
  },
  pov: {
    still: "First-person view: exactly what the person filming sees, the scene fills the whole frame; nobody is in the foreground, and no phone, screen, camera or hand appears in the picture",
    video: "First-person handheld footage of exactly what the person filming sees, slow natural movement, the scene fills the frame, no phone or screen in the picture",
  },
};

/** The first-frame and video prompts for one shot. Pure, so it can be tested without a workspace. */
export function shotPrompts(world: AiWorld, p: PhotorealModel["params"], shot: Shot, face: string, spoken: string): { onCamera: boolean; imagePrompt: string; videoPrompt: string } {
  const cam = CAMERA[shot.camera];
  // Phone cameras read as a vlog; the cinematic ones (closeup, establishing, silhouette) as a film.
  const film = ["closeup", "establishing", "silhouette"].includes(shot.camera);
  const frameOf = film ? "from a film" : "from a smartphone video";
  const footage = film ? "realistic live-action film footage" : "realistic smartphone footage";
  const sayRule = `{She} says only that line, then stops talking. Ambient sound: ${shot.sound ?? "the natural sounds of the place"}. No music. No subtitles, no on-screen text.`;
  if (OFF_CAMERA.includes(shot.camera)) {
    const fromBehind = shot.camera === "silhouette";
    const figure = fromBehind ? `The figure, seen only from behind: ${p.wardrobe}; dark curly shoulder-length hair.` : "";
    const voiceOver = fromBehind
      ? `{She} is seen only from behind and never turns to the camera. In a voice-over, in ${p.voice}, {she} says: "${spoken}"`
      : `The woman holding the phone stays behind the camera and is never seen. Off screen, in ${p.voice}, {she} says: "${spoken}"`;
    return {
      onCamera: false,
      imagePrompt: [
        `Photorealistic vertical 9:16 frame ${frameOf}. ${cam.still}.`,
        figure,
        `Setting: ${world.world}. ${shot.place}.`,
        `The camera: ${shot.action}.`,
        shot.others ? `Also in the frame: ${shot.others}.` : "",
        `Style: ${world.look}. A real photograph: real light, real textures, no text, no captions, no logos, no watermark.`,
      ].filter(Boolean).join("\n"),
      videoPrompt: [
        `${cam.video}, ${footage}. ${world.look}.`,
        `Setting: ${world.world}; ${shot.place}.`,
        `The camera: ${shot.action}.`,
        shot.others ? `In the scene: ${shot.others}.` : "",
        figure,
        voiceOver,
        sayRule,
      ].filter(Boolean).join("\n"),
    };
  }
  return {
    onCamera: true,
    imagePrompt: [
      `Photorealistic vertical 9:16 frame ${frameOf}. ${cam.still}.`,
      `The person: ${p.identity}. Wearing ${p.wardrobe}.${p.references.length ? " Exactly the same person as in the reference photos: same face, hair, skin and build." : ""}`,
      `Setting: ${world.world}. ${shot.place}.`,
      `{She} {is} ${shot.action}, mid-sentence, expression: ${face}.`,
      shot.others ? `Also in the frame: ${shot.others}.` : "",
      `Style: ${world.look}. A real photograph: natural skin texture, real light, no text, no captions, no logos, no watermark.`,
    ].filter(Boolean).join("\n"),
    videoPrompt: [
      `${cam.video}, ${footage}. ${world.look}.`,
      `${p.identity}, wearing ${p.wardrobe}. Setting: ${world.world}; ${shot.place}.`,
      `{She} {is} ${shot.action}; expression: ${face}.`,
      shot.others ? `In the background: ${shot.others}.` : "",
      `{She} looks into the camera and says, in ${p.voice}: "${spoken}"`,
      sayRule,
    ].filter(Boolean).join("\n"),
  };
}

export function seriesUsesAiVideo(ep: EpisodeRef): boolean {
  const series = ep.channel.series.get(ep.series)!.data as unknown as SeriesData;
  return series.skills.render.includes("render-ai-video");
}

function photorealOf(ep: EpisodeRef, speaker: string): { model: PhotorealModel; dir: string; pronunciations: Record<string, string>; pronoun: string } {
  const doc = ep.channel.characters.get(speaker);
  if (!doc) throw new EngineError(`Unknown speaker "${speaker}".`);
  const model = parseCharacterModel(readJson(doc.modelPath));
  if (model.rig !== "photoreal") throw new EngineError(`${speaker} is a "${model.rig}" character; render-ai-video needs a "photoreal" one.`, `Give the series a photoreal character (see skills/render-ai-video/SKILL.md).`);
  return { model, dir: dirname(doc.modelPath), pronunciations: (doc.data.pronunciations as Record<string, string> | undefined) ?? {}, pronoun: String(doc.data.pronoun ?? "she") };
}

function clipSeconds(ws: Workspace, words: number): number {
  const cfg = ws.config.ai_video;
  const need = words / cfg.words_per_second + 1;
  const options = [...cfg.clip_seconds].sort((a, b) => a - b);
  return options.find((s) => s >= need) ?? options[options.length - 1];
}

/** Turn the script's shots into model prompts. Pure: the same script gives the same plan. */
export function planShots(ws: Workspace, ep: EpisodeRef, script: Script): PlannedShot[] {
  const world = script.visuals["render-ai-video"] as AiWorld;
  const shots: PlannedShot[] = [];
  script.beats.forEach((beat, beatIndex) => {
    if (beat.visual.skill !== "render-ai-video") return;
    const { model, pronunciations, pronoun } = photorealOf(ep, beat.speaker);
    const p = model.params;
    const pron = { ...pronunciations, ...script.pronunciations };
    (beat.visual as unknown as AiBeatVisual).shots.forEach((shot, shotIndex) => {
      const words = voiceTokens(shot.line).length;
      const face = model.expressions[shot.expression ?? beat.character.expression] ?? model.expressions.neutral ?? "relaxed, friendly";
      const spoken = voiceTokens(shot.line).map((t) => sayFor(t, pron)).join(" ");
      const { onCamera, imagePrompt, videoPrompt } = shotPrompts(world, p, shot, face, spoken);
      shots.push({
        id: `${String(beatIndex).padStart(2, "0")}-${beat.id}-${shotIndex + 1}`,
        beat: beat.id,
        beatIndex,
        shotIndex,
        speaker: beat.speaker,
        line: shot.line,
        words,
        seconds: clipSeconds(ws, words),
        onCamera,
        imagePrompt: withPronoun(imagePrompt, pronoun),
        videoPrompt: withPronoun(videoPrompt, pronoun),
        negativePrompt: NEGATIVE,
      });
    });
  });
  return shots;
}

// ---------------------------------------------------------------- money

export function videoRate(ws: Workspace, model = ws.config.ai_video.video_model): number {
  const r = ws.config.ai_video.rates_usd;
  return r.video_per_second[model] ?? r.video_per_second_default;
}

export function readLedger(ws: Workspace, episodeDir: string): Ledger {
  const path = footagePaths(episodeDir).ledger;
  if (existsSync(path)) return readJson<Ledger>(path);
  return { budget_usd: ws.config.ai_video.budget_per_episode_usd, budget_changes: [], entries: [] };
}

export function spent(ledger: Ledger): number {
  return round2(ledger.entries.filter((e) => !e.fake).reduce((s, e) => s + e.usd, 0));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

class Purse {
  ledger: Ledger;
  constructor(
    private ws: Workspace,
    private ep: EpisodeRef,
    private fake: boolean,
  ) {
    this.ledger = readLedger(ws, ep.dir);
  }
  /** Stop before a call that would take the episode over its budget. */
  reserve(usd: number, what: string): void {
    if (this.fake) return;
    const now = spent(this.ledger);
    if (now + usd > this.ledger.budget_usd + 1e-9) {
      throw new PipelinePause("awaiting-approval", [
        `Budget reached: this episode has spent $${now.toFixed(2)} of its $${this.ledger.budget_usd.toFixed(2)} budget, and ${what} would cost about $${usd.toFixed(2)} more.`,
        `Spending log: ${this.ws.rel(footagePaths(this.ep.dir).ledger)}`,
        `To allow more: ./engine ai-video budget --channel ${this.ep.channel.slug} --episode ${this.ep.state.id} --usd <new total> --by "<your name>"`,
        "Nothing more is generated until then.",
      ]);
    }
  }
  record(entry: Omit<LedgerEntry, "at" | "fake">): void {
    this.ledger.entries.push({ at: nowIso(), ...entry, ...(this.fake ? { fake: true, usd: 0 } : {}) });
    writeJson(footagePaths(this.ep.dir).ledger, this.ledger);
  }
}

// ---------------------------------------------------------------- backends

export interface Backend {
  fake: boolean;
  image(prompt: string, references: gemini.ImageInput[], seedText: string): Promise<Buffer>;
  video(req: gemini.VideoRequest, line: string, log: (l: string) => void): Promise<Buffer>;
  check(wav: Buffer, line: string): Promise<gemini.SpeechCheck>;
}

export function isFake(): boolean {
  return process.env.ENGINE_AI_VIDEO_FAKE === "1";
}

/** The real backend (Gemini API, paid) or, with ENGINE_AI_VIDEO_FAKE=1, labelled placeholders made locally. */
export function backend(ws: Workspace, workDir: string): Backend {
  const cfg = ws.config.ai_video;
  if (!isFake()) {
    gemini.geminiKey();
    return {
      fake: false,
      image: (prompt, refs) => gemini.generateImage(cfg.image_model, prompt, refs),
      video: async (req, _line, log) => gemini.waitForVideo(await gemini.startVideo(req), log),
      check: (wav, line) => gemini.checkSpeech(cfg.check_model, wav, line),
    };
  }
  mkdirSync(workDir, { recursive: true });
  return {
    fake: true,
    async image(_prompt, _refs, seedText) {
      const out = join(workDir, `fake-${sha256(seedText).slice(0, 10)}.png`);
      const hue = parseInt(sha256(seedText).slice(0, 2), 16) * 1.4;
      runFfmpeg(["-y", "-f", "lavfi", "-i", "testsrc2=s=720x1280:d=1", "-frames:v", "1", "-vf", `hue=h=${hue.toFixed(0)}`, out], "making a placeholder still");
      return readFileSync(out);
    },
    async video(req, line) {
      const id = sha256(req.prompt).slice(0, 10);
      const still = join(workDir, `fake-${id}.jpg`);
      writeFileSync(still, req.firstFrame!.data);
      const k = runKokoro(ws, [{ id: `fake-${id}`, voice: "af_heart", lang: kokoroLang("af_heart"), speed: 0.9, sentence_pause: 0.25, clause_pause: 0.1, say: voiceTokens(line) }], workDir);
      const out = join(workDir, `fake-${id}.mp4`);
      runFfmpeg(
        [
          "-y", "-loop", "1", "-i", still, "-i", k.chunks[0].file,
          "-f", "lavfi", "-i", `anoisesrc=color=pink:amplitude=0.015:d=${req.durationSeconds}`,
          "-filter_complex", `[1:a]adelay=400|400,apad[v];[v][2:a]amix=inputs=2:duration=longest:normalize=0[a];[0:v]scale=720:1280,zoompan=z='1+0.0008*on':d=1:s=720x1280:fps=24[vid]`,
          "-map", "[vid]", "-map", "[a]", "-t", String(req.durationSeconds), "-r", "24", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", out,
        ],
        "making a placeholder clip",
      );
      return readFileSync(out);
    },
    async check(_wav, line) {
      return { transcript: line, same_words: true, differences: "placeholder clip (not checked)" };
    },
  };
}

// ---------------------------------------------------------------- the step

function loadState(path: string): FootageState {
  return existsSync(path) ? readJson<FootageState>(path) : { version: FOOTAGE_VERSION, shots: {} };
}

/** Move a file to footage/rejected/ (never delete). */
function retire(paths: ReturnType<typeof footagePaths>, file: string, label: string): void {
  if (!existsSync(file)) return;
  mkdirSync(paths.rejected, { recursive: true });
  const ext = file.slice(file.lastIndexOf("."));
  let n = 1;
  while (existsSync(join(paths.rejected, `${label}-${n}${ext}`))) n++;
  renameSync(file, join(paths.rejected, `${label}-${n}${ext}`));
}

function stillKey(ws: Workspace, shot: PlannedShot, refsHash: string, variant: number): string {
  return sha256(canonicalJson({ v: FOOTAGE_VERSION, prompt: shot.imagePrompt, model: ws.config.ai_video.image_model, refs: refsHash, variant }));
}

function clipKey(ws: Workspace, shot: PlannedShot, stillSha: string, variant: number): string {
  const c = ws.config.ai_video;
  return sha256(canonicalJson({ v: FOOTAGE_VERSION, prompt: shot.videoPrompt, neg: shot.negativePrompt, model: c.video_model, res: c.resolution, seconds: shot.seconds, still: stillSha, variant }));
}

function referencesFor(ep: EpisodeRef, speaker: string, fake: boolean): { images: gemini.ImageInput[]; hash: string } {
  const { model, dir } = photorealOf(ep, speaker);
  const refs = model.params.references;
  if (!refs.length && !fake) {
    throw new PipelinePause("needs-fix", [
      `${speaker} has no approved reference photos yet, so the face would change from shot to shot.`,
      `Make candidates: ./engine ai-video identity --channel ${ep.channel.slug} --character ${speaker}`,
      `Then pick one (that is your approval): ./engine ai-video pick-identity --channel ${ep.channel.slug} --character ${speaker} <file>`,
    ]);
  }
  const images = refs.map((r) => {
    const file = join(dir, r);
    if (!existsSync(file)) throw new EngineError(`Reference photo ${r} of ${speaker} is missing (${file}).`);
    return { mimeType: r.endsWith(".png") ? "image/png" : "image/jpeg", data: readFileSync(file) };
  });
  return { images, hash: sha256(images.map((i) => sha256(i.data)).join(",")) };
}

/** Save model output as a JPEG (smaller in git, accepted by Veo). */
function saveJpeg(data: Buffer, out: string, work: string): void {
  mkdirSync(work, { recursive: true });
  mkdirSync(dirname(out), { recursive: true });
  const tmp = join(work, `${basename(out)}.src`);
  writeFileSync(tmp, data);
  runFfmpeg(["-y", "-i", tmp, "-q:v", "2", out], "saving a still");
}

export function approvalHash(plan: PlannedShot[], state: FootageState, ws: Workspace): string {
  return sha256(canonicalJson({ shots: plan.map((s) => [s.id, s.seconds, state.shots[s.id]?.still?.sha ?? null]), model: ws.config.ai_video.video_model, res: ws.config.ai_video.resolution }));
}

export function estimateClips(ws: Workspace, plan: PlannedShot[]): { seconds: number; usd: number; worstUsd: number } {
  const seconds = plan.reduce((s, p) => s + p.seconds, 0);
  const usd = round2(seconds * videoRate(ws) + plan.length * ws.config.ai_video.rates_usd.check);
  return { seconds, usd, worstUsd: round2(usd * (1 + ws.config.ai_video.max_retries_per_shot)) };
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const errors: unknown[] = [];
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(size, queue.length)) }, async () => {
      while (queue.length) {
        const item = queue.shift()!;
        try {
          await fn(item);
        } catch (err) {
          errors.push(err);
          if (err instanceof PipelinePause) queue.length = 0;
        }
      }
    }),
  );
  if (errors.length) throw errors.find((e) => e instanceof PipelinePause) ?? errors[0];
}

export interface FootageResult {
  plan: PlannedShot[];
  regenerated: boolean;
  spentUsd: number;
  fake: boolean;
}

export async function runFootage(ws: Workspace, ep: EpisodeRef, script: Script, opts: { log?: (l: string) => void } = {}): Promise<FootageResult> {
  const log = opts.log ?? (() => {});
  const paths = footagePaths(ep.dir);
  const cfg = ws.config.ai_video;
  const plan = planShots(ws, ep, script);
  if (!plan.length) throw new EngineError("No beat uses render-ai-video, so there is no footage to make.");
  const state = loadState(paths.state);
  const be = backend(ws, paths.work);
  const purse = new Purse(ws, ep, be.fake);
  const save = () => writeJson(paths.state, state);
  let regenerated = false;
  mkdirSync(paths.dir, { recursive: true });
  writeJson(join(paths.dir, "plan.json"), { video_model: cfg.video_model, image_model: cfg.image_model, resolution: cfg.resolution, shots: plan });

  // 2. Stills
  for (const shot of plan) {
    const s = (state.shots[shot.id] ??= { still_variant: 0, clip_variant: 0 });
    // A pov shot doesn't show the character, so it gets no face references (the model would put her in).
    const faceRefs = referencesFor(ep, shot.speaker, be.fake);
    const refs = shot.onCamera ? faceRefs : { images: [], hash: "" };
    const key = stillKey(ws, shot, refs.hash, s.still_variant);
    const file = join(paths.stills, `${shot.id}.jpg`);
    if (s.still?.key === key && existsSync(file)) continue;
    if (s.still) retire(paths, file, `${shot.id}-still`);
    purse.reserve(cfg.rates_usd.image, `the first frame of shot ${shot.id}`);
    log(`  ↳ still ${shot.id}${be.fake ? " (placeholder)" : ""}…`);
    let data: Buffer;
    try {
      data = await be.image(shot.imagePrompt, refs.images, `${shot.id}:${key}`);
      purse.record({ shot: shot.id, kind: "image", model: cfg.image_model, usd: cfg.rates_usd.image, ok: true });
    } catch (err) {
      purse.record({ shot: shot.id, kind: "image", model: cfg.image_model, usd: cfg.rates_usd.image, ok: false, note: (err as Error).message.slice(0, 200) });
      throw err;
    }
    saveJpeg(data, file, paths.work);
    s.still = { file: ws.rel(file), sha: sha256(readFileSync(file)), key, at: nowIso(), ...(be.fake ? { fake: true } : {}) };
    regenerated = true;
    save();
  }

  // 3. A person approves the look and the cost before any video is generated.
  const hash = approvalHash(plan, state, ws);
  if (state.approval?.hash !== hash) {
    const est = estimateClips(ws, plan);
    state.pending = { hash, estimate_usd: est.usd };
    save();
    writeStoryboard(ws, ep, plan, state, est);
    throw new PipelinePause("awaiting-approval", [
      `Look at the first frame of every shot: ${ws.rel(paths.storyboard)} (contact sheet: ${ws.rel(paths.sheet)}).`,
      `Next: ${plan.length} clips, ${est.seconds}s of ${cfg.video_model} ≈ $${est.usd.toFixed(2)} (≤ $${est.worstUsd.toFixed(2)} with retries). Spent so far: $${spent(purse.ledger).toFixed(2)} of $${purse.ledger.budget_usd.toFixed(2)}.`,
      `Approve: ./engine approve footage --channel ${ep.channel.slug} --episode ${ep.state.id} --by "<your name>"`,
      `Redo one still: ./engine ai-video redo --channel ${ep.channel.slug} --episode ${ep.state.id} --shot <id>   (or change the shot in script.json)`,
      "No video is generated until then.",
    ]);
  }

  // 4–5. Clips, each checked by ear.
  const todo = plan.filter((shot) => {
    const s = state.shots[shot.id];
    const key = clipKey(ws, shot, s.still!.sha, s.clip_variant);
    return !(s.clip?.key === key && existsSync(join(paths.clips, `${shot.id}.mp4`)));
  });
  if (todo.length) log(`  ↳ generating ${todo.length} clip(s) with ${be.fake ? "placeholders (ENGINE_AI_VIDEO_FAKE=1)" : cfg.video_model}…`);
  await pool(todo, cfg.concurrency, async (shot) => {
    const s = state.shots[shot.id];
    const file = join(paths.clips, `${shot.id}.mp4`);
    for (let attempt = 1; ; attempt++) {
      const key = clipKey(ws, shot, s.still!.sha, s.clip_variant);
      const cost = shot.seconds * videoRate(ws);
      purse.reserve(cost + cfg.rates_usd.check, `clip ${shot.id} (${shot.seconds}s)`);
      log(`    · ${shot.id}: ${shot.seconds}s clip, attempt ${attempt}`);
      let data: Buffer;
      try {
        data = await be.video(
          { model: cfg.video_model, prompt: shot.videoPrompt, negativePrompt: shot.negativePrompt, firstFrame: { mimeType: "image/jpeg", data: readFileSync(join(paths.stills, `${shot.id}.jpg`)) }, aspectRatio: "9:16", durationSeconds: shot.seconds, resolution: cfg.resolution, personGeneration: cfg.person_generation },
          shot.line,
          log,
        );
        purse.record({ shot: shot.id, kind: "video", model: cfg.video_model, seconds: shot.seconds, usd: cost, ok: true });
      } catch (err) {
        // Filtered or failed jobs are usually not billed; recorded at full price to stay on the safe side.
        purse.record({ shot: shot.id, kind: "video", model: cfg.video_model, seconds: shot.seconds, usd: cost, ok: false, note: (err as Error).message.slice(0, 200) });
        throw err;
      }
      if (existsSync(file)) retire(paths, file, `${shot.id}-clip`);
      mkdirSync(paths.clips, { recursive: true });
      writeFileSync(file, data);
      const speech = await be.check(clipAudio(file, join(paths.work, `${shot.id}-check.wav`)), shot.line);
      purse.record({ shot: shot.id, kind: "check", model: cfg.check_model, usd: cfg.rates_usd.check, ok: true, note: speech.same_words ? "line ok" : `wrong words: ${speech.differences}`.slice(0, 200) });
      s.clip = { file: ws.rel(file), sha: sha256(data), key, at: nowIso(), seconds: probe(file).duration, attempts: attempt, speech, ...(be.fake ? { fake: true } : {}) };
      regenerated = true;
      save();
      if (speech.same_words) break;
      log(`    ⚠ ${shot.id} said "${speech.transcript}" instead of "${shot.line}"`);
      if (attempt > cfg.max_retries_per_shot) break;
      s.clip_variant++;
    }
  });

  const wrong = plan.filter((p) => state.shots[p.id].clip?.speech?.same_words === false);
  if (wrong.length) {
    throw new PipelinePause("needs-fix", [
      "These clips still don't say their line after a retry:",
      ...wrong.map((p) => `  - ${p.id}: wanted "${p.line}", heard "${state.shots[p.id].clip!.speech!.transcript}"`),
      `Shorten or simplify those lines in script.json (the fact-check then needs a fresh approval), or try again: ./engine ai-video redo --channel ${ep.channel.slug} --episode ${ep.state.id} --shot <id>`,
    ]);
  }
  return { plan, regenerated, spentUsd: spent(purse.ledger), fake: be.fake };
}

/** 16 kHz mono WAV of a clip's sound (for the speech check and alignment). */
export function clipAudio(clip: string, out: string): Buffer {
  mkdirSync(dirname(out), { recursive: true });
  runFfmpeg(["-y", "-i", clip, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", out], "extracting clip audio");
  return readFileSync(out);
}

function writeStoryboard(ws: Workspace, ep: EpisodeRef, plan: PlannedShot[], state: FootageState, est: { seconds: number; usd: number; worstUsd: number }): void {
  const paths = footagePaths(ep.dir);
  const ledger = readLedger(ws, ep.dir);
  const fake = plan.some((p) => state.shots[p.id].still?.fake);
  const lines = [
    `# Footage plan — ${ep.state.id}`,
    "",
    fake ? "> **PLACEHOLDERS** — made locally with ENGINE_AI_VIDEO_FAKE=1. Not real footage; QA will refuse this episode.\n" : "",
    `Video model \`${ws.config.ai_video.video_model}\` at ${ws.config.ai_video.resolution}. ${plan.length} shots, ${est.seconds}s of clips ≈ **$${est.usd.toFixed(2)}** (≤ $${est.worstUsd.toFixed(2)} if every shot needs a retry).`,
    `Spent so far: $${spent(ledger).toFixed(2)} of the $${ledger.budget_usd.toFixed(2)} budget.`,
    "",
    "Check each first frame: same person every time, period-correct place, no text or logos, the face clear of the caption area (lower third).",
    "",
    "| shot | clip | line | still |",
    "|---|---|---|---|",
    ...plan.map((p) => `| \`${p.id}\` | ${p.seconds}s | ${p.line.replace(/\|/g, "\\|")} | ![${p.id}](stills/${p.id}.jpg) |`),
    "",
  ];
  writeText(paths.storyboard, lines.filter((l) => l !== "").join("\n").replace(/\n\|/g, "\n|") + "\n");
  try {
    const files = plan.map((p) => join(paths.stills, `${p.id}.jpg`));
    const cols = Math.min(6, files.length);
    const rows = Math.ceil(files.length / cols);
    const inputs = files.flatMap((f) => ["-i", f]);
    const scaled = files.map((_, i) => `[${i}:v]scale=240:426:force_original_aspect_ratio=increase,crop=240:426[s${i}]`).join(";");
    const pads = Array.from({ length: cols * rows - files.length }, (_, i) => `color=black:s=240x426:d=1[p${i}]`);
    const all = [...files.map((_, i) => `[s${i}]`), ...pads.map((_, i) => `[p${i}]`)];
    const layout = all.map((_, i) => `${(i % cols) * 240}_${Math.floor(i / cols) * 426}`).join("|");
    const graph = [scaled, ...pads, `${all.join("")}xstack=inputs=${all.length}:layout=${layout}[out]`].join(";");
    runFfmpeg(["-y", ...inputs, "-filter_complex", graph, "-map", "[out]", "-frames:v", "1", "-q:v", "3", paths.sheet], "building the storyboard sheet");
  } catch {
    // The individual stills are enough.
  }
}

/** `./engine approve footage`: a person approved the stills and the clip cost. */
export function approveFootage(ws: Workspace, ep: EpisodeRef, by: string): { estimate: number } {
  const paths = footagePaths(ep.dir);
  const state = loadState(paths.state);
  if (!state.pending) throw new EngineError("There is nothing to approve yet.", `Run: ./engine make episode --channel ${ep.channel.slug} --series ${ep.series}`);
  state.approval = { hash: state.pending.hash, by, at: nowIso() };
  const estimate = state.pending.estimate_usd;
  delete state.pending;
  writeJson(paths.state, state);
  return { estimate };
}

/** `./engine ai-video redo`: make a new still (and so a new clip), or only a new clip, for one shot. */
export function redoShot(ws: Workspace, ep: EpisodeRef, shotId: string, what: "still" | "clip"): void {
  const paths = footagePaths(ep.dir);
  const state = loadState(paths.state);
  const s = state.shots[shotId];
  if (!s) throw new EngineError(`No shot "${shotId}" in this episode.`, `Shots: ${Object.keys(state.shots).join(", ") || "(none yet)"}`);
  if (what === "still") s.still_variant++;
  else s.clip_variant++;
  writeJson(paths.state, state);
}

/** `./engine ai-video budget`: a person sets a new total budget for one episode. */
export function setBudget(ws: Workspace, ep: EpisodeRef, usd: number, by: string): Ledger {
  const ledger = readLedger(ws, ep.dir);
  ledger.budget_usd = usd;
  ledger.budget_changes.push({ at: nowIso(), usd, by });
  mkdirSync(footagePaths(ep.dir).dir, { recursive: true });
  writeJson(footagePaths(ep.dir).ledger, ledger);
  return ledger;
}

export function listClips(episodeDir: string): string[] {
  const dir = footagePaths(episodeDir).clips;
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".mp4")).sort() : [];
}

