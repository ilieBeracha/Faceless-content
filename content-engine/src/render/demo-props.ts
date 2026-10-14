/**
 * Neutral demo props (not any channel's content) for Remotion Studio and `./engine doctor`, which
 * renders a few stills to prove the 3D, motion-graphics, character and caption skills work.
 */
import type { Script } from "../skills/write-script/schema.ts";
import type { EpisodeProps, TimedBeat, TimedWord } from "./types.ts";

const script: Script = {
  schema: "script/v1",
  channel: "demo",
  series: "demo",
  idea: "demo",
  title: "Engine demo",
  language: "en",
  beats: [
    { id: "hook", speaker: "demo-bot", voiceover: "What is inside a flashlight?", on_screen_text: "What's inside?", visual: { skill: "render-3d-explainer", shot: "establish", callouts: [] }, character: { placement: "full", expression: "curious" } },
    { id: "inside", speaker: "demo-bot", voiceover: "Batteries push current through a spring and a switch.", visual: { skill: "render-3d-explainer", shot: "explode", callouts: ["battery", "spring"] }, character: { placement: "corner", expression: "neutral" } },
    { id: "light", speaker: "demo-bot", voiceover: "Then the LED turns it into light.", visual: { skill: "render-3d-explainer", shot: "focus", target: "led", callouts: ["led", "lens"] }, character: { placement: "corner", expression: "excited" } },
    { id: "numbers", speaker: "demo-bot", voiceover: "That is the whole trick.", on_screen_text: "Demo panel", visual: { skill: "render-motion-graphics", elements: [{ type: "counter", from: 0, to: 3, decimals: 0, prefix: "", suffix: "parts", label: "do the work" }] }, character: { placement: "corner", expression: "neutral" } },
  ],
  visuals: {
    "render-3d-explainer": {
      object: "flashlight",
      parts: [
        { id: "body", label: "Body", shape: "tube", radius: 1.6, inner_radius: 1.35, length: 12, position: [0, 0, 0], color: "#3d5afe", material: "metal", shell: true, explode: [0, 0, -4] },
        { id: "battery", label: "Battery", note: "stores energy", shape: "cylinder", radius: 1.2, length: 5, position: [0, -2.5, 0], color: "#ffb300", material: "metal", shell: false, explode: [-3.2, -1, 0] },
        { id: "spring", label: "Spring", shape: "spring", radius: 0.9, length: 1.6, turns: 6, wire: 0.12, position: [0, -5.6, 0], color: "#cfd8dc", material: "metal", shell: false, explode: [0, -4, 0] },
        { id: "switch", label: "Switch", shape: "box", width: 1, height: 1.6, depth: 0.8, position: [1.7, 1.5, 0], color: "#212121", material: "rubber", shell: false, explode: [3.5, 0, 0] },
        { id: "led", label: "LED", note: "makes the light", shape: "sphere", radius: 0.6, position: [0, 4.6, 0], color: "#fff59d", material: "glass", shell: false, explode: [0, 4.5, 0] },
        { id: "lens", label: "Lens", shape: "disc", radius: 1.55, length: 0.3, position: [0, 6.1, 0], color: "#b3e5fc", material: "glass", shell: false, explode: [0, 7.5, 0] },
      ],
    },
  },
  claims: [],
  pronunciations: {},
  publish: { title: "Engine demo", description: "Demo", hashtags: [] },
};

function timedWords(): { words: TimedWord[]; beats: TimedBeat[] } {
  const words: TimedWord[] = [];
  const beats: TimedBeat[] = [];
  let t = 0.1;
  for (const beat of script.beats) {
    const start = t;
    for (const text of beat.voiceover.split(" ")) {
      words.push({ i: words.length, beat: beat.id, text, start: t, end: t + 0.28 });
      t += 0.34;
    }
    beats.push({ id: beat.id, speaker: beat.speaker, start, end: t });
    t += 0.5;
  }
  return { words, beats };
}

const { words, beats } = timedWords();
const fps = 30;
const durationInFrames = Math.ceil((beats[beats.length - 1].end + 0.8) * fps);

export const demoProps: EpisodeProps = {
  width: 1080,
  height: 1920,
  fps,
  durationInFrames,
  safeArea: { top: 250, bottom: 440, left: 60, right: 150 },
  brand: { primary_color: "#3d5afe", accent_color: "#ffb300", background: ["#0d1b2a", "#1b263b"], text_color: "#ffffff", font: "montserrat", caption_case: "normal" },
  script,
  words,
  beats,
  envelope: Array.from({ length: durationInFrames }, (_, f) => {
    const t = f / fps;
    const speaking = words.some((w) => t >= w.start && t <= w.end);
    return speaking ? 0.55 + 0.4 * Math.abs(Math.sin(t * 17)) : 0;
  }),
  characters: {
    "demo-bot": {
      name: "demo-bot",
      display_name: "Demo Bot",
      model: {
        rig: "orb-bot-3d",
        params: {
          body: { shape: "sphere", color: "#c8ced8", metalness: 1, roughness: 0.2, facets: 24 },
          eye: { count: 1, size: 0.42, sclera: "#f5f8fc", iris: "#29d3ff", pupil: "#0a0e14", glow: 0.7 },
          mouth: { style: "led-bar", color: "#29d3ff", width: 0.34 },
          antenna: { enabled: true, color: "#9aa3b0", tip: "#ff5a3c", length: 0.45 },
          accent: "#ff5a3c",
          arms: "stubs",
          hover: 0.05,
        },
        expressions: {
          neutral: { eye_scale: 1, pupil_scale: 1, lid: 0, tilt_deg: 0, look: [0, 0], bounce: 0.3, brow: "flat", mouth_curve: 0.2, glow: 1 },
          curious: { eye_scale: 1.1, pupil_scale: 1.1, lid: 0, tilt_deg: 10, look: [0.3, 0.2], bounce: 0.4, brow: "up", mouth_curve: 0.2, glow: 1.1 },
          excited: { eye_scale: 1.15, pupil_scale: 0.9, lid: 0, tilt_deg: -6, look: [0, 0], bounce: 0.8, brow: "up", mouth_curve: 0.6, glow: 1.4 },
        },
      },
    },
  },
  renderSkills: ["render-3d-explainer", "render-motion-graphics", "render-talking-character"],
  captionsSkill: "captions",
  captionStyle: "pages",
  audioFile: null,
  showSafeAreas: false,
  qaProbe: false,
};
