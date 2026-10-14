/**
 * Drafts: brainstormed niches, characters, series and ideas waiting for a human decision.
 *
 *   drafts/niches/<date>-<slug>.md                 one niche proposal per file (templates/niche.md)
 *   drafts/<channel>/characters/<name>.md (+ <name>/model.json)
 *   drafts/<channel>/series/<slug>.md
 *   drafts/<channel>/ideas/<date>-<batch>.md       ideas-format file, statuses proposed/approved/rejected
 *
 * Every draft carries a `draft:` block in its frontmatter (kind, channel, status, created, decided,
 * note). Approving copies it into the channel and marks the draft "approved"; rejecting marks it
 * "rejected". Drafts are never deleted.
 */
import { cpSync, existsSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { checkCharacterModel } from "../skills/render-talking-character/rigs.ts";
import { loadChannel, readDoc, refResolver, template, validateChannel } from "./channels.ts";
import { EngineError } from "./errors.ts";
import { appendIdeaBlocks, checkIdeas, DRAFT_IDEA_STATUSES, parseIdeas, renderIdeas, updateIdea } from "./ideas.ts";
import { parseMarkdown, serializeMarkdown, updateFrontmatter } from "./markdown.ts";
import { createFileExclusive, isPlainObject, readJson, readText, today, writeText } from "./util.ts";
import { hasErrors, validateAgainstTemplate, type Issue } from "./validate.ts";
import type { Workspace } from "./workspace.ts";

export type DraftKind = "niche" | "character" | "series" | "ideas";
export const DRAFT_STATUSES = ["proposed", "approved", "rejected"] as const;

export interface DraftInfo {
  abs: string;
  rel: string;
  kind: DraftKind;
  channel: string | null;
  status: string;
  title: string;
  created: string;
  /** For idea batches: how many ideas are proposed / approved / rejected. */
  ideaCounts?: Record<string, number>;
}

export function listDrafts(ws: Workspace): DraftInfo[] {
  const root = ws.path("drafts");
  if (!existsSync(root)) return [];
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (entry.endsWith(".md") && entry !== "README.md") files.push(p);
    }
  };
  walk(root);
  return files
    .map((abs) => {
      const text = readText(abs);
      const { data, body } = parseMarkdown(text, ws.rel(abs));
      const meta = isPlainObject(data.draft) ? data.draft : {};
      const kind = String(meta.kind ?? "") as DraftKind;
      const info: DraftInfo = {
        abs,
        rel: ws.rel(abs),
        kind,
        channel: meta.channel ? String(meta.channel) : null,
        status: String(meta.status ?? "proposed"),
        title: String(data.name ?? data.title ?? basename(abs, ".md")),
        created: String(meta.created ?? ""),
      };
      if (kind === "ideas") {
        const ideas = parseIdeas(body);
        info.ideaCounts = {};
        for (const idea of ideas) info.ideaCounts[idea.status] = (info.ideaCounts[idea.status] ?? 0) + 1;
        info.title = `${ideas.length} idea${ideas.length === 1 ? "" : "s"}`;
      }
      return info;
    })
    .sort((a, b) => a.rel.localeCompare(b.rel));
}

export function draftInfo(ws: Workspace, relOrAbs: string): DraftInfo {
  const abs = relOrAbs.startsWith("/") ? relOrAbs : ws.path(relOrAbs);
  const info = listDrafts(ws).find((d) => d.abs === abs);
  if (!info) throw new EngineError(`No draft at ${relOrAbs}.`, "List drafts with: ./engine list drafts");
  return info;
}

/** Validate one draft file against its template (and its channel, for references). */
export function validateDraft(ws: Workspace, draft: DraftInfo): Issue[] {
  const text = readText(draft.abs);
  const md = parseMarkdown(text, draft.rel);
  const channel = draft.channel ? loadChannel(ws, draft.channel) : null;
  if (draft.kind === "niche") return validateAgainstTemplate(md, template(ws, "niche.md"), { file: draft.rel, resolveRef: refResolver(ws, null), ignoreKeys: ["draft"] });
  if (draft.kind === "character") {
    const issues = validateAgainstTemplate(md, template(ws, "character.md"), { file: draft.rel, resolveRef: refResolver(ws, channel), ignoreKeys: ["draft"] });
    const model = join(dirname(draft.abs), basename(draft.abs, ".md"), "model.json");
    if (!existsSync(model)) issues.push({ level: "error", file: draft.rel, message: `missing ${ws.rel(model)}` });
    else for (const p of checkCharacterModel(readJson(model))) issues.push({ level: "error", file: ws.rel(model), message: p });
    return issues;
  }
  if (draft.kind === "series") {
    // A drafted series may use characters that are drafted alongside it; only check references to existing ones loosely.
    return validateAgainstTemplate(md, template(ws, "series.md"), { file: draft.rel, resolveRef: refResolver(ws, channel), ignoreKeys: ["draft"] });
  }
  if (draft.kind === "ideas") {
    const ideas = parseIdeas(md.body);
    return checkIdeas(ideas, { statuses: DRAFT_IDEA_STATUSES, series: channel ? [...channel.series.keys()] : undefined }).map((p) => ({ level: "error" as const, file: draft.rel, message: p.message }));
  }
  return [{ level: "error", file: draft.rel, message: `unknown draft kind "${String(draft.kind)}" (expected niche, character, series or ideas)` }];
}

