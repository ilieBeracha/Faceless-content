/**
 * Moving shots for render-themed worlds: after the voice is made, every painted shot is turned into a short clip by
 * an image-to-video model on fal (paid, needs FAL_KEY), so the wine really pours and the drops really fall. The clip
 * starts from the painted picture, keeps its style and framing, and runs as long as the shot is on screen.
 *
 * Clips are kept by content: a shot is animated again only when its picture, its words, its length or the model
 * change. Every paid call is written to the episode's shots/motion-ledger.json first, and spending stops before an
 * episode would pass its budget. Nothing is deleted: replaced clips move to shots/retired/.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { EngineError } from "../../core/errors.ts";
import { downloadFal, runFal } from "../../core/fal.ts";
import { runFfmpeg } from "../../core/ffmpeg.ts";
import { nowIso, readJson, sha256, writeJson } from "../../core/util.ts";
import type { Workspace } from "../../core/workspace.ts";
import type { EpisodeRef } from "../../pipeline/episode.ts";
import { beatSpans } from "../../render/timeline.ts";
import type { EpisodeProps } from "../../render/types.ts";
import { isFake } from "../render-ai-video/footage.ts";
import type { Script } from "../write-script/schema.ts";
import { paintPaths } from "./paint.ts";
import { shotsUsed, type Shot } from "./schema.ts";
import { shotTimeline, FADE } from "./shots.ts";

/** Bump to animate everything again (when the prompt below changes in a way old clips should follow). */
export const MOTION_VERSION = 1;
/** A clip runs this much longer than its shot is on screen, so the dissolve into the next shot never runs out of frames. */
const SPARE = 0.4;

export function motionPrompt(shot: Shot, line: string): string {
  return [
    `Animate this painting. What it shows: ${shot.show}`,
    `While it is on screen the narrator says: "${line}"`,
    "Make only what it shows happen, with natural, unhurried motion: liquid already pouring keeps pouring and settles, drops fall, people breathe, blink and move their hands a little.",
    "Fixed camera: no zoom, pan or cut. Keep the picture exactly as painted: the same art style, flat colours, brush outlines, paper texture, faces, objects and framing. Add nothing new: no steam, smoke or mist, and no hands, bottles, objects, people, text or logos coming into the frame.",
  ].join("\n");
}

export function motionPaths(episodeDir: string) {
  const shots = paintPaths(episodeDir);
  return { dir: join(shots.dir, "clips"), state: join(shots.dir, "motion.json"), ledger: join(shots.dir, "motion-ledger.json"), retired: shots.retired, work: shots.work };
}

export interface MotionClip {
  file: string;
  key: string;
  /** Seconds asked of the model. */
  seconds: number;
  at: string;
  fake?: boolean;
}
interface MotionState {
  clips: Record<string, MotionClip>;
}
export interface MotionLedger {
  budget_usd: number;
  entries: { at: string; what: string; usd: number; fake?: boolean }[];
}

/** How long each shot's clip must be: the time it is on screen, plus a little for the dissolve. */
export function clipSeconds(props: EpisodeProps, maxSeconds: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of shotTimeline(props, beatSpans(props))) out[s.id] = Math.min(maxSeconds, Math.max(1, Math.ceil((s.end - s.start + FADE + SPARE) * 10) / 10));
  return out;
}

/** What moving a whole episode costs, from how long it runs and how many shots it has (each clip runs a little past its shot): for the person to see before they approve. */
export function motionCostUsd(ws: Workspace, seconds: number, shots: number): number {
  return Math.round((seconds + shots * (FADE + SPARE)) * ws.config.motion.usd_per_second * 100) / 100;
}

export interface AnimateResult {
  /** Shot id → its clip (absolute path) and the seconds it holds. */
  clips: Record<string, { file: string; seconds: number }>;
  spentUsd: number;
  fake: boolean;
  regenerated: boolean;
}

function spentOf(ledger: MotionLedger): number {
  return Math.round(ledger.entries.filter((e) => !e.fake).reduce((s, e) => s + e.usd, 0) * 100) / 100;
}

