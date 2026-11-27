/** A picture of a host on white (the HostStill composition), for the image model to copy into painted shots. */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Workspace } from "../core/workspace.ts";
import type { CharacterModel } from "../skills/render-talking-character/rigs.ts";
import { browserOptions, bundleFor } from "./render-episode.ts";

export async function renderHostStill(ws: Workspace, model: CharacterModel, out: string, log: (l: string) => void = () => {}): Promise<void> {
  const serveUrl = await bundleFor(null, log);
  const { renderStill, selectComposition } = await import("@remotion/renderer");
  const browser = browserOptions(ws);
  const inputProps = { model };
  const composition = await selectComposition({ serveUrl, id: "HostStill", inputProps, ...browser, logLevel: "error" });
  mkdirSync(dirname(out), { recursive: true });
  await renderStill({ composition, serveUrl, output: out, frame: 0, inputProps, imageFormat: "png", ...browser, logLevel: "error" });
}
