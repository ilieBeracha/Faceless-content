---
name: brainstorm
kind: brainstorm
description: How to propose niches, characters, series and ideas — as drafts a person approves.
---

# Skill: brainstorm

Brainstorming never changes a channel. You write **drafts** (in `drafts/`) and a person approves or rejects each
one. Propose fewer, better options; make each one concrete enough to approve as is.

## Principles

- **Specific over generic.** "Inside It: a ballpoint pen", not "everyday objects". A niche you can describe in one
  sentence to a stranger.
- **Repeatable.** A series must work for 100+ episodes with the same structure. An idea must fit its series' beats.
- **Different.** Each option differs from the others and from what already exists (other niches; this channel's
  characters, series and ideas — including used and rejected ones).
- **Producible with the engine as it is.** Use only the render skills listed in your task; characters must be
  drawable by an existing rig (see render-talking-character); voices from the voice list.
- **Original and safe.** No existing IP, real people, brand mascots or trends that need copyrighted audio. Follow
  AGENTS.md safety rules; think about fact-checking load (how hard is it to verify every episode?).

## Niches (`./engine brainstorm niches`)

One file per proposal: `drafts/niches/<date>-<slug>.md`, filled from `templates/niche.md`. For each, give the
audience, why it works (demand, repeatability, what's different), the character, the first series (format,
length, beats), the visual style + render skills, three sample ideas, and honest risks. Spread the options:
different audiences, visual styles and characters.

## Characters (`./engine brainstorm characters --channel <slug>`)

`drafts/<channel>/characters/<name>.md` (templates/character.md) + `drafts/<channel>/characters/<name>/model.json`,
with `draft: {kind: character, channel: <slug>, status: proposed, created: <date>}` in the frontmatter. A good
character has one strong visual idea, a voice that fits, a clear want, and flaws (`bad_at`). It must suit the
channel's audience and tone — and must not clone the channel's existing characters.

## Series (`./engine brainstorm series --channel <slug>`)

`drafts/<channel>/series/<slug>.md` (templates/series.md) with the draft block. Give a format line, a hook
pattern that works in 2 seconds, 3–6 beats whose seconds add up to the length, the visual style, and render
skills chosen from the list. Use this channel's characters.

## Ideas (`./engine brainstorm ideas --channel <slug> [--series <s>]`)

One file `drafts/<channel>/ideas/<date>-<name>.md`: frontmatter with the draft block, then ideas in the ideas
format with `status: proposed`:

```markdown
## zipper
- title: Inside It: a zipper
- series: inside-it
- status: proposed
- angle: How do two rows of teeth lock so tight — and why does the slider open them so easily?
- added: 2026-01-31
```

A good idea has a question the audience already wonders about, a payoff that fits the series' length, and facts
that can be verified from solid sources.
