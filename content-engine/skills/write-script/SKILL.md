---
name: write-script
kind: script
description: Turns a series definition + an idea into script.json (beats, voiceover, visuals, claims, publish metadata).
---

# Skill: write-script

You receive a task file with the channel, the series, its characters, the channel's learnings, the idea, and the
SKILL.md of every render skill the series uses. You write **one file: `script.json`**. Nothing else.

## How to write it

1. **Follow the series.** Use its beats, in order, with the same ids. Each beat's `purpose` says what it must do;
   `seconds` is a target — the voice decides the real timing.
2. **Hook first.** The first sentence of the first beat is ~5 words and lands within 2 seconds. Put the hook on
   screen too (`on_screen_text`, ≤ 30 characters works best). Questions and surprising claims work; greetings don't.
3. **Write for the ear.** Short sentences. Contractions. One idea per sentence. Numbers the way people say them.
   Read it out loud in your head at the character's speed. Total words are given in the task — stay inside them.
4. **Be the character.** Use its personality, vocabulary and verbal tics from its file. A catchphrase at most once.
5. **Show, don't decorate.** Every beat has a visual that explains what is being said (see the render skills).
6. **Facts are claims.** Every fact — spoken, on screen, in a part label, or a number in a graphic — goes into
   `claims` with a real source you have checked. Unverifiable → cut it. Confidence `low` → find a better source.
7. **Pronunciations.** If the voice may stumble (years, acronyms, names, symbols), add
   `"pronunciations": {"1938": "nineteen thirty-eight", "LED": "L E D"}`. Captions still show the original word.
8. **No AI-label text, no links, no "subscribe" unless the series' `cta` asks for it.**

## script.json (schema `script/v1`)

```jsonc
{
  "schema": "script/v1",
  "channel": "<channel slug>",            // must match the episode
  "series": "<series slug>",
  "idea": "<idea id>",
  "title": "<episode title>",
  "language": "en",
  "beats": [                               // the series' beats, same ids, same order
    {
      "id": "hook",
      "speaker": "<character name>",       // one of the series' characters
      "voiceover": "What's inside a bike bell?",
      "on_screen_text": "Inside a bike bell",   // optional, ≤ 48 chars, shown at the top
      "visual": { "skill": "render-3d-explainer", "shot": "establish" },  // a scene skill of the series, or {"skill": "none"}
      "character": { "placement": "full", "expression": "curious" }      // full | corner | hidden; expression from model.json
    }
    // …one object per series beat
  ],
  "visuals": {                             // shared data for scene skills (see each render skill)
    "render-3d-explainer": { "object": "bike bell", "parts": [ /* … */ ] }
  },
  "claims": [
    {
      "id": "c1",                          // c1, c2, …
      "claim": "A bicycle bell rings when a spring-loaded striker hits the dome.",
      "beat": "inside",                    // beat where it's said or shown
      "source": "https://… (or a precise citation)",
      "confidence": "high",                // high | medium | low
      "note": "optional: caveats, rounding, where sources disagree"
    }
  ],
  "pronunciations": {},
  "publish": {
    "title": "What's inside a bike bell?",
    "description": "1–3 sentences. No AI label here — the engine adds disclosure fields.",
    "hashtags": ["#howitworks", "#shorts"] // up to 5 is best (max 8)
  }
}
```

## Checks the engine runs (fix and re-run until clean)

- beats match the series exactly; speakers are series characters; expressions exist in the character's model.json
- each beat's `visual.skill` is one of the series' scene skills and its payload is valid
- `visuals[...]` payloads are valid for their skill (part ids unique, targets/callouts exist, sizes present …)
- every claim points at an existing beat
- estimated length is inside the series length; the first sentence fits the 2-second hook
- banned-topic keywords (warning; the QA review decides)
