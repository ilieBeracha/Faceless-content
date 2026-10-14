import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { EngineError } from "../core/errors.ts";
import { ffmpegTools, hasFilter } from "../core/ffmpeg.ts";
import type { Workspace } from "../core/workspace.ts";
import { ENGINE_DIR } from "../core/workspace.ts";
import { venvPython } from "./synthesize.ts";

/** One-time machine setup: Python venv + Kokoro model (free, local), ffmpeg check, render browser. */
export async function runSetup(ws: Workspace, log: (l: string) => void): Promise<void> {
  log("1/4 ffmpeg");
  const tools = ffmpegTools();
  log(`  ✓ using ${tools.source === "remotion" ? "the ffmpeg bundled with Remotion" : `${tools.ffmpeg.bin} (${tools.source})`}`);
  if (!hasFilter("rubberband")) log("  · no rubberband filter: pitch changes will use the resample method (fine for most voices)");

  log("2/4 Python environment for the local voice (Kokoro)");
  const python = venvPython(ws);
  if (!existsSync(python)) {
    const base = process.env.PYTHON ?? (process.platform === "win32" ? "python" : "python3");
    const version = spawnSync(base, ["-c", "import sys; print('%d.%d' % sys.version_info[:2])"], { encoding: "utf8" });
    if (version.status !== 0) throw new EngineError(`Python 3.10+ is needed for the local voice engine ("${base}" was not found).`, "Install Python 3 (macOS: brew install python) or set PYTHON=/path/to/python3 in .env.");
    const [major, minor] = version.stdout.trim().split(".").map(Number);
    if (major < 3 || (major === 3 && minor < 10)) throw new EngineError(`Python ${version.stdout.trim()} is too old; Kokoro needs 3.10+.`);
    run(base, ["-m", "venv", ws.path(".venv")], "creating .venv");
    log(`  ✓ created .venv with Python ${version.stdout.trim()}`);
  } else {
    log("  ✓ .venv exists");
  }
  const packages = ws.config.voice.providers.kokoro.python_packages ?? [];
  run(python, ["-m", "pip", "install", "--quiet", "--disable-pip-version-check", ...packages], "installing Python packages");
  log(`  ✓ installed ${packages.join(", ")}`);

  log("3/4 Kokoro voice model (Apache-2.0, ~350 MB, downloaded once from GitHub)");
  const cfg = ws.config.voice.providers.kokoro;
  const res = spawnSync(python, [join(ENGINE_DIR, "src", "voice", "setup_kokoro.py"), ws.path(cfg.dir ?? ".models/kokoro"), cfg.model_url!, cfg.voices_url!], { stdio: "inherit" });
  if (res.status !== 0) throw new EngineError("Downloading or preparing the Kokoro model failed (see above).");

  log("4/4 Render browser");
  if (ws.config.render.browser_executable) {
    if (!existsSync(ws.config.render.browser_executable)) throw new EngineError(`REMOTION_BROWSER_EXECUTABLE points to a missing file: ${ws.config.render.browser_executable}`);
    log(`  ✓ using ${ws.config.render.browser_executable}`);
  } else {
    const { ensureBrowser } = await import("@remotion/renderer");
    await ensureBrowser();
    log("  ✓ Chrome Headless Shell is ready");
  }
  log("Setup complete. Try: ./engine list");
}

function run(cmd: string, args: string[], what: string): void {
  const res = spawnSync(cmd, args, { encoding: "utf8" });
  if (res.status !== 0) throw new EngineError(`Failed ${what}:\n${(res.stderr || res.stdout).split("\n").slice(-10).join("\n")}`);
}
