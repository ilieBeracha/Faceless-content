# QA report — Inside It: a ballpoint pen

**Status: PASS** · episode `2026-10-14-ballpoint-pen` · channel `pip-how-things-work` · series `inside-it` · 2026-10-15

Checklist: `workflows/qa.md`. Video: `out/pip-how-things-work/2026-10-14-ballpoint-pen.mp4` (not in git).

## Automated checks

| | Check | Result |
|---|---|---|
| ✅ | Format | 1080×1920 @ 30.00 fps, h264/aac, yuvj420p |
| ✅ | Length | 37.27s (series allows 35–50s) |
| ✅ | Hook: speech starts immediately | first word at 0.16s (limit 0.5s) |
| ✅ | Hook: first line lands in 2 s | "Why doesn't your pen leak?" ends at 1.34s (limit 2s) |
| ✅ | Hook: on-screen text | visible from 0.07s |
| ✅ | Text inside safe areas | 9 text elements checked on every frame (3466 measurements) |
| ✅ | Nothing cut off | no element leaves the frame or overflows its box |
| ✅ | Captions in sync | 115 words; text matches script: yes; highlight off on 0/1090 frames; words over silent audio: 0 |
| ✅ | Loudness | -14.9 LUFS (target -14 ±1.5), true peak -4.5 dBTP (max -1) |
| ✅ | Banned topics (keyword screen) | none of 6 banned topics mentioned |
| ✅ | Fact-check approved | approved by ilieBeracha (approved in chat) (6 claims) |

## Agent review

| | Area | Notes |
|---|---|---|
| ✅ | tone | Fast, curious and a little cheeky; the catchphrase lands once in the fly-in; the 'the ball is the lid' payoff is clear for a general audience. |
| ✅ | banned topics | An everyday object and how it works; nothing near the banned list. |
| ✅ | visuals | Explode view separates barrel, ink tube and tip clearly; every label fits its box and points at the right part; captions never touch each other; headlines stay inside the safe area. |
| ✅ | character | Pip matches the model (chrome orb, one big eye, antenna, LED mouth) and the mouth follows the voice; expressions fit the lines. |


## Sampled frames

- `channels/pip-how-things-work/episodes/2026-10-14-ballpoint-pen/qa/frames/t000.5s.jpg`
- `channels/pip-how-things-work/episodes/2026-10-14-ballpoint-pen/qa/frames/t001.5s.jpg`
- `channels/pip-how-things-work/episodes/2026-10-14-ballpoint-pen/qa/frames/t005.2s.jpg`
- `channels/pip-how-things-work/episodes/2026-10-14-ballpoint-pen/qa/frames/t010.5s.jpg`
- `channels/pip-how-things-work/episodes/2026-10-14-ballpoint-pen/qa/frames/t015.7s.jpg`
- `channels/pip-how-things-work/episodes/2026-10-14-ballpoint-pen/qa/frames/t021.0s.jpg`
- `channels/pip-how-things-work/episodes/2026-10-14-ballpoint-pen/qa/frames/t026.2s.jpg`
- `channels/pip-how-things-work/episodes/2026-10-14-ballpoint-pen/qa/frames/t031.4s.jpg`
