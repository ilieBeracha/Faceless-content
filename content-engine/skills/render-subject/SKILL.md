---
name: render-subject
kind: render
layer: scene
description: One subject, the whole video - a single painted subject on a plain background whose view changes on the word that brings each new fact (push in on a part, label its parts, a big number, split it open, swap it for another state, set something beside it to scale, tilt it). Pictures painted once (a few cents); every motion drawn by code, free and exactly on the word.
---

# Skill: render-subject

One subject stays in the middle of the screen for the whole video, and every sentence **does something to it**:
the camera pushes in on the part the line is about, labels draw on, it splits open, it turns into another state of
itself, something appears beside it to scale. Nothing cuts away. The subject is painted once (and each other state
of it once), by Google's image model, on the scene's plain background; all motion is drawn by code, so it is smooth,
free and lands on the word.

## How the script is written (this style only works with it)

- **One subject.** Pick the one thing the story happens to (a glass, a bridge, a coin, a cell, a planet) and keep it
  on screen from the first word to the last.
- **One fact per sentence, and each sentence changes the picture.** Short, plain, declarative sentences (about 4–8
  words). Change the view on the word that brings the new fact (`at_word`).
- **The voice tells the story; the labels carry the numbers.** Say "it's colder than anything around it", and put
  "-224 °C" in a `stat` view. Years, names, sizes and units go in `caption`, `labels` and `stat`, not in the voice.
- **Build with contrast pairs toward one payoff.** "It's hot inside. But it's freezing outside." Each pair sets up
  the next, and the last line pays off everything before it: the twist, the reason, or the line that makes the
  viewer look again. Stop on it: no outro, no lesson, no call to action.
- **Short.** About 20 seconds; 4–6 facts.

## Scene payload: `visuals["render-subject"]`

```jsonc
{
  "subject": { "name": "Uranus", "show": "the planet Uranus, a pale cyan ball with faint bands" },
  "pictures": [                              // 0–4 other pictures of the same subject the views switch to
    { "id": "inside", "show": "Uranus cut in half: a thin cyan shell, a hot orange mantle, a small dark core" },
    { "id": "earth", "show": "the planet Earth", "name": "Earth" }
  ],
  "style": "flat vector illustration, soft gradients, thin clean outlines, gentle grain",
  "background": { "top": "#1b2130", "bottom": "#07080d" }   // the plain colour every picture is painted on
}
```

Every picture shows the subject alone, whole, in the middle, on that plain background, so the code can move it.
Write `show` as one thing seen clearly, never a scene.

## Each beat: `visual`

```jsonc
{
  "skill": "render-subject",
  "views": [                                  // 1–4, in order
    { "view": "hero", "at_word": 0, "caption": "Voyager 2 · 1986" },
    { "view": "reveal", "at_word": 5, "picture": "inside" }
  ]
}
```

`at_word` is the index of the beat's word where the view starts (the first view starts at 0). Every view also takes
`caption` (≤ 32 chars): small text above the subject, like a chart title. Views that show the subject take
`picture` (default `"main"`, the subject; or a `pictures` id).

| view | fields | shows |
|---|---|---|
| `hero` | `zoom` (0.6–1.6) | the subject, gently alive |
| `focus` | `x`, `y` (0–1 across / down the picture), `zoom` (1.3–3) | the camera pushes in on that part |
| `labels` | `items`: 1–3 × `{text ≤ 24, x, y}` | dots on those points, lines out to labels at the sides |
| `stat` | `value` (≤ 14), `subtitle` (≤ 40) | a big number counting up above a smaller subject |
| `reveal` | `picture` (what is inside) | a bright slit, the subject splits apart, the inside grows in between |
| `swap` | `picture` | the subject turns into another state of itself |
| `compare` | `picture`, `ratio` (its size ÷ the subject's), `label` | another thing beside it, to scale, with both names |
| `tilt` | `degrees`, `label` | the subject tips over against an upright line, with the angle counting up |

Points (`x`, `y`) are fractions of the whole picture; the subject fills its middle half, so its parts sit between
about 0.25 and 0.75.

## Rules

- **Every label, caption, number and name on screen is a claim** with a source.
- **Use views for what they mean:** `reveal` only for what is really inside, `compare` only with a real ratio,
  `tilt` only with a real angle.
- **No characters on screen.** The narrator is heard, not seen (`character.placement: "hidden"`).
- Pair it with the `captions` skill and `caption_style: chunks` (two or three words under the subject, the spoken
  word in the accent colour).
- Costs: one picture per `pictures` entry used, plus the subject (`ai_video.rates_usd.image` each, about $0.04),
  within `paint.budget_per_episode_usd`.
