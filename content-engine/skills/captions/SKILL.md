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
- **Style** comes from the channel's brand: `font`, `accent_color` (highlight), `text_color`, `caption_case`
  (`upper` for ALL-CAPS captions). Captions sit in the lower part of the safe area, above platform UI.

## What this means for the script writer

- Write numbers and names the way they should appear on screen; add `pronunciations` if the voice should say
  them differently (`"1938": "nineteen thirty-eight"`).
- Very long words (14+ letters) get a line to themselves; prefer shorter words.
- Punctuation shows on screen. Use "—" and "…" sparingly; they also create pauses in the voice.

## QA

`workflows/qa.md` checks that caption words equal the script, the highlighted word matches the timings on ≥ 98 %
of frames, no word is shown over silence, and captions never leave the safe area or overflow.
