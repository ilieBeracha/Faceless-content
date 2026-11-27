import { checkbox, confirm, input, select } from "@inquirer/prompts";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { channelExists, CHANNEL_STATUSES, listChannelSlugs, loadChannel, validateChannel } from "../../core/channels.ts";
import { draftInfo, validateDraft } from "../../core/drafts.ts";
import { EngineError } from "../../core/errors.ts";
import { commitPaths } from "../../core/git.ts";
import { appendIdeaBlocks, renderIdeas } from "../../core/ideas.ts";
import { parseMarkdown, updateFrontmatter } from "../../core/markdown.ts";
import { createChannel, createChannelSkeleton, type ChannelInput } from "../../core/scaffold.ts";
import { runTask, type LlmProviderName } from "../../core/tasks.ts";
import { readText, slugify, today, writeText } from "../../core/util.ts";
import { formatIssues, hasErrors } from "../../core/validate.ts";
import type { Workspace } from "../../core/workspace.ts";
import { draftChannelTask } from "../../pipeline/draft-channel.ts";
import { log, next, ok } from "../ui.ts";
import { askCharacter, askSeries } from "./add.ts";

const csv = (s: string) => s.split(/[,;]\s*/).map((x) => x.trim()).filter(Boolean);

/** `new channel` — interactive questions, or a one-line seed / approved niche that an agent drafts. */
export async function newChannel(ws: Workspace, opts: { seed?: string; slug?: string; fromDraft?: string; llm: LlmProviderName }): Promise<void> {
  if (opts.seed || opts.fromDraft) return draftChannelFromSeed(ws, opts);
  if (!process.stdin.isTTY) throw new EngineError("Interactive mode needs a terminal.", 'Use a seed instead: ./engine new channel --seed "space facts for kids"');

  log("Let's define the channel. Every answer can be edited later in the channel's files.\n");
  const name = await input({ message: "Channel name:", required: true });
  const slug = await input({ message: "Slug (folder name, can't change later):", default: slugify(name), validate: (v) => (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) ? (channelExists(ws, v) ? "That channel already exists" : true) : "lowercase-with-dashes") });
  const channel: ChannelInput = {
    slug,
    name,
    niche: await input({ message: "Niche — one sentence, what is every video about?", required: true }),
    audience: {
      who: await input({ message: "Audience — who watches?", required: true }),
      age_range: await input({ message: 'Age range (e.g. "8-12", "18+"):', required: true }),
      made_for_kids: await confirm({ message: 'Is it "made for kids" (YouTube/COPPA)?', default: false }),
    },
    tone: csv(await input({ message: "Tone — 2 to 6 adjectives, comma-separated:", required: true })),
    language: await input({ message: "Voiceover language code:", default: "en" }),
    platforms: await checkbox({ message: "Platforms (for later — nothing is posted):", choices: Object.keys(ws.config.platforms).map((p) => ({ value: p, checked: true })), required: true }),
    cadence: await input({ message: "Cadence:", default: "3 per week" }),
    banned_topics: csv(await input({ message: "Banned topics — comma-separated:", required: true })),
    brand: {
      primary_color: await input({ message: "Primary color (headline boxes):", default: "#3d5afe" }),
      accent_color: await input({ message: "Accent color (caption highlight):", default: "#ffb300" }),
      background_top: await input({ message: "Background gradient top:", default: "#0d1b2a" }),
      background_bottom: await input({ message: "Background gradient bottom:", default: "#1b263b" }),
      text_color: "#ffffff",
      font: await select({ message: "Font:", choices: ws.config.fonts.map((f) => ({ value: f })) }),
      caption_case: "normal",
    },
    promise: await input({ message: "Promise — why would someone follow this channel?", required: true }),
  };
  const touched = createChannel(ws, channel);
  ok(`Created channels/${slug}/ (status: draft)`);

  if (await confirm({ message: "Add the first character now?", default: true })) touched.push(...(await askCharacter(ws, slug)));
  if (await confirm({ message: "Add the first series now?", default: true })) touched.push(...(await askSeries(ws, slug)));
  const ideasText = await input({ message: "Ideas — titles separated by ';' (optional):" });
  const ch = loadChannel(ws, slug);
  if (ideasText.trim() && ch.series.size) {
    const series = ch.series.size === 1 ? [...ch.series.keys()][0] : await select({ message: "Which series are these ideas for?", choices: [...ch.series.keys()].map((s) => ({ value: s })) });
    const { text } = renderIdeas(csv(ideasText).map((title) => ({ title, series })), [], "new", today());
    writeText(ch.ideasPath, appendIdeaBlocks(readText(ch.ideasPath), text));
  }
  commitPaths(ws, [ws.channelDir(slug)], `new channel ${slug} (draft)`);
  const issues = validateChannel(ws, loadChannel(ws, slug));
  log("\n" + formatIssues(issues));
  next([hasErrors(issues) ? `Fix the problems above, then: ./engine validate --channel ${slug}` : `Review channels/${slug}/, then approve it: ./engine approve channel ${slug}`]);
}

