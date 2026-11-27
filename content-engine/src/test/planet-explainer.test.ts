import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { beatVisualSchema, checkBeat, sceneSchema, viewText } from "../skills/render-planet-explainer/schema.ts";

describe("render-planet-explainer", () => {
  it("fills view defaults and lists every on-screen text for the fact-check", () => {
    const v = beatVisualSchema.parse({ skill: "render-planet-explainer", views: [{ view: "hero" }, { view: "tilt", at_word: 3, degrees: 26.7 }] });
    assert.equal(v.views[0].at_word, 0);
    assert.deepEqual(viewText(v.views[1]), ["26.7°", "Spin axis", "Orbit"]);
    const scene = sceneSchema.parse({ planet: { name: "Saturn", color: "#d8b77a" } });
    assert.equal(scene.stars, true);
    assert.deepEqual(scene.planet.bands, []);
  });

  it("checks view timing and cutaway layer order", () => {
    const bad = beatVisualSchema.parse({
      skill: "render-planet-explainer",
      views: [
        { view: "hero", at_word: 1 },
        { view: "cutaway", at_word: 9, layers: [{ label: "Core", color: "#553322", radius: 0.2 }, { label: "Gas", color: "#ddcc99", radius: 0.9 }] },
      ],
    });
    const problems = checkBeat(bad, "fact-1", "Split it open and look inside");
    assert.ok(problems.some((p) => /first view must start at word 0/.test(p)));
    assert.ok(problems.some((p) => /past the beat's last word/.test(p)));
    assert.ok(problems.some((p) => /outside to inside/.test(p)));
  });
});
