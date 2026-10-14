import { checkbox, confirm, input, number, select } from "@inquirer/prompts";
import { loadChannel, validateChannel } from "../../core/channels.ts";
import { EngineError } from "../../core/errors.ts";
import { commitPaths } from "../../core/git.ts";
import { appendIdeaBlocks, renderIdeas, updateIdea } from "../../core/ideas.ts";
import { createCharacter, createSeries, defaultModel } from "../../core/scaffold.ts";
import { listSkills } from "../../core/skills.ts";
import { readText, slugify, today, writeText } from "../../core/util.ts";
import { formatIssues } from "../../core/validate.ts";
import type { Workspace } from "../../core/workspace.ts";
import { KOKORO_VOICES } from "../../voice/voices.ts";
import { log, ok } from "../ui.ts";

const csv = (s: string) => s.split(/[,;]\s*/).map((x) => x.trim()).filter(Boolean);

function requireTty(what: string, alternative: string): void {
  if (!process.stdin.isTTY) throw new EngineError(`${what} asks questions, so it needs a terminal.`, alternative);
}

/** Interactive character questions → characters/<name>.md + characters/<name>/model.json */
export async function askCharacter(ws: Workspace, channel: string): Promise<string[]> {
  requireTty("add character", `Or brainstorm one for approval: ./engine brainstorm characters --channel ${channel}`);
  const display = await input({ message: "Character display name:", required: true });
  const name = await input({ message: "File name (slug):", default: slugify(display) });
  const rig = await select({
    message: "Look (rig):",
    choices: [
      { value: "orb-bot-3d" as const, name: "orb-bot-3d — round 3D robot (chrome/plastic), 1–2 eyes, LED mouth" },
      { value: "flat-2d" as const, name: "flat-2d — flat vector creature (blob, circle, drop, star…), big eyes" },
    ],
  });
  const body = await input({ message: "Main body color:", default: rig === "orb-bot-3d" ? "#c8ced8" : "#7ad3ff" });
  const accent = await input({ message: "Accent color:", default: "#ff5a3c" });
  const voiceId = await select({ message: "Voice (free, local Kokoro):", choices: KOKORO_VOICES.map((v) => ({ value: v.id, name: `${v.id} — ${v.desc} (${v.grade})` })) });
  const files = createCharacter(ws, channel, {
    name,
    display_name: display,
    pronoun: await input({ message: "Pronoun (she/he/they/it):", default: rig === "orb-bot-3d" ? "it" : "they" }),
    concept: await input({ message: "Concept — one line:", required: true }),
    look: await input({ message: "Look — describe it:", required: true }),
    personality: csv(await input({ message: "Personality traits (comma-separated):", required: true })),
    catchphrases: csv(await input({ message: "Catchphrases (separated by ;):" })),
    good_at: csv(await input({ message: "Good at:", required: true })),
    bad_at: csv(await input({ message: "Bad at:", required: true })),
    voice: { provider: "kokoro", voice_id: voiceId, speed: (await number({ message: "Speaking speed (0.7–1.4):", default: 1.0, step: "any" })) ?? 1, pitch_semitones: (await number({ message: "Pitch shift in semitones (-6–6):", default: 0, step: "any" })) ?? 0 },
    how_it_talks: await input({ message: "How it talks (a sentence or two):", required: true }),
    model: defaultModel(rig, { body, accent }),
  });
  ok(`Created ${files.map((f) => ws.rel(f)).join(" and ")} — fine-tune the look in model.json`);
  return files;
}

