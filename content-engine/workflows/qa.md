# Workflow: QA checklist

Every video must pass all of this before it counts as done. The engine checks the first group itself
(`qa/automated.json`); the agent checks the second group by watching the sampled frames and reading the
script (`qa-review.json`). Results are written to the episode's `qa-report.md`.

## Automated (engine)

- [ ] **Format** — 1080×1920, 30 fps, H.264 video + AAC audio, MP4.
- [ ] **Length** — inside the series' `length.min_seconds`–`max_seconds`.
- [ ] **Hook in the first 2 s** — speech starts by 0.5 s; the first sentence ends by 2.0 s; the captions are on
      screen by 0.5 s (they are the only words on screen, and stay up from the first frame to the last).
- [ ] **Safe areas** — every caption, headline, label and graphic text stays inside the platform-safe area
      (top 250 px, bottom 440 px, left 60 px, right 150 px of the 1080×1920 frame) on every frame.
- [ ] **Nothing cut off** — no text leaves the frame or overflows its box on any frame.
- [ ] **Captions in sync** — caption words equal the script's words; the highlighted word matches the word
      timings on ≥ 98 % of frames; no word is shown over silent audio.
- [ ] **Loudness** — -14 LUFS ± 1.5 integrated, true peak ≤ -1 dBTP.
- [ ] **Banned topics (keyword screen)** — none of the channel's banned topics appear (a hit can be cleared
      only by the reviewer as a false positive).
- [ ] **Fact-check** — approved, and the approval matches the current script.

## Review (agent, from the frames and the script)

- [ ] **Point** — argues the point in the script's `angle` (the channel's Belief), told through someone with something at stake, with a turn, and the story itself makes the point plain, ending on what happened. True facts with no point fail. It explains plainly, in the order things
  happened (no opening on the ending, teasing, flashbacks or clever dramatic lines), introduces every person and
  thing before referring to them, says why when someone does something surprising, and ends on what happened. A
  viewer who can't follow what happened and why fails, and so does an ending that preaches: advice, "next time…",
  "trust yourself", a pep talk or a moral addressed to the viewer.
- [ ] **Tone** — sounds like this channel (tone adjectives, audience age, the character's way of talking).
- [ ] **Banned topics** — nothing touches them, even indirectly.
- [ ] **Visuals** — readable at phone size, nothing overlapping, the object/graphics are clear, the visual
      style is what the series promises, no ugly frames (empty screens, glitches, wrong colours), no shot of a page, sign or label that comes out as
      meaningless scribbles.
- [ ] **Character** — on-model (matches its file), mouth moves with the voice, expressions fit the lines.

## On a pass
`publish.json` is written with `ai_disclosure` (always `ai_generated: true`) and `status: not-posted`, and the
review's learnings are appended to this channel's `learnings.md`. On a fail, the report lists what to fix —
usually in `script.json` — and the pipeline re-runs from the step that changed.
