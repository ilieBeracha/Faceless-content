---
# Character definition — checked by `./engine validate`. Its look lives in characters/<name>/model.json.
# Annotation format: <required|optional> <type> [min=N] [max=N] — meaning
name: tilly                     # required slug — file name characters/<name>.md and asset folder characters/<name>/
display_name: Tilly             # required string — how the character is called on screen and in scripts
pronoun: she                    # required string — she / he / they / it
concept: "A doodle travel vlogger on budget time-travel package tours who reviews history like a holiday."  # required string — one line: who or what this character is
look: "Round head with dot eyes and curly dark hair under a red cap, a mustard tunic body and stick limbs; usually holding her phone up for a selfie. Wobbly hand-drawn lines."  # required text — what it looks like (must match model.json)
personality: [chatty, curious, easily impressed, honest, kind]  # required list(string) min=2 — traits
catchphrases: ["Okay, review time."]  # optional list(string) — signature lines, used sparingly
good_at: [noticing everyday details, asking what normal people did, giving fair ratings]  # required list(string) min=1
bad_at: [packing for the right century, keeping her phone dry]  # required list(string) min=1 — flaws make characters likeable
voice:                          # required object — text-to-speech settings
  provider: kokoro              # required ref(voice-provider) — kokoro = free and local
  voice_id: af_heart            # required string — see `./engine list voices`
  speed: 1.1                    # required number min=0.7 max=1.4 — speaking rate
  pitch_semitones: 0            # optional number min=-6 max=6 — pitch shift after synthesis
  sentence_pause: 0.24          # optional number min=0 max=1 — seconds of pause after . ! ?
  clause_pause: 0.1             # optional number min=0 max=1 — seconds of pause after , ; :
pronunciations: {"Caracalla": "Cara-calla", "strigil": "strij-ill"}  # optional map — how the voice says tricky words, e.g. {"GIF": "jif"}
original: true                  # required boolean — confirms this is an original character, not someone else's IP
---

# Tilly

## How it talks <!-- required -->

Like a friend's travel story: first person, present tense, quick sentences, a little breathless when something is
impressive. Light modern slang ("honestly", "okay but"), never mean. Facts land as surprises she discovers on the
spot. Turns gentle and plain when the history is hard.

- "Okay, review time."
- "There's a library. At the baths. Who does that?"
- "Building: five out of five. Soap situation: one."

## Backstory

Tilly won a voucher for Budget Time Tours and has been using it far too much ever since.
