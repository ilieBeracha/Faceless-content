/**
 * Painted worlds for render-themed: a look with a `world` tells each story in pictures. Every line of an episode is
 * acted out by 1–3 shots painted by Google's image model (paid); a shot that says "the host" has the host drawn in it.
 *
 * One establishing picture per channel (channels/<slug>/world/key.jpg) sets the world's style, and one picture of
 * each host that appears on white (channels/<slug>/world/hosts/<name>.png, drawn from its rig) sets how the host looks.
 * Every shot is painted from them, so all of a channel's videos share one style and one host.
 *
 * Pictures are kept by content: a shot is painted again only when its words, the world, the host or the model
 * change. Every paid call is written to the episode's shots/ledger.json first, and spending stops before an episode
 * would pass its budget. Nothing is deleted: replaced pictures move to retired/.
 */
import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { EngineError } from "../../core/errors.ts";
import { canonicalJson, nowIso, readJson, sha256, writeJson } from "../../core/util.ts";
import type { Workspace } from "../../core/workspace.ts";
import type { EpisodeRef } from "../../pipeline/episode.ts";
import { backend, saveJpeg } from "../render-ai-video/footage.ts";
import { parseCharacterModel, type CharacterModel } from "../render-talking-character/rigs.ts";
import type { Script } from "../write-script/schema.ts";
import { showsHost, shotsUsed, type Shot, type Theme, type World } from "./schema.ts";

/** Bump to repaint everything (when the prompts below change in a way old pictures should follow). */
export const PAINT_VERSION = 3;

const RULES = [
  "A vertical 9:16 picture, painted edge to edge: the scene fills the whole frame, and its floor, ground or room carries on all the way down to the bottom edge. Never leave empty paper or a plain band anywhere.",
  "Tell one moment of a story at a glance: one clear action, few objects, big simple shapes. Put the action in the middle band, drawn large.",
  "Lettering and captions are laid over the top fifth and the bottom third, so keep those parts simple (sky, wall, floor), but painted.",
  "No text of any kind: no letters, numbers, signs with writing, labels, logos, watermarks, borders or frames. Never write the narrator's words in the picture.",
  "No real people, celebrities, brand mascots or copyrighted characters.",
].join(" ");

export function worldKeyPrompt(world: World): string {
  return [`An establishing view of this world, with nobody in it: ${world.description}`, "This picture sets the art style, palette, line work, materials and light that every later picture of the world follows, so make them clear and distinctive.", RULES].join("\n");
}

export function shotPrompt(world: World, shot: Shot, line: string): string {
  return [
    `Paint one shot of a story. What we see: ${shot.show}`,
    `While it is on screen the narrator says: "${line}"`,
    `It happens in this world: ${world.description}`,
    "The first reference picture shows only how this world is drawn: copy its art style, palette, line work, materials and light. Do not copy its layout, its place, its objects or its camera angle: compose a new picture of exactly what this shot shows, from the camera angle that tells it best (close-up, wide, from above, from below, over a shoulder).",
    ...(showsHost(shot)
      ? ["The second reference picture is the host, the main character, shown alone on white. Draw exactly this character (same body shape, colours, face and accessories) inside the scene, in the world's art style, acting the moment out with a clear pose and expression. Draw the host once. Never copy the white background."]
      : ["There is no host or narrator character in this shot: show only what it describes."]),
    RULES,
  ].join("\n");
}

export function paintPaths(episodeDir: string) {
  const dir = join(episodeDir, "shots");
  // Scratch files go with the audio chunks, which are not committed.
  return { dir, state: join(dir, "state.json"), ledger: join(dir, "ledger.json"), work: join(episodeDir, "audio", "chunks", "shots"), retired: join(dir, "retired") };
}

export function worldPaths(channelDir: string) {
  const dir = join(channelDir, "world");
  return { dir, key: join(dir, "key.jpg"), state: join(dir, "state.json"), retired: join(dir, "retired"), hosts: join(dir, "hosts") };
}

interface Painted {
  file: string;
  key: string;
  sha: string;
  at: string;
  fake?: boolean;
}
interface PaintState {
  shots: Record<string, Painted>;
}
export interface PaintLedger {
  budget_usd: number;
  entries: { at: string; what: string; usd: number; fake?: boolean }[];
}

export function readPaintLedger(ws: Workspace, episodeDir: string): PaintLedger {
  const path = paintPaths(episodeDir).ledger;
  return existsSync(path) ? readJson<PaintLedger>(path) : { budget_usd: ws.config.paint.budget_per_episode_usd, entries: [] };
}

function spentOf(ledger: PaintLedger): number {
  return Math.round(ledger.entries.filter((e) => !e.fake).reduce((s, e) => s + e.usd, 0) * 100) / 100;
}

/** Move a picture that is being replaced into retired/, stamped, instead of deleting it. */
function retire(file: string, retiredDir: string, label: string, ext = "jpg"): void {
  if (!existsSync(file)) return;
  mkdirSync(retiredDir, { recursive: true });
  renameSync(file, join(retiredDir, `${label}-${nowIso().replace(/[:.]/g, "-")}.${ext}`));
}

export interface PaintResult {
  /** Shot id → absolute path of its picture. */
  files: Record<string, string>;
  spentUsd: number;
  fake: boolean;
  /** True when any picture was painted on this run. */
  regenerated: boolean;
}

/** Draws a host on white into `out` (a PNG). The default renders the HostStill composition. */
export type HostDrawer = (model: CharacterModel, out: string) => Promise<void>;

