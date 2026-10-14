import { join } from "node:path";
import { listChannelSlugs, loadChannel } from "../../core/channels.ts";
import { ContextBundle } from "../../core/context.ts";
import { listDrafts, validateDraft } from "../../core/drafts.ts";
import { EngineError } from "../../core/errors.ts";
import { commitPaths } from "../../core/git.ts";
import { listSkills } from "../../core/skills.ts";
import { runTask, type LlmProviderName, type Task } from "../../core/tasks.ts";
import { today } from "../../core/util.ts";
import type { Workspace } from "../../core/workspace.ts";
import { KOKORO_VOICES } from "../../voice/voices.ts";
import { next, ok } from "../ui.ts";

export type BrainstormKind = "niches" | "characters" | "series" | "ideas";

/**
 * Brainstorm proposals into drafts/. Nothing reaches a channel until you approve a draft.
 * Channel-scoped brainstorms only see that channel's files (plus AGENTS.md and the brainstorm skill).
 */
export async function brainstorm(ws: Workspace, kind: BrainstormKind, opts: { channel?: string; series?: string; count?: number; seed?: string; llm: LlmProviderName }): Promise<void> {
  const count = opts.count ?? (kind === "ideas" ? 10 : 3);
  const renderSkills = listSkills(ws).filter((s) => s.kind === "render");
  const skillMenu = renderSkills.map((s) => `- ${s.name} (${s.layer}): ${s.description}`).join("\n");
  const before = new Set(listDrafts(ws).map((d) => d.abs));
  let task: Task;

  if (kind === "niches") {
    if (opts.channel) throw new EngineError("Niches are brainstormed globally — drop --channel.");
    const dir = ws.path("drafts", "niches");
    const ctx = new ContextBundle(ws, { purpose: "brainstorm-niches", skills: ["brainstorm"], globals: ["templates/niche.md"] });
    ctx.addFile("skills/brainstorm/SKILL.md", "skill");
    ctx.addFile("templates/niche.md", "template");
    const existing = listChannelSlugs(ws).map((slug) => {
      const c = loadChannel(ws, slug);
      return `- ${slug}: ${String(c.doc.data.niche ?? "")} (${String(c.doc.data.status)})`;
    });
    ctx.addInline("existing channels (names and niches only — propose something different)", existing.join("\n") || "(none yet)", "listing");
    ctx.addInline("render skills available", skillMenu, "listing");
    if (opts.seed) ctx.addInline("direction from the person", opts.seed);
    task = {
      id: `brainstorm-niches-${today()}`,
      title: `Brainstorm ${count} channel niches`,
      dir: ws.path("drafts"),
      context: ctx,
      instructions: `Propose **${count}** channel niches, following \`skills/brainstorm/SKILL.md\` (section "Niches").
Write one file per proposal: \`drafts/niches/${today()}-<slug>.md\`, using \`templates/niche.md\` exactly
(\`draft: {kind: niche, status: proposed, created: ${today()}}\`). Each must differ clearly from the existing channels
in niche, character and visual style, and only use the render skills listed. Then run \`./engine list drafts\`.`,
      outputs: [{ path: dir, format: "files", description: `${count} niche proposals` }],
      next: "./engine list drafts",
    };
  } else {
    if (!opts.channel) throw new EngineError(`Brainstorming ${kind} needs --channel <slug>.`);
    const channel = loadChannel(ws, opts.channel);
    if (opts.series && !channel.series.has(opts.series)) throw new EngineError(`Channel "${channel.slug}" has no series "${opts.series}".`);
    const skills = kind === "characters" ? ["brainstorm", "render-talking-character"] : ["brainstorm"];
    const ctx = new ContextBundle(ws, { purpose: `brainstorm-${kind}`, channel: channel.slug, skills, globals: [`templates/${kind === "characters" ? "character" : kind === "series" ? "series" : "ideas"}.md`] });
    for (const s of skills) ctx.addFile(`skills/${s}/SKILL.md`, "skill");
    ctx.addFile(channel.doc.rel, "channel");
    for (const c of channel.characters.values()) ctx.addFile(c.rel, "channel");
    for (const s of channel.series.values()) ctx.addFile(s.rel, "channel");
    ctx.addFile(ws.rel(channel.ideasPath), "channel", { optional: true });
    ctx.addFile(ws.rel(channel.learningsPath), "channel", { optional: true });
    const dir = ws.path("drafts", channel.slug, kind === "characters" ? "characters" : kind === "series" ? "series" : "ideas");
    const draftBlock = `draft: {kind: ${kind === "characters" ? "character" : kind === "series" ? "series" : "ideas"}, channel: ${channel.slug}, status: proposed, created: ${today()}}`;
    if (kind === "characters") {
      ctx.addFile("templates/character.md", "template");
      ctx.addInline("voices available (free, local Kokoro)", KOKORO_VOICES.map((v) => `- ${v.id}: ${v.desc} (quality ${v.grade})`).join("\n"), "listing");
    }
    if (kind === "series") {
      ctx.addFile("templates/series.md", "template");
      ctx.addInline("render skills available", skillMenu, "listing");
    }
    if (kind === "ideas") ctx.addFile("templates/ideas.md", "template");
    if (opts.seed) ctx.addInline("direction from the person", opts.seed);
    const what = {
      characters: `Propose **${count}** new original characters for this channel. One file each: \`drafts/${channel.slug}/characters/<name>.md\` (templates/character.md) plus \`drafts/${channel.slug}/characters/<name>/model.json\` (see skills/render-talking-character). Add \`${draftBlock}\` to the frontmatter.`,
      series: `Propose **${count}** new series for this channel. One file each: \`drafts/${channel.slug}/series/<slug>.md\` (templates/series.md), using only this channel's characters and the render skills listed. Add \`${draftBlock}\` to the frontmatter.`,
      ideas: `Propose **${count}** new episode ideas${opts.series ? ` for series \`${opts.series}\`` : ""}. Write ONE file \`drafts/${channel.slug}/ideas/${today()}-<short-name>.md\` with frontmatter \`---\\n${draftBlock}\\n---\` and then the ideas in the ideas format with \`status: proposed\`. Don't repeat anything already in ideas.md (including used and rejected ideas).`,
    }[kind];
    task = {
      id: `brainstorm-${kind}-${today()}`,
      title: `Brainstorm ${kind} for ${channel.slug}`,
      dir: ws.path("drafts", channel.slug),
      context: ctx,
      instructions: `${what}\n\nFollow \`skills/brainstorm/SKILL.md\`. Use only this channel's context — never borrow from other channels. Then run \`./engine list drafts\`.`,
      outputs: [{ path: dir, format: "files", description: `${kind} proposals` }],
      next: "./engine list drafts",
    };
  }

  await runTask(ws, task, opts.llm);
  const created = listDrafts(ws).filter((d) => !before.has(d.abs));
  for (const d of created) {
    const problems = validateDraft(ws, d).filter((i) => i.level === "error");
    ok(`${d.rel}${problems.length ? ` — ${problems.length} problem(s)` : ""}`);
  }
  commitPaths(ws, created.map((d) => d.abs).concat(created.map((d) => join(d.abs.replace(/\.md$/, "")))), `brainstorm ${kind}${opts.channel ? ` for ${opts.channel}` : ""}`);
  next(["Review the drafts, then: ./engine approve draft <path>   or   ./engine reject draft <path> --reason \"…\""]);
}
