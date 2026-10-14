---
# Fields are documented in templates/series.md — check with: ./engine validate
slug: inside-it
name: Inside It
status: active
format: Pip flies the camera into one everyday object, takes it apart in an explode view, and labels the parts that answer one "why" question.
characters: [pip]
length:
  min_seconds: 35
  max_seconds: 50
hook_pattern: >-
  Pip asks the object's one "why" question in five words or fewer ("Why doesn't your pen leak?") while the
  whole object spins in close-up, with the question on screen from the first frame.
beats:
  - id: hook
    seconds: 3
    purpose: Ask the why-question while the object is on screen; Pip is big and curious.
  - id: fly-in
    seconds: 7
    purpose: The camera flies into the object; Pip spots where the answer must be hiding and teases it.
  - id: explode
    seconds: 12
    purpose: The object comes apart; callouts name the 2–3 parts that matter, each in kid-proof words.
  - id: key-part
    seconds: 12
    purpose: Focus on the part that answers the question and show how it does it, with one picture-able comparison or number.
  - id: payoff
    seconds: 6
    purpose: Answer the question in one line, then a tiny surprise or Pip's catchphrase; the object reassembles.
visual_style: >-
  Low-poly 3D parts in clean flat colours on a dark navy studio background with a soft glow; the camera flies in,
  the object explodes along its long axis, yellow callout lines point at labelled parts; chrome Pip sits big in the
  hook and payoff, small in the corner otherwise; bold word-by-word captions.
skills:
  script: write-script
  render: [render-3d-explainer, render-talking-character]
  captions: captions
cta: ""
created: 2026-10-14
---

# Inside It

## Notes

- One object per episode, always the whole object first (hook), then inside it.
- The explode view is the hero shot: spread parts along the long axis so every callout has room.
- The key part should be tiny or hidden in the assembled object — that's what makes the fly-in worth it.
- End on the answer, not on a call to action.
