---
# A brainstormed channel idea, waiting for a decision. Lives in drafts/niches/.
# Annotation format: <required|optional> <type> [min=N] [max=N] — meaning
draft:                          # required object — decision tracking (set by the engine)
  kind: niche                   # required enum(niche)
  status: proposed              # required enum(proposed|approved|rejected)
  created: 2026-01-01           # required date
slug: my-niche                  # required slug — proposed channel slug
name: ""                        # required string — proposed channel name
niche: ""                       # required string — one sentence
audience: ""                    # required string — who watches
why_it_works: ""                # required text — demand, repeatability, what makes it different
character: ""                   # required text — the original character: look, personality, voice
series: ""                      # required text — the first series: format, length, beats
visual_style: ""                # required text — what it looks like on screen
render_skills: []               # required list(ref(skill:render)) min=1 — existing render skills it would use
sample_ideas: []                # required list(string) min=3 — example episodes
risks: ""                       # required text — fact-checking load, safety, platform rules, competition
---

## Pitch

<!-- Optional longer pitch. -->
