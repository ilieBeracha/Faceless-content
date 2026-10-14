---
name: render-motion-graphics
kind: render
layer: scene
description: Motion graphics — animated 2D panels with titles, counters, size comparisons, lists, orbs/planets, timelines, fact cards, icon rows and step flows.
---

# Skill: render-motion-graphics

A scene skill: during the beats that use it, a flat, animated panel fills the frame. Each beat lists 1–3
elements; they animate in one after another, stacked in the space between the headline and the captions
(leaving room for the character).

## Scene payload (optional): `visuals["render-motion-graphics"]`

```jsonc
{ "background": { "top": "#140c2e", "bottom": "#2b1857" }, "texture": "stars" }   // texture: none | stars | grid | dots | paper
```

## Beat visuals: `beats[].visual`

```jsonc
{ "skill": "render-motion-graphics", "elements": [ { "type": "counter", "to": 109, "suffix": "×", "label": "wider than Earth" } ] }
```

| type | fields | use it for |
|---|---|---|
| `title` | `text` (≤ 40), `size`: xl \| lg \| md | a punchy statement |
| `counter` | `to`, `from` (0), `decimals`, `prefix`, `suffix`, `label` | a number that counts up |
| `compare` | `items`: [{`label`, `value`, `color`?}] (2–4), `mode`: circles \| bars, `unit`, `show_values` | sizes or amounts side by side (circles are area-true) |
| `list` | `items` (1–4, ≤ 36 chars), `numbered` | steps, reasons |
| `orb` | `color`, `accent`, `label`, `ring`, `bands`, `size`: s \| m \| l, `glow` | a planet, a ball, a cell, a drop |
| `timeline` | `items`: [{`label`, `value`}] (2–4) | years, stages |
| `fact-card` | `text` (≤ 90), `kicker` | one surprising fact |
| `icon-row` | `symbol`: dot \| star \| circle \| square \| heart \| bolt \| drop, `count` (≤ 30), `color`, `label` | counting things |
| `arrow-flow` | `steps` (2–4, ≤ 20 chars) | cause → effect |

Every number and label shown is on screen, so factual ones must be in `claims`.
Prefer one strong element per beat; two when they're read together (e.g. an orb + a counter).
