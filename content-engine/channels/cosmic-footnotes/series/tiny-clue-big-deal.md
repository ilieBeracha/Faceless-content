---
# Series definition — checked by `./engine validate`.
# Annotation format: <required|optional> <type> [min=N] [max=N] — meaning
slug: tiny-clue-big-deal        # required slug — file name series/<slug>.md
name: Tiny Clue, Big Deal       # required string — shown in titles
status: active                  # required enum(draft|active|paused|retired)
format: "One true story: a small, odd clue about space, matter or time → how people figured it out → why it matters (the point)."  # required string — one line: what happens in every episode
characters: [ori]               # required list(ref(character)) min=1 — characters from THIS channel; the first one narrates
length:                         # required object — overrides the engine default (20–60 s)
  min_seconds: 40               # required number min=5 max=180 — shortest acceptable video
  max_seconds: 58               # required number min=5 max=180 — longest acceptable video
hook_pattern: "The odd clue in five words or fewer, stated as a fact that sounds wrong (\"Your phone needs Einstein.\"), with the first scene showing it and the title bar naming it."  # required text — how the first 2 seconds grab attention
beats:                          # required list(object) min=2 max=8 — the structure every episode follows, in order
  - id: hook                    # required slug — beat name used in scripts
    seconds: 3                  # required number min=1 max=60 — target duration
    purpose: "The surprising claim in one short sentence."
  - id: clue
    seconds: 10
    purpose: "The small, strange observation: who noticed what, where, when. Make it concrete and a little funny if the history allows."
  - id: story
    seconds: 18
    purpose: "How it was worked out, in 3–4 short sentences, one picture each. The reveal lands at the end."
  - id: point
    seconds: 12
    purpose: "Why it matters: what it changed, or what it means in the viewer's own life. This is the reason the video exists."
  - id: kicker
    seconds: 4
    purpose: "One line that ties the point back to the hook."
visual_style: "Storybook: a square hand-drawn picture under a two-tone title bar on a dark night-blue frame. Muted watercolour scenes, Ori in her bubble helmet in every scene, a new picture for every sentence, one-word gold captions."  # required text — what the screen looks like
skills:                         # required object — the ONLY skills an episode of this series may load
  script: write-script          # required ref(skill:script) — writes the script JSON
  render: [render-storybook]    # required list(ref(skill:render)) min=1 — visual styles; mix and match
  captions: captions            # required ref(skill:captions) — word-by-word captions
caption_style: single-word      # optional enum(pages|single-word) — a block of words with the spoken one highlighted, or one word at a time
cta: ""                         # optional string — closing line or call to action
created: 2026-10-15             # required date
---

# Tiny Clue, Big Deal

## Notes

- The point beat is mandatory and specific: "without this, your map would be wrong by kilometres a day" beats
  "this changed science forever".
- Numbers only when they carry the story; round them and say them the way people talk.
- Pictures from the render-storybook library; one per sentence. If a sentence can't be drawn, rewrite it.
- Title bar: the hook phrase (≤ 30 characters).