async function draftChannelFromSeed(ws: Workspace, opts: { seed?: string; slug?: string; fromDraft?: string; llm: LlmProviderName }): Promise<void> {
  let seed = opts.seed ?? "";
  let slug = opts.slug;
  let name = "";
  let draftRel: string | null = null;
  let draftSkills: string[] = [];
  if (opts.fromDraft) {
    const draft = draftInfo(ws, opts.fromDraft);
    if (draft.kind !== "niche") throw new EngineError(`${draft.rel} is a ${draft.kind} draft, not a niche.`);
    if (draft.status !== "proposed") throw new EngineError(`${draft.rel} is already ${draft.status}.`);
    const issues = validateDraft(ws, draft);
    if (hasErrors(issues)) throw new EngineError(`${draft.rel} has problems:\n${formatIssues(issues)}`);
    const { data } = parseMarkdown(readText(draft.abs), draft.rel);
    slug = slug ?? String(data.slug);
    name = String(data.name);
    seed = `Approved niche proposal (${draft.rel}) — use it as the brief:\n\n${readText(draft.abs)}`;
    draftRel = draft.rel;
    draftSkills = Array.isArray(data.render_skills) ? data.render_skills.map(String) : [];
  }
  slug = slug ?? slugify(seed).split("-").slice(0, 5).join("-");
  const touched = createChannelSkeleton(ws, slug, name);
  if (draftRel) {
    writeText(ws.path(draftRel), updateFrontmatter(readText(ws.path(draftRel)), { "draft.status": "approved", "draft.decided": today(), "draft.approved_into": `channels/${slug}` }));
    touched.push(ws.path(draftRel));
  }
  ok(`Created channels/${slug}/ (status: draft) — the agent drafts the rest`);
  commitPaths(ws, touched, `new channel ${slug}: skeleton from ${draftRel ? "approved niche" : "seed"}`);

  const dir = ws.channelDir(slug);
  const task = draftChannelTask(ws, slug, seed, draftSkills);
  await runTask(ws, task, opts.llm);
  const issues = validateChannel(ws, loadChannel(ws, slug));
  log(formatIssues(issues));
  commitPaths(ws, [dir], `new channel ${slug}: drafted by the API`);
  next([`Review channels/${slug}/ then approve: ./engine approve channel ${slug}`]);
}

export function approveChannel(ws: Workspace, slug: string, by: string | undefined): void {
  const channel = loadChannel(ws, slug);
  const issues = validateChannel(ws, channel);
  if (hasErrors(issues)) throw new EngineError(`Channel "${slug}" can't be approved yet:\n${formatIssues(issues)}`);
  const status = String(channel.doc.data.status);
  if (status === "active") throw new EngineError(`Channel "${slug}" is already active.`);
  writeText(channel.doc.abs, updateFrontmatter(channel.doc.text, { status: "active", approved: today(), ...(by ? { approved_by: by } : {}) }));
  commitPaths(ws, [channel.dir], `approve channel ${slug} → active${by ? ` (by ${by})` : ""}`);
  ok(`${slug} is now active`);
  next([`Make an episode: ./engine make episode --channel ${slug} --series ${[...channel.series.keys()][0] ?? "<series>"}`]);
}

export function setChannelStatus(ws: Workspace, slug: string, status: string): void {
  if (!(CHANNEL_STATUSES as readonly string[]).includes(status)) throw new EngineError(`Status must be one of: ${CHANNEL_STATUSES.join(", ")}.`);
  const channel = loadChannel(ws, slug);
  if (status === "active") return approveChannel(ws, slug, undefined);
  writeText(channel.doc.abs, updateFrontmatter(channel.doc.text, { status }));
  commitPaths(ws, [channel.doc.abs], `channel ${slug} → ${status}`);
  ok(`${slug} is now ${status}`);
}

/** Open a channel/character/series file in $EDITOR, then validate. */
export function editFile(ws: Workspace, kind: "channel" | "character" | "series", channelSlug: string, name?: string): void {
  if (!listChannelSlugs(ws).includes(channelSlug)) throw new EngineError(`No channel "${channelSlug}".`);
  const dir = ws.channelDir(channelSlug);
  const file = kind === "channel" ? join(dir, "channel.md") : join(dir, kind === "character" ? "characters" : "series", `${name}.md`);
  if (!existsSync(file)) throw new EngineError(`${ws.rel(file)} doesn't exist.`, kind === "channel" ? undefined : `Create it: ./engine add ${kind} --channel ${channelSlug}`);
  const editor = process.env.VISUAL ?? process.env.EDITOR;
  if (editor && process.stdin.isTTY) spawnSync(editor, [file], { stdio: "inherit", shell: true });
  else log(`Edit ${ws.rel(file)} in your editor (set $EDITOR to open it automatically).`);
  const issues = validateChannel(ws, loadChannel(ws, channelSlug));
  log(formatIssues(issues));
  if (!hasErrors(issues)) commitPaths(ws, [dir], `edit ${kind} ${name ?? channelSlug} in ${channelSlug}`);
}
