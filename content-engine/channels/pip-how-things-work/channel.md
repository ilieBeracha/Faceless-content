---
# Channel definition — checked by `./engine validate`.
# Annotation format: <required|optional> <type> [min=N] [max=N] — meaning
slug: pip-how-things-work       # required slug — folder name under channels/; never changes
name: "Pip: How Things Work"    # required string — public channel name
status: active                  # required enum(draft|active|paused) — draft until you approve it; paused stops new episodes
niche: "Tiny 3D tear-downs of everyday objects that answer one 'why does it do that?' question each."  # required string — one sentence: what every video is about
audience:                       # required object
  who: "Curious people who like knowing how stuff works — older kids, teens and adults who watch with them"  # required string — who watches, in plain words
  age_range: "10+"              # required string — e.g. "8-12" or "18+"
  made_for_kids: false          # required boolean — YouTube "made for kids" (COPPA) setting
tone: [curious, fast, playful, clear, a little cheeky]  # required list(string) min=2 max=6 — adjectives for how it feels
language: en                    # required string — language code of the voiceover
platforms: [youtube-shorts, tiktok, instagram-reels]  # required list(ref(platform)) — where it will be posted later: youtube-shorts, tiktok, instagram-reels
cadence: "3 per week"           # required string — e.g. "3 per week"
banned_topics:                  # required list(string) min=1 — subjects this channel never covers
  - weapons, ammunition and anything built to hurt
  - opening mains-powered, pressurised or lithium-battery devices (never show or suggest it at home)
  - medical devices and health advice
  - brand comparisons, product rankings or endorsements
  - politics and religion
  - scary, gory or gross-out content
brand:                          # required object — the channel's look
  primary_color: "#ff5a3c"      # required color — headline boxes
  accent_color: "#ffd23f"       # required color — caption highlight, callout lines
  background_top: "#081226"     # required color — background gradient, top
  background_bottom: "#16284d"  # required color — background gradient, bottom
  text_color: "#ffffff"         # optional color — on-screen text
  font: montserrat              # required ref(font) — one of the fonts bundled with the engine
  caption_case: normal          # optional enum(normal|upper) — UPPERCASE captions or not
created: 2026-10-14             # required date — when the channel was created
approved: "2026-10-14"          # optional date — set by `./engine approve channel`
approved_by: "ilieBeracha (approved in chat)" # optional string — who approved it
---

# Pip: How Things Work

## Promise <!-- required -->

Every episode, Pip flies inside one object you use every day and comes back with the one "why" you never thought
to ask — in under a minute, with the parts labelled so you can see it, not just hear it.

## Style notes

- One object, one question, one satisfying answer. The answer is the moment a part "clicks" for the viewer.
- Pip talks fast but never rushes the payoff line. Short sentences; real part names, explained in kid-proof words.
- Numbers only when they surprise (sizes, speeds, counts) — always sourced.
- Visual identity: dark navy studio, low-poly parts in clean flat colours, yellow callout lines, Pip's cyan eye.
- Never suggests taking anything apart at home; the 3D model does the taking apart.
