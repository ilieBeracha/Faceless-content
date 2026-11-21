import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { mixEpisodeAudio, musicPrompt, sfxCues } from "../audio/bed.ts";
import { measureLoudness, probe, runFfmpeg } from "../core/ffmpeg.ts";
import { sha256 } from "../core/util.ts";
import { tempWorkspace } from "./helpers.ts";

const lengths = { hit: 1.48, whoosh: 0.8, riser: 1.6 };

describe("music and effects under the voice", () => {
  it("puts the hit at the start, a whoosh centred on each cut and a riser into the last beat", () => {
    const cues = sfxCues([{ start: 0.1 }, { start: 3.12 }, { start: 8.12 }, { start: 15.12 }], lengths);
    assert.deepEqual(cues, [
      { name: "hit", at: 0 },
      { name: "whoosh", at: 2.6 }, // cut at 3.0 (0.12 s before the voice), whoosh 0.8 s centred on it
      { name: "whoosh", at: 7.6 },
      { name: "riser", at: 13.4 }, // ends on the last cut at 15.0
    ]);
  });

  it("uses whooshes only when there are fewer than three beats", () => {
    assert.deepEqual(sfxCues([{ start: 0.1 }, { start: 4.12 }], lengths).map((c) => c.name), ["hit", "whoosh"]);
    assert.deepEqual(sfxCues([{ start: 0.1 }], lengths).map((c) => c.name), ["hit"]);
  });

  it("asks for instrumental music that fits the channel and the topic", () => {
    const p = musicPrompt(["surprised", "playful"], "Bananas are berries");
    assert.match(p, /Feel: surprised, playful\. Topic: Bananas are berries\./);
    assert.match(p, /No vocals, no lyrics/);
  });

  it("mixes music and effects into a stereo file at the platform loudness, leaving voice.wav as it was", () => {
    const ws = tempWorkspace();
    const dir = join(ws.root, "ep");
    mkdirSync(join(dir, "audio"), { recursive: true });
    const voice = join(dir, "audio", "voice.wav");
    const music = join(dir, "audio", "music.m4a");
    // A stand-in voice: a tone that speaks for 1 s, pauses 0.5 s, speaks again; and a stand-in music track.
    runFfmpeg(["-y", "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=48000:duration=6", "-af", "volume='if(between(t,1,1.5),0,1)':eval=frame", "-ac", "1", "-c:a", "pcm_s16le", voice], "test voice");
    runFfmpeg(["-y", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=8", "-ac", "2", "-c:a", "aac", music], "test music");
    const before = sha256(readFileSync(voice));
    const out = mixEpisodeAudio(ws, dir, voice, music, [{ start: 0.1 }, { start: 2.12 }, { start: 4.12 }], 6);
    assert.equal(sha256(readFileSync(voice)), before);
    const p = probe(out);
    assert.ok(Math.abs(p.duration - 6) < 0.05, `mix lasts ${p.duration}s`);
    const stream = runFfmpeg(["-i", out, "-f", "null", "-"], "read mix");
    assert.match(stream, /stereo/);
    const loud = measureLoudness(out);
    assert.ok(Math.abs(loud.integratedLufs - ws.config.audio.target_lufs) <= ws.config.audio.lufs_tolerance, `${loud.integratedLufs} LUFS`);
    assert.ok(loud.truePeakDb <= ws.config.audio.true_peak_max_db + 0.3, `${loud.truePeakDb} dBTP`);
  });
});
