# QA report — Saturn's hexagon storm, reviewed

**Status: PENDING REVIEW** · episode `2026-10-16-saturn-s-hexagon-storm-up-close` · channel `time-tourist` · series `rated-space` · 2026-10-16

Checklist: `workflows/qa.md`. Video: `out/time-tourist/2026-10-16-saturn-s-hexagon-storm-up-close.mp4` (not in git).

## Automated checks

| | Check | Result |
|---|---|---|
| ✅ | Format | 1080×1920 @ 30.00 fps, h264/aac, yuvj420p |
| ✅ | Length | 56.00s (series allows 38–62s) |
| ✅ | Hook: speech starts immediately | first word at 0.10s (limit 0.5s) |
| ❌ | Hook: first line lands in 2 s | "Saturn has a hexagon." ends at 2.66s (limit 2s) |
| ✅ | Hook: on-screen text | visible from 0.07s |
| ✅ | Text inside safe areas | 2 text elements checked on every frame (1795 measurements) |
| ❌ | Nothing cut off | headline:hook:text-overflow (134 frames) |
| ✅ | Captions in sync | 124 words; text matches script: yes; highlight off on 0/1660 frames; words over silent audio: 0 |
| ❌ | Loudness | -15.9 LUFS (target -14 ±1.5), true peak -4.4 dBTP (max -1) |
| ✅ | Banned topics (keyword screen) | none of 6 banned topics mentioned |
| ✅ | Footage is real (not placeholders) | 11 clips from veo-3.1-fast-generate-preview |
| ✅ | Every clip says its line | 11 clips checked by ear |
| ✅ | Within budget | $7.60 spent of $25.00 (47 paid calls logged in footage/ledger.json) |
| ✅ | Fact-check approved | approved by Ilie (delegated to Claude: 'decide by yourself'; sources checked by Claude) (8 claims) |

## Agent review

| | Area | Notes |
|---|---|---|
| ⏳ | agent review | waiting for `qa-review.json` |


## Sampled frames

- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t000.5s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t001.5s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t007.9s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t015.8s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t023.7s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t031.7s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t039.6s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t047.5s.jpg`
