import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkCharacterModel, parseCharacterModel, RIG_NAMES } from "../skills/render-talking-character/rigs.ts";

describe("character rigs: pixel-sprite and neon-line", () => {
  const expressions = { neutral: {} };

  it("are listed, and accept a minimal model with the defaults filled in", () => {
    assert.ok(RIG_NAMES.includes("pixel-sprite") && RIG_NAMES.includes("neon-line"));
    const sprite = parseCharacterModel({ rig: "pixel-sprite", params: { body: "#ff6b2c", accent: "#ffe14a" }, expressions });
    assert.ok(sprite.rig === "pixel-sprite" && sprite.params.feature === "none" && sprite.params.outline === "#1a0f1f");
    const neon = parseCharacterModel({ rig: "neon-line", params: { line: "#ff3d9a", glow: "#27e0ff" }, expressions });
    assert.ok(neon.rig === "neon-line" && neon.params.shape === "hex" && neon.params.backing === "#0d0b1e");
  });

  it("reject an unknown feature, a bad colour, a missing neutral expression", () => {
    assert.match(checkCharacterModel({ rig: "pixel-sprite", params: { body: "#ff6b2c", accent: "#ffe14a", feature: "wings" }, expressions })[0], /feature/);
    assert.match(checkCharacterModel({ rig: "neon-line", params: { line: "pink", glow: "#27e0ff" }, expressions })[0], /line/);
    assert.match(checkCharacterModel({ rig: "neon-line", params: { line: "#ff3d9a", glow: "#27e0ff" }, expressions: { happy: {} } })[0], /neutral/);
  });
});
