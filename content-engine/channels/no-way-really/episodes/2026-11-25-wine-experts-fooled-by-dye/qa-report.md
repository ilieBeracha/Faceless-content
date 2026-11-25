# QA report — Dye fooled wine students

**Status: FAIL** · episode `2026-11-25-wine-experts-fooled-by-dye` · channel `no-way-really` · series `wait-what` · 2026-11-25

Checklist: `workflows/qa.md`. Video: `out/no-way-really/2026-11-25-wine-experts-fooled-by-dye.mp4` (not in git).

## Automated checks

| | Check | Result |
|---|---|---|
| ✅ | Format | 1080×1920 @ 30.00 fps, h264/aac, yuvj420p |
| ✅ | Length | 33.24s (series allows 20–35s) |
| ✅ | Hook: speech starts immediately | first word at 0.10s (limit 0.5s) |
| ✅ | Hook: first line lands in 2 s | "Dye fooled wine students." ends at 1.85s (limit 2s) |
| ✅ | Hook: captions on screen | visible from 0.17s |
| ✅ | Text inside safe areas | 8 text elements checked on every frame (2596 measurements) |
| ✅ | Nothing cut off | no element leaves the frame or overflows its box |
| ✅ | Captions in sync | 91 words; text matches script: yes; highlight off on 0/992 frames; words over silent audio: 0 |
| ✅ | Loudness | -14.0 LUFS (target -14 ±1.5), true peak -2.2 dBTP (max -1) |
| ✅ | Banned topics (keyword screen) | none of 6 banned topics mentioned |
| ✅ | Fact-check approved | approved by ilieBeracha (told Claude in chat not to wait for approval; not read before approving) (9 claims) |

## Agent review

| | Area | Notes |
|---|---|---|
| ❌ | tone | Honest and careful, but not surprised, playful or quick. The setup is one 25-word sentence with two clauses ('Frédéric Brochet, working on his doctorate, noticed experts describe smells with things coloured like the wine, and suspected colour chose their words'), and the turn packs two separate events (the dye smell check and session 1) into one long beat. That reads like a paper abstract, not like Blink telling a friend. The series asks for links like 'so' and 'here's the funny part', and none are used. The beats never sound amazed and Blink's catchphrase 'No way. Really.' never appears, although the series ending beat asks for it. |
| ✅ | banned topics | Keyword screen was clean, and nothing touches the banned topics indirectly. Wine appears only as a perception experiment with oenology students: no drinking, no health or diet claim, no advice. It is an approved peer-reviewed study, not a myth. Brochet is a real researcher named as the subject of the story, not used as a character. Alcohol is not on this channel's banned list, but it is a borderline subject for a 13+ audience. The video never shows or talks about drinking, so it passes. |
| ✅ | visuals | All 8 frames are clean paper collage on off-white: torn coloured sheets that move on every beat, taped notes, a dated-tag line and a cut-out two-glasses sticker. Captions are large, outlined and readable at phone size, with the spoken word highlighted in the accent green. Nothing overlaps or is cut off, and there are no scribbled pages or labels. The note text and the 'Dye / Session 1' tags are legible. In the ending, the glasses (one pale, one red) sit under 'SAME WHITE WINE', which shows the twist clearly. Minor issues: the hook has no word-by-word pasted paper strips as the series hook_pattern describes (only the glasses sticker and captions are shown). The tag '50 sniffers: no smell' is ambiguous: it means the dye added no smell, but it reads as if the wine had none. |
| ✅ | character | Blink is on-model in every frame: a mint-green egg blob with a dark outline, round glasses, pink cheeks, a small mouth and sparkles. It is full-size on the hook and ending and sits in the lower-left corner on the middle beats, as the series promises. The mouth shape changes between frames, and the expressions (wide-eyed on the hook, smiling on the turn) fit the lines. I judged only from the sampled frames. I did not hear the voice or check lip sync against the audio. |
| ❌ | point | The story is told in order and is mostly easy to follow: Brochet's hunch, the dye check, session 1, the same white twice a week later, then the result. It ends on what happened, with no preaching. It still fails on the 'say why' rule. The surprising thing is that trained students gave a white wine red-wine smell words, and the video never says why: what they saw overrode what they smelled. That is the angle's own point. The only hint is Brochet's hunch in the setup ('suspected colour chose their words'), 15 seconds earlier, and the payoff never confirms it. The twist beat, which the series says must explain why, only sets up the second session. The black glasses in the dye check are also unexplained (they hide the colour so only smell counts). The stakes are thin: 'working on his doctorate' never says the doctorate depended on the test. The ending also skips the series structure (where things stand now, then the catchphrase). |

**Fixes requested:**
- script.json ending: after the result, add one plain sentence saying why, e.g. that seeing red made them smell red, then end on 'No way. Really.' The series ending beat requires the catchphrase. Any new wording must go back through the fact-check (claim c1 already supports 'because of what they saw, the tasters discounted what they smelled').
- script.json setup: split the 25-word sentence into two short spoken sentences, and say what was at stake (his doctorate rested on testing the hunch, per the angle's stakes).
- script.json turn: split it into two sentences, the dye smell check and then session 1, and say why the glasses were black ('so nobody could see the colour').
- script.json voice: add one or two friend-telling links ('so', 'here's the funny part') so it sounds like Blink, not a paper abstract.
- script.json turn visual: change the tag '50 sniffers: no smell' to something that cannot be misread, e.g. 'Dye adds no smell' (keep it matched to claim c8).

## Sampled frames

- `channels/no-way-really/episodes/2026-11-25-wine-experts-fooled-by-dye/qa/frames/t000.5s.jpg`
- `channels/no-way-really/episodes/2026-11-25-wine-experts-fooled-by-dye/qa/frames/t001.5s.jpg`
- `channels/no-way-really/episodes/2026-11-25-wine-experts-fooled-by-dye/qa/frames/t004.7s.jpg`
- `channels/no-way-really/episodes/2026-11-25-wine-experts-fooled-by-dye/qa/frames/t009.3s.jpg`
- `channels/no-way-really/episodes/2026-11-25-wine-experts-fooled-by-dye/qa/frames/t009.5s.jpg`
- `channels/no-way-really/episodes/2026-11-25-wine-experts-fooled-by-dye/qa/frames/t014.0s.jpg`
- `channels/no-way-really/episodes/2026-11-25-wine-experts-fooled-by-dye/qa/frames/t014.2s.jpg`
- `channels/no-way-really/episodes/2026-11-25-wine-experts-fooled-by-dye/qa/frames/t018.6s.jpg`
- `channels/no-way-really/episodes/2026-11-25-wine-experts-fooled-by-dye/qa/frames/t018.9s.jpg`
- `channels/no-way-really/episodes/2026-11-25-wine-experts-fooled-by-dye/qa/frames/t023.3s.jpg`
- `channels/no-way-really/episodes/2026-11-25-wine-experts-fooled-by-dye/qa/frames/t023.6s.jpg`
- `channels/no-way-really/episodes/2026-11-25-wine-experts-fooled-by-dye/qa/frames/t028.0s.jpg`
- `channels/no-way-really/episodes/2026-11-25-wine-experts-fooled-by-dye/qa/frames/t028.4s.jpg`
