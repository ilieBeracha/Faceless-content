# QA report — Inside It: a ballpoint pen

**Status: PENDING REVIEW** · episode `2026-10-14-ballpoint-pen` · channel `pip-how-things-work` · series `inside-it` · 2026-10-15

Checklist: `workflows/qa.md`. Video: `out/pip-how-things-work/2026-10-14-ballpoint-pen.mp4` (not in git).

## Automated checks

| | Check | Result |
|---|---|---|
| ✅ | Format | 1080×1920 @ 30.00 fps, h264/aac, yuvj420p |
| ✅ | Length | 37.27s (series allows 35–50s) |
| ✅ | Hook: speech starts immediately | first word at 0.16s (limit 0.5s) |
| ✅ | Hook: first line lands in 2 s | "Why doesn't your pen leak?" ends at 1.34s (limit 2s) |
| ✅ | Hook: on-screen text | visible from 0.07s |
| ❌ | Text inside safe areas | label:barrel (1 frames), label:ball (3 frames), label:tip (2 frames) |
| ❌ | Nothing cut off | captions:text-overflow (1091 frames), label:barrel:text-overflow (281 frames), label:ink:text-overflow (267 frames), label:ball:text-overflow (597 frames), label:tip:text-overflow (330 frames) |
| ✅ | Captions in sync | 115 words; text matches script: yes; highlight off on 0/1090 frames; words over silent audio: 0 |
| ✅ | Loudness | -14.9 LUFS (target -14 ±1.5), true peak -4.5 dBTP (max -1) |
| ✅ | Banned topics (keyword screen) | none of 6 banned topics mentioned |
| ✅ | Fact-check approved | approved by ilieBeracha (approved in chat) (6 claims) |

## Agent review

| | Area | Notes |
|---|---|---|
| ⏳ | agent review | waiting for `qa-review.json` |


## Sampled frames

- `channels/pip-how-things-work/episodes/2026-10-14-ballpoint-pen/qa/frames/t000.5s.jpg`
- `channels/pip-how-things-work/episodes/2026-10-14-ballpoint-pen/qa/frames/t001.5s.jpg`
- `channels/pip-how-things-work/episodes/2026-10-14-ballpoint-pen/qa/frames/t005.2s.jpg`
- `channels/pip-how-things-work/episodes/2026-10-14-ballpoint-pen/qa/frames/t010.5s.jpg`
- `channels/pip-how-things-work/episodes/2026-10-14-ballpoint-pen/qa/frames/t015.7s.jpg`
- `channels/pip-how-things-work/episodes/2026-10-14-ballpoint-pen/qa/frames/t021.0s.jpg`
- `channels/pip-how-things-work/episodes/2026-10-14-ballpoint-pen/qa/frames/t026.2s.jpg`
- `channels/pip-how-things-work/episodes/2026-10-14-ballpoint-pen/qa/frames/t031.4s.jpg`
