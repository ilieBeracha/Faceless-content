# QA report — The first computer bug was a real moth

**Status: PASS** · episode `2026-11-14-first-computer-bug-moth` · channel `no-way-really` · series `wait-what` · 2026-11-14

Checklist: `workflows/qa.md`. Video: `out/no-way-really/2026-11-14-first-computer-bug-moth.mp4` (not in git).

## Automated checks

| | Check | Result |
|---|---|---|
| ✅ | Format | 1080×1920 @ 30.00 fps, h264/aac, yuvj420p |
| ✅ | Length | 34.41s (series allows 20–35s) |
| ✅ | Hook: speech starts immediately | first word at 0.16s (limit 0.5s) |
| ✅ | Hook: first line lands in 2 s | "A real moth jammed a computer." ends at 2.00s (limit 2s) |
| ✅ | Hook: on-screen text | visible from 0.17s |
| ✅ | Text inside safe areas | 12 text elements checked on every frame (3702 measurements) |
| ✅ | Nothing cut off | no element leaves the frame or overflows its box |
| ✅ | Captions in sync | 91 words; text matches script: yes; highlight off on 0/1002 frames; words over silent audio: 0 |
| ✅ | Loudness | -14.4 LUFS (target -14 ±1.5), true peak -5.1 dBTP (max -1) |
| ✅ | Banned topics (keyword screen) | none of 6 banned topics mentioned |
| ✅ | Fact-check approved | approved by ilieBeracha (5 claims) |

## Agent review

| | Area | Notes |
|---|---|---|
| ✅ | tone | Opens on the fact with no warm-up, asks "Okay, but why write it down?" and answers it, ends on the catchphrase. Surprised, playful and quick; no call to action. Honest: it says the word "bug" is older than the moth instead of claiming the moth invented it. |
| ✅ | banned topics | A piece of computing history. No politics, war, crime, advice, gore or copyable stunts. The popular myth (that the moth is where the word comes from) is corrected on screen, not repeated. Edison and Harvard are named as historical facts, not used as characters. |
| ✅ | visuals | Reviewed the 8 sampled frames plus 10 more across all beats. Deep purple grid background, headline box on the hook, fact cards and a two-point timeline, as the series promises. All text is readable and inside the frame after two fixes from the first render (hook title lg -> md because it was cut off; timeline end labels moved inside the safe area in the renderer). Known blemish: in the why beat the timeline and the quote card are stacked, and the top of Blink's head touches the bottom edge of the card. Not hiding any text, so passed. The bottom third of the frame is empty by design (platform safe area). |
| ✅ | character | Blink is on-model: mint-green egg blob, dark outline, round glasses, pink cheeks, sparkles. Full size and wide-eyed on the hook, lower-left corner afterwards, mouth open on spoken frames, expressions change per beat. Judged from frames only; the audio was not listened to, so how the Kokoro af_bella voice says "Mark II" and the years is checked only through the caption-sync and pronunciation settings. |


## Sampled frames

- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t000.5s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t001.5s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t004.8s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t009.7s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t014.5s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t019.3s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t024.2s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t029.0s.jpg`
