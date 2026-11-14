---
# Series definition — checked by `./engine validate`.
# Annotation format: <required|optional> <type> [min=N] [max=N] — meaning
slug: wait-what                 # required slug — file name series/<slug>.md
name: "Wait, What?"             # required string — shown in titles
status: active                  # required enum(draft|active|paused|retired)
format: "One surprising true fact: say it, show what everyone assumes instead, prove it with a number or a comparison, explain why, and leave one more odd detail."  # required string — one line: what happens in every episode
characters: [blink]             # required list(ref(character)) min=1 — characters from THIS channel; the first one narrates
length:                         # required object — overrides the engine default (20–60 s)
  min_seconds: 20               # required number min=5 max=180 — shortest acceptable video
  max_seconds: 35               # required number min=5 max=180 — longest acceptable video
hook_pattern: "State the fact flat out in four to six words with no warm-up (\"Bananas are berries.\"), the same words on screen in a headline box, Blink wide-eyed."  # required text — how the first 2 seconds grab attention
beats:                          # required list(object) min=2 max=8 — the structure every episode follows, in order
  - id: hook
    seconds: 3
    purpose: "The fact itself, as a short flat statement."
  - id: assume
    seconds: 5
    purpose: "What most people believe instead, so the fact has something to knock over."
  - id: proof
    seconds: 7
    purpose: "The evidence: one real number, date or side-by-side comparison on screen."
  - id: why
    seconds: 8
    purpose: "The reason it is true, in one picture the viewer can hold in their head."
  - id: kicker
    seconds: 4
    purpose: "One more odd detail about the same thing, or what nobody knows yet. No call to action."
visual_style: "Bold 2D motion graphics on a deep purple background: a headline box, big counters, size and timeline comparisons, icon rows and fact cards, one panel per beat. Blink sits in the lower-left corner and reacts; full-size on the hook. Word-by-word captions with the spoken word highlighted."  # required text — what the screen looks like
skills:                         # required object — the ONLY skills an episode of this series may load
  script: write-script          # required ref(skill:script) — writes the script JSON
  render: [render-motion-graphics, render-talking-character]  # required list(ref(skill:render)) min=1 — visual styles; mix and match
  captions: captions            # required ref(skill:captions) — word-by-word captions
caption_style: pages            # optional enum(pages|single-word) — a block of words with the spoken one highlighted, or one word at a time
cta: ""                         # optional string — closing line or call to action
created: 2026-11-14             # required date
---

# Wait, What?

## Notes

- Free to make: code-drawn motion graphics and the local Kokoro voice.
- One fact per video. If the fact needs two caveats to be true, pick another fact.
- Every number, date and label on screen is a claim with a checked source; popular "facts" that turn out to be
  myths are dropped, not hedged.
- A great episode makes the viewer repeat the first sentence to someone else.
