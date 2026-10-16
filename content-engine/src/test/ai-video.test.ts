import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkAiBeat, maxWordsPerShot, type AiBeatVisual } from "../skills/render-ai-video/schema.ts";
import { estimateClips, shotPrompts, spent, withPronoun, type Ledger, type PlannedShot } from "../skills/render-ai-video/footage.ts";
import { tempWorkspace } from "./helpers.ts";

const shot = (line: string) => ({ camera: "selfie" as const, place: "a marble hall with columns and a pool", action: "talking", line });

describe("render-ai-video", () => {
  it("shot lines must add up to the voiceover and fit in one clip", () => {
    const max = maxWordsPerShot([4, 6, 8], 2.6);
    assert.equal(max, 18);
    const good: AiBeatVisual = { skill: "render-ai-video", shots: [shot("This is the cold room."), shot("It is huge.")] };
    assert.deepEqual(checkAiBeat(good, "tour", "This is the cold room. It is huge.", max), []);
    const missing = checkAiBeat(good, "tour", "This is the cold room. It is huge. Really.", max);
    assert.ok(missing.some((p) => /must be exactly the voiceover/.test(p)), missing.join("\n"));
    const long = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen";
    const tooLong = checkAiBeat({ skill: "render-ai-video", shots: [shot(long)] }, "tour", long, max);
    assert.ok(tooLong.some((p) => /a clip holds at most 18/.test(p)), tooLong.join("\n"));
    const quoted = checkAiBeat({ skill: "render-ai-video", shots: [shot('She said "hi".')] }, "tour", 'She said "hi".', max);
    assert.ok(quoted.some((p) => /double quotes/.test(p)));
  });

  it("prompts follow the character's pronoun", () => {
    assert.equal(withPronoun("{She} {is} smiling at {her} phone; {she} waves.", "she"), "She is smiling at her phone; she waves.");
    assert.equal(withPronoun("{She} {is} smiling at {her} phone.", "they"), "They are smiling at their phone.");
    assert.equal(withPronoun("{She} {is} smiling at {her} phone.", "he"), "He is smiling at his phone.");
  });

  it("estimates clip cost from the configured rate and ignores placeholder spend", () => {
    const ws = tempWorkspace();
    const plan = [{ seconds: 8 }, { seconds: 4 }] as PlannedShot[];
    const est = estimateClips(ws, plan);
    const rate = ws.config.ai_video.rates_usd.video_per_second[ws.config.ai_video.video_model];
    assert.equal(est.seconds, 12);
    assert.equal(est.usd, Math.round((12 * rate + 2 * ws.config.ai_video.rates_usd.check) * 100) / 100);
    const ledger: Ledger = {
      budget_usd: 25,
      budget_changes: [],
      entries: [
        { at: "", shot: "a", kind: "video", model: "m", usd: 0.8, ok: true },
        { at: "", shot: "b", kind: "video", model: "m", usd: 0.8, ok: true, fake: true },
        { at: "", shot: "c", kind: "image", model: "m", usd: 0.039, ok: false },
      ],
    };
    assert.equal(spent(ledger), 0.84);
  });

  it("pov shots film the place and keep the character off screen", () => {
    const world = { world: "Rome, AD 216, the Baths of Caracalla", look: "handheld phone footage", grade: "natural" as const, score: "none" as const };
    const params = { identity: "a fictional woman in her late twenties with dark curly hair and freckles", wardrobe: "a red cap", voice: "a bright London voice", fictional: true as const, references: ["references/ref-1.jpg"] };
    const pov = shotPrompts(world, params, { camera: "pov", place: "a vast cold hall with a pool", action: "tilts up to the vaulted ceiling", line: "Look at this." }, "excited", "Look at this.");
    assert.equal(pov.onCamera, false);
    assert.ok(!pov.imagePrompt.includes(params.identity), "the still must not describe the character");
    assert.match(pov.videoPrompt, /never seen/);
    assert.match(pov.videoPrompt, /Off screen.*"Look at this\."/);
    const selfie = shotPrompts(world, params, { camera: "selfie", place: "a vast cold hall with a pool", action: "grinning", line: "Look at this." }, "excited", "Look at this.");
    assert.equal(selfie.onCamera, true);
    assert.ok(selfie.imagePrompt.includes(params.identity));
  });

  it("cinematic cameras read as film; a silhouette narrates from behind", () => {
    const world = { world: "Saturn from orbit", look: "cinematic", grade: "cinematic" as const, score: "space-drone" as const };
    const params = { identity: "a fictional woman in her late twenties with dark curly hair and freckles", wardrobe: "a mustard flight suit", voice: "a bright London voice", fictional: true as const, references: ["references/ref-1.jpg"] };
    const close = shotPrompts(world, params, { camera: "closeup", place: "a cabin", action: "smiling", line: "Hi." }, "excited", "Hi.");
    assert.equal(close.onCamera, true);
    assert.match(close.imagePrompt, /frame from a film/);
    assert.match(close.videoPrompt, /live-action film footage/);
    const back = shotPrompts(world, params, { camera: "silhouette", place: "a giant window onto Saturn", action: "slowly pushes in", line: "Look." }, "excited", "Look.");
    assert.equal(back.onCamera, false);
    assert.ok(!back.imagePrompt.includes(params.identity), "a silhouette never describes the face");
    assert.match(back.imagePrompt, /mustard flight suit/);
    assert.match(back.videoPrompt, /voice-over.*"Look\."/);
  });
});

