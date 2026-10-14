import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseMarkdown } from "./markdown.ts";
import { readText } from "./util.ts";
import type { Workspace } from "./workspace.ts";

export type SkillKind = "script" | "render" | "captions" | "brainstorm";

export interface SkillInfo {
  name: string;
  kind: SkillKind;
  /** For render skills: "scene" fills the frame for a beat; "overlay" sits on top (e.g. a talking character). */
  layer?: "scene" | "overlay";
  description: string;
  dir: string;
  /** Workspace-relative path of SKILL.md. */
  skillFile: string;
}

/** Skills are folders under skills/ with a SKILL.md whose frontmatter declares name, kind and description. */
export function listSkills(ws: Workspace): SkillInfo[] {
  const root = ws.path("skills");
  if (!existsSync(root)) return [];
  const skills: SkillInfo[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = join(root, entry.name, "SKILL.md");
    if (!existsSync(file)) continue;
    const { data } = parseMarkdown(readText(file), ws.rel(file));
    skills.push({
      name: String(data.name ?? entry.name),
      kind: String(data.kind ?? "render") as SkillKind,
      layer: data.layer ? (String(data.layer) as "scene" | "overlay") : undefined,
      description: String(data.description ?? ""),
      dir: join(root, entry.name),
      skillFile: ws.rel(file),
    });
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export function skillsOfKind(ws: Workspace, kind: SkillKind): SkillInfo[] {
  return listSkills(ws).filter((s) => s.kind === kind);
}
