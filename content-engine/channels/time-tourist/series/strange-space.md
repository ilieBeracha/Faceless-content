---
# Series definition — checked by `./engine validate`.
# Annotation format: <required|optional> <type> [min=N] [max=N] — meaning
slug: strange-space             # required slug — file name series/<slug>.md
name: "Strange Facts: Space"    # required string — shown in titles
status: active                  # required enum(draft|active|paused|retired)
format: "Five or six strange, true facts about one planet or moon, each shown on the planet itself: split it open, draw its rings, tilt it, float it, put a number on it."  # required string — one line: what happens in every episode
characters: [tilly]             # required list(ref(character)) min=1 — characters from THIS channel; the first one narrates
length:                         # required object — overrides the engine default (20–60 s)
  min_seconds: 20               # required number min=5 max=180 — shortest acceptable video
  max_seconds: 40               # required number min=5 max=180 — longest acceptable video
hook_pattern: "Name the world and promise weirdness in a first sentence of three or four words (\"Saturn is wild.\"), the planet already on screen."  # required text — how the first 2 seconds grab attention
beats:                          # required list(object) min=2 max=8 — the structure every episode follows, in order
  - id: hook
    seconds: 4
    purpose: "Name the world and land the first fact (often its size)."
  - id: fact-1
    seconds: 6
    purpose: "Inside it: what you'd find if you split it open."
  - id: fact-2
    seconds: 6
    purpose: "A physical oddity you can picture (density, temperature, gravity)."
  - id: fact-3
    seconds: 4
    purpose: "Its day, year or spin."
  - id: fact-4
    seconds: 4
    purpose: "A feature on it (a storm, a spot, a crater, a geyser)."
  - id: fact-5
    seconds: 6
    purpose: "Its rings, moons or tilt, with a number."
  - id: kicker
    seconds: 4
    purpose: "Who visited it and when, and one line that leaves you curious."
visual_style: "Motion-graphics explainer: one hero planet drawn by code on a dark starfield, a new view for every fact (cutaway, rings, tilt, big number, probe flyby, size comparison, spin, feature, float), labels in a clean sans, word-by-word captions with the spoken word highlighted. No characters on screen."  # required text — what the screen looks like
skills:                         # required object — the ONLY skills an episode of this series may load
  script: write-script          # required ref(skill:script) — writes the script JSON
  render: [render-planet-explainer]  # required list(ref(skill:render)) min=1 — visual styles; mix and match
  captions: captions            # required ref(skill:captions) — word-by-word captions
caption_style: pages            # optional enum(pages|single-word) — a block of words with the spoken one highlighted, or one word at a time
cta: ""                         # optional string — closing line or call to action
created: 2026-10-17             # required date
---

# Strange Facts: Space

## Notes

- Free to make: code-drawn visuals and the local Kokoro voice. Renders in minutes.
- Tilly narrates off screen (`character.placement: "hidden"`); the planet is the star.
- Every on-screen number and label is a claim with a NASA/ESA/JPL source.
