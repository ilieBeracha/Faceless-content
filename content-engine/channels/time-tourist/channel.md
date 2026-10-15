---
# Channel definition — checked by `./engine validate`.
# Annotation format: <required|optional> <type> [min=N] [max=N] — meaning
slug: time-tourist                # required slug — folder name under channels/; never changes
name: "Time Tourist"                # required string — public channel name
status: draft                   # required enum(draft|active|paused) — draft until you approve it; paused stops new episodes
niche: "A budget time-traveller vlogs famous places and moments in history and reviews them like a travel influencer — real facts, honest star ratings."                       # required string — one sentence: what every video is about
audience:                       # required object
  who: "Teens and adults who like history best when it feels like scrolling a travel feed"                       # required string — who watches, in plain words
  age_range: "13+"                 # required string — e.g. "8-12" or "18+"
  made_for_kids: false          # required boolean — YouTube "made for kids" (COPPA) setting
tone: [casual, funny, curious, honest, respectful]                        # required list(string) min=2 max=6 — adjectives for how it feels
language: en                    # required string — language code of the voiceover
platforms: [youtube-shorts, tiktok, instagram-reels]                   # required list(ref(platform)) — where it will be posted later: youtube-shorts, tiktok, instagram-reels
cadence: "3 per week"                     # required string — e.g. "3 per week"
banned_topics:               # required list(string) min=1 — subjects this channel never covers
  - jokes about real victims, deaths or suffering (tragedies are told with care, never as punchlines)
  - graphic violence, gore or torture
  - glorifying war, empire or slavery
  - modern politics, elections and religion
  - medical or health advice
  - made-up history presented as fact
brand:                          # required object — the channel's look
  primary_color: "#d1495b"      # required color — headline boxes
  accent_color: "#edae49"       # required color — caption highlight, callout lines
  background_top: "#14110f"     # required color — background gradient, top
  background_bottom: "#14110f"  # required color — background gradient, bottom
  text_color: "#ffffff"         # optional color — on-screen text
  font: anton              # required ref(font) — one of the fonts bundled with the engine
  caption_case: normal          # optional enum(normal|upper) — UPPERCASE captions or not
  caption_color: "#ffe08a"      # optional color — single-word captions (defaults to the accent colour)
created: 2026-10-15             # required date — when the channel was created
approved: ""                    # optional date — set by `./engine approve channel`
approved_by: ""                 # optional string — who approved it
---

# Time Tourist

## Promise <!-- required -->

Every episode is a holiday to a famous moment in history: what it was really like to be there, what nobody
tells you, and an honest rating at the end.

## Style notes

- Selfie-vlog voice: first person, present tense, short sentences, light modern slang (no swearing, no slurs).
- Every joke is about the experience of being there (no soap, weird food, the queue), never about the people
  who suffered. When the history is hard (slavery, disease, war), say it plainly and kindly, then move on.
- Strictly true: names, dates, numbers and customs come from sources; when sources disagree, say "about".
- Every episode ends with a rating (on a sign, like "5/5") and one line on what it tells us about life back then.
