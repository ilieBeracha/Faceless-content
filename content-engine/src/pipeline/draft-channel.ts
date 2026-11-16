/**
 * The "draft a channel from a seed" task: the instructions, the isolated context and where the files
 * go. The CLI (`new channel --seed`) and the storefront's automatic builds both run exactly this.
 */
import { join } from "node:path";
import { loadChannel, validateChannel } from "../core/channels.ts";
import { ContextBundle } from "../core/context.ts";
import { listSkills } from "../core/skills.ts";
import type { Task } from "../core/tasks.ts";
import { today } from "../core/util.ts";
import type { Workspace } from "../core/workspace.ts";
import { KOKORO_VOICES } from "../voice/voices.ts";

/**
 * `slug` is a channel whose skeleton already exists. `skills` are render skills whose guides the
 * draft should also see (ones that are not render skills of this engine are ignored).
 */
export function draftChannelTask(ws: Workspace, slug: string, seed: string, skills: string[]): Task {
  const renderSkills = listSkills(ws).filter((s) => s.kind === "render");
  // The chosen render skills come with their guides, so the series and character fit them.
  const extraSkills = skills.filter((s) => s !== "render-talking-character" && renderSkills.some((r) => r.name === s));
  const ctx = new ContextBundle(ws, { purpose: "new-channel", channel: slug, skills: ["brainstorm", "render-talking-character", "write-script", ...extraSkills], globals: ["templates/channel.md", "templates/character.md", "templates/series.md", "templates/ideas.md", "workflows/new-channel.md"] });
  ctx.addFile("workflows/new-channel.md", "workflow");
  for (const t of ["channel.md", "character.md", "series.md", "ideas.md"]) ctx.addFile(`templates/${t}`, "template");
  ctx.addFile("skills/brainstorm/SKILL.md", "skill");
  ctx.addFile("skills/render-talking-character/SKILL.md", "skill");
  for (const s of extraSkills) ctx.addFile(`skills/${s}/SKILL.md`, "skill");
  ctx.addFile(`channels/${slug}/channel.md`, "channel");
  ctx.addInline("seed", seed);
  ctx.addInline("render skills available (series pick from these)", renderSkills.map((s) => `- ${s.name} (${s.layer}): ${s.description}`).join("\n"), "listing");
  ctx.addInline("voices available (free, local Kokoro)", KOKORO_VOICES.map((v) => `- ${v.id}: ${v.desc} (quality ${v.grade})`).join("\n"), "listing");
  ctx.addInline("fonts available", ws.config.fonts.join(", "), "listing");

  const dir = ws.channelDir(slug);
  const instructions = `
Draft a complete channel from the seed below, following \`workflows/new-channel.md\` and \`skills/brainstorm/SKILL.md\`.
Keep \`slug: ${slug}\` and \`status: draft\`. Everything goes inside \`channels/${slug}/\`:

1. \`channel.md\` — fill every field of the template (it's already there, with the annotations) and write the Promise section.
2. One original character (two at most): \`characters/<name>.md\` from templates/character.md, plus
   \`characters/<name>/model.json\` (a rig from skills/render-talking-character — pick the one that fits the
   visual style, choose colours and expressions: at least neutral, curious, excited). Pick a voice from the list.
3. One series (two at most): \`series/<slug>.md\` from templates/series.md. Its \`skills.render\` must only
   use the render skills listed below; its beats must add up to its length.
4. \`ideas.md\` — append exactly 10 ideas in the ideas format (status \`new\`, one-line angle, series slug, added ${today()}).
5. Leave \`learnings.md\` as it is.

Then run \`./engine validate --channel ${slug}\` and fix every error. Finally tell the person to review the files and
approve with \`./engine approve channel ${slug}\` — never approve it yourself.
`;
  return {
    id: "draft-channel",
    title: `Draft channel ${slug}`,
    dir,
    context: ctx,
    instructions,
    outputs: [{ path: dir, format: "files", description: "channel.md, characters/, series/, ideas.md" }],
    next: `./engine validate --channel ${slug}`,
    replaceable: [join(dir, "channel.md"), join(dir, "ideas.md")],
    check: () => validateChannel(ws, loadChannel(ws, slug)).filter((i) => i.level === "error").map((i) => `${i.file}: ${i.message}`),
  };
}
