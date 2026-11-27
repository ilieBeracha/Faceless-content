---
name: render-planet-explainer
kind: render
layer: scene
description: Planet explainer - one hero planet drawn by code on a dark starfield, whose view changes with the narration (split it open, draw its rings, show its axis tilt, a big number, a probe flyby, a size comparison, a fast spin, a surface feature, a float test). Free, exact, no AI footage.
---

# Skill: render-planet-explainer

A scene skill for short "strange facts about a planet" videos. One planet stays centred the whole video; each
fact changes **what the planet shows**, and the planet glides smoothly from one view to the next. Every label and
number is drawn exactly as written, so it must match a claim.

## Scene payload: `visuals["render-planet-explainer"]`

```jsonc
{
  "planet": {
    "name": "Saturn",                       // shown under it in the compare view
    "color": "#d9b97a",                     // main body colour
    "bands": ["#e8d3a2", "#c9a066", "#e3c48c", "#b98d55", "#dcc08a"],  // latitude stripes, top to bottom
    "glow": "#f3d9a4",                      // optional atmosphere glow
    "rings": { "color": "#e9dcc0", "inner": 1.25, "outer": 2.1, "bands": 5 },  // optional
    "tilt_deg": -12                          // how the disc leans on screen (styling only)
  },
  "background": { "top": "#0b1026", "bottom": "#04050b" },  // optional
  "stars": true
}
```

Pick colours that look like the real planet (NASA true-colour images), not decoration.

## Each beat: `visual`

```jsonc
{
  "skill": "render-planet-explainer",
  "views": [                                 // 1–4, in order
    { "view": "hero", "at_word": 0 },
    { "view": "stat", "at_word": 6, "value": "-224 °C", "subtitle": "coldest air in the Solar System" }
  ]
}
```

`at_word` is the index of the beat's word where the view starts (the first view starts at 0). Change the view
on the word that introduces the new idea, like the reference style: every new fact = a new picture.

| view | fields | shows |
|---|---|---|
| `hero` | `zoom` (0.6–1.6) | the planet slowly turning |
| `cutaway` | `layers`: 1–4 × `{label, color, radius}` outside → inside | a slit opens, the planet splits to show labelled layers (background warms) |
| `rings` | – | the rings draw themselves on |
| `tilt` | `degrees`, `axis_label`, `orbit_label` | orbit line, upright reference, the real spin axis and an angle arc counting up |
| `stat` | `value` (≤ 14 chars), `subtitle` | a huge number above a smaller planet |
| `probe` | `tag` (e.g. "Cassini · 2004–2017") | a spacecraft flies past |
| `compare` | `other: {name, color, ratio}`, `label` | another body to scale next to the planet (`ratio` = its diameter ÷ the planet's) |
| `spin` | `label` (e.g. "1 day = 10 h 33 min") | the clouds race round, a clock spins |
| `spot` | `shape` hexagon/oval/circle, `at` north-pole/south-pole/upper/middle/lower, `size`, `color`, `label` | a feature drawn onto the planet |
| `float` | `submerged` (0.05–0.95), `label` | the planet bobbing in water |

Every view also takes an optional `caption` (≤ 32 chars): small text above the planet, like a chart title
("13 rings", "Voyager 2 · 1986").

## Rules

- **Short and dense:** 20–35 s, 4–6 facts, one new view per fact. No filler.
- **Every number and label on screen is a claim** with a source (NASA, ESA, JPL). Put units in the text
  (`"10 h 33 min"`, `"-178 °C"`). Ratios in `compare` must be real (Earth ÷ Saturn diameter ≈ 0.11).
- **Use the views for what they mean:** `cutaway` only for interiors, `tilt` only with the real axial tilt,
  `float` only for density below water's.
- **No characters on screen.** The narrator is heard, not seen (`character.placement: "hidden"`).
