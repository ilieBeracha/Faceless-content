# Workflow: episode pipeline

**idea → research → script → script review → fact-check → [footage] → [paint] → voice → [motion] → render → QA → (later) post**

One command runs it for any channel: `./engine make episode --channel <slug> --series <series>`.
It stops whenever it needs someone, and continues from the first unfinished step when you run it again.
Everything lands in `channels/<slug>/episodes/<date>-<idea>/`.

| # | Step | Who | Writes | Gate |
|---|---|---|---|---|
| 1 | **Idea** | engine | `episode.json`; idea → `used` in ideas.md | needs a `new` idea for the series |
| 1b | **Research** | agent (or `--llm anthropic` / `--llm gemini`, with web search) | `tasks/research.md` → `research.json` | must pass the dossier checks (a named person, ≥3 events in order, every fact with its https source and the exact quote; with an API writer, each quote must be on its page) |
| 2 | **Script** | agent (or `--llm anthropic` / `gemini`) | `tasks/script.md` (context bundle) → `script.json` | must pass `script/v1` + series checks; every claim cites a source in `research.json` |
| 2b | **Script review** | agent (or `--llm anthropic` / `gemini`) | `tasks/script-review.md` → `script-review.json` | must pass; bound to the exact script.json. An API writer fixes a fail itself (up to 2 rewrites); on the storefront what's left after that is a note |
| 3 | **Fact-check** | engine lists, **person approves** | `factcheck.md` | **STOP until approved**; bound to the script's words and numbers |
| 3b | **Footage** (only series using `render-ai-video`; paid) | engine (Gemini image + Veo), **person approves the stills** | `footage/` (stills, clips, ledger) | **STOP until `approve footage`**; budget cap per episode |
| 3e | **Subject pictures** (only series using `render-subject`; paid) | engine (Gemini image) | `subject/<picture>.jpg`, `subject/state.json` (with where the subject is in each picture), `subject/ledger.json` | needs GEMINI_API_KEY; `paint.budget_per_episode_usd` cap |
| 4 | **Voice** | engine (Kokoro, local; or cut from the Veo clips) | `audio/voice.wav`, `audio/timings.json`, `audio/envelope.json` | — |
| 4b | **Motion** (only looks with a painted world; paid) | engine (fal image-to-video, `motion` in engine.config.json) | `shots/clips/<shot>.mp4`, `shots/motion.json`, `shots/motion-ledger.json` | needs FAL_KEY; budget cap per episode |
| 5 | **Render** | engine (fal music, paid; then Remotion) | `audio/music.m4a` + `music.json` (made once), `audio/mix.wav` (voice + music + effects), `out/<slug>/<episode>.mp4` (and without captions, `out/<slug>/clean/<episode>.mp4`), its captions as `out/<slug>/<episode>.srt`, `render.json`, `captions-render.json`, `qa/layout.json` | needs FAL_KEY and the effects (`./engine sfx`, once) |
| 6 | **QA** | engine checks + agent review | `qa-report.md`, `qa-review.json`, `publish.json`, learnings entry | must pass `workflows/qa.md` |
| 7 | Post | — | not built yet | — |

## 1. Idea
Picks the first `new` idea whose series matches (or `--idea <id>`), creates the episode folder and marks the
idea `used` (with `used_in`). Run with `--new` to start a second episode while one is in progress.

