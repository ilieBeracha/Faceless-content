# QA report — Strange facts about Jupiter

**Status: PASS** · episode `2026-11-14-strange-facts-about-jupiter` · channel `time-tourist` · series `strange-space` · 2026-11-14

Checklist: `workflows/qa.md`. Video: `out/time-tourist/2026-11-14-strange-facts-about-jupiter.mp4` (not in git).

## Automated checks

| | Check | Result |
|---|---|---|
| ✅ | Format | 1080×1920 @ 30.00 fps, h264/aac, yuvj420p |
| ✅ | Length | 36.27s (series allows 20–40s) |
| ✅ | Hook: speech starts immediately | first word at 0.17s (limit 0.5s) |
| ✅ | Hook: first line lands in 2 s | "Jupiter is ridiculous." ends at 1.52s (limit 2s) |
| ✅ | Hook: on-screen text | visible from 0.17s |
| ✅ | Text inside safe areas | 19 text elements checked on every frame (2941 measurements) |
| ✅ | Nothing cut off | no element leaves the frame or overflows its box |
| ✅ | Captions in sync | 97 words; text matches script: yes; highlight off on 0/1057 frames; words over silent audio: 0 |
| ✅ | Loudness | -14.6 LUFS (target -14 ±1.5), true peak -4.2 dBTP (max -1) |
| ✅ | Banned topics (keyword screen) | none of 6 banned topics mentioned |
| ✅ | Fact-check approved | approved by ilieBeracha (11 claims) |

## Agent review

| | Area | Notes |
|---|---|---|
| ✅ | tone | First person, short sentences, light slang ("ridiculous", "One day here?"), Tilly's catchphrase once and a two-part rating as the closer. Casual, curious and honest; nothing mean. Fits a 13+ audience. |
| ✅ | banned topics | Planetary science only. No people, deaths, violence, politics, religion or health advice; every fact is sourced to NASA, so nothing is made up. The keyword screen found nothing. |
| ✅ | visuals | Reviewed the 8 sampled frames plus extra frames at 2.2-4.0s, 18.5s, 24.3s, 26.5s, 27.8s, 29.0s and 34.5s. Code-drawn Jupiter on a dark starfield with a new view per fact, as the series promises; labels and captions are readable at phone size and inside the safe areas. The first render failed this check: in the tilt view the "3°" number sat on top of the "spin axis" label for the whole beat. The renderer's number position was fixed and the episode re-rendered; in this render the number sits clear above the label. Minor, not blocking: the angle counts up, so intermediate values (e.g. "1.4°") show for about a second before it lands on 3°; the "11 Earths wide" label is fully visible for under a second because the hook is short. |
| ✅ | character | Tilly is off screen (placement hidden) as the series requires. Lines match her file: discovers facts on the spot, "Okay, review time.", rating format "Size: five out of five. Landing spots: zero." The voice is the Kokoro af_heart setting from her file; the audio was checked by the automated loudness and caption-sync checks, not listened to by the reviewer. |


## Sampled frames

- `channels/time-tourist/episodes/2026-11-14-strange-facts-about-jupiter/qa/frames/t000.5s.jpg`
- `channels/time-tourist/episodes/2026-11-14-strange-facts-about-jupiter/qa/frames/t001.5s.jpg`
- `channels/time-tourist/episodes/2026-11-14-strange-facts-about-jupiter/qa/frames/t005.1s.jpg`
- `channels/time-tourist/episodes/2026-11-14-strange-facts-about-jupiter/qa/frames/t010.2s.jpg`
- `channels/time-tourist/episodes/2026-11-14-strange-facts-about-jupiter/qa/frames/t015.3s.jpg`
- `channels/time-tourist/episodes/2026-11-14-strange-facts-about-jupiter/qa/frames/t020.4s.jpg`
- `channels/time-tourist/episodes/2026-11-14-strange-facts-about-jupiter/qa/frames/t025.5s.jpg`
- `channels/time-tourist/episodes/2026-11-14-strange-facts-about-jupiter/qa/frames/t030.6s.jpg`
