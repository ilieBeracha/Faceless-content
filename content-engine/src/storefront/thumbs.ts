/**
 * Draw the picture of each ready-made host: `npm run avatars:thumbs` (only the missing ones) or
 * `npm run avatars:thumbs -- --all`. Each host is rendered standing in for the presenter of the demo
 * channel's latest finished episode (STOREFRONT_DEMO_CHANNEL, default "no-way-really") and cropped out.
 */
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadChannel } from "../core/channels.ts";
import { runFfmpeg } from "../core/ffmpeg.ts";
import { readJson } from "../core/util.ts";
import { ENGINE_DIR, Workspace } from "../core/workspace.ts";
import { listEpisodes, loadEpisode, readScript } from "../pipeline/episode.ts";
import { buildProps } from "../render/render-episode.ts";
import { parseTheme } from "../skills/render-themed/schema.ts";
import { hostPicture, readHosts } from "./catalog.ts";

/** A moment where the presenter stands still in the lower left, and the square of the frame they stand in. */
const FRAME = 200;
const CROP = "crop=400:400:0:860,scale=320:320";
/** A plain, light look so every host reads against it. */
const BACKDROP = "soft-studio";

const all = process.argv.includes("--all");
const ws = Workspace.fromEnv();
const slug = process.env.STOREFRONT_DEMO_CHANNEL ?? "no-way-really";
const done = listEpisodes(loadChannel(ws, slug)).filter((e) => e.status === "done");
if (!done.length) throw new Error(`Channel "${slug}" has no finished episode to draw the hosts in.`);
const ep = loadEpisode(ws, slug, done[done.length - 1].id);
const hosts = readHosts(ENGINE_DIR).filter((h) => all || !existsSync(hostPicture(ENGINE_DIR, h.id)));
if (!hosts.length) {
  console.log("Every host already has a picture. Use --all to redraw them.");
  process.exit(0);
}

const base = buildProps(ws, ep, readScript(ep));
const speaker = Object.keys(base.characters)[0];
const theme = parseTheme(readJson(join(ENGINE_DIR, "themes", `${BACKDROP}.json`)), `themes/${BACKDROP}.json`);
const { bundle } = await import("@remotion/bundler");
const { renderStill, selectComposition } = await import("@remotion/renderer");
const serveUrl = await bundle({ entryPoint: join(ENGINE_DIR, "src", "render", "index.ts"), publicDir: ws.path(".cache", "render", slug, ep.state.id, "public"), onProgress: () => undefined });
const browser = { browserExecutable: ws.config.render.browser_executable ?? null, chromiumOptions: { gl: ws.config.render.gl as "angle" | "swangle" | "egl" | "swiftshader" | "vulkan" | "angle-egl", enableMultiProcessOnLinux: true } };
const tmp = mkdtempSync(join(tmpdir(), "avatar-thumbs-"));
for (const host of hosts) {
  const props = { ...base, qaProbe: false, captionsSkill: null, theme, characters: { ...base.characters, [speaker]: { ...base.characters[speaker], model: host.model } } };
  const composition = await selectComposition({ serveUrl, id: "Episode", inputProps: props, ...browser, logLevel: "error" });
  const full = join(tmp, `${host.id}.jpg`);
  await renderStill({ composition, serveUrl, output: full, frame: FRAME, inputProps: props, imageFormat: "jpeg", jpegQuality: 92, ...browser, logLevel: "error" });
  runFfmpeg(["-y", "-i", full, "-vf", CROP, "-q:v", "3", hostPicture(ENGINE_DIR, host.id)], `cropping the picture of ${host.name}`);
  console.log(`avatars/${host.id}.jpg`);
}
