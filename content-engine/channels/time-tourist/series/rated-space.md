---
# Series definition — checked by `./engine validate`.
# Annotation format: <required|optional> <type> [min=N] [max=N] — meaning
slug: rated-space               # required slug — file name series/<slug>.md
name: "Rated: Space"           # required string — shown in titles
status: active                  # required enum(draft|active|paused|retired)
format: "Tilly takes a Budget Space Tour to one real wonder of the universe, films it on her phone like a real travel vlog (half selfies, half the view itself), and gives it an honest rating."  # required string — one line: what happens in every episode
characters: [tilly-space]       # required list(ref(character)) min=1 — characters from THIS channel; the first one narrates
length:                         # required object — overrides the engine default (20–60 s)
  min_seconds: 38               # required number min=5 max=180 — shortest acceptable video
  max_seconds: 62               # required number min=5 max=180 — longest acceptable video
hook_pattern: "Helmet selfie naming the wonder in five words or fewer (\"Saturn has a hexagon.\"), the wonder already visible behind her or reflected in her visor, the hook as a short headline."  # required text — how the first 2 seconds grab attention
beats:                          # required list(object) min=2 max=8 — the structure every episode follows, in order
  - id: hook                    # required slug — beat name used in scripts
    seconds: 3                  # required number min=1 max=60 — target duration
    purpose: "Helmet selfie naming the wonder."
  - id: arrival
    seconds: 9
    purpose: "Where we are, how far from Earth, and one fact that sets the scene."
  - id: tour
    seconds: 15
    purpose: "Three things she sees, each with a real detail, mostly pov shots of the view itself."
  - id: catch
    seconds: 10
    purpose: "The extreme or unexplained part: what would happen to you there, or what scientists still cannot explain (said plainly)."
  - id: rating
    seconds: 7
    purpose: "The rating, said out loud as 'N out of 5', and one line on what it says about our universe."
visual_style: "Live-action look: realistic handheld phone footage from a budget spacecraft or spacesuit: helmet selfies of a real-looking Tilly, and pov shots of the real wonder through the window or her visor, scientifically plausible, jump cuts, natural sound, word-by-word captions in the lower third."  # required text — what the screen looks like
skills:                         # required object — the ONLY skills an episode of this series may load
  script: write-script          # required ref(skill:script) — writes the script JSON
  render: [render-ai-video]     # required list(ref(skill:render)) min=1 — visual styles; mix and match
  captions: captions            # required ref(skill:captions) — word-by-word captions
caption_style: pages            # optional enum(pages|single-word) — a block of words with the spoken one highlighted, or one word at a time
cta: ""                         # optional string — closing line or call to action
created: 2026-10-16             # required date
---

# Rated: Space

## Notes

- Paid footage (Veo): about $6–9 an episode, capped at $25 including retries. Stills are approved before any
  video is made.
- 8–12 shots per episode; about half are `pov` shots of the wonder itself (through the window, the visor, or
  her phone pointed at it). Hook and rating are helmet selfies.
- Tilly is always somewhere a person could survive: inside a ship, in orbit, in a suit at a safe distance, or a
  balloon in a breathable layer. Never pretend the impossible is safe.
- Sizes, distances and temperatures are real and sourced (NASA, ESA, JPL). Unexplained things are said to be
  unexplained; speculation is labelled.
- No text in the picture; no real astronauts, no agency logos.
