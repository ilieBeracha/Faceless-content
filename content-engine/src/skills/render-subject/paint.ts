/**
 * The pictures of render-subject: the subject itself, then every other picture of it the views use, painted by
 * Google's image model (paid, ai_video.rates_usd.image each). Each picture shows the subject alone on the scene's
 * plain background, so it sits on the video's background seamlessly and the code can move, zoom, split and tilt it.
 * The later pictures are painted from the subject's picture, so they share its style.
 *
 * Pictures are kept by content: one is painted again only when its words, the style, the background or the model
 * change. Every paid call is written to the episode's subject/ledger.json first, and spending stops before an
 * episode would pass its budget (paint.budget_per_episode_usd). Nothing is deleted: replaced pictures move to retired/.
 */
import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { EngineError } from "../../core/errors.ts";
import { nowIso, readJson, sha256, writeJson } from "../../core/util.ts";
import type { Workspace } from "../../core/workspace.ts";
import type { EpisodeRef } from "../../pipeline/episode.ts";
import { runFfmpeg } from "../../core/ffmpeg.ts";
import { backend, saveJpeg } from "../render-ai-video/footage.ts";
import type { Script } from "../write-script/schema.ts";
import { MAIN, picturesUsed, sceneSchema, type SubScene } from "./schema.ts";

/** Bump to repaint everything (when the prompts below change in a way old pictures should follow). */
export const SUBJECT_PAINT_VERSION = 1;

export function subjectPrompt(scene: SubScene, show: string, fromMain: boolean): string {
  return [
    `Paint one picture for a short explainer video. It shows: ${show}`,
    `Art style: ${scene.style}`,
    ...(fromMain ? ["The reference picture is the video's subject. Paint in exactly its art style, colours, line work, lighting and proportions, so the two pictures belong together."] : []),
    "A vertical 9:16 picture. The subject stands alone in the middle of the picture, whole and drawn large (about half the picture's height), with plenty of empty space all around it.",
    `The background is one plain, flat colour, ${scene.background.top} at the top fading to ${scene.background.bottom} at the bottom, with nothing on it: no floor, table, scenery, frame or cast shadow.`,
    "No text of any kind: no letters, numbers, labels, logos or watermarks.",
    "No real people, celebrities, brand mascots or copyrighted characters.",
  ].join("\n");
}

export function subjectPaths(episodeDir: string) {
  const dir = join(episodeDir, "subject");
  return { dir, state: join(dir, "state.json"), ledger: join(dir, "ledger.json"), retired: join(dir, "retired"), work: join(episodeDir, "audio", "chunks", "subject") };
}

/** Where the subject is in its picture, as fractions of the picture (0 = left / top, 1 = right / bottom). */
export interface SubjectBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Painted {
  file: string;
  key: string;
  at: string;
  box: SubjectBox;
  fake?: boolean;
}

/** The size the picture is measured at: small enough to be quick, fine enough to place labels. */
const MEASURE_W = 90;
const MEASURE_H = 160;

/**
 * Find the subject in a picture painted on a plain background: everything that differs clearly from the colour of
 * the picture's edges. The renderer sizes and places the subject by this box, so a subject painted larger or smaller
 * than asked still sits the same on screen.
 */
export function boxOf(rgb: Buffer, w: number, h: number): SubjectBox {
  if (rgb.length !== w * h * 3) throw new EngineError(`Measuring the subject: expected ${w * h * 3} bytes of pixels, got ${rgb.length}.`);
  const px = (x: number, y: number) => [rgb[(y * w + x) * 3], rgb[(y * w + x) * 3 + 1], rgb[(y * w + x) * 3 + 2]];
  // The background, row by row (it is often a gradient from top to bottom): the median of the row's outer pixels.
  const edge = 3;
  const rowBg = Array.from({ length: h }, (_, y) => {
    const ps = [...Array.from({ length: edge }, (_, x) => px(x, y)), ...Array.from({ length: edge }, (_, x) => px(w - 1 - x, y))];
    return [0, 1, 2].map((c) => ps.map((p) => p[c]).sort((a, b) => a - b)[Math.floor(ps.length / 2)]);
  });
  const rows = new Array<number>(h).fill(0);
  const cols = new Array<number>(w).fill(0);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = px(x, y);
      if (Math.max(...p.map((v, c) => Math.abs(v - rowBg[y][c]))) > 40) {
        rows[y]++;
        cols[x]++;
      }
    }
  // A row or column counts once a few pixels in it differ (single specks of grain don't).
  const first = (a: number[]) => a.findIndex((n) => n >= 2);
  const last = (a: number[]) => a.length - 1 - [...a].reverse().findIndex((n) => n >= 2);
  const y0 = first(rows);
  const x0 = first(cols);
  if (y0 < 0 || x0 < 0) throw new EngineError("The painted picture has no subject on its background: it is one plain colour.", "Paint it again with a clearer subject (change its `show`).");
  return { x0: x0 / w, y0: y0 / h, x1: (last(cols) + 1) / w, y1: (last(rows) + 1) / h };
}

