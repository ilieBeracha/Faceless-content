# Content engine

An engine for **faceless short-video channels run by AI agents**. Nothing about any niche is built in: a channel
is a folder of plain files (niche, audience, characters, series, idea backlog), and one pipeline turns an idea
from any channel into a finished, checked vertical video:

**idea → script → fact-check (stops for you) → voice → render → QA**

- **Free by default.** Local voices (Kokoro), the `agent` writer (your coding agent writes from task files),
  visuals drawn in code. Paid services are listed below with prices; none is used until you pick it.
- **Channels never mix.** Every generation step gets a task file that contains only `AGENTS.md`, the target
  channel's files and the skills its series uses (with a checksum manifest).
- **Nothing is deleted.** Ideas and drafts are marked `used` / `rejected` / `approved`; every change is a git commit.
- **People decide.** Channels, drafts and every fact-check are approved by a person. Nothing renders before
  the facts are approved, and the approval is bound to the exact words and numbers.
- **Nothing is posted.** Each finished episode gets a `publish.json` (with the AI-disclosure fields platforms
  require), but posting and scheduling aren't built.

## Setup (once)

You need Node.js 22+, Python 3.10+ and about 1 GB of disk. ffmpeg is optional (Remotion ships one).

```bash
cd content-engine
npm install
./engine setup     # local voice: Python venv + Kokoro model (~340 MB, free, Apache-2.0), ffmpeg + render browser check
./engine doctor    # checks everything and renders three demo stills to .cache/doctor/
```

On a machine without a GPU (servers, containers, CI) put `REMOTION_GL=swangle` in `.env` (copy `.env.example`).
Keys for paid services also go in `.env`, which is gitignored. Never commit them.

## Everyday commands

Every command works on any channel. `./engine --help` and `./engine <command> --help` list all options.

### Create a channel

```bash
./engine new channel --seed "space facts for kids"           # one line → the agent drafts everything for review
./engine new channel                                         # or answer the questions yourself
./engine brainstorm niches --count 4                         # or brainstorm niches first (saved as drafts)…
./engine new channel --from-draft drafts/niches/<file>.md     # …and turn the one you like into a channel

./engine validate --channel <slug>                           # checks every file against templates/
./engine approve channel <slug> --by "Your Name"             # draft → active, after you've reviewed it
```

A drafted channel has `channel.md`, one or two characters (`characters/<name>.md` + `model.json` for the look),
one or two series, and 10 ideas. Edit any file freely, then validate. Errors name the file and the field, say
what's expected, and point to the template line that defines it.

### Brainstorm (drafts wait for your decision)

```bash
./engine brainstorm characters --channel <slug>
./engine brainstorm series --channel <slug>
./engine brainstorm ideas --channel <slug> --series <series> --count 10
./engine list drafts
./engine approve draft drafts/<slug>/<file>.md              # copies it into the channel (--only id1,id2 for ideas)
./engine reject draft drafts/<slug>/<file>.md --reason "…"  # marked rejected, kept
```

### Add things directly

```bash
./engine add character --channel <slug>                       # interactive
./engine add series --channel <slug>                          # interactive
./engine add ideas --channel <slug> --series <series> "A zipper" "A smoke alarm" --angle "how it works inside"
./engine idea reject --channel <slug> <idea-id> --reason "…"  # ideas are never deleted
./engine idea reopen --channel <slug> <idea-id>
./engine edit character --channel <slug> --name <name>        # opens $EDITOR, then validates and commits
```

### Make an episode

```bash
./engine make episode --channel pip-how-things-work --series inside-it
```

Run it again after each stop; it continues from the first unfinished step.

| It prints | You do |
|---|---|
| `⏸ Waiting for the agent` | The agent opens the task file it names (e.g. `…/tasks/script.md`), writes the output, re-runs the command. |
| `✋ STOP — human approval needed` | Read `…/factcheck.md` (every claim + source + the full transcript), then `./engine approve factcheck --channel <slug> --episode <id> --by "Your Name"`, or `./engine reject factcheck … --reason "…"`. |
| `✔ done` | Watch `out/<channel>/<episode>.mp4`; read `qa-report.md` and `publish.json` in the episode folder. |

Options: `--idea <id>` (pick the idea), `--new` (another episode while one is open), `--episode <id>`,
`--redo voice,render,qa`.

### Look around

```bash
./engine list channels                        # also: characters | series | ideas | episodes | drafts | skills | voices
./engine list ideas --channel big-numbers --status new
./engine compare pip-how-things-work big-numbers
./engine status --channel big-numbers         # where each episode is in the pipeline
```

## Working with an agent

The default writer is `agent`. When a step needs writing (a channel draft, brainstorm, script, QA review) the
engine writes a task file with the instructions and exactly the allowed context, prints **Waiting for the agent**
and stops. A coding agent such as Claude Code, opened in this folder, reads `AGENTS.md` / `CLAUDE.md`, does the
task and re-runs the command. You can simply say "make the next episode for big-numbers" and approve when asked.

`--llm anthropic` makes the engine call the Claude API itself instead (paid, see below; needs `ANTHROPIC_API_KEY`).

## The two example channels

