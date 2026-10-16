# Learnings — 

<!--
What worked and what didn't for THIS channel only. The engine appends an entry when an episode passes
QA (with the agent's notes); script writing reads this file. Never copy learnings between channels.
-->

## 2026-10-15 · 2026-10-15-roman-baths

- Episode: "Rome's biggest bathhouse, reviewed" (rated) — 46.1s, 134 words, -15.1 LUFS. QA passed.
- Selfie shots (hold phone, scale 2.0) at the start and end make the vlog format instantly readable — keep both bookends.
- Crowd scenes sell scale (~1,600 bathers) better than a number alone; use 3–4 background figures.
- Hand-lettered labels inside the bathhouse sit on the vault line; place sky text at y ≤ 0.16 in 'baths' scenes.

## 2026-10-15 · 2026-10-15-reviewing-rome-s-biggest-bathhouse-for-real

- Episode: "Rome's biggest bathhouse, reviewed (live action)" (rated-live) — 60.8s, 130 words, -15.3 LUFS. QA passed.
- Veo speaks slower than the engine's 2.6 words/s estimate: 130 words ran 60.8 s (about 2.2 words/s) after trimming. Keep rated-live scripts to about 115-120 words to land under 58 s.
- Describing the setting as 'the massive building' or 'the huge baths' makes the image model draw the Colosseum or modern ruins. Name the bathhouse's own features (red-brick and marble front, tall arched windows) and say 'just-built, undamaged'.
- Veo blocked a shot of Tilly miming scraping her forearm with a curved tool. Show objects held up to the camera instead of tools against skin.
- Veo repeated words in 2 of 11 clips ('brand brand new', a doubled 'there's a library'); the by-ear check caught both and one retry fixed them. Budget about one retry per five clips.

## 2026-10-16 · 2026-10-16-saturn-s-hexagon-storm-up-close

- Episode: "Saturn's hexagon storm, reviewed" (rated-space) — 57.5s, 124 words, -15.0 LUFS. QA passed.
- pov shots work: Saturn through the window carries the episode. Prompts must not mention a phone or camera, or the image model draws a phone screen inside the shot.
- Ask for 'exactly six long straight sides and six sharp corners' or the hexagon comes out with eight sides.
- Veo speaks the hook slowly: a 4-word first sentence ran 2.7 s. Open with a 2-word sentence ('A hexagon.') to land under 2 s.
- Veo occasionally burns in garbled subtitles despite the negative prompt (1 of 11 clips here). Scan the bottom third of every clip before approving the render.
- A pressurised cabin with no helmet keeps Tilly's face visible and consistent; helmets came and went between stills.

## 2026-10-16 · 2026-10-16-venus-by-balloon-the-one-nice-layer

- Episode: "Floating in Venus's clouds, reviewed" (rated-space) — 51.6s, 116 words, -15.2 LUFS. QA passed.
- Putting Tilly physically on location (an open deck, a pressure suit, her gloved hand reaching into the scene) feels far more 'there' than a window view; keep doing it.
- direction: documentary keeps her acting calm; describe actions as small and steady and say 'not walking toward the camera'.
- Bubble-helmet close-ups that move toward the lens get a glare band across the eyes that doubles the face; use a steady medium shot with 'soft even light, no reflections across the visor'.
- The cinematic grade/grain makes renders slow on this machine (36–44 min); plan for it.
