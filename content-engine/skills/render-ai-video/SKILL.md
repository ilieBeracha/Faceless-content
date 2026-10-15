---
name: render-ai-video
kind: render
layer: scene
description: Realistic footage - a photoreal fictional presenter filmed selfie-vlog style in real-looking places, speaking every line on camera (Google Veo via the Gemini API). Paid, budget-capped per episode, with a stills-approval stop before any video is generated.
---

# Skill: render-ai-video

A scene skill for **realistic** videos. Every beat is 1–4 **shots**. In each shot the series' photoreal character
says one line straight into the camera, lip-synced, with the place's real sound around them. The engine turns
your shot descriptions into prompts:

1. a first frame per shot, made by a Gemini image model from the character's approved face photos;
2. **STOP**: a person looks at the stills and the cost estimate and runs `./engine approve footage`;
3. an 4–8 s clip per shot, made by Veo from that frame; the character speaks the line;
4. every clip is checked by ear (Gemini transcribes it). A clip that says the wrong words is regenerated once;
5. the voice step cuts each clip to its spoken part, lays the clips end to end, times every word for the
   captions and normalises the loudness. The render adds captions and the hook text on top.

It costs money: about $0.10 per second of 720p Veo Fast clip plus ~$0.04 per still, so a 45 s episode is
around **$6–9**. Every paid call is logged in `footage/ledger.json`. The engine stops and asks before an
episode would go over its budget (`ai_video.budget_per_episode_usd`, retries included).

## The character: `rig: "photoreal"`

The speaker's `model.json`:

```jsonc
{
  "rig": "photoreal",
  "params": {
    "identity": "a woman in her late twenties, warm olive skin, dark brown curly shoulder-length hair, …",  // ≥ 40 chars, specific
    "wardrobe": "a mustard linen shirt over a white tee, a small brass compass on a cord",
    "voice": "a warm, slightly husky alto with a light London accent, quick and chatty",
    "fictional": true,                 // must be true: never a real person's likeness
    "references": ["references/ref-1.jpg"]  // set by `./engine ai-video pick-identity` — a person picks the face
  },
  "expressions": {                     // words, not numbers: they go into the prompts
    "neutral": "relaxed, friendly half-smile",
    "excited": "wide-eyed, big open grin"
  }
}
```

Its character file uses `voice: { provider: veo, voice_id: veo, speed: 1 }`: the video model speaks.
Faces: `./engine ai-video identity --channel <c> --character <name>` makes candidate photos (≈ $0.04 each,
capped at `ai_video.identity_budget_usd` per character); a person picks one with `pick-identity`.

## Scene data: `visuals["render-ai-video"]`

```jsonc
{
  "world": "Rome, 216 AD, the Baths of Caracalla on a hot summer afternoon",   // era, place, season, light
  "look": "handheld smartphone vlog footage, natural light, realistic skin texture, shallow depth of field"  // optional
}
```

## Each beat: `visual`

```jsonc
{
  "skill": "render-ai-video",
  "shots": [
    {
      "camera": "selfie",            // selfie | selfie-walk | over-shoulder | wide
      "place": "the vast frigidarium hall: marble columns, a coffered vaulted ceiling, a cold plunge pool, bathers in tunics",
      "action": "turning slowly so the hall fills the frame behind her",
      "line": "This is the cold room.", // EXACTLY the words said in this shot
      "others": "two bathers chatting on the pool's edge",  // optional, they never speak
      "sound": "echoing voices and splashing water",         // optional; never music
      "expression": "excited"                                // optional, a key of the model's expressions
    }
  ]
}
```

## Rules

- **Lines:** the shots' `line`s, joined with spaces, must be exactly the beat's `voiceover` (the engine checks).
  One or two short sentences per shot, **≤ 18 words** (a clip lasts at most 8 s). No double quotes inside a
  line. Shorter lines get shorter, cheaper clips (4 s ≈ up to 7 words, 6 s ≈ 12, 8 s ≈ 18).
- **Hook:** the first shot's line starts with the hook sentence (≤ 5 words). Put the hook text in the first
  beat's `on_screen_text`. It is shown as a headline at the top, so keep it short.
- **Pacing:** 8–12 shots per 45–55 s episode. Change the place or camera every shot: a new room, a new angle,
  walking somewhere. Jump cuts between shots are normal in vlogs.
- **Places:** concrete, visible things, period-accurate: materials, light, crowd, weather. Never ask for
  writing, signs, captions, logos or numbers in the picture: video models garble text. Numbers go in the
  spoken line and the captions.
- **People:** extras are generic background people ("bathers in tunics"). Never a real or famous person,
  never children in focus, nothing violent, gory or sexual. The models refuse some of this anyway, and a
  refused shot still costs money.
- **Facts:** what the character says is fact-checked like any script. What the footage *shows* should not
  contradict the claims. Keep places plausible and general rather than precise reconstructions.
- **Captions:** use `caption_style: pages` in the series (a short block of words, the spoken one
  highlighted). The lower third of the frame is shaded for them; keep faces in the upper two thirds
  (the camera presets already do).

## Checks the engine runs

`./engine make episode` rejects a script when the shots' lines don't add up to the voiceover, a line is too
long for one clip, a line contains double quotes, or an `expression` is not in the speaker's model.json.
QA fails an episode whose clips are placeholders (`ENGINE_AI_VIDEO_FAKE=1`), whose clips don't say their
lines, or that went over budget. The QA review also checks the same face in every shot, no AI artefacts up
close, no burned-in text, the era, and lip-sync.

## Fixing a shot

- `./engine ai-video redo --channel <c> --episode <e> --shot <id>` makes a new still (then the stills need
  approving again). `--what clip` keeps the still and makes a new clip. Old files move to
  `footage/rejected/`; nothing is deleted.
- Changing a shot's `place`, `action`, `camera` or `line` in script.json regenerates only that shot. Changing a
  line changes the words, so the fact-check needs approving again.
- `./engine ai-video ledger --channel <c> --episode <e>` shows every paid call;
  `./engine ai-video budget … --usd <total> --by <name>` raises an episode's budget (a person decides).
