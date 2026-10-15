# QA report — Rome's biggest bathhouse, reviewed

**Status: PASS** · episode `2026-10-15-roman-baths` · channel `time-tourist` · series `rated` · 2026-10-15

Checklist: `workflows/qa.md`. Video: `out/time-tourist/2026-10-15-roman-baths.mp4` (not in git).

## Automated checks

| | Check | Result |
|---|---|---|
| ✅ | Format | 1080×1920 @ 30.00 fps, h264/aac, yuvj420p |
| ✅ | Length | 46.10s (series allows 40–58s) |
| ✅ | Hook: speech starts immediately | first word at 0.19s (limit 0.5s) |
| ✅ | Hook: first line lands in 2 s | "Rome's biggest bathhouse." ends at 1.52s (limit 2s) |
| ✅ | Hook: on-screen text | visible from 0.07s |
| ✅ | Text inside safe areas | 2 text elements checked on every frame (2721 measurements) |
| ✅ | Nothing cut off | no element leaves the frame or overflows its box |
| ✅ | Captions in sync | 134 words; text matches script: yes; highlight off on 0/1340 frames; words over silent audio: 0 |
| ✅ | Loudness | -15.2 LUFS (target -14 ±1.5), true peak -4.4 dBTP (max -1) |
| ✅ | Banned topics (keyword screen) | none of 6 banned topics mentioned |
| ✅ | Fact-check approved | approved by ilieBeracha (approved in chat) (11 claims) |

## Agent review

| | Area | Notes |
|---|---|---|
| ✅ | tone | Casual selfie-vlog voice with real details; jokes are about the experience (no soap), and the enslaved workers are mentioned plainly, not as a joke. Rating lands as a point about Roman life. |
| ✅ | banned topics | No gore, no jokes about victims, no glorifying; slavery stated factually and briefly. |
| ✅ | visuals | Roman street and bathhouse settings read clearly; selfie shots keep Tilly's face above the caption; signs and lettering legible; background bathers are now varied strangers. |
| ✅ | character | Tilly on-model (red cap, mustard tunic, curly hair, phone) in every scene; mouth follows the voice. |


## Sampled frames

- `channels/time-tourist/episodes/2026-10-15-roman-baths/qa/frames/t000.5s.jpg`
- `channels/time-tourist/episodes/2026-10-15-roman-baths/qa/frames/t001.5s.jpg`
- `channels/time-tourist/episodes/2026-10-15-roman-baths/qa/frames/t006.5s.jpg`
- `channels/time-tourist/episodes/2026-10-15-roman-baths/qa/frames/t013.0s.jpg`
- `channels/time-tourist/episodes/2026-10-15-roman-baths/qa/frames/t019.5s.jpg`
- `channels/time-tourist/episodes/2026-10-15-roman-baths/qa/frames/t026.0s.jpg`
- `channels/time-tourist/episodes/2026-10-15-roman-baths/qa/frames/t032.5s.jpg`
- `channels/time-tourist/episodes/2026-10-15-roman-baths/qa/frames/t039.0s.jpg`
