---
name: render-storybook
kind: render
layer: scene
description: Hand-drawn storybook — a new illustrated scene for every sentence (setting + posed stick-figure character + props), a two-tone title bar above a square picture. Drawn in code, free.
---

# Skill: render-storybook

A scene skill: during the beats that use it, it fills the frame with a square illustrated card (full width, from
y≈420 to y≈1500) and a title bar above it. You never draw pixels — you **describe scenes** from a fixed library of
settings, poses and props, and the skill draws them with wobbly hand-drawn lines, muted watercolour washes and paper
grain. Same script → same picture (fixed seeds), so re-renders are stable.

It suits stories told one picture at a time: a narrator character acting out a metaphor ("if you took one step
every…"), each sentence its own scene. Pair it with the `captions` skill and `caption_style: single-word` in the
series (one word at a time in the middle of the picture) and `skills.render: [render-storybook]` (no separate
character layer — the character lives inside the scenes).

## Title bar: `visuals["render-storybook"]`

```jsonc
{
  "title": "A billion seconds is how long?",  // 3–64 chars, shown on top for the whole video, upper-cased
  "highlight": ["billion seconds"]             // ≤ 4 parts of the title drawn in the channel's accent colour
}
```

Keep titles **≤ 30 characters** so they fit on one line at a readable size (longer titles wrap into two balanced
lines and get smaller). The title is on screen the whole time → its words and numbers are claims too.

## Each beat: `visual`

```jsonc
{
  "skill": "render-storybook",
  "scenes": [ /* 1–6 scenes, one per sentence of the beat's voiceover, in order */ ]
}
```

**Timing is automatic:** scene 1 starts with the beat, scene 2 with the beat's second sentence, and so on (a short
cross-fade between scenes). More scenes than sentences split the last sentence evenly. Fewer scenes than sentences
keep the last scene up. So write the voiceover in short sentences and give each one a picture.

### A scene

```jsonc
{
  "setting": "hills",        // hills | beach | sea | plain | desert | snow | night | space | room | city
  "time": "day",             // day | dusk | night   (night and space settings are always night)
  "camera": "push-in",       // still | push-in | pull-out | pan-left | pan-right   (slow move over the scene)
  "character": {             // the beat's speaker, posed in the scene; null = no character in this scene
    "pose": "point",         // stand | point | wave | think | shrug | cheer | hold | walk | sit | look-up | facepalm
    "x": 0.3,                // 0 = left edge … 1 = right edge (feet always on the ground)
    "scale": 1,              // 1 ≈ 37% of the picture's height; 0.3–2.5
    "facing": "right",       // left | right
    "expression": "curious", // a key from the character's model.json → expressions
    "hold": "clock",         // optional: cards | paper | book | clock | coins | drop | globe | sign | candle
    "hold_text": "52!"       // optional: ≤ 12 chars written on a held sign / paper / book
  },
  "others": [                // ≤ 4 extra figures (same look, they don't talk) — crowds, "you", a friend
    { "pose": "stand", "x": 0.62, "scale": 0.8, "facing": "left" }
  ],
  "props": [                 // ≤ 8 props (below)
    { "type": "sign", "x": 0.72, "text": "1,000,000,000" }
  ]
}
```

Settings: `hills` rolling sage hills · `plain` flat grassland · `beach` sand, sea and a headland · `sea` open water
with a strip of shore · `desert` dunes · `snow` white hills · `night` hills under stars · `space` stars only ·
`room` wall, floor, window · `city` skyline behind a street.

### Props

Every prop has `type`, `x` (0–1, its centre), optional `y` (0 = top … 1 = bottom), `scale` (0.2–4, default 1) and
`color` (hex). **Ground things** stand on the ground when `y` is left out; **sky things** float at a sensible
height. Some props use `text`, `count`, `content`, or `x2`/`y2`.

