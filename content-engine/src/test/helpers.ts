import { cpSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createChannel, createCharacter, createSeries, defaultModel } from "../core/scaffold.ts";
import { appendIdeaBlocks, renderIdeas } from "../core/ideas.ts";
import { readText, today, writeText } from "../core/util.ts";
import { ENGINE_DIR, Workspace } from "../core/workspace.ts";
import type { Script } from "../skills/write-script/schema.ts";

/** A throwaway workspace with the real templates, skills and house rules, and git auto-commit off. */
export function tempWorkspace(): Workspace {
  process.env.ENGINE_AUTO_COMMIT = "0";
  const root = mkdtempSync(join(tmpdir(), "content-engine-test-"));
  for (const p of ["templates", "skills", "workflows"]) cpSync(join(ENGINE_DIR, p), join(root, p), { recursive: true });
  for (const f of ["AGENTS.md", "engine.config.json"]) cpSync(join(ENGINE_DIR, f), join(root, f));
  return new Workspace(root);
}

/** A small valid channel: one robot character, one 3D series, a few ideas. */
export function makeChannel(ws: Workspace, slug: string, opts: { status?: "draft" | "active"; banned?: string[] } = {}): void {
  createChannel(ws, {
    slug,
    name: `Test ${slug}`,
    niche: "How everyday things work, for curious kids",
    audience: { who: "curious kids and their parents", age_range: "8-12", made_for_kids: false },
    tone: ["curious", "playful"],
    language: "en",
    platforms: ["youtube-shorts", "tiktok"],
    cadence: "3 per week",
    banned_topics: opts.banned ?? ["weapons", "medical advice"],
    brand: { primary_color: "#3d5afe", accent_color: "#ffb300", background_top: "#0d1b2a", background_bottom: "#1b263b", font: "montserrat" },
    promise: "Short peeks inside everyday objects.",
  });
  createCharacter(ws, slug, {
    name: "bot",
    display_name: "Bot",
    pronoun: "it",
    concept: "a tiny curious robot",
    look: "round chrome body, one big eye",
    personality: ["curious", "fast"],
    catchphrases: ["Okay but why?"],
    good_at: ["asking questions"],
    bad_at: ["sitting still"],
    voice: { provider: "kokoro", voice_id: "af_bella", speed: 1.1 },
    how_it_talks: "Short, quick sentences.",
    model: defaultModel("orb-bot-3d", { body: "#c8ced8", accent: "#ff5a3c" }),
  });
  createSeries(ws, slug, {
    slug: "inside",
    name: "Inside",
    format: "Fly into an object and take it apart",
    characters: ["bot"],
    length: { min_seconds: 20, max_seconds: 40 },
    hook_pattern: "A question about the object",
    beats: [
      { id: "hook", seconds: 3, purpose: "grab attention" },
      { id: "explain", seconds: 20, purpose: "show the parts" },
      { id: "payoff", seconds: 5, purpose: "answer the question" },
    ],
    visual_style: "low-poly 3D",
    skills: { script: "write-script", render: ["render-3d-explainer", "render-talking-character"], captions: "captions" },
  });
  const ideasPath = join(ws.channelDir(slug), "ideas.md");
  const { text } = renderIdeas(
    [
      { title: "A ballpoint pen", series: "inside", angle: "why doesn't it leak?" },
      { title: "A zipper", series: "inside" },
    ],
    [],
    "new",
    today(),
  );
  writeText(ideasPath, appendIdeaBlocks(readText(ideasPath), text));
  if (opts.status === "active") {
    const p = join(ws.channelDir(slug), "channel.md");
    writeFileSync(p, readText(p).replace("status: draft", "status: active"));
  }
}

export function sampleScript(channel: string, idea = "a-ballpoint-pen"): Script {
  return {
    schema: "script/v1",
    channel,
    series: "inside",
    idea,
    title: "Inside a pen",
    language: "en",
    beats: [
      { id: "hook", speaker: "bot", voiceover: "Why doesn't your pen leak?", on_screen_text: "Why no leaks?", visual: { skill: "render-3d-explainer", shot: "establish" }, character: { placement: "full", expression: "curious" } },
      { id: "explain", speaker: "bot", voiceover: "A tiny ball sits in the tip. It rolls ink onto paper and seals the tube when you stop. The ink is thick, so it waits for the ball. Gravity pulls the ink down toward the tip while you write. That is why most pens struggle upside down. A small hole lets air in behind the ink.", visual: { skill: "render-3d-explainer", shot: "explode", callouts: ["ball"] }, character: { placement: "corner", expression: "neutral" } },
      { id: "payoff", speaker: "bot", voiceover: "So the ball is the lid. Okay but why?", visual: { skill: "render-3d-explainer", shot: "focus", target: "ball", callouts: [] }, character: { placement: "full", expression: "excited" } },
    ],
    visuals: {
      "render-3d-explainer": {
        object: "pen",
        parts: [
          { id: "barrel", label: "Barrel", shape: "tube", radius: 0.5, inner_radius: 0.4, length: 14, position: [0, 0, 0], color: "#2244ff", material: "plastic", shell: true, explode: [0, 0, -2] },
          { id: "ball", label: "Ball", shape: "sphere", radius: 0.05, position: [0, -7.2, 0], color: "#cccccc", material: "metal", shell: false, explode: [0, -2, 0] },
        ],
      },
    },
    claims: [{ id: "c1", claim: "A ballpoint pen's tip holds a small metal ball.", beat: "explain", source: "https://example.org/ballpoint", confidence: "high" }],
    pronunciations: {},
    publish: { title: "Inside a pen", description: "Why pens don't leak.", hashtags: ["#howitworks"] },
  };
}
