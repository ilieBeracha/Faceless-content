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
- **Frames open the arrangement up.** Set `layout.frames` and the four settings above are no longer used:
  each beat is drawn in one frame, and beats switch between them (see "Frames" below). Give a look several
  frames that differ a lot, and make some of your own, so its videos don't all sit the same way.
- **With a world, the pictures tell the story.** A theme's `world` describes, in words, where the videos happen
  and how they are drawn. Every line is then acted out by painted *shots* (with the host in them when wanted), painted by
  Google's image model (paid: about $0.04 a picture, capped per episode). Such a look draws no lettering, notes
  or artwork over the shots, and the host's rig is not shown on its beats: the host lives in the pictures.
- **The pictures are yours.** Each episode draws the artwork its story needs, as vector shapes in the script.
  The theme decides how they are shown (paper stickers, line drawings, flat shapes) and colours them.

The skill draws the beat's `on_screen_text` itself in the headline area — the engine's headline box stays off.
Without frames, lettering stacks above the character and an `art` element sits beside it; with frames, each goes in
its frame's box. Either way, use at most one `art` element per beat.
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

## The world: `world` in theme.json

```jsonc
"world": { "description": "A very simple cartoon town: flat shapes, thick black outlines, three soft colours, sunny afternoon light." }
```

Say what the world is and how it is drawn (setting, era, light, art style): the words are all the painter gets,
so specific beats general. The engine paints one establishing picture of the world per channel
(`channels/<slug>/world/key.jpg`), used only for its style, and draws each host that appears on white from its rig
(`channels/<slug>/world/hosts/<name>.png`), so all videos share one style and one host. Change the words or the host and
they are painted again. A look without `world` keeps the drawn backdrops (`backdrop`) and lettering (`elements`).

## Shots: `shots` on each beat

With a world, every beat tells its words in 1–3 shots, and takes no `elements`:

```jsonc
{ "id": "hook", "voiceover": "I went to the hospital, and inside was a goose.",
  "visual": { "skill": "render-themed", "shots": [
    { "show": "The host pushes open the glass doors of a small hospital, looking nervous" },
    { "at": "goose", "show": "A goose sits behind the front desk wearing a nurse's cap; the host freezes in the doorway", "camera": "push-in" }
  ] } }
```

- `show` is **what we see acting out the words**: who does what, where, with what expression. The host is not
  required: most shots show the story itself (the geese, the sugar cube, the fish). Write "the host" only when the
  host should be in the shot; it is then drawn from its picture. A channel whose shots never say "the host" needs
  no drawable host. The world's style is added by the engine; don't repeat it. A shot can also say it outright:
  `"host": true` draws the host in it, `"host": false` leaves it out (then its words must not say "the host").
- When the world says `"host": false`, the channel has **no host on screen**: the voice narrates, and no shot may
  show the host.
- When the world says `"host_lead": true`, the host is the **main character**: every beat shows the host in at least
  one of its shots, doing something in the story (holding the thing, reacting to it, standing in the place), not
  standing beside it. Describe the host the same way in every shot, so it is drawn the same.
- Each shot is a new picture: its own place, objects and camera angle (close-up, wide, from above). The world's
  picture only sets the style, so don't lean on it for the setting.
- The first shot starts with the beat. Each later shot cuts in on its `at` word, just as that word is spoken, so
  the picture changes on the word it shows. Pick the word that names the new thing ("goose").
- One clear moment per shot: one action, few objects. Follow the story: a shot per new place, thing or turn.
- Pictures carry **no words**: never ask for text, signs, labels or numbers. No real people, logos, brand mascots
  or copyrighted characters. The beat's `on_screen_text` is still drawn as the headline (keep it short).
- Keep the top fifth and the bottom third calm (sky, floor): the headline and the captions go there.

`camera` on a shot moves over it: `push-in`, `pull-out`, `pan-left`, `pan-right`, `rise`, `sink` or `drift`.
Leave it out and shots take turns, so consecutive shots never move the same way. Shots dissolve into each other.

## Frames: `layout.frames`

A frame is one arrangement of a beat: a box for the host, a box for the lettering and a box for the picture.
Boxes are in **percent of the stage** — the space between the headline and the captions (x right, y down,
0–100). List 1–10 frames; each is a preset's name or a frame of your own.

```jsonc
"layout": { "frames": [
  "big-picture",
  "split",
  { "name": "host-peeks",
    "host": { "x": 0, "y": 70, "w": 30, "h": 30 },              // null = the host steps out on these beats
    "text": { "x": 0, "y": 0, "w": 100, "h": 34, "align": "top" },  // align: top | middle | bottom
    "picture": { "x": 32, "y": 36, "w": 68, "h": 64 } }         // null = the picture flows with the lettering
] }
```

Presets: `host-left`, `host-right`, `big-picture` (no host, the picture fills the stage), `split` (picture on top,
host and lettering share the bottom), `host-centre`, `corner-host`, `title-card` (lettering only), `host-top` (host and lettering share the top, the picture fills the rest),
`columns` (lettering in a tall column), `picture-in-picture`.

Rules: boxes stay on the stage (`x + w` and `y + h` at most 100) and never overlap; a host or picture box is at
least 10 × 10, a lettering box at least 35 wide and 15 tall. The host stands on the bottom of its box, centred,
as big as the box allows (`placement: full`) or small (`corner`). Every frame needs its own `name`.

A beat names its frame with `frame` (see beat visuals). Beats that don't name one take the frames in turn, so
a look with frames changes arrangement every beat; a frame is skipped for a beat whose lettering would have to
shrink below three quarters of its size to fit it, or that has no artwork for the frame's picture box. Pick the frame that suits the beat: `big-picture` for the
thing itself, `title-card` for a big statement, a host frame when the host is talking to the viewer.

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

Looks with a world take `shots` instead of `elements` (see "Shots" above).

`frame` (optional): the name of one of the look's frames, e.g. `{ "skill": "render-themed", "frame": "big-picture", "elements": [...] }`.
Only when the channel's `theme.json` has `layout.frames`; leave it out to take the next frame in turn.
