---
name: render-talking-character
kind: render
layer: overlay
description: The channel's character in frame, mouth driven by the loudness of the voice, blinking, expressions per beat. Rigs - orb-bot-3d (3D robot) and flat-2d (vector creature).
---

# Skill: render-talking-character

An overlay skill: it draws the speaking character on top of whatever scene skill a beat uses. The mouth opens with
the loudness of the voice audio (a per-frame envelope from the voice step); eyes blink on their own; each beat sets a
placement and an expression.

## Per beat: `beats[].character`

```jsonc
{ "placement": "corner", "expression": "curious" }
```

- `placement`: `full` (large, lower half — the scene is framed above it; good for hooks and outros), `corner`
  (small, lower left, above the captions), `hidden`.
- `expression`: a key from the character's `model.json` → `expressions`.

## The character's look: `characters/<name>/model.json`

A character picks a **rig** (a generic, parameterised character builder) and sets its parameters. New characters
need no code — only a new model.json.

### Rig `orb-bot-3d` — a round 3D robot

```jsonc
{
  "rig": "orb-bot-3d",
  "params": {
    "body":    { "shape": "sphere", "color": "#c8ced8", "metalness": 1, "roughness": 0.2, "facets": 24 },  // sphere | capsule | rounded-box; facets < 20 = low-poly
    "eye":     { "count": 1, "size": 0.42, "sclera": "#f5f8fc", "iris": "#29d3ff", "pupil": "#0a0e14", "glow": 0.7 },
    "mouth":   { "style": "led-bar", "color": "#29d3ff", "width": 0.34 },       // led-bar | slit | none
    "antenna": { "enabled": true, "color": "#9aa3b0", "tip": "#ff5a3c", "length": 0.45 },
    "accent": "#ff5a3c",      // ear bolts
    "arms": "stubs",          // stubs | none
    "hover": 0.05             // idle float
  },
  "expressions": { "neutral": { … }, "curious": { … } }
}
```

### Rig `flat-2d` — a flat vector creature

```jsonc
{
  "rig": "flat-2d",
  "params": {
    "body":  { "shape": "blob", "color": "#ffd166", "shade": "#f4a261", "outline": "#1d1b26", "outline_width": 7 },  // circle | blob | rounded-rect | drop | star | egg
    "eyes":  { "style": "round", "white": "#ffffff", "pupil": "#1d1b26", "spacing": 0.36, "y": -0.12, "size": 0.17 },   // round | dot | oval | sleepy
    "mouth": { "color": "#3b1f2b", "tongue": "#ff7a8a", "width": 0.3, "y": 0.2 },
    "cheeks": "#ff8fab",
    "accessories": [ { "type": "tail", "color": "#7ad3ff", "accent": "#ffffff" } ]  // tail | ears | antenna | sparkles | glasses | leaf | hat | crown | bow
  },
  "expressions": { "neutral": { … } }
}
```

### Rig `stick-figure` — a round-headed doodle person

Drawn with sketchy hand-drawn lines. It is the character of the `render-storybook` skill, which poses it inside
each scene (see that skill); on other scene skills this layer shows it like any other rig.

```jsonc
{
  "rig": "stick-figure",
  "params": {
    "head": "#f1d9a6", "line": "#3a332d", "line_width": 5.5, "head_size": 1,   // head_size 0.8–1.4
    "hair": "tuft",            // tuft | none | curl | spiky | bun
    "hair_color": "#3a332d",
    "body_style": "stick",     // stick | tunic (a small filled body)
    "body_color": "#d9b97e",
    "accessory": "none",       // none | glasses | beanie | chef-hat | helmet | scarf | bow | cap
    "accessory_color": "#c2553a"
  },
  "expressions": { "neutral": { … } }
}
```

### Expressions (same fields for every rig; all optional)

| field | range | effect |
|---|---|---|
| `eye_scale` | 0.5–1.6 | bigger / smaller eyes |
| `pupil_scale` | 0.4–1.6 | tiny pupils = surprise |
| `lid` | 0–0.9 | half-closed eyes (sleepy, sceptical) |
| `tilt_deg` | -25–25 | head tilt |
| `look` | [-1..1, -1..1] | gaze direction |
| `bounce` | 0–1 | how much it bobs while talking |
| `brow` | flat \| up \| down \| worried | brows (2D and stick-figure rigs) |
| `mouth_curve` | -1–1 | frown … smile (2D and stick-figure rigs) |
| `glow` | 0–1.5 | eye/LED glow (robot rig) |

Every model needs at least `neutral`. Recommended set: `neutral`, `curious`, `excited`, `surprised`, `thinking`.
