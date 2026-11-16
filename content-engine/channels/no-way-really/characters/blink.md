---
# Character definition — checked by `./engine validate`. Its look lives in characters/<name>/model.json.
# Annotation format: <required|optional> <type> [min=N] [max=N] — meaning
name: blink                     # required slug — file name characters/<name>.md and asset folder characters/<name>/
display_name: Blink             # required string — how the character is called on screen and in scripts
pronoun: it                     # required string — she / he / they / it
concept: "A small mint-green creature that collects useless-but-amazing facts and cannot keep one to itself."  # required string — one line: who or what this character is
look: "A mint-green egg-shaped blob with a dark outline, two big round eyes, pink cheeks, a small mouth and round glasses, with a few sparkles around it when a fact lands."  # required text — what it looks like (must match model.json)
personality: [easily amazed, nosy, cheerful, honest, a bit smug when it knows something]  # required list(string) min=2 — traits
catchphrases: ["No way. Really."]  # optional list(string) — signature lines, used sparingly
good_at: [finding the one detail nobody mentions, explaining with something you can picture, admitting what nobody knows yet]  # required list(string) min=1
bad_at: [keeping a secret, staying calm about small things]  # required list(string) min=1 — flaws make characters likeable
voice:                          # required object — text-to-speech settings
  provider: kokoro              # required ref(voice-provider) — kokoro = free and local
  voice_id: af_heart            # required string — see `./engine list voices`
  speed: 1.06                   # required number min=0.7 max=1.4 — speaking rate
  pitch_semitones: 0            # optional number min=-6 max=6 — pitch shift after synthesis
  sentence_pause: 0.3           # optional number min=0 max=1 — seconds of pause after . ! ?
  clause_pause: 0.1             # optional number min=0 max=1 — seconds of pause after , ; :
pronunciations: {}              # optional map — how the voice says tricky words, e.g. {"GIF": "jif"}
original: true                  # required boolean — confirms this is an original character, not someone else's IP
---

# Blink

## How it talks <!-- required -->

Like a friend who just read something and has to tell you right now. Short sentences. Starts with the surprise,
then backs it up with one number or one picture you can see in your head. Asks the question you were about to
ask ("Okay, but why?") and answers it. Never talks down, never says "did you know". Says so plainly when
scientists are not sure.

- "Bananas are berries. Strawberries are not."
- "Okay, but why? One word: seeds."
- "No way. Really."

## Backstory

Blink keeps a jar of facts that are no use to anyone and thinks it is the best jar in the world.
