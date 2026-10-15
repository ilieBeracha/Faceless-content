# QA report — How long is a billion seconds?

**Status: PENDING REVIEW** · episode `2026-10-15-a-billion-seconds` · channel `big-numbers` · series `bigger-than-you-think` · 2026-10-15

Checklist: `workflows/qa.md`. Video: `out/big-numbers/2026-10-15-a-billion-seconds.mp4` (not in git).

## Automated checks

| | Check | Result |
|---|---|---|
| ✅ | Format | 1080×1920 @ 30.00 fps, h264/aac, yuvj420p |
| ✅ | Length | 45.48s (series allows 40–55s) |
| ✅ | Hook: speech starts immediately | first word at 0.22s (limit 0.5s) |
| ✅ | Hook: first line lands in 2 s | "A billion seconds." ends at 1.32s (limit 2s) |
| ✅ | Hook: on-screen text | visible from 0.07s |
| ✅ | Text inside safe areas | 2 text elements checked on every frame (2671 measurements) |
| ❌ | Nothing cut off | storybook:title:text-overflow (1362 frames) |
| ✅ | Captions in sync | 119 words; text matches script: yes; highlight off on 0/1309 frames; words over silent audio: 0 |
| ✅ | Loudness | -15.0 LUFS (target -14 ±1.5), true peak -4.5 dBTP (max -1) |
| ✅ | Banned topics (keyword screen) | none of 7 banned topics mentioned |
| ✅ | Fact-check approved | approved by ilieBeracha (approved in chat) (9 claims) |

## Agent review

| | Area | Notes |
|---|---|---|
| ⏳ | agent review | waiting for `qa-review.json` |


## Sampled frames

- `channels/big-numbers/episodes/2026-10-15-a-billion-seconds/qa/frames/t000.5s.jpg`
- `channels/big-numbers/episodes/2026-10-15-a-billion-seconds/qa/frames/t001.5s.jpg`
- `channels/big-numbers/episodes/2026-10-15-a-billion-seconds/qa/frames/t006.4s.jpg`
- `channels/big-numbers/episodes/2026-10-15-a-billion-seconds/qa/frames/t012.8s.jpg`
- `channels/big-numbers/episodes/2026-10-15-a-billion-seconds/qa/frames/t019.2s.jpg`
- `channels/big-numbers/episodes/2026-10-15-a-billion-seconds/qa/frames/t025.6s.jpg`
- `channels/big-numbers/episodes/2026-10-15-a-billion-seconds/qa/frames/t032.1s.jpg`
- `channels/big-numbers/episodes/2026-10-15-a-billion-seconds/qa/frames/t038.5s.jpg`
