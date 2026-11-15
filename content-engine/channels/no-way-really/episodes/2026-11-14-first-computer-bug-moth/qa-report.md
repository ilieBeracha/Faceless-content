# QA report — The first computer bug was a real moth

**Status: PASS** · episode `2026-11-14-first-computer-bug-moth` · channel `no-way-really` · series `wait-what` · 2026-11-15

Checklist: `workflows/qa.md`. Video: `out/no-way-really/2026-11-14-first-computer-bug-moth.mp4` (not in git).

## Automated checks

| | Check | Result |
|---|---|---|
| ✅ | Format | 1080×1920 @ 30.00 fps, h264/aac, yuvj420p |
| ✅ | Length | 34.41s (series allows 20–35s) |
| ✅ | Hook: speech starts immediately | first word at 0.16s (limit 0.5s) |
| ✅ | Hook: first line lands in 2 s | "A real moth jammed a computer." ends at 2.00s (limit 2s) |
| ✅ | Hook: on-screen text | visible from 0.33s |
| ✅ | Text inside safe areas | 13 text elements checked on every frame (3631 measurements) |
| ✅ | Nothing cut off | no element leaves the frame or overflows its box |
| ✅ | Captions in sync | 91 words; text matches script: yes; highlight off on 0/1002 frames; words over silent audio: 0 |
| ✅ | Loudness | -14.4 LUFS (target -14 ±1.5), true peak -5.1 dBTP (max -1) |
| ✅ | Banned topics (keyword screen) | none of 6 banned topics mentioned |
| ✅ | Fact-check approved | approved by ilieBeracha (5 claims) |

## Agent review

| | Area | Notes |
|---|---|---|
| ✅ | tone | Words and voice are unchanged from the approved script: opens on the fact with no warm-up, asks "Okay, but why write it down?" and answers it, ends on the catchphrase. No call to action. It says the word "bug" is older than the moth instead of claiming the moth invented it. |
| ✅ | banned topics | A piece of computing history. No politics, war, crime, advice, gore or copyable stunts. The popular myth is corrected on screen, not repeated. Edison and Harvard are named as historical facts, not used as characters. The new cut-out pictures (moth, computer cabinet, open book) are generic drawings, not a likeness of a real object or person. |
| ✅ | visuals | Re-rendered in render-paper-collage. Reviewed the 8 sampled frames plus a sheet of 3 frames per second across the whole video. Off-white paper with two torn coloured sheets per beat, the hook pasted word by word, taped notes, dated tags on a line and a cut-out sticker beside Blink. All text readable and inside the safe area (11/11 automated checks). Two defects found and fixed in the skill before this render: the hook text counted as on screen only at 0.93 s (words now land 0.03 s apart), and the quote note vanished in some frames of the why beat in the video render (its CSS filter shadow replaced by a shadow sheet). Known blemishes, not hiding any text: the yellow disc behind a sticker blends into the yellow sheet in the assume, proof and kicker beats; beats with a single note leave the middle of the frame empty. Motion was judged from sampled frames, not watched at speed. |
| ✅ | character | Blink is on-model: mint-green egg blob, dark outline, round glasses, pink cheeks, sparkles. Full size on the hook, lower-left corner afterwards, expressions change per beat, nothing overlaps it now (the cut-out sits to its right). Blink is still drawn flat, not as a paper cut-out, so it sits slightly apart from the collage. The audio was not listened to; it is the same voice file as the previous render. |


## Sampled frames

- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t000.5s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t001.5s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t004.8s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t009.7s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t014.5s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t019.3s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t024.2s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t029.0s.jpg`
