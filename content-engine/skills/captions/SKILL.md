---
name: captions
kind: captions
description: Word-by-word captions in the lower third; the word being spoken is highlighted, timed from the voice model.
---

# Skill: captions

Captions are generated, not written: you don't add anything to the script for them. They show the voiceover
exactly as written in `script.json` (so spelling and capitalisation there are what viewers read), a short page at a
time (≤ 2 lines), and highlight each word while it is spoken.

## How it works

- **Timings** come from the voice step (`audio/timings.json`). The local voice (Kokoro) predicts how long every
  phoneme lasts before generating audio; the engine reads those durations, so each word's start/end is exact — no
  speech recognition, no drift.
- **Pages** break at sentence ends and beat boundaries, and when a line would get too wide for the safe area.
- **Style**: white words with a dark outline, the spoken one on the channel's `accent_color`, in the channel's
  `font` and `caption_case` (`upper` for ALL-CAPS captions). Captions sit in the lower part of the safe area, above
  platform UI. A video's own settings (`captions.json`, else its storyboard's) can change the font, the words'
  colour, the highlight, the size, the place and the case, and hide them on some beats.
- **Drawn last, on their own**: the render makes the video without captions first (`out/<slug>/clean/<episode>.mp4`),
  then draws the captions over it. Changing how they look (the storefront's captions step, seen live over the clean
  video) draws only the captions again, in under a minute; nothing else is made again.

## What this means for the script writer

- Write numbers and names the way they should appear on screen; add `pronunciations` if the voice should say
  them differently (`"1938": "nineteen thirty-eight"`).
- Very long words (14+ letters) get a line to themselves; prefer shorter words.
- Punctuation shows on screen. Use "—" and "…" sparingly; they also create pauses in the voice.

## QA

`workflows/qa.md` checks that caption words equal the script, the highlighted word matches the timings on ≥ 98 %
of frames, no word is shown over silence, and captions never leave the safe area or overflow.