function measure(file: string, work: string): SubjectBox {
  mkdirSync(work, { recursive: true });
  const raw = join(work, "measure.rgb");
  runFfmpeg(["-y", "-i", file, "-vf", `scale=${MEASURE_W}:${MEASURE_H}`, "-f", "rawvideo", "-pix_fmt", "rgb24", raw], "measuring where the subject is in its picture");
  return boxOf(readFileSync(raw), MEASURE_W, MEASURE_H);
}
interface Ledger {
  budget_usd: number;
  entries: { at: string; what: string; usd: number; fake?: boolean }[];
}

function spentOf(ledger: Ledger): number {
  return Math.round(ledger.entries.filter((e) => !e.fake).reduce((s, e) => s + e.usd, 0) * 100) / 100;
}

export interface SubjectPaintResult {
  /** Picture id → absolute path. */
  files: Record<string, string>;
  spentUsd: number;
  fake: boolean;
  regenerated: boolean;
}

export async function runPaintSubject(ws: Workspace, ep: EpisodeRef, script: Script, opts: { log?: (l: string) => void } = {}): Promise<SubjectPaintResult> {
  const log = opts.log ?? (() => {});
  const raw = script.visuals["render-subject"];
  if (raw === undefined) throw new EngineError(`${ep.state.id} uses render-subject but its script has no visuals["render-subject"].`);
  const scene = sceneSchema.parse(raw);
  const paths = subjectPaths(ep.dir);
  const be = backend(ws, paths.work);
  const model = ws.config.ai_video.image_model;
  const rate = ws.config.ai_video.rates_usd.image;
  const ledger: Ledger = existsSync(paths.ledger) ? readJson<Ledger>(paths.ledger) : { budget_usd: ws.config.paint.budget_per_episode_usd, entries: [] };
  const state: { pictures: Record<string, Painted> } = existsSync(paths.state) ? readJson(paths.state) : { pictures: {} };
  const files: Record<string, string> = {};
  let regenerated = false;
  let mainData: Buffer | null = null;

  for (const id of picturesUsed(scene, script.beats)) {
    const show = id === MAIN ? scene.subject.show : scene.pictures.find((p) => p.id === id)!.show;
    const fromMain = id !== MAIN;
    const prompt = subjectPrompt(scene, show, fromMain);
    const reference = fromMain ? mainData : null;
    if (fromMain && !reference) throw new EngineError(`The subject's own picture must be painted before picture "${id}".`);
    const key = sha256(JSON.stringify({ v: SUBJECT_PAINT_VERSION, model, prompt, reference: reference ? sha256(reference) : null, fake: be.fake }));
    const file = join(paths.dir, `${id}.jpg`);
    const had = state.pictures[id];
    if (!had || had.key !== key || !existsSync(file)) {
      if (!be.fake && spentOf(ledger) + rate > ledger.budget_usd + 1e-9) {
        throw new EngineError(
          `Budget reached: painting this episode's subject has spent $${spentOf(ledger).toFixed(2)} of its $${ledger.budget_usd.toFixed(2)} budget, and picture "${id}" would cost about $${rate.toFixed(2)} more.`,
          `To allow more, raise budget_usd in ${ws.rel(paths.ledger)} (or paint.budget_per_episode_usd in engine.config.json for new episodes).`,
        );
      }
      ledger.entries.push({ at: nowIso(), what: `picture "${id}"`, usd: be.fake ? 0 : rate, ...(be.fake ? { fake: true } : {}) });
      mkdirSync(paths.dir, { recursive: true });
      writeJson(paths.ledger, ledger);
      log(`  ↳ painting the subject's picture "${id}"`);
      const data = await be.image(prompt, reference ? [{ mimeType: "image/jpeg", data: reference }] : [], key);
      if (existsSync(file)) {
        mkdirSync(paths.retired, { recursive: true });
        renameSync(file, join(paths.retired, `${id}-${nowIso().replace(/[:.]/g, "-")}.jpg`));
      }
      saveJpeg(data, file, paths.work);
      state.pictures[id] = { file: `${id}.jpg`, key, at: nowIso(), box: measure(file, paths.work), ...(be.fake ? { fake: true } : {}) };
      writeJson(paths.state, state);
      regenerated = true;
    } else if (!had.box) {
      // Painted before pictures were measured: measure it now (free).
      state.pictures[id] = { ...had, box: measure(file, paths.work) };
      writeJson(paths.state, state);
      regenerated = true;
    }
    files[id] = file;
    if (id === MAIN) mainData = readFileSync(file);
  }
  return { files, spentUsd: spentOf(ledger), fake: be.fake, regenerated };
}

/** The pictures a render stages: picture id → its path inside the episode (subject/<id>.jpg) and where the subject is in it. */
export function subjectPictureFiles(episodeDir: string, script: Script): Record<string, { file: string; box: SubjectBox }> {
  const scene = sceneSchema.parse(script.visuals["render-subject"]);
  const statePath = subjectPaths(episodeDir).state;
  if (!existsSync(statePath)) throw new EngineError("The subject's pictures have not been painted yet.", "Run the episode again: its paint step paints them.");
  const state = readJson<{ pictures: Record<string, Painted> }>(statePath);
  return Object.fromEntries(
    picturesUsed(scene, script.beats).map((id) => {
      const painted = state.pictures[id];
      if (!painted?.box) throw new EngineError(`The subject's picture "${id}" has not been painted (or measured) yet.`, "Run the episode again: its paint step paints and measures it.");
      return [id, { file: `subject/${id}.jpg`, box: painted.box }];
    }),
  );
}