| prop | what it draws | uses |
|---|---|---|
| `sign` | wooden signpost with lettering | `text` (required) |
| `calendar` | wall/desk calendar page | `text` (required), e.g. "31 years" |
| `clock` | clock face with moving hands | `text` (optional: written on the face instead of hands, e.g. "0") |
| `paper` | a sheet of paper on the ground | `text` (small) |
| `book` | a book lying flat | `color` |
| `text` | big hand-lettered words or a number, outlined | `text` (required) |
| `speech` | speech bubble | `text` (required) |
| `thought` | thought cloud | `content` (globe, clock, question, cards, coins, sun, moon, planet, drop, money, heart) or `text` |
| `question` | big "?" | — |
| `arrow` | curved arrow from (`x`,`y`) to (`x2`,`y2`) in the accent colour | `x2` (required), `y2`, `text` |
| `footprints` | trail of footprints from `x` to `x2` | `x2` (required), `y2`, `count` |
| `jars` | row(s) of glass jars with water | `count` (≤ 40) |
| `coins` | stacks of coins | `count` |
| `money` | a stack of banknotes | — |
| `dots` | a grid of dots — "this is 100" | `count` (≤ 400) |
| `stars` | a cluster of stars | `count` |
| `cards` | a fan of playing cards | — |
| `pile` | a heap (rice, sand, grain) | `color` |
| `globe` | Earth with a soft glow | — |
| `planet` | ringed planet | `color` |
| `sun`, `moon` | in the sky | — |
| `tree`, `palm`, `bush`, `mountain`, `house` | scenery | — |
| `table`, `box`, `sack`, `bucket`, `drop`, `hourglass`, `candle`, `rocket`, `car` | objects | — |

Sky things (default heights): `sun`, `moon`, `stars`, `planet`, `globe`, `thought`, `speech`, `question`, `text`,
`dots`, `arrow`. Everything else is a ground thing.

## Layout rules (read before placing anything)

- The picture is a 1000×1000 grid in scene units; the ground line is at about y = 830 (845–860 on beach, sea,
  room and city).
- **Caption band:** single-word captions appear at scene y ≈ 330–390, horizontally centred. Keep faces and
  lettering out of that band: standing characters at `scale` ≤ 1.2 (normal shots) or ≥ 1.9 (close-ups, the face is
  above the band) — scales in between put the caption across the face.
- Sky lettering (`text`, `speech`, `thought`) goes at y ≤ 0.28. Keep everything inside 0.05–0.95: the picture's
  edges are darkened by a vignette.
- One focal point per scene: the character plus 1–3 props. Leave air around the character.
- Every scene is a new picture: change the setting, the camera, the pose or the props from one sentence to the
  next. Escalate — the story's scenes should get bigger (one jar → a row of jars → the ocean).

## Writing for this skill

- The hook beat's first scene shows the number itself (`sign`, `text` or `calendar`) with the character reacting.
- Numbers on props are exactly the numbers in the voiceover ("1,000,000,000" ↔ "a billion"), rounded the same way.
- Every word on a prop (`text`, `hold_text`) and the title are on-screen text: factual ones need a claim with a
  source in `claims`, and the fact-check covers them.
- Short lettering: props ≤ 28 characters, held signs ≤ 12. Use digits with commas for big numbers.

## Checks the engine runs

`./engine make episode` rejects a script (and lists every problem) when: a scene uses an unknown setting/pose/prop,
an `arrow`/`footprints` has no `x2`, a `sign`/`calendar`/`speech`/`text` has no `text`, a beat has many more scenes
than sentences, or an `expression` isn't in the speaker's model.json.

## Example beat

Three sentences, three scenes, each one bigger than the last (the words are placeholders — no facts in them):

```json
{
  "id": "story",
  "speaker": "narrator",
  "voiceover": "Picture one jar. Now fill it one drop at a time. Then do it again, a thousand times over.",
  "visual": {
    "skill": "render-storybook",
    "scenes": [
      { "setting": "room", "camera": "push-in", "character": { "pose": "point", "x": 0.35, "expression": "curious" }, "props": [{ "type": "jars", "count": 1, "x": 0.68, "scale": 1.6 }] },
      { "setting": "plain", "character": { "pose": "hold", "hold": "drop", "x": 0.4, "expression": "thinking" }, "props": [{ "type": "bucket", "x": 0.7 }] },
      { "setting": "hills", "time": "dusk", "camera": "pull-out", "character": { "pose": "shrug", "x": 0.22, "scale": 0.8, "expression": "surprised" }, "props": [{ "type": "jars", "count": 36, "x": 0.62 }, { "type": "text", "text": "× 1,000", "x": 0.62, "y": 0.22 }] }
    ]
  }
}
```
