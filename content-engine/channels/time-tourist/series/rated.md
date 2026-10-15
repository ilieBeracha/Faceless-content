---
# Series definition — checked by `./engine validate`.
# Annotation format: <required|optional> <type> [min=N] [max=N] — meaning
slug: rated                     # required slug — file name series/<slug>.md
name: Rated                     # required string — shown in titles
status: active                  # required enum(draft|active|paused|retired)
format: "Tilly visits one famous place or moment in history, vlogs it selfie-style, and gives it an honest rating."  # required string — one line: what happens in every episode
characters: [tilly]             # required list(ref(character)) min=1 — characters from THIS channel; the first one narrates
length:                         # required object — overrides the engine default (20–60 s)
  min_seconds: 40               # required number min=5 max=180 — shortest acceptable video
  max_seconds: 58               # required number min=5 max=180 — longest acceptable video
hook_pattern: "The destination as a selfie greeting in five words or fewer (\"Reviewing Rome's biggest bathhouse.\"), Tilly holding her phone up in the first scene."  # required text — how the first 2 seconds grab attention
beats:                          # required list(object) min=2 max=8 — the structure every episode follows, in order
  - id: hook                    # required slug — beat name used in scripts
    seconds: 3                  # required number min=1 max=60 — target duration
    purpose: "Selfie greeting naming the place or moment."
  - id: arrival
    seconds: 9
    purpose: "Where and when we are, and one fact that sets the scene."
  - id: tour
    seconds: 15
    purpose: "Three things she sees, each with a real detail, one picture each."
  - id: catch
    seconds: 10
    purpose: "The thing nobody tells you: the weird, uncomfortable or surprising truth (told with care if it is hard)."
  - id: rating
    seconds: 7
    purpose: "The rating on a sign and one line on what it says about life back then."
visual_style: "Storybook: hand-drawn scenes under a two-tone title bar on near-black; Tilly holding her phone selfie-style in the hook and rating; one new picture per sentence; one-word yellow captions."  # required text — what the screen looks like
skills:                         # required object — the ONLY skills an episode of this series may load
  script: write-script          # required ref(skill:script) — writes the script JSON
  render: [render-storybook]    # required list(ref(skill:render)) min=1 — visual styles; mix and match
  captions: captions            # required ref(skill:captions) — word-by-word captions
caption_style: single-word      # optional enum(pages|single-word) — a block of words with the spoken one highlighted, or one word at a time
cta: ""                         # optional string — closing line or call to action
created: 2026-10-15             # required date
---

# Rated

## Notes

- Selfie shots: Tilly in the foreground, `pose: hold`, `hold: phone`, scale 1.9–2.1, so her face stays above the
  caption band; everyday shots at scale ≤ 1.2.
- The rating goes on a sign as "N/5" (not star symbols).
- Pick moments that can be told kindly; for tragedies, the catch beat explains, it doesn't joke.
