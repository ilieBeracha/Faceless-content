---
# Character definition — checked by `./engine validate`. Its look lives in characters/<name>/model.json.
# Annotation format: <required|optional> <type> [min=N] [max=N] — meaning
name: my-character              # required slug — file name characters/<name>.md and asset folder characters/<name>/
display_name: My Character      # required string — how the character is called on screen and in scripts
pronoun: it                     # required string — she / he / they / it
concept: ""                     # required string — one line: who or what this character is
look: ""                        # required text — what it looks like (must match model.json)
personality: []                 # required list(string) min=2 — traits
catchphrases: []                # optional list(string) — signature lines, used sparingly
good_at: []                     # required list(string) min=1
bad_at: []                      # required list(string) min=1 — flaws make characters likeable
voice:                          # required object — text-to-speech settings
  provider: kokoro              # required ref(voice-provider) — kokoro = free and local
  voice_id: af_heart            # required string — see `./engine list voices`
  speed: 1.0                    # required number min=0.7 max=1.4 — speaking rate
  pitch_semitones: 0            # optional number min=-6 max=6 — pitch shift after synthesis
  sentence_pause: 0.25          # optional number min=0 max=1 — seconds of pause after . ! ?
  clause_pause: 0.1             # optional number min=0 max=1 — seconds of pause after , ; :
pronunciations: {}              # optional map — how the voice says tricky words, e.g. {"GIF": "jif"}
original: true                  # required boolean — confirms this is an original character, not someone else's IP
---

# {{display_name}}

## How it talks <!-- required -->

<!-- Sentence length, vocabulary, energy, verbal tics. A few example lines help. -->

## Backstory

<!-- Optional details the writer can draw on. -->
