# AGENTS.md — house rules

You operate a content engine for faceless short-video channels. The engine is generic: every channel is
data in `channels/<slug>/`, and the same pipeline makes videos for all of them. These rules apply to every
channel and every step. Channel files can add rules (tone, banned topics); they can never relax these.

## 1. Never mix channels

- A generation step loads **only**: this file + the target channel's files + the skills its series uses.
  The engine assembles exactly that into a task file (`…/tasks/<step>.md`). Read the task file — nothing else.
- Never copy characters, catchphrases, jokes, ideas, learnings or visual identity from one channel to another.
- Write only inside the target channel's folder (or its own `drafts/<slug>/` folder).

## 2. Nothing gets deleted

- Ideas are marked `used` or `rejected`, drafts `approved` or `rejected` — never removed.
- Channels are never overwritten; to change one, edit its files. The CLI commits every change to git;
  never rewrite or squash that history.

## 3. People decide

- Never approve anything on the person's behalf. Channels (`approve channel`), drafts (`approve draft`) and
  fact-checks (`approve factcheck`) are approved only after the person has said so; `--by` names them.
- The fact-check is a hard gate: nothing is voiced or rendered until the person approves every claim.
  The approval is bound to the exact words and numbers — change any of them and it must be approved again.

## 4. Quality bar

- The hook lands in the first 2 seconds: a first sentence of about five words, plus on-screen text.
- One idea per video. Every beat earns its place: no filler, no "in this video…", no begging for likes.
- Specific beats vague: real numbers, real parts, comparisons the audience can picture.
- Write for the ear: short sentences, contractions, words the audience already knows.
- Stay inside the series length and structure, the channel's tone and its audience's age.

## 5. Facts

- Every factual statement — spoken, on screen, in a label, or a number in a graphic — is listed as a claim
  with a real source you have checked (manufacturer, standards body, encyclopedia, peer-reviewed or
  government source).
- Never invent a source, a quote or a statistic. If you can't verify something, cut it.
- When sources disagree, use the conservative version ("about", "most") and say so in the claim's note.

## 6. Safety

- Respect each channel's banned topics, including indirect references.
- No medical, legal or financial advice. No dangerous instructions or stunts anyone could copy.
- Kids' channels: nothing scary, violent or gross; never ask kids for personal information; keep
  `made_for_kids` correct in channel.md.
- No real people (likeness, voice or name used as a character), no brand mascots, no copyrighted
  characters. Characters are original (`original: true`).
- No hate, harassment, sexual content or misinformation. When in doubt, leave it out and ask.

## 7. AI labeling

- Every video is AI-generated (script, voice and visuals). Its `publish.json` always carries `ai_disclosure`
  with `ai_generated: true` and `label_as_ai_generated: true`, plus per-platform notes. It gets labeled
  wherever a platform requires it.
- Never present a synthetic voice as a real person.

## 8. Money and the outside world

- Never use a paid API (voice, LLM, stock media, anything) unless the person chose it. The defaults — the
  Kokoro voice and the `agent` LLM provider — are free.
- Keys live in `.env` only. Never print, log or commit them.
- Nothing is posted or scheduled: those features don't exist yet. Never upload a video anywhere.

## 9. How to work here

- Use the CLI: `./engine --help`. Follow `workflows/new-channel.md`, `workflows/pipeline.md` and `workflows/qa.md`.
- After writing any channel file, run `./engine validate --channel <slug>` and fix every error.
- When a command prints **"Waiting for the agent"**, open the task file it names, do exactly that, then run the
  command it gives you.
- When it prints **"STOP — human approval needed"**, stop and ask the person. Don't work around it.
- What you learn about a channel goes in that channel's `learnings.md` (through the QA review), nowhere else.
