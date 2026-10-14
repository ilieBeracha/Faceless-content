import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import type { Workspace } from "./workspace.ts";

/**
 * Commit exactly the given paths (files or folders). History is how the engine "never deletes":
 * every change to a channel, draft or idea lands in git. Ignored paths (renders, audio) are skipped.
 * Set ENGINE_AUTO_COMMIT=0 (or git.auto_commit=false) to turn it off.
 */
export function commitPaths(ws: Workspace, absPaths: string[], message: string): { committed: boolean; reason?: string } {
  if (!ws.config.git.auto_commit) return { committed: false, reason: "auto-commit is off" };
  const git = (args: string[]) => spawnSync("git", args, { cwd: ws.root, encoding: "utf8" });
  if (git(["rev-parse", "--is-inside-work-tree"]).stdout?.trim() !== "true") return { committed: false, reason: "not a git repository" };

  const paths = [...new Set(absPaths)].filter((p) => existsSync(p)).filter((p) => git(["check-ignore", "-q", p]).status !== 0);
  if (!paths.length) return { committed: false, reason: "nothing to commit" };

  const add = git(["add", "--", ...paths]);
  if (add.status !== 0) return { committed: false, reason: add.stderr.trim() };
  const staged = git(["diff", "--cached", "--quiet", "--", ...paths]);
  if (staged.status === 0) return { committed: false, reason: "no changes" };

  const trailer = process.env.ENGINE_COMMIT_TRAILER?.replace(/\\n/g, "\n");
  const full = `engine: ${message}${trailer ? `\n\n${trailer}` : ""}`;
  const commit = git(["commit", "-q", "-m", full, "--", ...paths]);
  if (commit.status !== 0) return { committed: false, reason: (commit.stderr || commit.stdout).trim().split("\n")[0] };
  return { committed: true };
}
