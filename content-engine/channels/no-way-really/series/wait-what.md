---
# Series definition — checked by `./engine validate`.
# Annotation format: <required|optional> <type> [min=N] [max=N] — meaning
slug: wait-what                 # required slug — file name series/<slug>.md
name: "Wait, What?"             # required string — shown in titles
status: active                  # required enum(draft|active|paused|retired)
format: "One surprising true fact told as a small story: say it, set the scene, show the moment it happened, give the twist that explains it, and end on one plain sentence that says why it matters."  # required string — one line: what happens in every episode
characters: [blink]             # required list(ref(character)) min=1 — characters from THIS channel; the first one narrates
length:                         # required object — overrides the engine default (20–60 s)
  min_seconds: 20               # required number min=5 max=180 — shortest acceptable video
  max_seconds: 35               # required number min=5 max=180 — longest acceptable video
hook_pattern: "State the fact flat out in four to six words with no warm-up (\"Bananas are berries.\"), the same words on screen as pasted paper strips, Blink wide-eyed."  # required text — how the first 2 seconds grab attention
beats:                          # required list(object) min=2 max=8 — the structure every episode follows, in order
  - id: hook
    seconds: 3
    purpose: "The fact itself, as a short flat statement."
  - id: setup
    seconds: 5
    purpose: "The start of the story: when and where, and the problem someone has. One sentence."
  - id: turn
    seconds: 6
    purpose: "The middle: what they do about it and the moment they find the surprising thing."
  - id: twist
    seconds: 10
    purpose: "Why it is more than a coincidence: the detail that explains it, led in with a spoken turn such as \"Here's the funny part\"."
  - id: ending
    seconds: 6
    purpose: "The end: where the thing is now, then one plain sentence that says the point of the story, then the catchphrase. No call to action."
visual_style: "Paper collage on off-white paper: torn coloured sheets that change place on every beat, the hook pasted word by word in mixed cut-out lettering, taped notes, dated tags on a line and cut-out stickers. Blink sits in the lower-left corner and reacts; full-size on the hook. Word-by-word captions with the spoken word highlighted."  # required text — what the screen looks like
skills:                         # required object — the ONLY skills an episode of this series may load
  script: write-script          # required ref(skill:script) — writes the script JSON
  render: [render-themed, render-talking-character]  # required list(ref(skill:render)) min=1 — visual styles; mix and match
  captions: captions            # required ref(skill:captions) — word-by-word captions
caption_style: pages            # optional enum(pages|single-word) — a block of words with the spoken one highlighted, or one word at a time
cta: ""                         # optional string — closing line or call to action
created: 2026-11-14             # required date
---

# Wait, What?

## Notes

- Free to make: code-drawn paper collage and the local Kokoro voice.
- One fact per video. If the fact needs two caveats to be true, pick another fact.
- It is a story, not a list: each beat follows from the one before ("so", "and there it is", "here's the funny
  part"), and the last beat says the point in plain words. Talk like a person telling a friend; no poetry, no
  clipped fact-after-fact reading.
- Every number, date and label on screen is a claim with a checked source; popular "facts" that turn out to be
  myths are dropped, not hedged.
- A great episode makes the viewer repeat the first sentence to someone else.
