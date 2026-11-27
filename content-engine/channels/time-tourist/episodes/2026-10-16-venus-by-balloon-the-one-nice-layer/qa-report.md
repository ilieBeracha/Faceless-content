# QA report — Floating in Venus's clouds, reviewed

**Status: PASS** · episode `2026-10-16-venus-by-balloon-the-one-nice-layer` · channel `time-tourist` · series `rated-space` · 2026-10-16

Checklist: `workflows/qa.md`. Video: `out/time-tourist/2026-10-16-venus-by-balloon-the-one-nice-layer.mp4` (not in git).

## Automated checks

| | Check | Result |
|---|---|---|
| ✅ | Format | 1080×1920 @ 30.00 fps, h264/aac, yuvj420p |
| ✅ | Length | 51.65s (series allows 38–62s) |
| ✅ | Hook: speech starts immediately | first word at 0.10s (limit 0.5s) |
| ✅ | Hook: first line lands in 2 s | "I'm floating." ends at 1.15s (limit 2s) |
| ✅ | Hook: on-screen text | visible from 0.07s |
| ✅ | Text inside safe areas | 2 text elements checked on every frame (1677 measurements) |
| ✅ | Nothing cut off | no element leaves the frame or overflows its box |
| ✅ | Captions in sync | 116 words; text matches script: yes; highlight off on 0/1527 frames; words over silent audio: 0 |
| ✅ | Loudness | -15.2 LUFS (target -14 ±1.5), true peak -5.3 dBTP (max -1) |
| ✅ | Banned topics (keyword screen) | none of 6 banned topics mentioned |
| ✅ | Footage is real (not placeholders) | 10 clips from veo-3.1-fast-generate-preview |
| ✅ | Every clip says its line | 10 clips checked by ear |
| ✅ | Within budget | $9.49 spent of $25.00 (38 paid calls logged in footage/ledger.json) |
| ✅ | Fact-check approved | approved by Ilie (delegated to Claude: 'decide by yourself'; sources checked by Claude) (8 claims) |

## Agent review

| | Area | Notes |
|---|---|---|
| ✅ | tone | Tilly's voice, calmer delivery: two-word hook, facts as discoveries, a plain serious catch, one 'Okay, review time', spoken rating. Fits 13+. |
| ✅ | banned topics | Planetary science only. The balloon platform is the channel's fictional budget tour; the physics (breathable air is a lifting gas on Venus) is from a NASA paper and listed as a claim. |
| ✅ | visuals | Tilly is physically inside Venus's cloud layer on an open balloon deck in a pressure suit: on-location and close-up shots at the rail, a first-person shot of her gloved hand reaching into the acid haze, establishing shots down through the cloud decks, along the streaming cloud sea and up the balloon cables, silhouettes at sunrise and under the balloon. Photoreal, no stylised graphics. Every clip scanned: no burned-in text. The first rating close-up had a visor glare band that doubled her eyes when she walked toward the lens; it was replaced by a steady medium shot. |
| ✅ | character | Same face as the approved reference, visible through the clear helmet; consistent mustard pressure suit with red shoulder stripes. Calm, natural body language throughout (standing at the rail, turning her head, one small hand movement); no jumping or posing. Every clip's audio was transcribed and says its exact line. |


## Sampled frames

- `channels/time-tourist/episodes/2026-10-16-venus-by-balloon-the-one-nice-layer/qa/frames/t000.5s.jpg`
- `channels/time-tourist/episodes/2026-10-16-venus-by-balloon-the-one-nice-layer/qa/frames/t001.5s.jpg`
- `channels/time-tourist/episodes/2026-10-16-venus-by-balloon-the-one-nice-layer/qa/frames/t007.3s.jpg`
- `channels/time-tourist/episodes/2026-10-16-venus-by-balloon-the-one-nice-layer/qa/frames/t014.6s.jpg`
- `channels/time-tourist/episodes/2026-10-16-venus-by-balloon-the-one-nice-layer/qa/frames/t021.8s.jpg`
- `channels/time-tourist/episodes/2026-10-16-venus-by-balloon-the-one-nice-layer/qa/frames/t021.9s.jpg`
- `channels/time-tourist/episodes/2026-10-16-venus-by-balloon-the-one-nice-layer/qa/frames/t029.1s.jpg`
- `channels/time-tourist/episodes/2026-10-16-venus-by-balloon-the-one-nice-layer/qa/frames/t029.2s.jpg`
- `channels/time-tourist/episodes/2026-10-16-venus-by-balloon-the-one-nice-layer/qa/frames/t036.4s.jpg`
- `channels/time-tourist/episodes/2026-10-16-venus-by-balloon-the-one-nice-layer/qa/frames/t036.5s.jpg`
- `channels/time-tourist/episodes/2026-10-16-venus-by-balloon-the-one-nice-layer/qa/frames/t043.7s.jpg`
- `channels/time-tourist/episodes/2026-10-16-venus-by-balloon-the-one-nice-layer/qa/frames/t043.8s.jpg`
