# QA report — Red dye changed wine students' smell words

**Status: PENDING REVIEW** · episode `2026-11-25-wine-experts-fooled-by-dye` · channel `no-way-really` · series `wait-what` · 2026-11-25

Checklist: `workflows/qa.md`. Video: `out/no-way-really/2026-11-25-wine-experts-fooled-by-dye.mp4` (not in git).

## Automated checks

| | Check | Result |
|---|---|---|
| ✅ | Format | 1080×1920 @ 30.00 fps, h264/aac, yuvj420p |
| ✅ | Length | 33.69s (series allows 20–35s) |
| ✅ | Hook: speech starts immediately | first word at 0.10s (limit 0.5s) |
| ❌ | Hook: first line lands in 2 s | "Red dye changed wine students' smell words." ends at 2.80s (limit 2s) |
| ✅ | Hook: captions on screen | visible from 0.17s |
| ❌ | Text inside safe areas | th:turn:0:mark-v-0 (177 frames) |
| ✅ | Nothing cut off | no element leaves the frame or overflows its box |
| ✅ | Captions in sync | 94 words; text matches script: yes; highlight off on 0/1005 frames; words over silent audio: 0 |
| ✅ | Loudness | -14.0 LUFS (target -14 ±1.5), true peak -1.8 dBTP (max -1) |
| ✅ | Banned topics (keyword screen) | none of 6 banned topics mentioned |
| ✅ | Fact-check approved | approved by ilieBeracha (told Claude in chat not to wait for approval; not read before approving) (9 claims) |

## Agent review

| | Area | Notes |
|---|---|---|
| ⏳ | agent review | waiting for `qa-review.json` |


## Sampled frames

- `channels/no-way-really/episodes/2026-11-25-wine-experts-fooled-by-dye/qa/frames/t000.5s.jpg`
- `channels/no-way-really/episodes/2026-11-25-wine-experts-fooled-by-dye/qa/frames/t001.5s.jpg`
- `channels/no-way-really/episodes/2026-11-25-wine-experts-fooled-by-dye/qa/frames/t004.7s.jpg`
- `channels/no-way-really/episodes/2026-11-25-wine-experts-fooled-by-dye/qa/frames/t009.5s.jpg`
- `channels/no-way-really/episodes/2026-11-25-wine-experts-fooled-by-dye/qa/frames/t014.2s.jpg`
- `channels/no-way-really/episodes/2026-11-25-wine-experts-fooled-by-dye/qa/frames/t018.9s.jpg`
- `channels/no-way-really/episodes/2026-11-25-wine-experts-fooled-by-dye/qa/frames/t023.6s.jpg`
- `channels/no-way-really/episodes/2026-11-25-wine-experts-fooled-by-dye/qa/frames/t028.4s.jpg`
