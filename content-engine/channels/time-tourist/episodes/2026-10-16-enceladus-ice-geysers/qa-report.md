# QA report — Standing on Enceladus, reviewed

**Status: PASS** · episode `2026-10-16-enceladus-ice-geysers` · channel `time-tourist` · series `rated-space` · 2026-10-16

Checklist: `workflows/qa.md`. Video: `out/time-tourist/2026-10-16-enceladus-ice-geysers.mp4` (not in git).

## Automated checks

| | Check | Result |
|---|---|---|
| ✅ | Format | 1080×1920 @ 30.00 fps, h264/aac, yuvj420p |
| ✅ | Length | 52.59s (series allows 38–62s) |
| ✅ | Hook: speech starts immediately | first word at 0.10s (limit 0.5s) |
| ✅ | Hook: first line lands in 2 s | "Ice everywhere." ends at 1.72s (limit 2s) |
| ✅ | Hook: on-screen text | visible from 0.07s |
| ✅ | Text inside safe areas | 2 text elements checked on every frame (1731 measurements) |
| ✅ | Nothing cut off | no element leaves the frame or overflows its box |
| ✅ | Captions in sync | 112 words; text matches script: yes; highlight off on 0/1569 frames; words over silent audio: 0 |
| ✅ | Loudness | -14.9 LUFS (target -14 ±1.5), true peak -5.3 dBTP (max -1) |
| ✅ | Banned topics (keyword screen) | none of 6 banned topics mentioned |
| ✅ | Footage is real (not placeholders) | 10 clips from veo-3.1-fast-generate-preview |
| ✅ | Every clip says its line | 10 clips checked by ear |
| ✅ | Within budget | $8.49 spent of $25.00 (38 paid calls logged in footage/ledger.json) |
| ✅ | Fact-check approved | approved by Ilie (delegated to Claude: 'decide by yourself'; sources checked by Claude) (8 claims) |

## Agent review

| | Area | Notes |
|---|---|---|
| ✅ | tone | Tilly's voice, calm delivery: hook names the place, facts as discoveries, the ocean as the catch, one 'Okay, review time', spoken rating. Fits 13+. |
| ✅ | banned topics | Planetary science only. |
| ✅ | visuals | New illustrated style matching the reference: flat 2D vector animation, deep blues and violets, glowing white ice, Saturn huge in the sky. Tilly stands on the ice of Enceladus in a mustard spacesuit; her gloved hand reaches toward a tiger-stripe crack; ice jets rise into space; the spray drifts into Saturn's E ring. Every clip scanned frame by frame: Veo had inserted an invented presenter or stray hands in two voice-over clips; both were regenerated and the remaining stray frames fall outside the used segments. No burned-in text. |
| ✅ | character | Drawn Tilly keeps the approved face: dark curly hair, freckles, thick brows; consistent mustard suit with red shoulder stripes and a clear bubble helmet. Calm, natural poses (standing, shading her visor once, small hand movements). Every clip's audio was transcribed and says its exact line. |


## Sampled frames

- `channels/time-tourist/episodes/2026-10-16-enceladus-ice-geysers/qa/frames/t000.5s.jpg`
- `channels/time-tourist/episodes/2026-10-16-enceladus-ice-geysers/qa/frames/t001.5s.jpg`
- `channels/time-tourist/episodes/2026-10-16-enceladus-ice-geysers/qa/frames/t007.4s.jpg`
- `channels/time-tourist/episodes/2026-10-16-enceladus-ice-geysers/qa/frames/t014.8s.jpg`
- `channels/time-tourist/episodes/2026-10-16-enceladus-ice-geysers/qa/frames/t014.9s.jpg`
- `channels/time-tourist/episodes/2026-10-16-enceladus-ice-geysers/qa/frames/t022.1s.jpg`
- `channels/time-tourist/episodes/2026-10-16-enceladus-ice-geysers/qa/frames/t022.2s.jpg`
- `channels/time-tourist/episodes/2026-10-16-enceladus-ice-geysers/qa/frames/t022.3s.jpg`
- `channels/time-tourist/episodes/2026-10-16-enceladus-ice-geysers/qa/frames/t029.5s.jpg`
- `channels/time-tourist/episodes/2026-10-16-enceladus-ice-geysers/qa/frames/t029.6s.jpg`
- `channels/time-tourist/episodes/2026-10-16-enceladus-ice-geysers/qa/frames/t029.7s.jpg`
- `channels/time-tourist/episodes/2026-10-16-enceladus-ice-geysers/qa/frames/t036.9s.jpg`
- `channels/time-tourist/episodes/2026-10-16-enceladus-ice-geysers/qa/frames/t037.0s.jpg`
- `channels/time-tourist/episodes/2026-10-16-enceladus-ice-geysers/qa/frames/t037.1s.jpg`
- `channels/time-tourist/episodes/2026-10-16-enceladus-ice-geysers/qa/frames/t044.3s.jpg`
- `channels/time-tourist/episodes/2026-10-16-enceladus-ice-geysers/qa/frames/t044.4s.jpg`
- `channels/time-tourist/episodes/2026-10-16-enceladus-ice-geysers/qa/frames/t044.6s.jpg`
