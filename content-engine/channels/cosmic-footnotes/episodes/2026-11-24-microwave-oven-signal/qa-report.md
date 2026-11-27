# QA report — Lunch fooled a telescope

**Status: FAIL** · episode `2026-11-24-microwave-oven-signal` · channel `cosmic-footnotes` · series `tiny-clue-big-deal` · 2026-11-25

Checklist: `workflows/qa.md`. Video: `out/cosmic-footnotes/2026-11-24-microwave-oven-signal.mp4` (not in git).

## Automated checks

| | Check | Result |
|---|---|---|
| ✅ | Format | 1080×1920 @ 30.00 fps, h264/aac, yuvj420p |
| ✅ | Length | 50.88s (series allows 40–58s) |
| ✅ | Hook: speech starts immediately | first word at 0.10s (limit 0.5s) |
| ✅ | Hook: first line lands in 2 s | "Lunch fooled a telescope." ends at 1.77s (limit 2s) |
| ✅ | Hook: captions on screen | visible from 0.17s |
| ✅ | Text inside safe areas | 2 text elements checked on every frame (3017 measurements) |
| ✅ | Nothing cut off | no element leaves the frame or overflows its box |
| ✅ | Captions in sync | 151 words; text matches script: yes; highlight off on 0/1496 frames; words over silent audio: 0 |
| ✅ | Loudness | -14.0 LUFS (target -14 ±1.5), true peak -2.0 dBTP (max -1) |
| ✅ | Banned topics (keyword screen) | none of 6 banned topics mentioned |
| ✅ | Fact-check approved | approved by ilieBeracha (11 claims) |

## Agent review

| | Area | Notes |
|---|---|---|
| ✅ | tone | Curious, warm and plain throughout: short sentences, contractions, real names and years where they help, no hype words. Fits a 13+ audience and Ori's 'friend telling you the best part of a documentary' voice. The kicker's wordplay is on-brand in tone; its problem is structural (see point), not tonal. |
| ✅ | banned topics | Keyword screen clean and I agree: no aliens-as-fact (fast radio bursts are framed as real astrophysical flashes, not messages), no disasters, health advice, politics or religion. One thing to watch: the room scenes (story s2-s3, point s1, kicker) have a wall picture of a red disc on a pale field that reads as the Japanese flag. Not a banned topic, but a national flag in an Australian observatory kitchen is a stray real-world symbol with no reason to be there. |
| ❌ | visuals | Storybook style is as promised: square watercolour picture under the two-tone 'LUNCH FOOLED A TELESCOPE' title bar, night-blue frame, one-word gold captions, Ori in every scene, a new picture per sentence; '17 years', 'LUNCH?', '3' and 'Beep!' lettering is clean, no scribbles, nothing cut off. But the object the whole story is about never reads: (1) story s2/s3, point s1 and kicker draw the microwave oven as a plain closed brown cardboard box on a table; nothing (door, window, dial, glow) says microwave, so the reveal 'The perytons were microwave ovens' (~36 s) is shown as a box. (2) Story s4 (~31 s, 'opened a microwave'): the box sits under the second figure, who appears to stand on it, so the 'microwave' becomes a pedestal; no oven is opened. (3) Kicker (~45-51 s): a 'Beep!' speech bubble pops from the window while Ori says the person 'wouldn't wait for the beep' - the picture shows the beep that the line says never happened, and the box is half-hidden behind the second figure. (4) Story s1 (~21 s, 'a new monitor at Parkes'): Ori holds a phone showing a map pin, which reads as GPS/navigation, not an interference monitor. (5) Story s3 (~28 s): Ori's 'sit' pose has no chair, so she floats in mid-air. Minor: the 'other galaxies' line (point s3, ~43 s) shows a ringed planet and the Moon, i.e. our own solar system. |
| ✅ | character | Ori is on-model in every sampled frame: round pale head, dot eyes, dark bun inside the clear bubble helmet, navy tunic, stick limbs, wobbly ink line. Expressions fit the lines (surprised at '3', amused shrug at the reveal, excited look-up at the end). Mouth opens on speech frames; full lip-sync can't be judged from stills. The floating 'sit' pose is logged under visuals. Catchphrase 'Here's the footnote' used once, sparingly, as the file asks. |
| ❌ | point | The middle works: stakes are set plainly in the clue beat (perytons looked like fast radio bursts, so the bursts Petroff hunted might be local noise too), the turn is told in order (new monitor, oven-frequency signal, lunchtime, the deliberate early-opening test), and the point beat ends on what happened (perytons were ovens; FRBs come at any hour; Petroff went on to track real bursts to other galaxies). Three problems keep it from passing. (1) The ending (kicker, 'Here's the footnote: the clue was someone who wouldn't wait for the beep.') replaces the true last event with a clever pun, which the brief rules out, and it hands the credit to the anonymous impatient lunch-heater instead of the person who refused to ignore the blip. The Belief is 'small things somebody refused to ignore', but the last line says the clue was impatience, so the story closes arguing a different point from its angle. It isn't preachy (no advice, no moral to the viewer); it fails on 'clever dramatic line' and on not ending on what happened. (2) Point beat: 'the team showed the first one couldn't have come from an oven' - 'the first one' (the first fast radio burst ever found) was never introduced, and right after 'The perytons were microwave ovens' a viewer will read it as the first peryton, which contradicts the sentence before. (3) Story beat: after the clue beat sets up Petroff as the one who 'had to know', the whole investigation is credited to 'a new monitor' and 'the team'; she is absent from her own turn, so the person with stakes doesn't visibly do the not-ignoring. Minor: in the hook, 'For seventeen years ... kept catching' overstates the continuity (the archival perytons are 1998-2002); fact-check approved it, so only a note. |

