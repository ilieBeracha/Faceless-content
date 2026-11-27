# QA report — Strange facts about Saturn

**Status: PASS** · episode `2026-10-17-strange-facts-about-saturn` · channel `time-tourist` · series `strange-space` · 2026-10-17

Checklist: `workflows/qa.md`. Video: `out/time-tourist/2026-10-17-strange-facts-about-saturn.mp4` (not in git).

## Automated checks

| | Check | Result |
|---|---|---|
| ✅ | Format | 1080×1920 @ 30.00 fps, h264/aac, yuvj420p |
| ✅ | Length | 30.72s (series allows 20–40s) |
| ✅ | Hook: speech starts immediately | first word at 0.21s (limit 0.5s) |
| ✅ | Hook: first line lands in 2 s | "Saturn is wild." ends at 1.49s (limit 2s) |
| ✅ | Hook: on-screen text | visible from 0.07s |
| ✅ | Text inside safe areas | 16 text elements checked on every frame (2100 measurements) |
| ✅ | Nothing cut off | no element leaves the frame or overflows its box |
| ✅ | Captions in sync | 95 words; text matches script: yes; highlight off on 0/889 frames; words over silent audio: 0 |
| ✅ | Loudness | -14.6 LUFS (target -14 ±1.5), true peak -4.7 dBTP (max -1) |
| ✅ | Banned topics (keyword screen) | none of 6 banned topics mentioned |
| ✅ | Fact-check approved | approved by Ilie (delegated to Claude: 'decide by yourself'; sources checked by Claude) (7 claims) |

## Agent review

| | Area | Notes |
|---|---|---|
| ✅ | tone | Short, punchy second-person facts in Tilly's voice ('Saturn is wild.'), one idea per line, ends on a curious note. Fits 13+. |
| ✅ | banned topics | Planetary science only; the float fact is framed as a thought experiment ('if you found a tub big enough'). |
| ✅ | visuals | Code-drawn explainer in the reference style: one hero Saturn on a dark starfield; each fact gets its own view - Earth to scale ('≈ 9 Earths wide'), a cutaway with four labelled layers on a warm background, Saturn bobbing in a bathtub, a fast spin with a clock ('1 day ≈ 10 h 33 min'), the polar hexagon drawn on, the rings drawing themselves on with '~10 m' thickness, and a Cassini flyby ('Cassini · 2004–2017'). Every label matches a claim. Captions and labels readable; no AI footage, so no glitches. Minor: the hexagon is small at phone size; the probe is small. |
| ✅ | character | No character on screen by design (narrator hidden); Tilly's local Kokoro voice narrates clearly. |


## Sampled frames

- `channels/time-tourist/episodes/2026-10-17-strange-facts-about-saturn/qa/frames/t000.5s.jpg`
- `channels/time-tourist/episodes/2026-10-17-strange-facts-about-saturn/qa/frames/t001.5s.jpg`
- `channels/time-tourist/episodes/2026-10-17-strange-facts-about-saturn/qa/frames/t004.3s.jpg`
- `channels/time-tourist/episodes/2026-10-17-strange-facts-about-saturn/qa/frames/t008.6s.jpg`
- `channels/time-tourist/episodes/2026-10-17-strange-facts-about-saturn/qa/frames/t012.9s.jpg`
- `channels/time-tourist/episodes/2026-10-17-strange-facts-about-saturn/qa/frames/t017.2s.jpg`
- `channels/time-tourist/episodes/2026-10-17-strange-facts-about-saturn/qa/frames/t021.5s.jpg`
- `channels/time-tourist/episodes/2026-10-17-strange-facts-about-saturn/qa/frames/t025.8s.jpg`