/** Turn every painted shot of the episode into a moving clip as long as the shot is on screen. */
export async function runAnimate(ws: Workspace, ep: EpisodeRef, script: Script, props: EpisodeProps, opts: { log?: (l: string) => void } = {}): Promise<AnimateResult> {
  const log = opts.log ?? (() => {});
  const cfg = ws.config.motion;
  const fake = isFake();
  const paths = motionPaths(ep.dir);
  const painted = paintPaths(ep.dir);
  const lengths = clipSeconds(props, cfg.max_clip_seconds);
  const ledger: MotionLedger = existsSync(paths.ledger) ? readJson<MotionLedger>(paths.ledger) : { budget_usd: cfg.budget_per_episode_usd, entries: [] };
  const state: MotionState = existsSync(paths.state) ? readJson<MotionState>(paths.state) : { clips: {} };
  const clips: AnimateResult["clips"] = {};
  let regenerated = false;

  for (const { id, line, shot } of shotsUsed(script.beats)) {
    const still = join(painted.dir, `${id}.jpg`);
    if (!existsSync(still)) throw new EngineError(`Shot "${id}" has no painted picture to animate (${ws.rel(still)}).`, "Run the episode again: its paint step makes it.");
    const seconds = lengths[id];
    if (seconds === undefined) throw new EngineError(`Shot "${id}" is not on the video's timeline, so it can't be animated.`);
    const prompt = motionPrompt(shot, line);
    const image = readFileSync(still);
    const key = sha256(JSON.stringify({ v: MOTION_VERSION, endpoint: cfg.endpoint, resolution: cfg.resolution, prompt, image: sha256(image), seconds, fake }));
    const file = join(paths.dir, `${id}.mp4`);
    const had = state.clips[id];
    if (!had || had.key !== key || !existsSync(file)) {
      const usd = Math.round(seconds * cfg.usd_per_second * 10000) / 10000;
      if (!fake && spentOf(ledger) + usd > ledger.budget_usd + 1e-9) {
        throw new EngineError(
          `Budget reached: moving this episode's shots has spent $${spentOf(ledger).toFixed(2)} of its $${ledger.budget_usd.toFixed(2)} budget, and shot "${id}" (${seconds}s) would cost about $${usd.toFixed(2)} more.`,
          `To allow more, raise budget_usd in ${ws.rel(paths.ledger)} (or motion.budget_per_episode_usd in engine.config.json for new episodes).`,
        );
      }
      ledger.entries.push({ at: nowIso(), what: `shot "${id}" (${seconds}s)`, usd: fake ? 0 : usd, ...(fake ? { fake: true } : {}) });
      mkdirSync(paths.dir, { recursive: true });
      writeJson(paths.ledger, ledger);
      mkdirSync(paths.work, { recursive: true });
      const made = join(paths.work, `motion-${id}.mp4`);
      if (fake) {
        log(`  ↳ moving shot "${id}" (${seconds}s, placeholder)`);
        runFfmpeg(["-y", "-loop", "1", "-i", still, "-t", String(seconds), "-r", "24", "-vf", "scale=768:1344,format=yuv420p", "-c:v", "libx264", made], "making a placeholder clip");
      } else {
        log(`  ↳ moving shot "${id}" via fal (paid, about $${usd.toFixed(3)}): ${seconds}s from ${cfg.endpoint}`);
        const out = await runFal<{ video?: { url?: string } }>(`Moving shot "${id}"`, cfg.endpoint, {
          prompt,
          image_url: `data:image/jpeg;base64,${image.toString("base64")}`,
          duration: seconds,
          resolution: cfg.resolution,
          prompt_expansion_mode: "disabled",
        }, 600);
        if (!out.video?.url) throw new EngineError(`The video model returned no clip for shot "${id}".`);
        await downloadFal(`the clip of shot "${id}"`, out.video.url, made);
      }
      if (existsSync(file)) {
        mkdirSync(paths.retired, { recursive: true });
        renameSync(file, join(paths.retired, `${id}-${nowIso().replace(/[:.]/g, "-")}.mp4`));
      }
      copyFileSync(made, file);
      state.clips[id] = { file: `clips/${id}.mp4`, key, seconds, at: nowIso(), ...(fake ? { fake: true } : {}) };
      writeJson(paths.state, state);
      regenerated = true;
    }
    clips[id] = { file, seconds };
  }
  return { clips, spentUsd: spentOf(ledger), fake, regenerated };
}

/** The clips an episode's render uses: shot id → its clip, as the motion step left them. Null when it has none. */
export function readMotionClips(episodeDir: string): Record<string, MotionClip> | null {
  const path = motionPaths(episodeDir).state;
  return existsSync(path) ? readJson<MotionState>(path).clips : null;
}
