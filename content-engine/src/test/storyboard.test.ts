import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { readJson, writeJson } from "../core/util.ts";
import { ENGINE_DIR } from "../core/workspace.ts";
import { approveStoryboard, episodePace, newStoryboard, readStoryboard, setCaptions, setPace, storyboardApproved, type CaptionSettings } from "../pipeline/storyboard.ts";
import { checkShots, parseTheme, showsHost } from "../skills/render-themed/schema.ts";
import type { Script } from "../skills/write-script/schema.ts";
import { CustomerError, parseBeatForm, parseCaptionForm, pausedEpisode } from "../storefront/builder.ts";
import { loadChannel } from "../core/channels.ts";
import { episodesDir } from "../pipeline/episode.ts";
import { NO_HOST, OWN_LOOK, loadCatalog } from "../storefront/catalog.ts";
import { validateIntake } from "../storefront/store.ts";
import { makeChannel, tempWorkspace } from "./helpers.ts";

const world = { description: "A very simple cartoon town: flat shapes, thick black outlines." };
const look = (w: Record<string, unknown>) => parseTheme({ ...readJson<Record<string, unknown>>(join(ENGINE_DIR, "themes", "blueprint.json")), world: w }, "t.json");
const beat = (id: string, voiceover: string, shots: unknown[]) => ({ id, voiceover, visual: { skill: "render-themed", shots } });
const CAPTIONS: CaptionSettings = { show: true, size: "medium", place: "bottom", case: "normal", hide_beats: [] };