function markDraft(abs: string, fields: Record<string, unknown>): void {
  const text = readText(abs);
  writeText(abs, updateFrontmatter(text, Object.fromEntries(Object.entries(fields).map(([k, v]) => [`draft.${k}`, v]))));
}

export interface DecisionResult {
  touched: string[];
  summary: string;
}

/** Approve a character/series/ideas draft into its channel. Niches are approved via `new channel --from-draft`. */
export function approveDraft(ws: Workspace, draft: DraftInfo, opts: { only?: string[]; note?: string } = {}): DecisionResult {
  if (draft.kind === "niche") {
    throw new EngineError("A niche is approved by turning it into a channel.", `Run: ./engine new channel --from-draft ${draft.rel}`);
  }
  if (!draft.channel) throw new EngineError(`${draft.rel} has no draft.channel set.`);
  if (draft.status !== "proposed" && draft.kind !== "ideas") throw new EngineError(`${draft.rel} is already ${draft.status}.`);
  const issues = validateDraft(ws, draft);
  if (hasErrors(issues)) {
    throw new EngineError(`${draft.rel} doesn't pass validation yet:\n  - ${issues.filter((i) => i.level === "error").map((i) => i.message).join("\n  - ")}`, "Fix the draft, then approve again.");
  }
  const channelDir = ws.channelDir(draft.channel);
  const name = basename(draft.abs, ".md");
  const touched: string[] = [draft.abs];

  if (draft.kind === "character" || draft.kind === "series") {
    const folder = draft.kind === "character" ? "characters" : "series";
    const target = join(channelDir, folder, `${name}.md`);
    const { data, body } = parseMarkdown(readText(draft.abs), draft.rel);
    delete data.draft;
    createFileExclusive(target, serializeMarkdown(data, body));
    touched.push(target);
    if (draft.kind === "character") {
      const assets = join(dirname(draft.abs), name);
      const targetAssets = join(channelDir, "characters", name);
      if (existsSync(targetAssets)) throw new EngineError(`${ws.rel(targetAssets)} already exists — not overwriting it.`);
      cpSync(assets, targetAssets, { recursive: true, errorOnExist: true, force: false });
      touched.push(targetAssets);
    }
    markDraft(draft.abs, { status: "approved", decided: today(), approved_into: ws.rel(target), ...(opts.note ? { note: opts.note } : {}) });
    const problems = validateChannel(ws, loadChannel(ws, draft.channel)).filter((i) => i.level === "error" && i.file.includes(`/${folder}/${name}`));
    return { touched, summary: `Approved ${draft.kind} "${name}" into ${ws.rel(target)}${problems.length ? ` (${problems.length} validation problem(s) to fix)` : ""}` };
  }

  // ideas batch
  const channel = loadChannel(ws, draft.channel);
  let draftText = readText(draft.abs);
  const { body } = parseMarkdown(draftText, draft.rel);
  const proposals = parseIdeas(body).filter((i) => i.status === "proposed" && (!opts.only || opts.only.includes(i.id)));
  if (!proposals.length) throw new EngineError(`No proposed ideas to approve in ${draft.rel}${opts.only ? ` matching ${opts.only.join(", ")}` : ""}.`);
  const { text, ids } = renderIdeas(
    proposals.map((p) => ({ id: p.id, title: p.title, series: p.series, angle: p.angle, extra: { source: draft.rel } })),
    channel.ideas.map((i) => i.id),
    "new",
    today(),
  );
  writeText(channel.ideasPath, appendIdeaBlocks(readText(channel.ideasPath), text));
  touched.push(channel.ideasPath);
  for (const p of proposals) draftText = updateIdea(draftText, p.id, { status: "approved", decided: today() });
  writeText(draft.abs, draftText);
  const remaining = parseIdeas(parseMarkdown(draftText).body).filter((i) => i.status === "proposed").length;
  if (!remaining) markDraft(draft.abs, { status: "approved", decided: today() });
  return { touched, summary: `Added ${ids.length} idea(s) to ${ws.rel(channel.ideasPath)} as "new": ${ids.join(", ")}` };
}

export function rejectDraft(ws: Workspace, draft: DraftInfo, reason: string, opts: { only?: string[] } = {}): DecisionResult {
  if (draft.kind === "ideas" && opts.only?.length) {
    let text = readText(draft.abs);
    for (const id of opts.only) text = updateIdea(text, id, { status: "rejected", decided: today(), rejected_reason: reason });
    writeText(draft.abs, text);
    return { touched: [draft.abs], summary: `Rejected idea(s) ${opts.only.join(", ")} in ${draft.rel}` };
  }
  if (draft.kind === "ideas") {
    let text = readText(draft.abs);
    for (const idea of parseIdeas(parseMarkdown(text).body).filter((i) => i.status === "proposed")) {
      text = updateIdea(text, idea.id, { status: "rejected", decided: today(), rejected_reason: reason });
    }
    writeText(draft.abs, text);
  }
  markDraft(draft.abs, { status: "rejected", decided: today(), note: reason });
  return { touched: [draft.abs], summary: `Rejected ${draft.rel} (kept for history)` };
}
