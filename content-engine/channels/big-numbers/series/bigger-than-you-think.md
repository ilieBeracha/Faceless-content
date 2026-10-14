---
# Series definition — checked by `./engine validate`.
# Annotation format: <required|optional> <type> [min=N] [max=N] — meaning
slug: bigger-than-you-think     # required slug — file name series/<slug>.md
name: Bigger Than You Think     # required string — shown in titles
status: active                  # required enum(draft|active|paused|retired)
format: "One huge number, one tiny story: Dot acts out a step-by-step comparison until the number finally feels real."  # required string — one line: what happens in every episode
characters: [dot]               # required list(ref(character)) min=1 — characters from THIS channel; the first one narrates
length:                         # required object — overrides the engine default (20–60 s)
  min_seconds: 40               # required number min=5 max=180 — shortest acceptable video
  max_seconds: 55               # required number min=5 max=180 — longest acceptable video
hook_pattern: "The number itself as a short question or claim (about five words), e.g. \"How long is a billion seconds?\" — the first scene shows the number on a sign or in big lettering while Dot reacts, and the title bar names it."  # required text — how the first 2 seconds grab attention
beats:                          # required list(object) min=2 max=8 — the structure every episode follows, in order
  - id: hook                    # required slug — beat name used in scripts
    seconds: 3                  # required number min=1 max=60 — target duration
    purpose: "Say the number as a surprising question or claim. One sentence."
  - id: setup
    seconds: 8
    purpose: "Why our gut gets it wrong: compare it with a smaller number that sounds similar, or give the plain maths in one line."
  - id: story
    seconds: 25
    purpose: "The tiny story: 3 to 5 short sentences, each one a new scene that is bigger than the last."
  - id: twist
    seconds: 8
    purpose: "The comparison that lands: what the number really means, said simply."
  - id: kicker
    seconds: 4
    purpose: "One line that calls back to the hook's words."
visual_style: "Storybook: a square hand-drawn picture under a two-tone title bar on black. Muted watercolour settings (sage hills, sand, slate sea, beige sky), Dot posed in every scene, a new scene for every sentence, one-word yellow captions in the upper middle of the picture."  # required text — what the screen looks like
skills:                         # required object — the ONLY skills an episode of this series may load
  script: write-script          # required ref(skill:script) — writes the script JSON
  render: [render-storybook]    # required list(ref(skill:render)) min=1 — visual styles; mix and match
  captions: captions            # required ref(skill:captions) — word-by-word captions
caption_style: single-word      # optional enum(pages|single-word) — a block of words with the spoken one highlighted, or one word at a time
cta: ""                         # optional string — closing line or call to action
created: 2026-10-14             # required date
---

# Bigger Than You Think

## Notes

- Plan the pictures from the render-storybook library (settings, poses, props) before writing lines — if a sentence
  can't be drawn, rewrite the sentence.
- Escalate: each story scene is bigger than the last (one jar → a row of jars → the sea).
- The number appears on screen the first time it's said (sign, calendar, big lettering), with digits and commas.
- Title bar: the hook as a short phrase (≤ 30 characters), the number highlighted.
- The kicker reuses the hook's words ("…and that's just a billion seconds.").