/** Paint the channel's world (once), picture each host (once per design) and paint every shot of the episode. */
export async function runPaint(ws: Workspace, ep: EpisodeRef, script: Script, theme: Theme, opts: { log?: (l: string) => void; drawHost?: HostDrawer } = {}): Promise<PaintResult> {
  const log = opts.log ?? (() => {});
  const world = theme.world;
  if (!world) throw new EngineError(`The look of "${ep.channel.slug}" has no world to paint.`);
  const drawHost: HostDrawer = opts.drawHost ?? (async (model, out) => (await import("../../render/host-still.ts")).renderHostStill(ws, model, out, log));
  const shots = shotsUsed(script.beats);
  const paths = paintPaths(ep.dir);
  const wp = worldPaths(ep.channel.dir);
  const be = backend(ws, paths.work);
  const model = ws.config.ai_video.image_model;
  const rate = ws.config.ai_video.rates_usd.image;
  const ledger = readPaintLedger(ws, ep.dir);
  let regenerated = false;

  const pay = (what: string) => {
    if (!be.fake && spentOf(ledger) + rate > ledger.budget_usd + 1e-9) {
      throw new EngineError(
        `Budget reached: painting this episode has spent $${spentOf(ledger).toFixed(2)} of its $${ledger.budget_usd.toFixed(2)} budget, and ${what} would cost about $${rate.toFixed(2)} more.`,
        `To allow more, raise budget_usd in ${ws.rel(paths.ledger)} (or paint.budget_per_episode_usd in engine.config.json for new episodes).`,
      );
    }
    ledger.entries.push({ at: nowIso(), what, usd: be.fake ? 0 : rate, ...(be.fake ? { fake: true } : {}) });
    mkdirSync(paths.dir, { recursive: true });
    writeJson(paths.ledger, ledger);
  };

  // 1. The world's establishing picture, shared by every episode of the channel.
  const keyPrompt = worldKeyPrompt(world);
  const worldKey = sha256(JSON.stringify({ v: PAINT_VERSION, model, prompt: keyPrompt, fake: be.fake }));
  const worldState = existsSync(wp.state) ? readJson<Painted>(wp.state) : null;
  if (!worldState || worldState.key !== worldKey || !existsSync(wp.key)) {
    pay("the world's establishing picture");
    log("  ↳ painting the world's establishing picture");
    const data = await be.image(keyPrompt, [], worldKey);
    retire(wp.key, wp.retired, "key");
    saveJpeg(data, wp.key, paths.work);
    writeJson(wp.state, { file: "key.jpg", key: worldKey, sha: sha256(readFileSync(wp.key)), at: nowIso(), ...(be.fake ? { fake: true } : {}) } satisfies Painted);
    regenerated = true;
  }
  const reference = readFileSync(wp.key);
  const referenceSha = sha256(reference);

  // 2. A picture of each host that appears in a shot, drawn from its rig (free); redrawn when its design changes.
  //    A channel whose shots never show the host needs no host at all.
  const hosts = new Map<string, Buffer>();
  for (const name of new Set(shots.filter((s) => showsHost(s.shot)).map((s) => s.speaker))) {
    const character = ep.channel.characters.get(name);
    if (!character || !existsSync(character.modelPath)) throw new EngineError(`A shot shows "the host", but character "${name}" has no model.json to draw it from.`, "Give the character a model, or describe the shot without the host.");
    const hostModel = parseCharacterModel(readJson(character.modelPath));
    const file = join(wp.hosts, `${name}.png`);
    const statePath = join(wp.hosts, `${name}.json`);
    const key = sha256(canonicalJson({ v: PAINT_VERSION, model: hostModel }));
    const had = existsSync(statePath) ? readJson<Painted>(statePath) : null;
    if (!had || had.key !== key || !existsSync(file)) {
      log(`  ↳ drawing ${name} for the painter`);
      retire(file, join(wp.hosts, "retired"), name, "png");
      await drawHost(hostModel, file);
      writeJson(statePath, { file: `${name}.png`, key, sha: sha256(readFileSync(file)), at: nowIso() } satisfies Painted);
    }
    hosts.set(name, readFileSync(file));
  }

  // 3. Every shot, painted from the world's picture (and its speaker's picture when the shot shows the host).
  const state: PaintState = existsSync(paths.state) ? readJson<PaintState>(paths.state) : { shots: {} };
  const files: Record<string, string> = {};
  for (const { id, speaker, line, shot } of shots) {
    const prompt = shotPrompt(world, shot, line);
    const host = showsHost(shot) ? hosts.get(speaker)! : null;
    const key = sha256(JSON.stringify({ v: PAINT_VERSION, model, prompt, reference: referenceSha, host: host ? sha256(host) : null, fake: be.fake }));
    const file = join(paths.dir, `${id}.jpg`);
    const had = state.shots[id];
    if (!had || had.key !== key || !existsSync(file)) {
      pay(`shot "${id}"`);
      log(`  ↳ painting shot "${id}"`);
      const data = await be.image(
        prompt,
        [{ mimeType: "image/jpeg", data: reference }, ...(host ? [{ mimeType: "image/png", data: host }] : [])],
        key,
      );
      retire(file, paths.retired, id);
      saveJpeg(data, file, paths.work);
      state.shots[id] = { file: `${id}.jpg`, key, sha: sha256(readFileSync(file)), at: nowIso(), ...(be.fake ? { fake: true } : {}) };
      writeJson(paths.state, state);
      regenerated = true;
    }
    files[id] = file;
  }
  return { files, spentUsd: spentOf(ledger), fake: be.fake, regenerated };
}
