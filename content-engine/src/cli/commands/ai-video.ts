import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { loadChannel } from "../../core/channels.ts";
import { EngineError } from "../../core/errors.ts";
import { runFfmpeg } from "../../core/ffmpeg.ts";
import { commitPaths } from "../../core/git.ts";
import { nowIso, readJson, writeJson, writeText } from "../../core/util.ts";
import type { Workspace } from "../../core/workspace.ts";
import { loadEpisode } from "../../pipeline/episode.ts";
import * as gemini from "../../skills/render-ai-video/gemini.ts";
import { approveFootage, backend, footagePaths, readLedger, redoShot, setBudget, spent } from "../../skills/render-ai-video/footage.ts";
import { parseCharacterModel, type PhotorealModel } from "../../skills/render-talking-character/rigs.ts";
import { heading, log, next, ok, table } from "../ui.ts";

export async function listAiModels(ws: Workspace): Promise<void> {
  const cfg = ws.config.ai_video;
  const models = await gemini.listModels();
  const interesting = models.filter((m) => /veo|image|imagen|flash|pro/i.test(m.name));
  heading(`Models your key can use (${models.length} total; video, image and checker models shown)`);
  table(
    ["model", "methods", "configured as"],
    interesting.map((m) => {
      const id = m.name.replace(/^models\//, "");
      const role = id === cfg.video_model ? "video_model" : id === cfg.image_model ? "image_model" : id === cfg.check_model ? "check_model" : "";
      return [id, (m.supportedGenerationMethods ?? []).join(", "), role];
    }),
  );
  for (const [role, id] of [["video_model", cfg.video_model], ["image_model", cfg.image_model], ["check_model", cfg.check_model]] as const) {
    if (!models.some((m) => m.name === `models/${id}`)) log(`  ⚠ ${role} "${id}" is not available to this key — set ai_video.${role} in engine.config.local.json`);
  }
}

function photoreal(ws: Workspace, channelSlug: string, name: string): { model: PhotorealModel; modelPath: string; dir: string } {
  const channel = loadChannel(ws, channelSlug);
  const doc = channel.characters.get(name);
  if (!doc) throw new EngineError(`Channel "${channelSlug}" has no character "${name}".`);
  const model = parseCharacterModel(readJson(doc.modelPath));
  if (model.rig !== "photoreal") throw new EngineError(`${name} is a "${model.rig}" character, not "photoreal".`);
  return { model, modelPath: doc.modelPath, dir: dirname(doc.modelPath) };
}

interface IdentityLedger {
  budget_usd: number;
  entries: { at: string; file: string; usd: number; ok: boolean; fake?: boolean; note?: string }[];
}

/** Candidate reference portraits for a photoreal character; a person picks one (`pick-identity`). */
export async function makeIdentity(ws: Workspace, channelSlug: string, name: string, count: number): Promise<void> {
  const { model, dir } = photoreal(ws, channelSlug, name);
  const cfg = ws.config.ai_video;
  const idDir = join(dir, "identity");
  mkdirSync(idDir, { recursive: true });
  const ledgerPath = join(idDir, "ledger.json");
  const ledger: IdentityLedger = existsSync(ledgerPath) ? readJson(ledgerPath) : { budget_usd: cfg.identity_budget_usd, entries: [] };
  const be = backend(ws, join(ws.path(".cache"), "identity"));
  const used = ledger.entries.filter((e) => !e.fake).reduce((s, e) => s + e.usd, 0);
  if (!be.fake && used + count * cfg.rates_usd.image > ledger.budget_usd + 1e-9) {
    throw new EngineError(`Identity photos for ${name} have used $${used.toFixed(2)} of $${ledger.budget_usd.toFixed(2)}; ${count} more would go over.`, `Raise it in ${ws.rel(ledgerPath)} (budget_usd) if you want more candidates.`);
  }
  const p = model.params;
  const views = [
    "head-and-shoulders portrait, looking straight into the lens, relaxed natural smile",
    "head-and-shoulders portrait, three-quarter view, mid-laugh",
    "waist-up photo, holding a smartphone up for a selfie, looking at the phone screen",
    "head-and-shoulders portrait, neutral expression, looking into the lens",
  ];
  const existing = readdirSync(idDir).filter((f) => /^candidate-\d+\.jpg$/.test(f)).length;
  const made: string[] = [];
  for (let i = 0; i < count; i++) {
    const n = existing + i + 1;
    const prompt = [
      `Photorealistic photo of one person for a casting sheet: ${views[i % views.length]}.`,
      `The person: ${p.identity}. Wearing ${p.wardrobe}.`,
      "Soft daylight, plain light-grey studio background, sharp focus, natural skin texture with pores, a real photograph taken on a modern phone.",
      "A fictional person — not anyone famous. No text, no logos, no watermark.",
    ].join("\n");
    const file = join(idDir, `candidate-${n}.jpg`);
    log(`  ↳ candidate ${n}${be.fake ? " (placeholder)" : ""}…`);
    try {
      const data = await be.image(prompt, [], `${name}-${n}`);
      const tmp = join(ws.path(".cache"), "identity", `candidate-${n}.src`);
      mkdirSync(dirname(tmp), { recursive: true });
      writeFileSync(tmp, data);
      runFfmpeg(["-y", "-i", tmp, "-q:v", "2", file], "saving a candidate photo");
      ledger.entries.push({ at: nowIso(), file: basename(file), usd: be.fake ? 0 : cfg.rates_usd.image, ok: true, ...(be.fake ? { fake: true } : {}) });
      made.push(file);
    } catch (err) {
      ledger.entries.push({ at: nowIso(), file: basename(file), usd: be.fake ? 0 : cfg.rates_usd.image, ok: false, note: (err as Error).message.slice(0, 200) });
      writeJson(ledgerPath, ledger);
      throw err;
    } finally {
      writeJson(ledgerPath, ledger);
    }
  }
  const all = readdirSync(idDir).filter((f) => /^candidate-\d+\.jpg$/.test(f)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  writeText(
    join(idDir, "candidates.md"),
    [`# ${name} — identity candidates`, "", be.fake ? "> PLACEHOLDERS (ENGINE_AI_VIDEO_FAKE=1), not real candidates.\n" : "", `Pick the face this character will have in every video. Prompt: ${p.identity}`, "", ...all.map((f) => `- \`${f}\`\n\n  ![${f}](${f})\n`)].join("\n"),
  );
  commitPaths(ws, [idDir], `${channelSlug}: identity candidates for ${name}`);
  ok(`${made.length} candidate photo(s) in ${ws.rel(idDir)} — $${ledger.entries.filter((e) => !e.fake).reduce((s, e) => s + e.usd, 0).toFixed(2)} spent on ${name}'s identity so far`);
  next([`Look at them: ${ws.rel(join(idDir, "candidates.md"))}`, `Pick one (a person decides): ./engine ai-video pick-identity --channel ${channelSlug} --character ${name} --by "<your name>" ${ws.rel(made[0] ?? join(idDir, "candidate-1.jpg"))}`]);
}

/** A person picked the face: it becomes the character's reference photo. */
export function pickIdentity(ws: Workspace, channelSlug: string, name: string, files: string[], by: string): void {
  const { modelPath, dir } = photoreal(ws, channelSlug, name);
  const refDir = join(dir, "references");
  mkdirSync(refDir, { recursive: true });
  const raw = readJson<{ params: { references?: string[] } }>(modelPath);
  const refs: string[] = [];
  files.forEach((f, i) => {
    const src = existsSync(f) ? f : join(dir, "identity", f);
    if (!existsSync(src)) throw new EngineError(`No such photo: ${f}`);
    const dest = join(refDir, `ref-${i + 1}${src.endsWith(".png") ? ".png" : ".jpg"}`);
    if (existsSync(dest)) {
      const old = join(refDir, "replaced");
      mkdirSync(old, { recursive: true });
      copyFileSync(dest, join(old, `${basename(dest, ".jpg")}-${Date.now()}.jpg`));
    }
    copyFileSync(src, dest);
    refs.push(relative(dir, dest));
  });
  raw.params.references = refs;
  writeJson(modelPath, raw);
  const approvals = join(dir, "identity", "approvals.json");
  const list = existsSync(approvals) ? readJson<unknown[]>(approvals) : [];
  writeJson(approvals, [...list, { at: nowIso(), by, picked: files.map((f) => basename(f)), references: refs }]);
  commitPaths(ws, [dir, modelPath], `${channelSlug}: ${name}'s face picked by ${by}`);
  ok(`${name} now uses ${refs.join(", ")} as reference photo(s). Every still is generated from this face.`);
}

export function approveFootageCommand(ws: Workspace, channel: string, episode: string, by: string): void {
  const ep = loadEpisode(ws, channel, episode);
  const r = approveFootage(ws, ep, by);
  commitPaths(ws, [footagePaths(ep.dir).dir], `${channel}: footage stills for ${episode} approved by ${by}`);
  ok(`Stills approved by ${by}. Generating the clips will cost about $${r.estimate.toFixed(2)} (the episode budget still applies).`);
  next([`Continue: ./engine make episode --channel ${channel} --series ${ep.state.series}`]);
}

export function redoShotCommand(ws: Workspace, channel: string, episode: string, shot: string, what: "still" | "clip"): void {
  const ep = loadEpisode(ws, channel, episode);
  redoShot(ws, ep, shot, what);
  commitPaths(ws, [footagePaths(ep.dir).dir], `${channel}: redo ${what} of ${shot} in ${episode}`);
  ok(`The next run makes a new ${what} for ${shot} (the old one moves to footage/rejected/).${what === "still" ? " The stills then need approving again." : ""}`);
  next([`./engine make episode --channel ${channel} --series ${ep.state.series}`]);
}

export function budgetCommand(ws: Workspace, channel: string, episode: string, usd: number, by: string): void {
  if (!(usd > 0)) throw new EngineError("--usd must be a positive number.");
  const ep = loadEpisode(ws, channel, episode);
  const ledger = setBudget(ws, ep, usd, by);
  commitPaths(ws, [footagePaths(ep.dir).ledger], `${channel}: budget for ${episode} set to $${usd} by ${by}`);
  ok(`Budget for ${episode}: $${ledger.budget_usd.toFixed(2)} (spent $${spent(ledger).toFixed(2)}).`);
}

export function ledgerCommand(ws: Workspace, channel: string, episode: string): void {
  const ep = loadEpisode(ws, channel, episode);
  const ledger = readLedger(ws, ep.dir);
  heading(`Spending for ${episode}: $${spent(ledger).toFixed(2)} of $${ledger.budget_usd.toFixed(2)}`);
  table(
    ["when", "shot", "kind", "model", "secs", "usd", "ok", "note"],
    ledger.entries.map((e) => [e.at.slice(0, 16), e.shot, e.kind, e.model, e.seconds ? String(e.seconds) : "", e.fake ? "fake" : e.usd.toFixed(3), e.ok ? "✔" : "✖", e.note ?? ""]),
  );
}
