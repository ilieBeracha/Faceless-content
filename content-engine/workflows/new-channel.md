# Workflow: new channel

**seed → draft channel, characters, series and 10 ideas → the person approves → status `active`**

A channel is a niche + an audience + one or more characters + one or more series + an idea backlog, stored as
plain files in `channels/<slug>/`. Creating one never touches another channel, and an existing channel is
never overwritten.

## Three ways in

| You have | Run |
|---|---|
| Answers you want to give yourself | `./engine new channel` (asks questions) |
| A one-line idea | `./engine new channel --seed "space facts for kids" [--slug space-facts]` |
| A brainstormed niche you liked | `./engine brainstorm niches` → `./engine new channel --from-draft drafts/niches/<file>.md` |

## Seed / niche path, step by step

1. **Engine** creates `channels/<slug>/` with `channel.md` (the annotated template; `status: draft`),
   `ideas.md`, `learnings.md`, and the agent task `channels/<slug>/tasks/draft-channel.md`. It commits.
2. **Agent** reads only that task file and writes, inside `channels/<slug>/`:
   - `channel.md` — every field, plus the Promise section.
   - `characters/<name>.md` + `characters/<name>/model.json` — an original character; the rig and
     parameters come from `skills/render-talking-character/SKILL.md`. Expressions: at least `neutral`,
     `curious`, `excited`.
   - `series/<slug>.md` — beats that add up to the length; `skills.render` only from existing render skills.
   - `ideas.md` — exactly 10 ideas, status `new`, each with a one-line angle.
3. **Agent** runs `./engine validate --channel <slug>` until it reports no errors, then summarises the
   channel for the person (niche, audience, character, series, the 10 ideas) and asks for approval.
4. **Person** reviews and edits whatever they like (`./engine edit channel --channel <slug>` etc.).
5. **Person** approves: `./engine approve channel <slug> --by "<name>"` → `status: active`. The command
   refuses while validation fails. Agents never run this on their own.
6. First episode: `./engine make episode --channel <slug> --series <series>` (see `workflows/pipeline.md`).

## What a good channel draft has

- A niche narrow enough to be recognisable, wide enough for 100+ episodes.
- An audience you can picture (age, what they already know, why they'd watch).
- A character with a clear look that a rig can draw, a voice that fits, flaws, and a way of talking.
- A series with a repeatable format and a hook pattern that works in 2 seconds.
- Banned topics that match the audience (stricter for kids).
- Ideas that are specific ("a ballpoint pen", not "office supplies").

## Changing a channel later

- Add: `./engine add character|series --channel <slug>`, `./engine add ideas --channel <slug> --series <s> "…"`
- Brainstorm for approval: `./engine brainstorm characters|series|ideas --channel <slug>`
- Edit any file directly (or `./engine edit …`), then `./engine validate --channel <slug>`.
- Pause: `./engine set-status channel <slug> paused`.
