---
# Channel definition — checked by `./engine validate`.
# Annotation format: <required|optional> <type> [min=N] [max=N] — meaning
slug: cosmic-footnotes                # required slug — folder name under channels/; never changes
name: "Cosmic Footnotes"                # required string — public channel name
status: active                  # required enum(draft|active|paused) — draft until you approve it; paused stops new episodes
niche: "Small, odd-looking findings about space, matter and time that turned out to matter enormously — one true story per video, always with its point."                       # required string — one sentence: what every video is about
audience:                       # required object
  who: "Curious teens and adults who love true science stories with a twist"                       # required string — who watches, in plain words
  age_range: "13+"                 # required string — e.g. "8-12" or "18+"
  made_for_kids: false          # required boolean — YouTube "made for kids" (COPPA) setting
tone: [curious, warm, witty, clear, awe-struck]                        # required list(string) min=2 max=6 — adjectives for how it feels
language: en                    # required string — language code of the voiceover
platforms: [youtube-shorts, tiktok, instagram-reels]                   # required list(ref(platform)) — where it will be posted later: youtube-shorts, tiktok, instagram-reels
cadence: "3 per week"                     # required string — e.g. "3 per week"
banned_topics:               # required list(string) min=1 — subjects this channel never covers
  - astrology or horoscopes presented as science
  - alien or UFO claims presented as fact (speculation only when clearly labelled)
  - conspiracy theories (moon-landing hoax, flat Earth and the like)
  - disasters, deaths and casualty numbers
  - medical or health advice
  - politics, elections and religion
brand:                          # required object — the channel's look
  primary_color: "#3b5bdb"      # required color — headline boxes
  accent_color: "#ffb547"       # required color — caption highlight, callout lines
  background_top: "#0b1020"     # required color — background gradient, top
  background_bottom: "#0b1020"  # required color — background gradient, bottom
  text_color: "#ffffff"         # optional color — on-screen text
  font: anton              # required ref(font) — one of the fonts bundled with the engine
  caption_case: normal          # optional enum(normal|upper) — UPPERCASE captions or not
  caption_color: "#ffd86b"      # optional color — single-word captions (defaults to the accent colour)
created: 2026-10-15             # required date — when the channel was created
approved: "2026-10-15"          # optional date — set by `./engine approve channel`
approved_by: "ilieBeracha (approved in chat)" # optional string — who approved it
---

# Cosmic Footnotes

## Promise <!-- required -->

Every video is one true footnote from science: a tiny, strange clue that turned out to change how we see the
universe, and why it matters to you.

## Style notes

- Every episode has a point. Before writing, answer: "So what? What did this change, or what does it mean for
  the viewer?" That answer is the payoff beat; if there isn't a good one, pick another idea.
- Stories, not lists: a person, a puzzle, a clue, the reveal. Real names and years when they help.
- Concrete over numeric: use a number only when it carries the point (and never a wall of digits).
- Wonder without hype: no "mind-blowing", "insane", "scientists baffled". Let the twist do the work.
- Strictly true: the real history, including the funny bits, with sources.
