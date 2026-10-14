---
# Series definition — checked by `./engine validate`.
# Annotation format: <required|optional> <type> [min=N] [max=N] — meaning
slug: my-series                 # required slug — file name series/<slug>.md
name: My Series                 # required string — shown in titles
status: active                  # required enum(draft|active|paused|retired)
format: ""                      # required string — one line: what happens in every episode
characters: []                  # required list(ref(character)) min=1 — characters from THIS channel; the first one narrates
length:                         # required object — overrides the engine default (20–60 s)
  min_seconds: 30               # required number min=5 max=180 — shortest acceptable video
  max_seconds: 45               # required number min=5 max=180 — longest acceptable video
hook_pattern: ""                # required text — how the first 2 seconds grab attention
beats:                          # required list(object) min=2 max=8 — the structure every episode follows, in order
  - id: hook                    # required slug — beat name used in scripts
    seconds: 3                  # required number min=1 max=60 — target duration
    purpose: ""                 # required text — what this beat must achieve
visual_style: ""                # required text — what the screen looks like
skills:                         # required object — the ONLY skills an episode of this series may load
  script: write-script          # required ref(skill:script) — writes the script JSON
  render: []                    # required list(ref(skill:render)) min=1 — visual styles; mix and match
  captions: captions            # required ref(skill:captions) — word-by-word captions
cta: ""                         # optional string — closing line or call to action
created: 2026-01-01             # required date
---

# {{name}}

## Notes

<!-- Recurring segments, running gags, what a great episode looks like. -->
