---
# Channel definition — checked by `./engine validate`.
# Annotation format: <required|optional> <type> [min=N] [max=N] — meaning
slug: no-way-really                # required slug — folder name under channels/; never changes
name: "No Way, Really?"                # required string — public channel name
status: active                  # required enum(draft|active|paused) — draft until you approve it; paused stops new episodes
niche: "One surprising, true, mostly useless fact per video, mostly about technology and the everyday things around us (gadgets, the internet, inventions, how things got their names), proven on screen with a number or a comparison."                       # required string — one sentence: what every video is about
audience:                       # required object
  who: "Teens and adults who like collecting odd facts to repeat to friends, and want them to actually be true"                       # required string — who watches, in plain words
  age_range: "13+"                 # required string — e.g. "8-12" or "18+"
  made_for_kids: false          # required boolean — YouTube "made for kids" (COPPA) setting
tone: [surprised, playful, curious, honest, quick]                        # required list(string) min=2 max=6 — adjectives for how it feels
language: en                    # required string — language code of the voiceover
platforms: [youtube-shorts, tiktok, instagram-reels]                   # required list(ref(platform)) — where it will be posted later: youtube-shorts, tiktok, instagram-reels
cadence: "3 per week"                     # required string — e.g. "3 per week"
banned_topics:               # required list(string) min=1 — subjects this channel never covers
  - modern politics, elections and religion
  - war, disasters, crime and deaths used as trivia
  - medical, health, diet or money advice
  - sexual content and gross-out gore
  - popular myths, urban legends or unverified claims presented as fact
  - tricks or stunts a viewer could copy and get hurt
brand:                          # required object — the channel's look
  primary_color: "#7b2ff7"      # required color — headline boxes
  accent_color: "#00e5a8"       # required color — caption highlight, callout lines
  background_top: "#1e1147"     # required color — background gradient, top
  background_bottom: "#120b2e"  # required color — background gradient, bottom
  text_color: "#ffffff"         # optional color — on-screen text
  font: space-grotesk              # required ref(font) — one of the fonts bundled with the engine
  caption_case: normal          # optional enum(normal|upper) — UPPERCASE captions or not
  caption_color: "#fff275"      # optional color — single-word captions (defaults to the accent colour)
created: 2026-11-14             # required date — when the channel was created
approved: "2026-11-14"          # optional date — set by `./engine approve channel`
approved_by: "ilieBeracha"      # optional string — who approved it
---

# No Way, Really?

## Promise <!-- required -->

Every video hands you one fact you did not know, will not need, and will repeat to someone today, with the proof
on screen so you can trust it.

## Belief <!-- required -->

Nothing around you is boring; it only looks that way until you know the story behind it.

## What the viewer gets <!-- required -->

One true thing to say out loud today that makes something ordinary in their hands, pocket or screen interesting again, with the proof to back it up.

## Style notes

- Lead with the fact, never with "did you know". The surprise is the first sentence.
- One fact per video. Prove it with one number, date or side-by-side picture, then say why it is true.
- True beats amazing: if a famous "fact" is a myth or the sources disagree, drop it or say "about".
- Light and friendly. The joke is how strange the world is, never a person or a group.
- No call to action and no "follow for more".
