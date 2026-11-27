# QA report — The first computer bug was a real moth

**Status: PASS** · episode `2026-11-14-first-computer-bug-moth` · channel `no-way-really` · series `wait-what` · 2026-11-15

Checklist: `workflows/qa.md`. Video: `out/no-way-really/2026-11-14-first-computer-bug-moth.mp4` (not in git).

## Automated checks

| | Check | Result |
|---|---|---|
| ✅ | Format | 1080×1920 @ 30.00 fps, h264/aac, yuvj420p |
| ✅ | Length | 32.70s (series allows 20–35s) |
| ✅ | Hook: speech starts immediately | first word at 0.17s (limit 0.5s) |
| ✅ | Hook: first line lands in 2 s | "A real moth jammed a computer." ends at 1.91s (limit 2s) |
| ✅ | Hook: on-screen text | visible from 0.33s |
| ✅ | Text inside safe areas | 14 text elements checked on every frame (3465 measurements) |
| ✅ | Nothing cut off | no element leaves the frame or overflows its box |
| ✅ | Captions in sync | 85 words; text matches script: yes; highlight off on 0/949 frames; words over silent audio: 0 |
| ✅ | Loudness | -14.5 LUFS (target -14 ±1.5), true peak -4.7 dBTP (max -1) |
| ✅ | Banned topics (keyword screen) | none of 6 banned topics mentioned |
| ✅ | Fact-check approved | approved by ilieBeracha (5 claims) |

## Agent review

| | Area | Notes |
|---|---|---|
| ✅ | tone | Rewritten after the person said the first version was a robotic reading with no start, middle, end or point. It is now a small story: the fact, the scene (September 1947, the Mark II hits an error), the find ("So the operators go looking. And there it is"), the twist ("Here's the funny part": the word was already old, so they taped it in and wrote the note) and an ending that says the point in plain words ("The one time a computer bug was a real bug") before the catchphrase. Beats are joined by spoken connectives instead of standing as separate facts. Plain talk, no poetry, no call to action. Judged from the text; the audio was not listened to. |
| ✅ | banned topics | A piece of computing history. No politics, war, crime, advice, gore or copyable stunts. The popular myth is corrected inside the story, not repeated. Edison and Harvard are named as historical facts, not used as characters. The artwork is generic: a moth, a cabinet computer, an open book, and a plain columned building standing for a museum, not a likeness of the real Smithsonian building. |
| ✅ | visuals | Re-rendered with render-themed, the general renderer that replaced the single-look collage skill. The look now comes from the channel's theme.json (paper collage) and the pictures are drawn in the script as vector artwork: moth, computer, logbook, and a new museum for the ending. Reviewed the 8 sampled frames plus a sheet of 3 frames per second across the whole video: same collage look as before (torn sheets, pasted plates, taped notes, stickers on a starburst), every note present in every sampled frame, all text readable and inside the safe area (11/11 automated checks). Known blemish, not hiding any text: for about a third of a second at each beat change the page is bare while the new sheets slide in. Motion was judged from sampled frames, not watched at speed. |
| ✅ | character | Blink is on-model and clear of every card. The voice changed from af_bella to af_heart (Kokoro's best-rated voice, warm) at speed 1.06 with a 0.3 s pause between sentences, after the person asked for a more human voice; 1.02 was tried first but pushed the hook line to 2.02 s, past the 2 s limit. The audio was not listened to, so whether it sounds more human is unverified. A paid voice was not used because the person has not chosen one. |


## Sampled frames

- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t000.5s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t001.5s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t004.6s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t004.7s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t004.8s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t009.2s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t009.4s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t009.7s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t013.8s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t014.1s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t014.5s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t018.3s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t018.8s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t019.3s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t022.9s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t023.5s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t024.2s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t027.5s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t028.2s.jpg`
- `channels/no-way-really/episodes/2026-11-14-first-computer-bug-moth/qa/frames/t029.0s.jpg`
