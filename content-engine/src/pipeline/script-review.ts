/**
 * The script review: a second reader checks the story itself (point, telling, ending) before a person checks the
 * facts and before anything is voiced, painted or rendered. What it finds costs a text edit here, not a render.
 * Bound to the exact script: any change to script.json asks for a fresh review.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { bodySection } from "../core/markdown.ts";
import { ContextBundle } from "../core/context.ts";
import type { Task } from "../core/tasks.ts";
import { canonicalJson, readJson, sha256 } from "../core/util.ts";
import type { Workspace } from "../core/workspace.ts";
import type { EpisodeRef } from "./episode.ts";
import type { SeriesData } from "./script-check.ts";

export interface ScriptReview {
  script_hash: string;
  verdict: "pass" | "fail";
  issues: { beat: string; problem: string; fix: string }[];
}

export function scriptReviewPath(ep: EpisodeRef): string {
  return join(ep.dir, "script-review.json");
}

/** All of script.json as written: a review holds only for the script it read. */
export function scriptReviewHash(script: unknown): string {
  return sha256(canonicalJson(script));
}

function writtenScriptHash(ep: EpisodeRef): string {
  return scriptReviewHash(readJson(join(ep.dir, "script.json")));
}

/** The review on file, if it is for the script now in script.json. */
export function currentScriptReview(ep: EpisodeRef): ScriptReview | null {
  const path = scriptReviewPath(ep);
  if (!existsSync(path)) return null;
  const review = readJson<ScriptReview>(path);
  return review.script_hash === writtenScriptHash(ep) ? review : null;
}

function reviewErrors(value: unknown, hash: string): string[] {
  const r = value as Partial<ScriptReview> | null;
  if (!r || typeof r !== "object") return ["the review must be a JSON object"];
  const errors: string[] = [];
  if (r.script_hash !== hash) errors.push(`"script_hash" must be "${hash}" (the script this review read)`);
  if (r.verdict !== "pass" && r.verdict !== "fail") errors.push('"verdict" must be "pass" or "fail"');
  if (!Array.isArray(r.issues)) errors.push('"issues" must be a list');
  else {
    r.issues.forEach((i, k) => {
      if (!i || typeof i.beat !== "string" || typeof i.problem !== "string" || typeof i.fix !== "string") errors.push(`issues[${k}] needs "beat", "problem" and "fix" (strings)`);
    });
    if (r.verdict === "fail" && r.issues.length === 0) errors.push('a "fail" lists at least one issue');
    if (r.verdict === "pass" && r.issues.length > 0) errors.push('a "pass" has no issues: anything listed must be fixed, so the verdict is "fail"');
  }
  return errors;
}

/** The review task: the house rules, this channel's files and the script, nothing else. */
export function scriptReviewTask(ws: Workspace, ep: EpisodeRef, series: SeriesData): Task {
  const ch = ep.channel;
  const scriptPath = join(ep.dir, "script.json");
  const reviewPath = scriptReviewPath(ep);
  const hash = writtenScriptHash(ep);
  const ctx = new ContextBundle(ws, { purpose: "script review", channel: ch.slug, series: ep.series, skills: [series.skills.script] });
  ctx.addFile(ws.rel(ch.doc.abs), "channel");
  ctx.addFile(ws.rel(ch.series.get(ep.series)!.abs), "channel");
  for (const name of series.characters) ctx.addFile(ch.characters.get(name)!.rel, "channel");
  ctx.addFile(`skills/${series.skills.script}/SKILL.md`, "skill");
  ctx.addFile(ws.rel(scriptPath), "channel");

  const instructions = `
Review the script \`${ws.rel(scriptPath)}\` before anyone checks its facts or anything is voiced or rendered. You are
a reader who has never heard this story. Read only the voiceover, beat by beat, as a viewer would hear it, and judge
it against the house rules (AGENTS.md §4), \`skills/${series.skills.script}/SKILL.md\` and this channel's Belief
(${JSON.stringify(bodySection(ch.doc.md.body, "Belief"))}).

Fail the script for any of these, naming the beat:
1. **No point.** It doesn't argue the point in its \`angle\` and the channel's Belief: a string of true facts with no turn.
2. **The person is missing.** The one with something at stake isn't the one who acts at the turn, or is replaced by
   "the team", "scientists" or a machine there.
3. **Not in order.** It opens on the ending, teases, flashes back, or uses clever dramatic lines instead of the plain thing.
4. **Referred to before introduced.** A person, thing, place or term ("the first one", "they", "the sheet") the viewer
   hasn't been told about yet.
5. **A missing why.** Someone does something surprising and the voiceover doesn't say why, or the script states a
   conclusion ("so they were real") without the reason a viewer needs to believe it.
6. **The ending.** The last beat doesn't end on what happened: it preaches (advice, "next time…", "trust yourself", a
   moral or pep talk to the viewer) or closes on a pun or wise-sounding line instead of the result.

Don't judge facts, sources, length, visuals or anything the engine checks; a person approves the facts next. Each fix
says exactly what to change in the voiceover, in plain words. Be strict: a fail costs a text edit now, a pass that
should have failed costs a render.

Write \`${ws.rel(reviewPath)}\` as JSON:

\`\`\`json
{
  "script_hash": "${hash}",
  "verdict": "pass",
  "issues": [{ "beat": "<beat id>", "problem": "…", "fix": "…" }]
}
\`\`\`

A "pass" has no issues. Don't change the script.
`;
  return {
    id: "script-review",
    title: `Review the script for ${ep.state.id}`,
    dir: ep.dir,
    context: ctx,
    instructions,
    outputs: [{ path: reviewPath, format: "json", description: "the script review" }],
    next: `./engine make episode --channel ${ch.slug} --series ${ep.series} --episode ${ep.state.id}`,
    check: () => reviewErrors(readJson(reviewPath), hash),
  };
}
