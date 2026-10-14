import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { ffmpegTools, hasFilter } from "../../core/ffmpeg.ts";
import type { Workspace } from "../../core/workspace.ts";
import { demoProps } from "../../render/demo-props.ts";
import { renderStills } from "../../render/render-episode.ts";
import { venvPython } from "../../voice/synthesize.ts";
import { log, ok, warn } from "../ui.ts";

/** Check the machine and render a few stills of the neutral demo. */
export async function doctor(ws: Workspace): Promise<boolean> {
  let healthy = true;
  const check = (good: boolean, yes: string, no: string) => {
    if (good) ok(yes);
    else {
      warn(no);
      healthy = false;
    }
  };
  const [major] = process.versions.node.split(".").map(Number);
  check(major >= 20, `Node ${process.versions.node}`, `Node ${process.versions.node} — please use Node 20 or newer`);
  try {
    const tools = ffmpegTools();
    check(true, `ffmpeg (${tools.source})${hasFilter("rubberband") ? "" : " — no rubberband, pitch uses the resample method"}`, "");
  } catch (e) {
    check(false, "", (e as Error).message);
  }
  check(existsSync(venvPython(ws)), "Python venv for Kokoro (.venv)", "Kokoro isn't set up — run ./engine setup");
  check(existsSync(ws.path(".models", "kokoro", "kokoro-v1.0.timed.onnx")), "Kokoro model with word timings", "Kokoro model missing — run ./engine setup");
  check(spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: ws.root, encoding: "utf8" }).stdout?.trim() === "true", "git repository (history is kept)", "not inside a git repository — history won't be kept");
  log(`Render: gl=${ws.config.render.gl}${ws.config.render.browser_executable ? `, browser ${ws.config.render.browser_executable}` : ", Remotion's Chrome Headless Shell"}`);
  try {
    const files = await renderStills(ws, demoProps, [20, 160, 300], ws.path(".cache", "doctor"), (l) => log(l));
    ok(`Rendered ${files.length} demo stills (3D, character, captions, motion graphics) into .cache/doctor/`);
  } catch (e) {
    check(false, "", `Rendering failed: ${(e as Error).message.split("\n")[0]}`);
  }
  return healthy;
}
