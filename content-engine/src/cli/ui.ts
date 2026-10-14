import pc from "picocolors";
import type { PipelinePause } from "../core/errors.ts";

export const log = (line = "") => console.log(line);

export function heading(text: string): void {
  console.log(pc.bold(text));
}

export function ok(text: string): void {
  console.log(`${pc.green("✔")} ${text}`);
}

export function warn(text: string): void {
  console.log(`${pc.yellow("⚠")} ${text}`);
}

export function next(lines: string[]): void {
  console.log(pc.cyan("\nNext:"));
  for (const l of lines) console.log(`  ${l}`);
}

const visible = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

/** Plain aligned table (no external deps). */
export function table(headers: string[], rows: string[][]): void {
  if (!rows.length) {
    console.log(pc.dim("  (none)"));
    return;
  }
  const widths = headers.map((h, i) => Math.min(48, Math.max(visible(h).length, ...rows.map((r) => visible(r[i] ?? "").length))));
  const fit = (s: string, w: number) => {
    const v = visible(s);
    if (v.length <= w) return s + " ".repeat(w - v.length);
    return v.slice(0, w - 1) + "…";
  };
  console.log(pc.dim(headers.map((h, i) => fit(h, widths[i])).join("  ")));
  for (const r of rows) console.log(r.map((c, i) => fit(c ?? "", widths[i])).join("  "));
}

export function printPause(p: PipelinePause): void {
  const title = { "waiting-for-agent": "⏸  Waiting for the agent", "awaiting-approval": "✋ STOP — human approval needed", "needs-fix": "🔧 Needs a fix" }[p.kind];
  console.log("\n" + pc.bold(pc.yellow(title)));
  for (const l of p.lines) console.log(`   ${l}`);
  console.log(pc.dim(`\nSTATUS: ${p.kind}`));
}

export function statusColor(status: string): string {
  if (["active", "done", "approved", "pass", "new"].includes(status)) return pc.green(status);
  if (["draft", "proposed", "in-progress", "pending", "waiting"].includes(status)) return pc.yellow(status);
  if (["paused", "rejected", "failed", "used", "retired"].includes(status)) return pc.dim(status);
  return status;
}
