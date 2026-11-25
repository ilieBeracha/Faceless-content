---
name: write-script
kind: script
description: Turns a series definition + an idea into script.json (beats, voiceover, visuals, claims, publish metadata).
---

# Skill: write-script

You receive a task file with the channel, the series, its characters, the channel's learnings, the idea, the
research dossier (`research.json`: the facts with their sources and quotes, the people, the events in order with
their whys, the turn, the key objects, and what could not be verified), and the SKILL.md of every render skill the
series uses. You write **one file: `script.json`**. Nothing else.

## How to write it

0. **Find the point before you write a line.** Facts told well are a report; people follow a point of view. Fill
   `angle` first:
   - `point`: the one sentence this video argues. It is the channel's **Belief** (channel.md), proved again by this
     story. "The French judges didn't lose to California, they lost to their own labels" — not "a 1976 tasting".
   - `stakes`: who in the story has something to lose, and exactly what, in plain words a stranger can feel ("her
     name rested on French wine being the best", not "an important editor"). Tell the story through them, never
     as a list of events.
   - `turn`: the moment the facts change meaning. Build the middle so the viewer walks into it.
   - `takeaway`: what the viewer understands once the story is told (**What the viewer gets** in channel.md). It is
     for you, not a line to say: the story makes it plain on its own. The last beat ends on what happened, the
     result or the one fact that settles it ("they all described the white wine as red"), in plain words. Never
     tell the viewer what to do, feel or believe: no advice, no "next time…", no "trust yourself", no "your taste
     is enough", no moral or summary of what it all means.
   Every beat serves the point: a fact that doesn't move the story toward the turn or the takeaway is cut, however
   true. The angle is opinion and framing; anything factual inside it is a claim like any other.

   **Tell it plainly, in the order it happened.** You are explaining something simply to a friend, not
   performing. Say what was going on, what everyone expected, what happened, and what came of it, in that order.
   Don't open on the ending, tease, flash back, or add dramatic lines ("so here's the thing", "and then?",
   questions to the viewer mid-story). If a line sounds clever, say the plain thing instead. Every person, thing
   and place is introduced before it is referred to, and when someone does something surprising, say why in
   plain words ("she asked for her sheet back, so no one would see she'd picked California").
1. **Follow the series.** Use its beats, in order, with the same ids. Each beat's `purpose` says what it must do;
   `seconds` is a target — the voice decides the real timing.
2. **Hook first.** The first sentence of the first beat is ~5 words and lands within 2 seconds. The captions put it
   on screen from the first frame; there is no headline, so don't write `on_screen_text`. Surprising claims work;
   greetings don't.
   The hook is a plain true statement of what happened that is surprising on its own ("France lost at wine."),
   complete for a stranger: no "the sheet" or "he" for something not yet introduced. It is not a tease; the rest
   of the video tells how it happened, in order.
3. **Write for the ear.** Short sentences. Contractions. One idea per sentence. Numbers the way people say them.
   Read it out loud in your head at the character's speed. Total words are given in the task — stay inside them.
   **A full stop ends a thought.** The voice drops its pitch and pauses at every `.` `!` `?`, so never cut one
   phrase into pieces: "You think all wine gets better with time?" — not "You think all wine improves. With
   time." Fragments that hang off the sentence before ("With time." "Mere weeks after harvest." "On purpose.")
   join it with a comma or a dash. For a beat of drama inside a line, use a comma, a dash or "…", which pause
   without ending the thought. A one-word sentence only when it's a full reply on its own ("Wrong.").
4. **Be the character.** Use its personality, vocabulary and verbal tics from its file. A catchphrase at most once.
5. **Show, don't decorate.** Every beat has a visual that explains what is being said (see the render skills).
   Never make a shot whose subject is writing (a page, score sheet, letter, sign, label or screen): the picture
   model can't draw readable text, so it comes out as scribbles. Show the person doing something with it instead
   (reading it with the paper edge-on, reaching for it).
6. **Facts are claims, from the dossier.** Write only from `research.json`: its facts, its people, its order and its
   whys. Every fact — spoken, on screen, in a part label, or a number in a graphic — goes into `claims` with the
   `source` of the dossier fact it comes from, and says no more than that fact's `quote` supports. Never use
   anything in its `unverified` list. A fact the dossier doesn't have is cut, however true. (An older episode with no
   dossier: a real source you have checked. Unverifiable → cut it. Confidence `low` → find a better source.)
7. **Pronunciations.** If the voice may stumble (years, acronyms, names, symbols), add
   `"pronunciations": {"1938": "nineteen thirty-eight", "LED": "L E D"}`. Captions still show the original word.
8. **No AI-label text, no links, no "subscribe", no call to action.** A series' `cta` is a fixed closing line, never advice.

## script.json (schema `script/v1`)

```jsonc
{
  "schema": "script/v1",
  "channel": "<channel slug>",            // must match the episode
  "series": "<series slug>",
  "idea": "<idea id>",
  "title": "<episode title>",
  "angle": {                               // required: written first, see step 0
    "point": "The one sentence this video argues (the channel's belief, from this story)",
    "stakes": "Who has something to lose, and what",
    "turn": "The moment the facts change meaning",
    "takeaway": "What the viewer understands once the story is told"
  },
  "language": "en",
  "beats": [                               // the series' beats, same ids, same order
    {
      "id": "hook",
      "speaker": "<character name>",       // one of the series' characters
      "voiceover": "A bike bell is a tiny drum.",
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
    "title": "A bike bell is a tiny drum",
    "description": "1–3 sentences. No AI label here — the engine adds disclosure fields.",
    "hashtags": ["#howitworks", "#shorts"] // up to 5 is best (max 8)
  }
}
```

## Checks the engine runs (fix and re-run until clean)

- a new script has an `angle` (point, stakes, turn, takeaway)
- beats match the series exactly; speakers are series characters; expressions exist in the character's model.json
- each beat's `visual.skill` is one of the series' scene skills and its payload is valid
- `visuals[...]` payloads are valid for their skill (part ids unique, targets/callouts exist, sizes present …)
- every claim points at an existing beat, and cites the source of a fact in `research.json`
- estimated length is inside the series length; the first sentence fits the 2-second hook
- banned-topic keywords (warning; the QA review decides)
