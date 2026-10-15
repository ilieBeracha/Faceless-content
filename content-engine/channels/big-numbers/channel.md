---
# Channel definition — checked by `./engine validate`.
# Annotation format: <required|optional> <type> [min=N] [max=N] — meaning
slug: big-numbers # required slug — folder name under channels/; never changes
name: "Big Numbers, Tiny Stories" # required string — public channel name
status: active # required enum(draft|active|paused) — draft until you approve it; paused stops new episodes
niche: "Mind-bending numbers (billions, light-years, doublings, odds) made graspable through one short illustrated story each." # required string — one sentence: what every video is about
audience:
  # required object
  who: "Curious teens and adults who love 'wait, that can't be true' facts about maths, time and scale" # required string — who watches, in plain words
  age_range: "13+" # required string — e.g. "8-12" or "18+"
  made_for_kids: false # required boolean — YouTube "made for kids" (COPPA) setting
tone: [ calm, wonder-struck, playful, precise ] # required list(string) min=2 max=6 — adjectives for how it feels
language: en # required string — language code of the voiceover
platforms: [ youtube-shorts, tiktok, instagram-reels ] # required list(ref(platform)) — where it will be posted later: youtube-shorts, tiktok, instagram-reels
cadence: "3 per week" # required string — e.g. "3 per week"
banned_topics:
  # required list(string) min=1 — subjects this channel never covers
  - gambling or betting tips (odds are fine as pure maths, never as a reason to bet)
  - financial or investment advice, get-rich claims, crypto
  - named real people's wealth, salaries or lives
  - disasters, wars, death tolls and casualty numbers
  - medical statistics or health advice
  - politics, elections and religion
  - conspiracy theories and pseudo-science
brand:
  # required object — the channel's look
  primary_color: "#f28c38" # required color — headline boxes
  accent_color: "#f28c38" # required color — caption highlight, callout lines
  background_top: "#0d0d0f" # required color — background gradient, top
  background_bottom: "#0d0d0f" # required color — background gradient, bottom
  text_color: "#ffffff" # optional color — on-screen text
  font: anton # required ref(font) — one of the fonts bundled with the engine
  caption_case: normal # optional enum(normal|upper) — UPPERCASE captions or not
  caption_color: "#f7d046" # optional color — single-word captions (defaults to the accent colour)
created: 2026-10-14 # required date — when the channel was created
approved: "2026-10-15" # optional date — set by `./engine approve channel`
approved_by: "ilieBeracha (approved in chat)" # optional string — who approved it
---

# Big Numbers, Tiny Stories

## Promise <!-- required -->

Every huge number becomes one tiny story you can picture. Dot walks it out, one drawing at a time, until a billion
feels like something you could hold.

## Style notes

- Calm narrator pace. The amazement comes from the comparison, never from hype words ("insane", "you won't
  believe", "mind-blowing" are out).
- One sentence = one picture. Stories escalate: one → a pile → a mountain → the planet.
- Numbers are exact and honestly rounded ("almost thirty-two years", never "thirty years"). Show the number on a
  sign, calendar or in big lettering when it's first said.
- Every episode ends with a one-line callback to the hook's words.
- Original stories only: never retell another creator's script or scene order.
