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
- point: The strongest grip comes from the angle, not the force — the same trick your hands miss every time you yank.
- fact: A zip's slider is a wedge: it pushes the teeth together at an angle no tug on the cloth can copy.
- fact_source: https://www.explainthatstuff.com/zippers.html
- added: 2026-01-31
```

Every idea has a `fact` (one sentence: the true, surprising fact the video turns on) and a `fact_source` (the
https address of a solid source where a person can check that fact). The person decides on the idea from these,
so the fact must be exactly what the source says. If you can't name a source for a fact, propose a different idea.

Every idea also has a `point`: what this story argues for the channel's Belief (channel.md) and why a viewer would
care. A true fact with no point is trivia; pick a story where someone has something at stake and the facts turn.

A good idea has a question the audience already wonders about, a payoff that fits the series' length, and facts
that can be verified from solid sources.

### Ideas only this channel would make

The niche says what the channel is about; the Belief, Promise and What the viewer gets (channel.md) say why it
exists. Ideas come from the second, not the first.

1. **Start from the Belief.** Before any idea, ask: what does someone who holds this Belief notice that others
   miss? Who proves it, who got caught by it, who was wrong about it, where does it show up in the viewer's own day?
   Find ideas there.
2. **The other-channel test.** If any channel in the same niche could make the video as is, it isn't this
   channel's idea. "Bananas are berries" is any trivia channel's; the story behind it, told so it argues this
   channel's Belief, is this one's.
3. **Skip the famous ones.** The first facts on every "top 10" list are already known and already made. Go one step
   behind them: the person, the date, the place, the decision or the money that made the fact true.
4. **Someone with something at stake.** A person or group who could win or lose, so the facts can turn.
5. **No two ideas share a shape.** Mix them: someone caught out, a hidden cause, a thing the viewer owns or does
   every day, a belief the viewer holds that turns out wrong, a number that changes meaning, an insider's trick.
6. **The title is a hook, not a label.** Specific (a name, a number, a place) and something the viewer wants
   answered: "The wine that beat France in a blind test", not "The 1976 Paris tasting".
7. **The point lands on the viewer.** It finishes the sentence "after this video, you'll…": a way of seeing, a line
   to say, a thing to try or to trust.

Work it as a funnel: think of about three times as many candidates as you're asked for, cut every one that fails
the other-channel test or repeats a shape, and write only the strongest.
