# Workflow: episode pipeline

**idea → script → fact-check → [footage] → voice → render → QA → (later) post**

One command runs it for any channel: `./engine make episode --channel <slug> --series <series>`.
It stops whenever it needs someone, and continues from the first unfinished step when you run it again.
Everything lands in `channels/<slug>/episodes/<date>-<idea>/`.

| # | Step | Who | Writes | Gate |
|---|---|---|---|---|
| 1 | **Idea** | engine | `episode.json`; idea → `used` in ideas.md | needs a `new` idea for the series |
| 2 | **Script** | agent (or `--llm anthropic`) | `tasks/script.md` (context bundle) → `script.json` | must pass `script/v1` + series checks |
| 3 | **Fact-check** | engine lists, **person approves** | `factcheck.md` | **STOP until approved**; bound to the script's words and numbers |
| 3b | **Footage** (only series using `render-ai-video`; paid) | engine (Gemini image + Veo), **person approves the stills** | `footage/` (stills, clips, ledger) | **STOP until `approve footage`**; budget cap per episode |
| 4 | **Voice** | engine (Kokoro, local; or cut from the Veo clips) | `audio/voice.wav`, `audio/timings.json`, `audio/envelope.json` | — |
| 5 | **Render** | engine (Remotion) | `out/<slug>/<episode>.mp4`, `render.json`, `qa/layout.json` | — |
| 6 | **QA** | engine checks + agent review | `qa-report.md`, `qa-review.json`, `publish.json`, learnings entry | must pass `workflows/qa.md` |
| 7 | Post | — | not built yet | — |

## 1. Idea
Picks the first `new` idea whose series matches (or `--idea <id>`), creates the episode folder and marks the
idea `used` (with `used_in`). Run with `--new` to start a second episode while one is in progress.

## 2. Script
The engine writes `tasks/script.md`: the instructions plus the **only** context allowed — AGENTS.md, this
channel's `channel.md`, the series file, its characters (+ model.json), `learnings.md`, the idea, and the
SKILL.md of each skill the series names (`skills.script`, `skills.render`, `skills.captions`). The agent
writes `script.json` following `skills/write-script/SKILL.md` and re-runs the command. The engine checks it:
beat order, speakers, expressions, render-skill payloads, estimated length, the 2-second hook, banned-topic
keywords. Problems are printed; fix `script.json` and re-run.

## 3. Fact-check (hard stop)
The engine writes `factcheck.md`: every claim with its source, plus the full transcript and on-screen text so
nothing slips through. The person approves with
`./engine approve factcheck --channel <slug> --episode <id> --by "<name>"` or asks for changes with
`./engine reject factcheck … --reason "…"`. The approval stores a hash of every word and number shown or said;
if the script changes afterwards, the pipeline stops again.

## 4. Voice
Each beat is synthesised with its speaker's voice (`voice` in the character file; pronunciation overrides
from the character and the script). Word timings come from the voice model itself, so captions match the
audio exactly. The mix is loudness-normalised (-14 LUFS, true peak ≤ -1 dBTP) and a per-frame loudness
envelope is saved to drive the character's mouth.

## 5. Render
One Remotion composition renders every channel: the beat's scene skill fills the frame
(`render-3d-explainer`, `render-motion-graphics`, …), overlays sit on top (`render-talking-character`), then
the on-screen headline and the captions skill. 1080×1920, 30 fps, H.264 + AAC. While rendering, every text
element reports its box, which QA uses for the safe-area and cut-off checks.

## 6. QA
See `workflows/qa.md`. Automated checks run on the MP4 and the layout data; the agent reviews tone, banned
topics, visuals and character from sampled frames and writes `qa-review.json` (with learnings for this
channel). On a pass the engine writes `publish.json` (with the AI-disclosure fields, `status: not-posted`)
and appends the learnings to the channel's `learnings.md`.

## Re-running steps
`--redo footage,voice,render,qa` re-runs steps even if they're done. Changing a script after approval resets the
fact-check; changing a voice setting re-voices; changing render code re-renders.
