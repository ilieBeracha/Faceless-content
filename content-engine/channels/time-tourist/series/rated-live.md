---
# Series definition — checked by `./engine validate`.
# Annotation format: <required|optional> <type> [min=N] [max=N] — meaning
slug: rated-live                # required slug — file name series/<slug>.md
name: Rated (live action)       # required string — shown in titles
status: active                  # required enum(draft|active|paused|retired)
format: "Tilly visits one famous place or moment in history, films it selfie-style on her phone like a real travel vlog, and gives it an honest rating."  # required string — one line: what happens in every episode
characters: [tilly-live]        # required list(ref(character)) min=1 — characters from THIS channel; the first one narrates
length:                         # required object — overrides the engine default (20–60 s)
  min_seconds: 38               # required number min=5 max=180 — shortest acceptable video
  max_seconds: 62               # required number min=5 max=180 — longest acceptable video
hook_pattern: "Selfie greeting naming the place in five words or fewer (\"Reviewing Rome's biggest bathhouse.\"), Tilly already inside the place, the hook as a short headline."  # required text — how the first 2 seconds grab attention
beats:                          # required list(object) min=2 max=8 — the structure every episode follows, in order
  - id: hook                    # required slug — beat name used in scripts
    seconds: 3                  # required number min=1 max=60 — target duration
    purpose: "Selfie greeting naming the place or moment."
  - id: arrival
    seconds: 9
    purpose: "Where and when we are, and one fact that sets the scene."
  - id: tour
    seconds: 15
    purpose: "Three things she sees, each with a real detail, one shot each."
  - id: catch
    seconds: 10
    purpose: "The thing nobody tells you: the weird, uncomfortable or surprising truth (told with care if it is hard)."
  - id: rating
    seconds: 7
    purpose: "The rating, said out loud as 'N out of 5', and one line on what it says about life back then."
visual_style: "Live-action look: realistic handheld phone footage of a real-looking Tilly in period-accurate places, jump cuts between shots, natural sound, word-by-word captions in the lower third."  # required text — what the screen looks like
skills:                         # required object — the ONLY skills an episode of this series may load
  script: write-script          # required ref(skill:script) — writes the script JSON
  render: [render-ai-video]     # required list(ref(skill:render)) min=1 — visual styles; mix and match
  captions: captions            # required ref(skill:captions) — word-by-word captions
caption_style: pages            # optional enum(pages|single-word) — a block of words with the spoken one highlighted, or one word at a time
cta: ""                         # optional string — closing line or call to action
created: 2026-10-15             # required date
---

# Rated (live action)

## Notes

- Paid footage (Veo): about $6–9 an episode, capped at $25 including retries. Stills are approved before any
  video is made.
- 8–12 shots per episode, each a new place or angle; lines ≤ 18 words.
- Places and clothes must fit the era; extras are generic background people. No text in the picture.
- Pick moments that can be told kindly; for tragedies, the catch beat explains, it doesn't joke.
