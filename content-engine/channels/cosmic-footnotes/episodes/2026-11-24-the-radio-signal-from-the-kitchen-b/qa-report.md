# QA report — Lunch fooled a telescope

**Status: PENDING REVIEW** · episode `2026-11-24-the-radio-signal-from-the-kitchen-b` · channel `cosmic-footnotes` · series `tiny-clue-big-deal` · 2026-11-25

Checklist: `workflows/qa.md`. Video: `out/cosmic-footnotes/2026-11-24-the-radio-signal-from-the-kitchen-b.mp4` (not in git).

## Automated checks

| | Check | Result |
|---|---|---|
| ✅ | Format | 1080×1920 @ 30.00 fps, h264/aac, yuvj420p |
| ✅ | Length | 49.07s (series allows 40–58s) |
| ✅ | Hook: speech starts immediately | first word at 0.10s (limit 0.5s) |
| ✅ | Hook: first line lands in 2 s | "Lunch fooled a telescope." ends at 1.82s (limit 2s) |
| ✅ | Hook: captions on screen | visible from 0.17s |
| ✅ | Text inside safe areas | 2 text elements checked on every frame (2909 measurements) |
| ✅ | Nothing cut off | no element leaves the frame or overflows its box |
| ✅ | Captions in sync | 147 words; text matches script: yes; highlight off on 0/1442 frames; words over silent audio: 0 |
| ✅ | Loudness | -14.0 LUFS (target -14 ±1.5), true peak -1.6 dBTP (max -1) |
| ✅ | Banned topics (keyword screen) | none of 6 banned topics mentioned |
| ✅ | Fact-check approved | approved by ilieBeracha (11 claims) |

## Agent review

| | Area | Notes |
|---|---|---|
| ⏳ | agent review | waiting for `qa-review.json` |


## Sampled frames

- `channels/cosmic-footnotes/episodes/2026-11-24-the-radio-signal-from-the-kitchen-b/qa/frames/t000.5s.jpg`
- `channels/cosmic-footnotes/episodes/2026-11-24-the-radio-signal-from-the-kitchen-b/qa/frames/t001.5s.jpg`
- `channels/cosmic-footnotes/episodes/2026-11-24-the-radio-signal-from-the-kitchen-b/qa/frames/t006.9s.jpg`
- `channels/cosmic-footnotes/episodes/2026-11-24-the-radio-signal-from-the-kitchen-b/qa/frames/t013.8s.jpg`
- `channels/cosmic-footnotes/episodes/2026-11-24-the-radio-signal-from-the-kitchen-b/qa/frames/t020.8s.jpg`
- `channels/cosmic-footnotes/episodes/2026-11-24-the-radio-signal-from-the-kitchen-b/qa/frames/t027.7s.jpg`
- `channels/cosmic-footnotes/episodes/2026-11-24-the-radio-signal-from-the-kitchen-b/qa/frames/t034.6s.jpg`
- `channels/cosmic-footnotes/episodes/2026-11-24-the-radio-signal-from-the-kitchen-b/qa/frames/t041.5s.jpg`
