---
# Channel definition — checked by `./engine validate`.
# Annotation format: <required|optional> <type> [min=N] [max=N] — meaning
slug: big-numbers                # required slug — folder name under channels/; never changes
name: "Big Numbers, Tiny Stories"                # required string — public channel name
status: draft                   # required enum(draft|active|paused) — draft until you approve it; paused stops new episodes
niche: ""                       # required string — one sentence: what every video is about
audience:                       # required object
  who: ""                       # required string — who watches, in plain words
  age_range: ""                 # required string — e.g. "8-12" or "18+"
  made_for_kids: false          # required boolean — YouTube "made for kids" (COPPA) setting
tone: []                        # required list(string) min=2 max=6 — adjectives for how it feels
language: en                    # required string — language code of the voiceover
platforms: []                   # required list(ref(platform)) — where it will be posted later: youtube-shorts, tiktok, instagram-reels
cadence: ""                     # required string — e.g. "3 per week"
banned_topics: []               # required list(string) min=1 — subjects this channel never covers
brand:                          # required object — the channel's look
  primary_color: "#3d5afe"      # required color — headline boxes
  accent_color: "#ffb300"       # required color — caption highlight, callout lines
  background_top: "#0d1b2a"     # required color — background gradient, top
  background_bottom: "#1b263b"  # required color — background gradient, bottom
  text_color: "#ffffff"         # optional color — on-screen text
  font: montserrat              # required ref(font) — one of the fonts bundled with the engine
  caption_case: normal          # optional enum(normal|upper) — UPPERCASE captions or not
  caption_color: "#ffd23f"      # optional color — single-word captions (defaults to the accent colour)
created: 2026-10-14             # required date — when the channel was created
approved: ""                    # optional date — set by `./engine approve channel`
approved_by: ""                 # optional string — who approved it
---

# Big Numbers, Tiny Stories

## Promise <!-- required -->

<!-- One or two sentences: why someone follows this channel. -->

## Style notes

<!-- Voice, pacing, recurring jokes, what to avoid. -->
