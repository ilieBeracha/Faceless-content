/**
 * factcheck.md — every claim in the script, for a human to approve. Nothing renders until the file
 * says `status: approved` AND its script_hash matches the script as it is now.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { EngineError } from "../core/errors.ts";
import { parseMarkdown, serializeMarkdown, updateFrontmatter } from "../core/markdown.ts";
import { nowIso, readText, writeText } from "../core/util.ts";
import type { Script } from "../skills/write-script/schema.ts";
import { allText, factualHash } from "./script-check.ts";

export type FactcheckStatus = "pending" | "approved" | "changes-requested";

export interface FactcheckState {
  status: FactcheckStatus;
  scriptHash: string;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
}

export function factcheckPath(episodeDir: string): string {
  return join(episodeDir, "factcheck.md");
}

export function readFactcheck(episodeDir: string): FactcheckState | null {
  const path = factcheckPath(episodeDir);
  if (!existsSync(path)) return null;
  const { data } = parseMarkdown(readText(path), "factcheck.md");
  return {
    status: String(data.status ?? "pending") as FactcheckStatus,
    scriptHash: String(data.script_hash ?? ""),
    approvedBy: data.approved_by ? String(data.approved_by) : undefined,
    approvedAt: data.approved_at ? String(data.approved_at) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
  };
}

export function writeFactcheck(episodeDir: string, script: Script, ids: { channel: string; episode: string }): string {
  const path = factcheckPath(episodeDir);
  const approve = `./engine approve factcheck --channel ${ids.channel} --episode ${ids.episode} --by "<your name>"`;
  const reject = `./engine reject factcheck --channel ${ids.channel} --episode ${ids.episode} --reason "<which claim and why>"`;
  const claims = script.claims
    .map((c) =>
      [
        `### ${c.id} · ${c.confidence} confidence · beat \`${c.beat}\``,
        "",
        `> ${c.claim}`,
        "",
        `- **Source:** ${c.source}`,
        c.note ? `- **Note:** ${c.note}` : "",
      ]
        .filter((l) => l !== "")
        .join("\n"),
    )
    .join("\n\n");
  const transcript = script.beats.map((b) => `| \`${b.id}\` | ${escapeCell(b.voiceover)} | ${escapeCell(b.on_screen_text ?? "")} |`).join("\n");
  const shown = [...new Set(allText(script))].filter((t) => !script.beats.some((b) => b.voiceover === t || b.on_screen_text === t));
  const body = [
    `# Fact-check: ${script.title}`,
    "",
    "**Nothing renders until a person approves this list.** Check each claim against its source, and read the",
    "full transcript below for anything the list missed.",
    "",
    `- Approve: \`${approve}\``,
    `- Ask for changes: \`${reject}\``,
    "",
    `## Claims (${script.claims.length})`,
    "",
    claims || "_The script lists no factual claims. If it states any fact, ask for changes._",
    "",
    "## Full transcript",
    "",
    "| Beat | Voiceover | On screen |",
    "|---|---|---|",
    transcript,
    "",
    "## Other text shown on screen",
    "",
    shown.length ? shown.map((t) => `- ${t}`).join("\n") : "_none_",
    "",
  ].join("\n");
  const data = {
    episode: ids.episode,
    channel: ids.channel,
    status: "pending",
    script_hash: factualHash(script),
    generated_at: nowIso(),
    approved_by: null,
    approved_at: null,
    notes: null,
  };
  writeText(path, serializeMarkdown(data, body));
  return path;
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function approveFactcheck(episodeDir: string, script: Script, by: string): void {
  const state = readFactcheck(episodeDir);
  if (!state) throw new EngineError("This episode has no factcheck.md yet.", "Run ./engine make episode … first; it writes the claim list.");
  if (state.scriptHash !== factualHash(script)) {
    throw new EngineError("factcheck.md is out of date — the script changed after the claim list was written.", "Re-run ./engine make episode … to regenerate the list, review it, then approve.");
  }
  if (!by.trim()) throw new EngineError("Say who is approving: --by \"<your name>\".");
  const path = factcheckPath(episodeDir);
  writeText(path, updateFrontmatter(readText(path), { status: "approved", approved_by: by.trim(), approved_at: nowIso(), notes: null }));
}

export function rejectFactcheck(episodeDir: string, reason: string): void {
  const path = factcheckPath(episodeDir);
  if (!existsSync(path)) throw new EngineError("This episode has no factcheck.md yet.");
  if (!reason.trim()) throw new EngineError('Say what needs to change: --reason "c3 is wrong because …".');
  writeText(path, updateFrontmatter(readText(path), { status: "changes-requested", notes: reason.trim(), approved_by: null, approved_at: null }));
}
