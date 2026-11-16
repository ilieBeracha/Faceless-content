---
name: render-themed
kind: render
layer: scene
description: Themed scenes — one renderer for every look. The channel's theme.json decides how things are made and how they move; each episode draws its own artwork as vector data. Drawn in code, free.
---

# Skill: render-themed

A scene skill with no fixed look and no fixed set of pictures.

- **The look is data.** The channel's `theme.json` says what the frame is made of. Change the file and every
  episode changes with it; no code is written for a new look. Ready-made themes are in the engine's `themes/`
  folder, one file each; every file there is also offered as a look on the storefront's create page, so
  adding a file adds an option. A channel has exactly one theme.
- **The arrangement is part of the look.** A theme's optional `layout` sets where things sit: `host` (`left` or
  `right`), `host_size` (`small`, `medium`, `large`), `lettering` (`top`, `middle`, `low`: where notes and headings sit
  in the space above the host) and `pictures` (`beside` the host, or `stacked` with the lettering; on a beat where the host is shown big, `placement: full`, pictures always stay beside it). Leave it out and
  the host stands on the left at medium size, lettering in the middle, pictures beside the host.
- **The pictures are yours.** Each episode draws the artwork its story needs, as vector shapes in the script.
  The theme decides how they are shown (paper stickers, line drawings, flat shapes) and colours them.

The skill draws the beat's `on_screen_text` itself in the headline area — the engine's headline box stays off.
Lettering stacks above the character. An `art` element sits beside the character, so use at most one per beat.
Nothing holds still: backdrops drift, plates hop, notes sway, markers travel, artwork hovers.

## The theme: `channels/<slug>/theme.json`

```jsonc
{
  "name": "Paper collage",
  "paper": "#e7dfcd",            // background
  "card": "#fbf7ec",             // notes, plates, labels
  "ink": "#151515",              // lettering on cards
  "text": "#151515",             // lettering and lines straight on the background (must contrast with paper)
  "colors": ["#e2543e", "#2f6f73", "#f0b429"],   // three supporting colours = artwork roles a, b, c
  "accent": "#f0b429",           // highlights
  "display": ["anton", "montserrat", "space-grotesk", "fredoka"],  // headline faces; several = lines alternate
  "body": "space-grotesk",
  "casing": "upper",             // upper | normal
  "surface": "torn",             // torn (taped paper) | ruled (drafting lines) | plain (soft cards) | glow (lit outlines)
  "backdrop": "sheets",          // sheets (torn paper + scraps) | grid (drafting grid + scan line) | blobs (soft colour) | none
  "texture": "grain",            // grain | none
  "motion": "stop-motion",       // stop-motion (moves on twelves) | draw-on (lines draw, text types) | snappy (pops and settles)
  "art": "cutout"                // cutout (stickers) | line (outline drawings) | flat (flat shapes)
}
```

Fonts: `anton`, `montserrat`, `space-grotesk`, `fredoka`, `baloo-2`. Any combination of the choices is valid;
check a new theme by rendering before using it, because contrast is your responsibility (`ink` on `card`,
`text` on `paper`).

## Artwork: `visuals["render-themed"].art`

A map from a name to a drawing on a **100 × 100 board** (x right, y down). A drawing is 1–40 shapes, back to front.

```jsonc
"visuals": { "render-themed": { "art": {
  "moth": { "shapes": [
    { "d": "M50 40C30 15 5 15 6 38c1 16 24 18 44 12z", "fill": "ink", "anim": "flap" },
    { "d": "M48 34C44 24 38 19 32 18", "stroke": "ink", "width": 2.4 }
  ] }
} } }
```

| field | meaning |
|---|---|
| `d` | SVG path data only: `M L H V C S Q T A Z` commands and numbers (≤ 600 characters) |
| `fill`, `stroke` | a **role**, not a colour: `ink`, `paper`, `a`, `b`, `c`, `accent`. Every shape needs at least one |
| `width` | stroke width, 0.5–8 (default 2.4) |
| `anim` | `flap` folds the shape towards the centre line x = 50 (wings, a page); `spin` turns it around `at`; `blink` flashes it |
| `at` | `[x, y]`, required for `spin` |

Draw simply: big flat shapes, few details, readable at the size of a thumbnail. Keep everything inside 4–96
on both axes. Draw generic objects — never a real person's likeness, a logo or a copyrighted character.
Artwork carries no lettering; words go in elements.

## Beat visuals: `beats[].visual`

```jsonc
{ "skill": "render-themed", "elements": [ { "type": "heading", "lines": ["9 September 1947"] }, { "type": "art", "id": "moth" } ] }
```

| type | fields | use it for |
|---|---|---|
| `heading` | `lines` (1–3, ≤ 18 chars each) | a punchy statement, one plate per line |
| `art` | `id` (a drawing in `art`), `label` (≤ 24) | the thing the beat is about |
| `note` | `text` (≤ 90), `kicker` (≤ 24) | one fact or a quote |
| `marks` | `items`: [{`value` (≤ 12), `label` (≤ 28)}] (2–3) | years or stages along a line |

1–3 elements per beat. Every number and label shown is on screen, so factual ones must be in `claims`.
