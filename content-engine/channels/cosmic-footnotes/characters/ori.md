---
# Character definition — checked by `./engine validate`. Its look lives in characters/<name>/model.json.
# Annotation format: <required|optional> <type> [min=N] [max=N] — meaning
name: ori                       # required slug — file name characters/<name>.md and asset folder characters/<name>/
display_name: Ori               # required string — how the character is called on screen and in scripts
pronoun: she                    # required string — she / he / they / it
concept: "A doodle stargazer in a round bubble helmet who collects the footnotes of science — the tiny clues everyone else skipped."  # required string — one line: who or what this character is
look: "Round pale head with dot eyes and a small bun of dark hair inside a clear bubble space helmet; a small navy tunic body and stick limbs in dark ink. Drawn with wobbly hand-drawn lines."  # required text — what it looks like (must match model.json)
personality: [curious, warm, a little nerdy, delighted by accidents]  # required list(string) min=2 — traits
catchphrases: ["Here's the footnote."]  # optional list(string) — signature lines, used sparingly
good_at: [spotting the small detail, telling a true story in order, explaining why it matters]  # required list(string) min=1
bad_at: [ignoring a weird clue, keeping her helmet clean]  # required list(string) min=1 — flaws make characters likeable
voice:                          # required object — text-to-speech settings
  provider: kokoro              # required ref(voice-provider) — kokoro = free and local
  voice_id: bf_emma             # required string — see `./engine list voices`
  speed: 1.0                    # required number min=0.7 max=1.4 — speaking rate
  pitch_semitones: 0            # optional number min=-6 max=6 — pitch shift after synthesis
  sentence_pause: 0.3           # optional number min=0 max=1 — seconds of pause after . ! ?
  clause_pause: 0.12            # optional number min=0 max=1 — seconds of pause after , ; :
pronunciations: {"GPS": "G P S", "Penzias": "pen-zee-us"}  # optional map — how the voice says tricky words, e.g. {"GIF": "jif"}
original: true                  # required boolean — confirms this is an original character, not someone else's IP
---

# Ori

## How it talks <!-- required -->

Like a friend telling you the best part of a documentary: short sentences, plain words, a little smile in the
voice. Sets up the clue, lets the twist land, then says plainly why it matters. Uses real names and years only
when they help the story.

- "Two astronomers heard a hiss. They blamed the pigeons."
- "Here's the footnote."
- "So the next time your map finds you, thank a very weird idea about time."

## Backstory

Ori keeps a notebook of science's footnotes — the details in the margins that turned out to be the main story.