| | Pip: How Things Work | Big Numbers, Tiny Stories |
|---|---|---|
| Niche | what's inside everyday objects | huge numbers made graspable |
| Character | **Pip**, a tiny nosy chrome robot with one big eye (3D) | **Dot**, a round-headed doodle person with an orange scarf |
| Series | *Inside It* (35–50 s): fly into the object, explode view, labelled parts | *Bigger Than You Think* (40–55 s): one number, one escalating story |
| Look | `render-3d-explainer` + `render-talking-character`, highlighted caption pages | `render-storybook`: hand-drawn scenes, title bar, one-word captions |
| Voice | Kokoro `af_bella`, faster, pitched up | Kokoro `af_heart`, calm |

## Costs and options

Nothing paid is used until you choose it. Prices are approximate, from public price lists in October 2026;
check the provider's page before you commit. A 45-second episode is about 120 words ≈ 700 characters.

### Voice (text-to-speech)

| Option | Price | Per 45-s episode | Word timings for captions |
|---|---|---|---|
| **Kokoro** (in use) | free, runs locally | $0 | exact, from the model |
| ElevenLabs | ≈ $0.05–0.10 per 1,000 characters, plus a plan ($6–$99 / month) | ≈ 4–7 ¢ | yes (timestamps endpoint) |
| OpenAI `gpt-4o-mini-tts` | ≈ $0.015 per minute of audio | ≈ 1 ¢ | no — would need an alignment step |
| Google Cloud TTS, Chirp 3 HD | $30 per 1 M characters, first 1 M / month free | ≈ 2 ¢ (free under the quota) | to be checked per voice |
| Azure AI Speech, neural voices | ≈ $15–16 per 1 M characters (check the calculator), 0.5 M / month free | ≈ 1 ¢ | yes (word-boundary events) |
| Cartesia Sonic | plans from ≈ $5 / month for 100 k characters | ≈ 3–4 ¢ | yes |

### Illustrations for the storybook channel

Scenes are drawn in code today (free). If you want painted, AI-generated scenes later (≈ 16 per episode, with
a reference image of Dot so the character stays the same):

| Option | Price per image | Per episode |
|---|---|---|
| Gemini 2.5 Flash Image | $0.039 ($0.0195 in batch) | ≈ $0.30–0.65 |
| OpenAI GPT Image | ≈ $0.005–0.21 depending on size and quality | ≈ $0.10–3.40 |
| FLUX.2 [pro] (Black Forest Labs) | ≈ $0.03 for the first megapixel | ≈ $0.50–0.60 |

### Script writing (LLM)

| Option | Price | Per script (≈ 15 k tokens in, ≈ 6 k out) |
|---|---|---|
| **`agent`** (in use) | your coding agent's own plan | — |
| Claude API, Claude Opus 5.5 (`--llm anthropic`) | $4 / $20 per million input / output tokens | ≈ $0.18 |
| Claude API, Claude Sonnet 5.5 (set `llm.anthropic.model`) | $2 / $10 per million | ≈ $0.09 |

### Rendering

Remotion renders locally at no cost. Its license is free for individuals and companies of up to 3 people;
bigger companies need a company license (from $25 per seat per month, or $0.01 per render with a $100 / month
minimum). On a 4-core machine without a GPU, a 45-second episode takes about 11 minutes (storybook) to
13 minutes (3D) to render; a GPU or more cores make it much faster (`RENDER_CONCURRENCY` in `.env`).

## Folder map

```
content-engine/
  AGENTS.md            house rules every agent follows (CLAUDE.md points to it)
  engine               the CLI (./engine --help)
  engine.config.json   video size, safe areas, loudness, hook timing, providers
  templates/           channel / character / series / niche / ideas / learnings — annotated, and they ARE the schema
  channels/<slug>/     channel.md, characters/, series/, ideas.md, learnings.md, episodes/<date>-<idea>/
  drafts/              brainstormed niches (drafts/niches/) and per-channel drafts (drafts/<slug>/)
  skills/<name>/SKILL.md   how each step is done: write-script, brainstorm, captions, render-* skills
  workflows/           new-channel.md, pipeline.md, qa.md
  src/                 the engine (TypeScript): cli/, core/, pipeline/, voice/, render/, skills/, qa/
  out/                 rendered videos (gitignored)
```

Inside an episode folder: `episode.json` (state), `tasks/` (task files + context manifests), `script.json`,
`factcheck.md`, `audio/` (voice, word timings, loudness envelope), `render.json`, `qa/` (layout data, frames,
contact sheet), `qa-report.md`, `qa-review.json`, `publish.json`.

## How it works

- **Templates are the schema.** Each template line says `# required|optional <type> — meaning`; `./engine validate`
  checks every channel file against it and reports the file, the field and the template line.
- **Skills.** A series names its script, render and captions skills; only those load for its episodes. Render
  skills are React components (Remotion): a scene skill fills the frame per beat (`render-3d-explainer`,
  `render-motion-graphics`, `render-storybook`), overlays sit on top (`render-talking-character`), then captions.
- **Voice.** Kokoro runs locally; the word timings come from the model's own durations, so captions highlight each
  word exactly when it's said. Audio is normalised to −14 LUFS, true peak ≤ −1 dBTP, and a loudness envelope
  drives the characters' mouths.
- **QA.** Automated checks (length against the series, hook within 2 s, safe areas, nothing cut off, captions in
  sync with the audio, loudness, banned topics, fact-check status) plus an agent review of sampled frames for tone,
  then `qa-report.md`. What QA learns goes into that channel's `learnings.md` and feeds its next scripts.
- **Tests:** `npm test` (validation, ideas/drafts, context isolation, the fact-check gate, captions, frontmatter
  edits). `npm run typecheck`.
