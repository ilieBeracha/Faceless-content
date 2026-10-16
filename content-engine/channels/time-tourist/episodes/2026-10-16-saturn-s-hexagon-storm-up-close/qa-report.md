# QA report — Saturn's hexagon storm, reviewed

**Status: PASS** · episode `2026-10-16-saturn-s-hexagon-storm-up-close` · channel `time-tourist` · series `rated-space` · 2026-10-16

Checklist: `workflows/qa.md`. Video: `out/time-tourist/2026-10-16-saturn-s-hexagon-storm-up-close.mp4` (not in git).

## Automated checks

| | Check | Result |
|---|---|---|
| ✅ | Format | 1080×1920 @ 30.00 fps, h264/aac, yuvj420p |
| ✅ | Length | 57.60s (series allows 38–62s) |
| ✅ | Hook: speech starts immediately | first word at 0.10s (limit 0.5s) |
| ✅ | Hook: first line lands in 2 s | "A hexagon." ends at 1.28s (limit 2s) |
| ✅ | Hook: on-screen text | visible from 0.07s |
| ✅ | Text inside safe areas | 2 text elements checked on every frame (1868 measurements) |
| ✅ | Nothing cut off | no element leaves the frame or overflows its box |
| ✅ | Captions in sync | 124 words; text matches script: yes; highlight off on 0/1707 frames; words over silent audio: 0 |
| ✅ | Loudness | -15.2 LUFS (target -14 ±1.5), true peak -5.0 dBTP (max -1) |
| ✅ | Banned topics (keyword screen) | none of 6 banned topics mentioned |
| ✅ | Footage is real (not placeholders) | 11 clips from veo-3.1-fast-generate-preview |
| ✅ | Every clip says its line | 11 clips checked by ear |
| ✅ | Within budget | $15.97 spent of $25.00 (87 paid calls logged in footage/ledger.json) |
| ✅ | Fact-check approved | approved by Ilie (delegated to Claude: 'decide by yourself'; hook reworded, same claims) (8 claims) |

## Agent review

| | Area | Notes |
|---|---|---|
| ✅ | tone | Same approved script in Tilly's voice: punchy two-word hook, facts as surprises, the unexplained part said plainly, one 'Okay, review time', spoken rating. Fits 13+. |
| ✅ | banned topics | Planetary science only; the cause of the six sides is labelled uncertain. |
| ✅ | visuals | Cinematic remake: Saturn-lit close-ups for hook, catch and rating; establishing shots of the wonder (a tiny ship gliding over Saturn's horizon, a crane down onto the hexagon, tracking along its edge, a pull-back revealing the rings, the blue eye); silhouettes of Tilly against the giant window. Film grade, vignette, grain, slow push-ins and an ambient score under the voice. Captions and headline readable and inside safe areas. Every clip's bottom third was scanned: no burned-in text. One clip (catch-1) glitches into a teal frame after 5.5 s, but only 0–5.3 s is used. The hexagon reads stylised (a glowing outline) in tour-1. |
| ✅ | character | Same face as the approved reference in every close-up; mustard flight suit with red shoulder stripes and faded red cap in close-ups and silhouettes. Lip-sync judged from frames; every clip's audio was transcribed and says its exact line. |


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
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t032.6s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t039.6s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t040.2s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t040.7s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t047.5s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t048.3s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t048.8s.jpg`
- `channels/time-tourist/episodes/2026-10-16-saturn-s-hexagon-storm-up-close/qa/frames/t048.9s.jpg`