**Fixes requested:**
- kicker: replace the pun with a plain last beat that ends on what happened and keeps Petroff at the centre, e.g. a line that ties back to the hook as fact: the blip that looked like a lunch break was, and the bursts that didn't come at lunchtime were real. No wordplay, no 'the clue was someone who...'. Any changed words need a new fact-check approval.
- kicker visual: remove the 'Beep!' speech bubble (it shows the beep the line says never came), or, with the new line, show the oven door open and the dish reacting.
- point: introduce the first fast radio burst before referring to it, e.g. 'the very first fast radio burst, found back in 2001, came from much farther than the kitchen' style wording, so 'the first one' can't be read as the first peryton (re-check claim c9 against the new words).
- story: put Petroff in the turn - say she (with the team) checked the new monitor and ran the oven test, so the person who 'had to know' is the one who finds out.
- visuals (story s2/s3/s4, point s1, kicker): draw the microwave as a microwave (a box with a door window and a dial/keypad, door open in the test scene), not a plain brown box; in story s4 move the box off the second figure's feet so nobody stands on it.
- visuals (story s1): swap the phone-with-map-pin for a monitor/screen showing a blip; the map pin reads as GPS.
- visuals (story s3): give Ori something to sit on or use a standing pose; she currently floats.
- visuals (room scenes): replace the red-disc wall picture that reads as the Japanese flag with a neutral picture.

## Sampled frames

- `channels/cosmic-footnotes/episodes/2026-11-24-microwave-oven-signal/qa/frames/t000.5s.jpg`
- `channels/cosmic-footnotes/episodes/2026-11-24-microwave-oven-signal/qa/frames/t001.5s.jpg`
- `channels/cosmic-footnotes/episodes/2026-11-24-microwave-oven-signal/qa/frames/t007.2s.jpg`
- `channels/cosmic-footnotes/episodes/2026-11-24-microwave-oven-signal/qa/frames/t014.4s.jpg`
- `channels/cosmic-footnotes/episodes/2026-11-24-microwave-oven-signal/qa/frames/t021.5s.jpg`
- `channels/cosmic-footnotes/episodes/2026-11-24-microwave-oven-signal/qa/frames/t028.7s.jpg`
- `channels/cosmic-footnotes/episodes/2026-11-24-microwave-oven-signal/qa/frames/t035.9s.jpg`
- `channels/cosmic-footnotes/episodes/2026-11-24-microwave-oven-signal/qa/frames/t043.1s.jpg`