/** Interactive series questions → series/<slug>.md */
export async function askSeries(ws: Workspace, channel: string): Promise<string[]> {
  requireTty("add series", `Or brainstorm one for approval: ./engine brainstorm series --channel ${channel}`);
  const ch = loadChannel(ws, channel);
  if (!ch.characters.size) throw new EngineError("Add a character first — every series needs one.", `./engine add character --channel ${channel}`);
  const name = await input({ message: "Series name:", required: true });
  const slug = await input({ message: "Slug:", default: slugify(name) });
  const characters = ch.characters.size === 1 ? [...ch.characters.keys()] : await checkbox({ message: "Characters (first one narrates):", choices: [...ch.characters.keys()].map((c) => ({ value: c })), required: true });
  const min = (await number({ message: "Minimum length (seconds):", default: 30 })) ?? 30;
  const max = (await number({ message: "Maximum length (seconds):", default: 45 })) ?? 45;
  const beats: { id: string; seconds: number; purpose: string }[] = [];
  log("Beats — the structure every episode follows. Enter one per prompt as  id | seconds | purpose  (empty line to finish).");
  for (;;) {
    const line = await input({ message: `Beat ${beats.length + 1}:`, default: beats.length === 0 ? "hook | 3 | grab attention in the first 2 seconds" : undefined });
    if (!line.trim()) {
      if (beats.length >= 2) break;
      log("  a series needs at least 2 beats");
      continue;
    }
    const [id, seconds, ...purpose] = line.split("|").map((s) => s.trim());
    beats.push({ id: slugify(id), seconds: Number(seconds) || 5, purpose: purpose.join(" | ") || id });
  }
  const renderSkills = listSkills(ws).filter((s) => s.kind === "render");
  const files = createSeries(ws, channel, {
    slug,
    name,
    format: await input({ message: "Format — what happens in every episode?", required: true }),
    characters,
    length: { min_seconds: min, max_seconds: max },
    hook_pattern: await input({ message: "Hook pattern — how do the first 2 seconds work?", required: true }),
    beats,
    visual_style: await input({ message: "Visual style:", required: true }),
    skills: { script: "write-script", render: await checkbox({ message: "Render skills (mix and match):", choices: renderSkills.map((s) => ({ value: s.name, name: `${s.name} — ${s.description}` })), required: true }), captions: "captions" },
    cta: await input({ message: "Closing line / call to action (optional):" }),
  });
  ok(`Created ${ws.rel(files[0])}`);
  return files;
}

export async function addCharacter(ws: Workspace, channel: string): Promise<void> {
  loadChannel(ws, channel);
  const files = await askCharacter(ws, channel);
  commitPaths(ws, files, `${channel}: add character`);
  log(formatIssues(validateChannel(ws, loadChannel(ws, channel)).filter((i) => files.some((f) => i.file.startsWith(ws.rel(f).replace(/\.md$|\/model\.json$/, ""))))));
}

export async function addSeries(ws: Workspace, channel: string): Promise<void> {
  loadChannel(ws, channel);
  const files = await askSeries(ws, channel);
  commitPaths(ws, files, `${channel}: add series`);
  log(formatIssues(validateChannel(ws, loadChannel(ws, channel)).filter((i) => i.file === ws.rel(files[0]))));
}

/** Ideas you type in yourself go straight into the backlog as "new". */
export function addIdeas(ws: Workspace, channel: string, series: string, titles: string[], angle?: string): void {
  const ch = loadChannel(ws, channel);
  if (!ch.series.has(series) && series !== "any") throw new EngineError(`Channel "${channel}" has no series "${series}".`, `Its series: ${[...ch.series.keys()].join(", ") || "none"}`);
  if (!titles.length) throw new EngineError("Give at least one idea title.", `./engine add ideas --channel ${channel} --series ${series} "A ballpoint pen" "A zipper"`);
  const { text, ids } = renderIdeas(titles.map((title) => ({ title, series, angle })), ch.ideas.map((i) => i.id), "new", today());
  writeText(ch.ideasPath, appendIdeaBlocks(readText(ch.ideasPath), text));
  commitPaths(ws, [ch.ideasPath], `${channel}: add ${ids.length} idea(s)`);
  ok(`Added ${ids.length} idea(s) to ${ws.rel(ch.ideasPath)}: ${ids.join(", ")}`);
}

export function setIdeaStatus(ws: Workspace, channel: string, id: string, action: "reject" | "reopen", reason?: string): void {
  const ch = loadChannel(ws, channel);
  const idea = ch.ideas.find((i) => i.id === id);
  if (!idea) throw new EngineError(`No idea "${id}" in ${channel}.`);
  if (action === "reject") {
    if (idea.status === "used") throw new EngineError(`Idea "${id}" was already used in ${idea.fields.used_in ?? "an episode"}.`);
    writeText(ch.ideasPath, updateIdea(readText(ch.ideasPath), id, { status: "rejected", rejected_on: today(), ...(reason ? { rejected_reason: reason } : {}) }));
  } else {
    if (idea.status !== "rejected") throw new EngineError(`Idea "${id}" is ${idea.status}; only rejected ideas can be reopened.`);
    writeText(ch.ideasPath, updateIdea(readText(ch.ideasPath), id, { status: "new", reopened_on: today() }));
  }
  commitPaths(ws, [ch.ideasPath], `${channel}: ${action} idea ${id}`);
  ok(`Idea "${id}" → ${action === "reject" ? "rejected (kept in ideas.md)" : "new"}`);
}

export { confirm };
