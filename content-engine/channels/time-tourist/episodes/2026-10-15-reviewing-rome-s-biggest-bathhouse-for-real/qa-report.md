# QA report — Rome's biggest bathhouse, reviewed (live action)

**Status: FAIL** · episode `2026-10-15-reviewing-rome-s-biggest-bathhouse-for-real` · channel `time-tourist` · series `rated-live` · 2026-10-15

Checklist: `workflows/qa.md`. Video: `out/time-tourist/2026-10-15-reviewing-rome-s-biggest-bathhouse-for-real.mp4` (not in git).

## Automated checks

| | Check | Result |
|---|---|---|
| ✅ | Format | 1080×1920 @ 30.00 fps, h264/aac, yuvj420p |
| ❌ | Length | 60.80s (series allows 38–58s) |
| ✅ | Hook: speech starts immediately | first word at 0.10s (limit 0.5s) |
| ✅ | Hook: first line lands in 2 s | "Rome's biggest bathhouse." ends at 1.94s (limit 2s) |
| ✅ | Hook: on-screen text | visible from 0.07s |
| ✅ | Text inside safe areas | 2 text elements checked on every frame (1908 measurements) |
| ✅ | Nothing cut off | no element leaves the frame or overflows its box |
| ✅ | Captions in sync | 130 words; text matches script: yes; highlight off on 0/1809 frames; words over silent audio: 0 |
| ✅ | Loudness | -15.3 LUFS (target -14 ±1.5), true peak -4.4 dBTP (max -1) |
| ✅ | Banned topics (keyword screen) | none of 6 banned topics mentioned |
| ✅ | Footage is real (not placeholders) | 11 clips from veo-3.1-fast-generate-preview |
| ✅ | Every clip says its line | 11 clips checked by ear |
| ✅ | Within budget | $10.25 spent of $25.00 (43 paid calls logged in footage/ledger.json) |
| ✅ | Fact-check approved | approved by Ilie (11 claims) |

## Agent review

| | Area | Notes |
|---|---|---|
| ✅ | tone | Casual first-person selfie vlog, present tense, short lines, light humour aimed at the experience (no soap, one coin). The enslaved-workers line is said plainly and seriously, with no joke attached. Ends with 'Okay, review time' and a spoken 5/5 and 1/5 rating, as the series asks. Fits 13+. |
| ✅ | banned topics | Slavery is mentioned once, factually and respectfully (c10), never glorified or joked about. No violence, politics, religion or health advice. The keyword screen found nothing. |
| ✅ | visuals | Realistic handheld phone footage, a new place in every shot, the period fits (tunics, marble, mosaics, a furnace tunnel), captions and the hook headline are readable and inside safe areas. No burned-in letters or logos in the sampled frames. Minor: the hook's background has a weathered, blank stone panel; the rating-1 arcaded front reads slightly like the Colosseum; tour-3's shelves look like bound books rather than scrolls. None of these contradicts a claim. |
| ✅ | character | Same face, freckles, curly hair, red cap, mustard overshirt and crossbody bag in every shot, matching tilly-live's model.json and reference photo. Expressions fit the lines (excited hook, serious furnace line, deadpan soap line). Lip sync was judged from the sampled frames (mouth shapes match the highlighted caption words); every clip's audio was checked by transcription and says its exact line. |


## Sampled frames

- `channels/time-tourist/episodes/2026-10-15-reviewing-rome-s-biggest-bathhouse-for-real/qa/frames/t000.5s.jpg`
- `channels/time-tourist/episodes/2026-10-15-reviewing-rome-s-biggest-bathhouse-for-real/qa/frames/t001.5s.jpg`
- `channels/time-tourist/episodes/2026-10-15-reviewing-rome-s-biggest-bathhouse-for-real/qa/frames/t008.6s.jpg`
- `channels/time-tourist/episodes/2026-10-15-reviewing-rome-s-biggest-bathhouse-for-real/qa/frames/t017.2s.jpg`
- `channels/time-tourist/episodes/2026-10-15-reviewing-rome-s-biggest-bathhouse-for-real/qa/frames/t025.8s.jpg`
- `channels/time-tourist/episodes/2026-10-15-reviewing-rome-s-biggest-bathhouse-for-real/qa/frames/t034.4s.jpg`
- `channels/time-tourist/episodes/2026-10-15-reviewing-rome-s-biggest-bathhouse-for-real/qa/frames/t043.0s.jpg`
- `channels/time-tourist/episodes/2026-10-15-reviewing-rome-s-biggest-bathhouse-for-real/qa/frames/t051.6s.jpg`
