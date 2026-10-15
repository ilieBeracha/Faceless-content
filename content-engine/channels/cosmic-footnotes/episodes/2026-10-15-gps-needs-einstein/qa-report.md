# QA report — Your phone needs Einstein

**Status: PASS** · episode `2026-10-15-gps-needs-einstein` · channel `cosmic-footnotes` · series `tiny-clue-big-deal` · 2026-10-15

Checklist: `workflows/qa.md`. Video: `out/cosmic-footnotes/2026-10-15-gps-needs-einstein.mp4` (not in git).

## Automated checks

| | Check | Result |
|---|---|---|
| ✅ | Format | 1080×1920 @ 30.00 fps, h264/aac, yuvj420p |
| ✅ | Length | 45.20s (series allows 40–58s) |
| ✅ | Hook: speech starts immediately | first word at 0.19s (limit 0.5s) |
| ✅ | Hook: first line lands in 2 s | "Your phone needs Einstein." ends at 1.76s (limit 2s) |
| ✅ | Hook: on-screen text | visible from 0.07s |
| ✅ | Text inside safe areas | 2 text elements checked on every frame (2660 measurements) |
| ✅ | Nothing cut off | no element leaves the frame or overflows its box |
| ✅ | Captions in sync | 130 words; text matches script: yes; highlight off on 0/1306 frames; words over silent audio: 0 |
| ✅ | Loudness | -15.2 LUFS (target -14 ±1.5), true peak -4.2 dBTP (max -1) |
| ✅ | Banned topics (keyword screen) | none of 6 banned topics mentioned |
| ✅ | Fact-check approved | approved by ilieBeracha (approved in chat) (8 claims) |

## Agent review

| | Area | Notes |
|---|---|---|
| ✅ | tone | Curious and clear; one true story with a concrete point ('your map would drift more than ten kilometres a day'); the kicker ties back to the hook. No hype words. |
| ✅ | banned topics | Physics and everyday technology only. |
| ✅ | visuals | A new picture per sentence; satellite/phone/clock props make each step concrete; title on one line; captions clear of faces; Ori visible on dark skies thanks to the pale outline. |
| ✅ | character | Ori on-model (bubble helmet, bun, navy tunic) in every scene; mouth follows the voice. |


## Sampled frames

- `channels/cosmic-footnotes/episodes/2026-10-15-gps-needs-einstein/qa/frames/t000.5s.jpg`
- `channels/cosmic-footnotes/episodes/2026-10-15-gps-needs-einstein/qa/frames/t001.5s.jpg`
- `channels/cosmic-footnotes/episodes/2026-10-15-gps-needs-einstein/qa/frames/t006.4s.jpg`
- `channels/cosmic-footnotes/episodes/2026-10-15-gps-needs-einstein/qa/frames/t012.7s.jpg`
- `channels/cosmic-footnotes/episodes/2026-10-15-gps-needs-einstein/qa/frames/t019.1s.jpg`
- `channels/cosmic-footnotes/episodes/2026-10-15-gps-needs-einstein/qa/frames/t025.5s.jpg`
- `channels/cosmic-footnotes/episodes/2026-10-15-gps-needs-einstein/qa/frames/t031.9s.jpg`
- `channels/cosmic-footnotes/episodes/2026-10-15-gps-needs-einstein/qa/frames/t038.2s.jpg`
