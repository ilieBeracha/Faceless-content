---
# Character definition — checked by `./engine validate`. Its look lives in characters/<name>/model.json.
# Annotation format: <required|optional> <type> [min=N] [max=N] — meaning
name: dot                       # required slug — file name characters/<name>.md and asset folder characters/<name>/
display_name: Dot               # required string — how the character is called on screen and in scripts
pronoun: they                   # required string — she / he / they / it
concept: "A round-headed doodle person in a little orange scarf who acts out huge numbers as tiny stories."  # required string — one line: who or what this character is
look: "A big beige circle head with dot eyes, small brows and a three-hair tuft; stick body and limbs in dark brown ink; a short orange scarf. Drawn with wobbly hand-drawn lines."  # required text — what it looks like (must match model.json)
personality: [endlessly patient, quietly amazed, precise, gently funny]  # required list(string) min=2 — traits
catchphrases: ["Let's make it smaller."]  # optional list(string) — signature lines, used sparingly
good_at: [turning a number into a picture, careful arithmetic, staying calm while the numbers explode]  # required list(string) min=1
bad_at: [hurrying, believing the answer the first time, rounding (it secretly hates rounding)]  # required list(string) min=1 — flaws make characters likeable
voice:                          # required object — text-to-speech settings
  provider: kokoro              # required ref(voice-provider) — kokoro = free and local
  voice_id: af_heart            # required string — see `./engine list voices`
  speed: 0.95                   # required number min=0.7 max=1.4 — speaking rate
  pitch_semitones: 0            # optional number min=-6 max=6 — pitch shift after synthesis
  sentence_pause: 0.3           # optional number min=0 max=1 — seconds of pause after . ! ?
  clause_pause: 0.12            # optional number min=0 max=1 — seconds of pause after , ; :
pronunciations: {}              # optional map — how the voice says tricky words, e.g. {"GIF": "jif"}
original: true                  # required boolean — confirms this is an original character, not someone else's IP
---

# Dot

## How it talks <!-- required -->

Short, calm sentences, mostly under ten words. Says numbers the way people say them out loud ("a billion",
"almost thirty-two years"), never as digits. Builds every story in steps — "Now make it bigger." — and lets the
last comparison land with a beat of silence. Warm, a little wry, never shouty.

- "A million seconds? About eleven and a half days."
- "Let's make it smaller."
- "Same number. Very different story."

## Backstory

Dot started as a doodle in the margin of a maths notebook and kept walking off the page whenever a number got too
big to imagine. The scarf is the only colour they own.
