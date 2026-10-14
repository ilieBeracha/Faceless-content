---
name: render-3d-explainer
kind: render
layer: scene
description: 3D explainer — the camera flies into an everyday object, it comes apart in an explode view, labeled callouts point at the parts. Simple low-poly parts.
---

# Skill: render-3d-explainer

A scene skill: during the beats that use it, it fills the frame. You describe the object once as simple
low-poly parts in `script.visuals["render-3d-explainer"]`, then direct each beat with a *shot*. Framing is
automatic (the engine fits the parts into the frame around the headline, captions and character), so you never
give camera coordinates.

## Scene payload: `visuals["render-3d-explainer"]`

```jsonc
{
  "object": "flashlight",
  "background": { "top": "#0d1b2a", "bottom": "#1b263b" },   // optional; defaults to the channel brand
  "parts": [
    {
      "id": "body",                    // unique, lowercase-with-dashes
      "label": "Aluminium body",       // callout text, ≤ 26 chars (shown on screen → it's a claim if factual)
      "note": "keeps it all aligned",  // optional second line, ≤ 34 chars
      "shape": "tube",                 // cylinder | tube | cone | sphere | box | capsule | torus | spring | disc
      "radius": 1.6, "inner_radius": 1.35, "length": 12,        // size fields depend on the shape (below)
      "position": [0, 0, 0],           // centre of the part when assembled, in cm
      "rotation": [0, 0, 0],           // optional, degrees around X, Y, Z
      "color": "#3d5afe",
      "material": "metal",             // plastic | metal | glass | rubber | ink | paper | wood | fabric
      "opacity": 1,                    // optional
      "shell": true,                   // outer casing: turns see-through when the camera flies inside
      "explode": [0, 0, -4],           // where it moves when fully exploded (offset in cm)
      "anchor": [0, 5, 0]              // optional: where the callout line points, relative to the centre
    }
  ]
}
```

**Coordinates:** centimetres, real proportions, **Y is up and is the object's long axis** (vertical video → stand
long objects upright). X is right, Z is towards the viewer. Positions are part centres in the assembled object.

**Sizes per shape**

| shape | needs | notes |
|---|---|---|
| `cylinder` | `radius`, `length` | optional `radius_top` / `radius_bottom` for a taper |
| `tube` | `radius`, `inner_radius`, `length` | hollow; great for barrels and casings |
| `cone` | `length`, `radius_bottom` (+ optional `radius_top`) | tips, nozzles |
| `sphere` | `radius` | low-poly ball |
| `box` | `width` (X), `height` (Y), `depth` (Z) | clips, buttons, boards |
| `capsule` | `radius`, `length` | length includes the rounded ends |
| `torus` | `radius`, `tube_radius` | ring around the Y axis (washers, O-rings) |
| `spring` | `radius`, `length`, `turns` (+ optional `wire`) | coil along Y |
| `disc` | `radius` (+ optional `length` = thickness) | lenses, caps, coins |

Keep it simple: 5–12 parts, real proportions, contrasting colours for parts that sit next to each other.
Very small parts (a 1 mm ball in a 14 cm pen) are fine — the camera can fly to them.

## Beat visuals: `beats[].visual`

```jsonc
{ "skill": "render-3d-explainer", "shot": "fly-in", "target": "spring", "callouts": ["spring", "battery"], "explode": 0 }
```

| shot | what the camera does | needs |
|---|---|---|
| `establish` | the whole assembled object, slow orbit | — |
| `fly-in` | flies close to (and into) a part; shells turn see-through | `target` |
| `explode` | parts fly apart along their `explode` offsets; camera pulls back to show all | — (`explode` 0–1 optional) |
| `focus` | frames one part (assembled or exploded), others dim | `target` |
| `reassemble` | parts come back together | — |
| `orbit` | keeps the framing and circles around | — |

- `callouts`: up to 4 part ids labelled during the beat (fewer is better: 1–3). They appear one by one after the
  beat's voice starts; keep labels short.
- `explode` (0 = assembled … 1 = fully exploded) sets the state the beat ends in; it carries into later beats.
- A typical arc: `establish` (hook) → `fly-in` (the mystery) → `explode` (show the parts) → `focus` (the key part,
  1–2 times) → `reassemble` or `orbit` (payoff).

## Good explode views

- Explode mostly along the long axis (Y), with small sideways offsets so parts don't hide each other.
- Total exploded height ≈ 1.6–2× the object; small parts can move further so they're visible.
- Outer casings (`shell: true`) usually move backwards (−Z) or sideways so the inside is revealed.
