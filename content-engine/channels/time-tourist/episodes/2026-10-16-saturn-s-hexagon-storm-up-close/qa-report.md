# QA report — Saturn's hexagon storm, reviewed

**Status: PASS** · episode `2026-10-16-saturn-s-hexagon-storm-up-close` · channel `time-tourist` · series `rated-space` · 2026-10-16

Checklist: `workflows/qa.md`. Video: `out/time-tourist/2026-10-16-saturn-s-hexagon-storm-up-close.mp4` (not in git).

## Automated checks

| | Check | Result |
|---|---|---|
| ✅ | Format | 1080×1920 @ 30.00 fps, h264/aac, yuvj420p |
| ✅ | Length | 57.54s (series allows 38–62s) |
| ✅ | Hook: speech starts immediately | first word at 0.10s (limit 0.5s) |
| ✅ | Hook: first line lands in 2 s | "A hexagon." ends at 1.49s (limit 2s) |
| ✅ | Hook: on-screen text | visible from 0.07s |
| ✅ | Text inside safe areas | 2 text elements checked on every frame (1869 measurements) |
| ✅ | Nothing cut off | no element leaves the frame or overflows its box |
| ✅ | Captions in sync | 124 words; text matches script: yes; highlight off on 0/1707 frames; words over silent audio: 0 |
| ✅ | Loudness | -15.0 LUFS (target -14 ±1.5), true peak -4.5 dBTP (max -1) |
| ✅ | Banned topics (keyword screen) | none of 6 banned topics mentioned |
| ✅ | Footage is real (not placeholders) | 11 clips from veo-3.1-fast-generate-preview |
| ✅ | Every clip says its line | 11 clips checked by ear |
| ✅ | Within budget | $8.80 spent of $25.00 (51 paid calls logged in footage/ledger.json) |
| ✅ | Fact-check approved | approved by Ilie (delegated to Claude: 'decide by yourself'; hook reworded, same claims) (8 claims) |

## Agent review

| | Area | Notes |
|---|---|---|
| ✅ | tone | Casual first-person vlog in Tilly's voice: punchy hook ('A hexagon. On Saturn.'), facts land as surprises, the unexplained part is said plainly ('Nobody's totally sure why'), 'Okay, review time' used once, rating said out loud. Fits 13+. |
| ✅ | banned topics | Pure planetary science; no violence, politics, religion or health advice. Nothing is presented as fact that sources don't support; the cause of the six sides is labelled uncertain. |
| ✅ | visuals | 5 of 11 shots show Saturn itself through the cabin window (pov, no phone or person in frame), the rest are cabin selfies with Saturn in the window. Captions and the hook headline are readable and inside safe areas. Every clip was checked for burned-in text: the first rating-1 clip had garbled Veo subtitles for ~2 s and was regenerated; the final clips have none. Saturn is a little stylised (glowing hexagon outline in tour-1, a bluish centre) but six-sided as the claims say. Minor: a small striped patch on her shoulder in a few shots. |
| ✅ | character | Same face as tilly-live's approved reference in every shot, mustard flight suit with red shoulder stripes and the faded red cap, matching tilly-space's model.json. Expressions fit the lines (excited hook, deadpan 'No landing', curious catch, frown at the snack pouch). Lip-sync judged from frames; every clip's audio was transcribed and says its exact line. |


## Sampled frames

- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t000.5s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t001.5s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t007.9s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t008.0s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t008.1s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t015.8s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t016.1s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t016.3s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t023.7s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t024.1s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t024.4s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t031.7s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t032.2s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t032.5s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t039.6s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t040.2s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t040.7s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t047.5s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t048.3s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t048.8s.jpg`