## 1b. Research
Before a line is written, the story is looked up. `tasks/research.md` gives the agent AGENTS.md, `channel.md`,
the series file and the idea; it writes `research.json`: the question the video answers, the **facts** (each one
sentence with the https address of the page it came from and the exact words on that page), the **people** with
something at stake (by name: who actually noticed or acted), the **timeline** in order with the why of each
surprising act, the **turn**, the **key objects** the viewer has to see, and what it could **not** verify
(including popular versions of the story the sources don't back). Nothing is written from memory. With an API
writer (`--llm anthropic` / `gemini`, and the storefront), the engine opens every cited page and looks for each quote
on it; a quote that isn't there, a page that won't open or a PDF goes back to the writer to fix.
`--redo research` looks it up again and then writes the script again from the new dossier. Episodes whose script
was written before this step have no dossier and keep going without one.

## 2. Script
The engine writes `tasks/script.md`: the instructions plus the **only** context allowed — AGENTS.md, this
channel's `channel.md`, the series file, its characters (+ model.json), `learnings.md`, the idea, `research.json`, and the
SKILL.md of each skill the series names (`skills.script`, `skills.render`, `skills.captions`). The agent
writes `script.json` following `skills/write-script/SKILL.md` and re-runs the command. The engine checks it:
beat order, speakers, expressions, render-skill payloads, estimated length, the 2-second hook, banned-topic
keywords, and that every claim cites the source of a dossier fact (a script written from the dossier doesn't search
the web). Problems are printed; fix `script.json` and re-run. A revision asked for by the fact-check may cite what
the person asked for.

## 2b. Script review
A second reader judges the voiceover alone, before anyone checks facts or anything is voiced or paid for: does it
argue a point through the person with something at stake, in the order it happened, with everything introduced
before it is referred to, a "why" for every surprising act and conclusion, and an ending on what happened (no
preaching, no pun), with nothing said twice? Only those seven fail a script. It writes `script-review.json` (`verdict`, `issues` with beat, problem,
fix), bound to the exact `script.json`. A fail stops the episode until the script is fixed; any change to the script is
reviewed again. Each fail is kept in `script-review-history.json`, and the next reviewer reads them: it may not ask to
undo a fix an earlier review asked for (unless that fix broke one of the seven rules). It also reads `research.json` (a
fix only uses facts in it) and the series' word budget, which every fix must stay inside. With an API writer the
script goes back to it with the review's findings and is reviewed again, up to 2 times, before a fail stops the
episode; the agent fixes it by hand. On a customer's video (the storefront) what is still wrong after those rewrites
is kept as notes and the episode goes on to the fact-check, where the customer reads it.

## 3. Fact-check (hard stop)
The engine writes `factcheck.md`: every claim with its source and, from the dossier, the exact words that source
says, plus the full transcript and on-screen text so
nothing slips through. The person approves with
`./engine approve factcheck --channel <slug> --episode <id> --by "<name>"` or asks for changes with
`./engine reject factcheck … --reason "…"`. The approval stores a hash of every word and number shown or said;
if the script changes afterwards, the pipeline stops again.

## 4. Voice
Each beat is synthesised with its speaker's voice (`voice` in the character file; pronunciation overrides
from the character and the script). Word timings come from the voice model itself, so captions match the
audio exactly. The mix is loudness-normalised (-14 LUFS, true peak ≤ -1 dBTP) and a per-frame loudness
envelope is saved to drive the character's mouth.

## 4b. Motion
In a look with a painted world, every painted shot is turned into a moving clip as long as it is on screen (after
the voice, so the lengths are known): what the shot shows happens, with a still camera, in the painting's own style.
Clips are kept by content, so only a shot whose picture, words or length changed is moved again. Every paid call is
in `shots/motion-ledger.json` first, and it stops before the episode would pass `motion.budget_per_episode_usd`.

## 5. Render
One Remotion composition renders every channel: the beat's scene skill fills the frame
(`render-3d-explainer`, `render-motion-graphics`, …), overlays sit on top (`render-talking-character`), then
the captions skill (the only words on screen: there is no headline). 1080×1920, 30 fps, H.264 + AAC. It renders in
two passes: everything but the captions (`out/<slug>/clean/<episode>.mp4`, `render.json`), then the captions drawn
over that (`out/<slug>/<episode>.mp4`, `captions-render.json`), so a change to how the captions look redraws only
them. While rendering, every text element reports its box, which QA uses for the safe-area and cut-off checks.

## 6. QA
See `workflows/qa.md`. Automated checks run on the MP4 and the layout data; the agent reviews tone, banned
topics, visuals and character from sampled frames and writes `qa-review.json` (with learnings for this
channel). On a pass the engine writes `publish.json` (with the AI-disclosure fields, `status: not-posted`)
and appends the learnings to the channel's `learnings.md`.

## Re-running steps
`--redo footage,voice,render,qa` re-runs steps even if they're done. Changing a script after approval resets the
fact-check; changing a voice setting re-voices; changing render code re-renders.