describe("render-themed: the host in painted shots", () => {
  it("puts the host in a shot by its words or by saying so, and keeps the two from contradicting each other", () => {
    assert.equal(showsHost({ show: "The host waves at a goose" }), true);
    assert.equal(showsHost({ show: "A goose at a desk" }), false);
    assert.equal(showsHost({ show: "A goose at a desk", host: true }), true);
    const theme = look(world);
    assert.deepEqual(checkShots([beat("a", "Hi there.", [{ show: "A goose at a desk", host: true }])], theme), []);
    assert.match(checkShots([beat("a", "Hi there.", [{ show: "The host waves at a goose", host: false }])], theme)[0], /leaves the host out, but its words say "the host"/);
  });

  it("lets a channel have no host on screen, and then no shot may show one", () => {
    const hostless = look({ ...world, host: false });
    assert.deepEqual(checkShots([beat("a", "Hi there.", [{ show: "A goose at a desk" }])], hostless), []);
    assert.match(checkShots([beat("a", "Hi there.", [{ show: "The host waves at a goose" }])], hostless)[0], /no host on screen/);
    assert.match(checkShots([beat("a", "Hi there.", [{ show: "A goose at a desk", host: true }])], hostless)[0], /no host on screen/);
    assert.equal(look(world).world?.host, undefined, "a world without the setting has a host, as before");
  });

  it("makes the host the main character only when the channel asks for it: then every beat shows the host in a shot", () => {
    const story = [beat("a", "Hi there.", [{ show: "The host waves at a goose" }]), beat("b", "Geese are loud.", [{ show: "A goose honks at a desk" }])];
    assert.deepEqual(checkShots(story, look(world)), [], "without the setting, a beat may tell the story alone");
    const lead = look({ ...world, host_lead: true });
    assert.deepEqual(checkShots(story, lead).map((e) => e.replace(/:.*/, "")), ['beat "b"']);
    assert.match(checkShots(story, lead)[0], /main character, so at least one of the beat's shots shows the host/);
    assert.deepEqual(checkShots([story[0], beat("b", "Geese are loud.", [{ show: "A goose honks at a desk" }, { at: "loud.", show: "A goose honks at a desk again", host: true }])], lead), []);
    assert.throws(() => look({ ...world, host: false, host_lead: true }), /host_lead needs a host on screen/);
  });
});

describe("storyboard: approved as it was seen", () => {
  const script = { beats: [{ ...beat("a", "Hi there.", [{ show: "A goose at a desk" }]), on_screen_text: "Hi", character: { placement: "corner", expression: "neutral" } }] } as unknown as Script;
  const episode = () => {
    const dir = tempWorkspace().path("channels", "x", "episodes", "e1");
    mkdirSync(join(dir, "shots"), { recursive: true });
    writeFileSync(join(dir, "shots", "a-1.jpg"), "picture one");
    writeFileSync(join(dir, "storyboard.json"), JSON.stringify(newStoryboard(CAPTIONS)));
    return dir;
  };

  it("is approved under the person's name, and needs approving again when a picture, a shot or the captions change", () => {
    const dir = episode();
    assert.equal(storyboardApproved(dir, script), false);
    assert.throws(() => approveStoryboard(dir, script, " "), /Say who is approving/);
    approveStoryboard(dir, script, "Sam Example");
    assert.deepEqual([readStoryboard(dir)?.status, readStoryboard(dir)?.approved_by], ["approved", "Sam Example"]);
    assert.equal(storyboardApproved(dir, script), true);

    writeFileSync(join(dir, "shots", "a-1.jpg"), "picture two");
    assert.equal(storyboardApproved(dir, script), false, "a repainted picture was not seen");
    writeFileSync(join(dir, "shots", "a-1.jpg"), "picture one");
    assert.equal(storyboardApproved(dir, script), true);
    const moved = { beats: [{ ...script.beats[0], on_screen_text: "Hello" }] } as unknown as Script;
    assert.equal(storyboardApproved(dir, moved), false, "changed on-screen text was not seen");

    setCaptions(dir, script, { ...CAPTIONS, show: false });
    assert.deepEqual([readStoryboard(dir)?.status, readStoryboard(dir)?.captions.show], ["pending", false]);
    assert.equal(storyboardApproved(dir, script), false);
  });

  it("a changed speaking speed must be approved again, and the same speed changes nothing", () => {
    const dir = episode();
    approveStoryboard(dir, script, "Sam Example");
    assert.equal(episodePace(dir), 1);
    setPace(dir, "normal");
    assert.equal(storyboardApproved(dir, script), true, "normal is what it already was");
    setPace(dir, "faster");
    assert.deepEqual([readStoryboard(dir)?.status, readStoryboard(dir)?.pace, episodePace(dir)], ["pending", "faster", 1.1]);
    approveStoryboard(dir, script, "Sam Example");
    assert.equal(storyboardApproved(dir, script), true);
    // Captions keep the speed; going back to normal is a change again.
    setCaptions(dir, script, { ...CAPTIONS, show: false });
    assert.equal(readStoryboard(dir)?.pace, "faster");
    approveStoryboard(dir, script, "Sam Example");
    setPace(dir, "normal");
    assert.deepEqual([readStoryboard(dir)?.status, readStoryboard(dir)?.pace, episodePace(dir)], ["pending", undefined, 1]);
  });

  it("refuses captions hidden on a part the video doesn't have, and a shot without its picture", () => {
    const dir = episode();
    assert.throws(() => setCaptions(dir, script, { ...CAPTIONS, hide_beats: ["nope"] }), /"nope", which is not a beat/);
    const more = { beats: [script.beats[0], { ...beat("b", "Bye now.", [{ show: "A goose leaves the room" }]), character: { placement: "corner", expression: "neutral" } }] } as unknown as Script;
    assert.throws(() => approveStoryboard(dir, more, "Sam Example"), /Shot "b-1" has no painted picture/);
  });
});

describe("storefront: storyboard forms", () => {
  it("reads a part's shots in order, drops removed and empty ones, and asks for the word a later shot cuts in on", () => {
    const edit = parseBeatForm({ show_1: "A goose at the front desk", host_1: "on", show_2: "  A duck   in the lobby ", remove_2: "on", show_3: "A swan by the lift doors", at_3: "swan" }, true);
    assert.deepEqual(edit, { shots: [{ show: "A goose at the front desk", host: true }, { show: "A swan by the lift doors", host: false, at: "swan" }] });
    assert.equal(parseBeatForm({ show_1: "A goose at the front desk", host_1: "on" }, false).shots[0].host, false, "no host on screen: no shot gets one");
    assert.throws(() => parseBeatForm({ show_1: "A goose at the front desk", show_2: "A duck in the lobby" }, true), (e: Error) => e instanceof CustomerError && /shot 2 cuts in on/.test(e.message));
    assert.throws(() => parseBeatForm({ show_1: "Goose" }, true), /10 to 500 characters/);
    assert.throws(() => parseBeatForm({ show_1: "A goose at the front desk", remove_1: "on" }, true), /at least one shot/);
  });

  it("reads caption settings, the own colour only when asked for, and parts without captions", () => {
    assert.deepEqual(parseCaptionForm({ show: "on", size: "small", place: "middle", case: "upper", color: "#123456", hide_intro: "on" }), { show: true, size: "small", place: "middle", case: "upper", hide_beats: ["intro"] });
    assert.deepEqual(parseCaptionForm({ size: "large", place: "bottom", case: "normal", own_color: "on", color: "#ABCDEF" }), { show: false, size: "large", place: "bottom", case: "normal", color: "#ABCDEF", hide_beats: [] });
    assert.throws(() => parseCaptionForm({ show: "on", size: "large", place: "bottom", case: "normal", own_color: "on", color: "red" }), /hex colour/);
  });
});

describe("storefront: the episode a new video is at", () => {
  it("is the one made for its idea, not an earlier unfinished one that sorts after it", () => {
    const ws = tempWorkspace();
    makeChannel(ws, "wines");
    const episode = (id: string, idea: string) =>
      writeJson(join(episodesDir(loadChannel(ws, "wines")), id, "episode.json"), { id, channel: "wines", series: "inside", idea, title: idea, created: "2026-11-18T10:00:00.000Z", updated: "2026-11-18T10:00:00.000Z", status: "in-progress", steps: {} });
    episode("2026-11-18-wine-legs", "wine-legs"); // an earlier video that failed and was left unfinished
    episode("2026-11-18-screw-caps", "screw-caps");
    assert.equal(pausedEpisode(ws, "wines", "inside", { idea: "screw-caps" }), "2026-11-18-screw-caps");
    assert.equal(pausedEpisode(ws, "wines", "inside", {}), "2026-11-18-wine-legs", "the first video names no idea: the latest unfinished one");
    assert.throws(() => pausedEpisode(ws, "wines", "inside", { idea: "corks" }), /no unfinished episode for idea "corks"/);
  });
});

describe("storefront: a channel without a host", () => {
  const OFFER = loadCatalog(ENGINE_DIR);
  const GOOD = { contact_name: "Sam Example", email: "sam@example.com", idea: "How bridges stay up", audience: "Curious adults", tone: "calm, clear", look: "Blueprint", look_note: "", avatar: NO_HOST, host: "", avoid: "" };

  it("is offered with a painted look: no host design, and the world says so", () => {
    const r = validateIntake({ ...GOOD, h_rig: "orb-bot-3d" }, OFFER);
    assert.ok(r.design, JSON.stringify(r.errors));
    assert.equal(r.design.model, null, "no host is designed, even if the designer's fields came along");
    assert.equal(r.design.theme?.world?.host, false);
  });

  it("is refused without a painted look", () => {
    const r = validateIntake({ ...GOOD, look: OWN_LOOK, look_note: "Bright and bold" }, OFFER);
    assert.match(r.errors?.avatar ?? "", /needs one of the painted looks/);
  });
});
