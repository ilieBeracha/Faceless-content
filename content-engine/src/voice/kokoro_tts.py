#!/usr/bin/env python3
"""Kokoro text-to-speech with exact word timings, for the content engine.

Kokoro predicts how long every phoneme lasts before it generates audio. The engine's setup step
exposes those durations as a model output ("duration"), so each caption word's start/end comes
straight from the model — no speech recognition or guessing.

Input (JSON on stdin):
  {"model": path, "voices": path, "out_dir": path,
   "chunks": [{"id": str, "voice": str, "lang": "en-us", "speed": float, "sentence_pause": float,
               "clause_pause": float, "continuous": bool, "say": [str, ...]}]}
  `say` has one entry per caption word: the text the voice should say for that word.
  `continuous` synthesizes the chunk as one flowing text, so the intonation runs across its sentences.

Output (JSON on stdout):
  {"sample_rate": 24000, "chunks": [{"id", "file", "duration", "words": [{"i", "start", "end"}]}]}
"""
import json
import os
import sys
from difflib import SequenceMatcher

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

CONTINUOUS_STYLE_TOKENS = 200  # the style of a ~200-phoneme passage (a few sentences)
SILENT = set(";:,.!?¡¿—…\"«»“”()[]-' ")


def phoneme_groups(spoken):
    """Index ranges [start, end) of the space-separated phoneme words."""
    groups, start = [], None
    for i, t in enumerate(spoken):
        if t.phoneme == " ":
            if start is not None:
                groups.append((start, i))
                start = None
        elif start is None:
            start = i
    if start is not None:
        groups.append((start, len(spoken)))
    return groups


STRESS = set("ˈˌː")
# A caption word the voice ran into its neighbour ("of the" said as one): it gets no sound of its own. Dearer than
# the worst mismatch (10), because a word said alone can sound nothing like it does in a sentence ("a": "ay" / "uh").
MERGED_COST = 11.0


def plain(phonemes):
    """Phonemes without spaces, stress marks and punctuation, to compare a written word with what was said."""
    return "".join(c for c in phonemes if c not in SILENT and c not in STRESS)


def align(words, sounds):
    """Assign each caption word a run of spoken phoneme words, by how alike they sound.

    words[i] is caption word i's phonemes said alone; sounds[j] is spoken phoneme word j. Counting alone can't
    tell which word of a sentence was run into its neighbour, and a wrong guess shifts every word after it.
    """
    inf = float("inf")
    n, m = len(words), len(sounds)
    dp = [[inf] * (m + 1) for _ in range(n + 1)]
    back = [[None] * (m + 1) for _ in range(n + 1)]
    dp[0][0] = 0
    for i in range(n):
        for j in range(m + 1):
            if dp[i][j] == inf:
                continue
            for k in range(0, 5):
                if j + k > m:
                    break
                if k == 0:
                    step = MERGED_COST if words[i] else 0.0
                elif not words[i]:
                    step = 10.0
                else:
                    step = (1 - SequenceMatcher(None, words[i], "".join(sounds[j : j + k]), autojunk=False).ratio()) * 10
                cost = dp[i][j] + step
                if cost < dp[i + 1][j + k]:
                    dp[i + 1][j + k] = cost
                    back[i + 1][j + k] = k
    out, j = [], m
    for i in range(n, 0, -1):
        k = back[i][j]
        if k is None:
            return [None] * n
        out.append((j - k, j - 1) if k > 0 else None)
        j -= k
    return list(reversed(out))


SENTENCE_MARKS = set(".!?…")
CLOSERS = "\"'”’)]»"


def word_sentences(say):
    """[start, end) runs of caption words, one per sentence (a word ending in . ! ? … closes one)."""
    runs, start = [], 0
    for i, word in enumerate(say):
        core = word.rstrip(CLOSERS)
        if core and core[-1] in SENTENCE_MARKS:
            runs.append((start, i + 1))
            start = i + 1
    if start < len(say):
        runs.append((start, len(say)))
    return runs


def group_sentences(spoken, groups):
    """[start, end) runs of phoneme words, one per sentence (a phoneme word holding . ! ? … closes one)."""
    runs, start = [], 0
    for g, (a, b) in enumerate(groups):
        if any(spoken[j].phoneme in SENTENCE_MARKS for j in range(a, b)):
            runs.append((start, g + 1))
            start = g + 1
    if start < len(groups):
        runs.append((start, len(groups)))
    return runs


def align_sentences(say, words, spoken, groups):
    """Align sentence by sentence, so a mismatch stays inside its own sentence and never moves the words of the next.
    When the voice and the text disagree on where sentences end, the whole text is aligned at once."""
    sounds = [plain("".join(spoken[j].phoneme for j in range(a, b))) for a, b in groups]
    written, said = word_sentences(say), group_sentences(spoken, groups)
    if len(written) != len(said):
        print(f"kokoro_tts: {len(written)} sentences written, {len(said)} spoken; aligning the whole text at once", file=sys.stderr)
        return align(words, sounds)
    out = []
    for (w0, w1), (g0, g1) in zip(written, said):
        for span in align(words[w0:w1], sounds[g0:g1]):
            out.append(None if span is None else (span[0] + g0, span[1] + g0))
    return out


def main():
    req = json.load(sys.stdin)
    kokoro = Kokoro(req["model"], req["voices"])
    if not kokoro.has_timings:
        sys.exit("The Kokoro model has no duration output. Run: ./engine setup")
    os.makedirs(req["out_dir"], exist_ok=True)
    result = {"sample_rate": 24000, "chunks": []}

    for chunk in req["chunks"]:
        lang = chunk.get("lang", req.get("lang", "en-us"))
        say = [w.strip() for w in chunk["say"]]
        if chunk["voice"] not in kokoro.voices:
            sys.exit(f'Unknown Kokoro voice "{chunk["voice"]}". Voices: {", ".join(sorted(kokoro.voices.keys()))}')
        continuous = bool(chunk.get("continuous", False))
        # Kokoro picks a speaking style by text length. A whole script falls in its longest style, which reads
        # about 30% faster than the same lines said one at a time; a passage's style keeps the usual pace.
        voice = kokoro.get_voice_style(chunk["voice"])[:CONTINUOUS_STYLE_TOKENS] if continuous else chunk["voice"]
        audio, sr, spoken = kokoro.create_timed(
            " ".join(say),
            voice,
            speed=float(chunk.get("speed", 1.0)),
            lang=lang,
            sentence_pause=float(chunk.get("sentence_pause", 0.25)),
            clause_pause=float(chunk.get("clause_pause", 0.1)),
            continuous=continuous,
        )
        groups = phoneme_groups(spoken)
        words_alone = [plain(kokoro.tokenizer.phonemize(w, lang)) for w in say]
        assignment = align_sentences(say, words_alone, spoken, groups)

        words, last_end = [], 0.0
        for i, span in enumerate(assignment):
            if span is None:
                words.append({"i": i, "start": last_end, "end": last_end})
                continue
            first, last = groups[span[0]], groups[span[1]]
            start = spoken[first[0]].start
            sounding = [j for j in range(last[0], last[1]) if spoken[j].phoneme not in SILENT]
            end = spoken[sounding[-1]].end if sounding else spoken[last[1] - 1].end
            words.append({"i": i, "start": round(start, 4), "end": round(max(end, start), 4)})
            last_end = end

        path = os.path.join(req["out_dir"], f'{chunk["id"]}.wav')
        sf.write(path, np.asarray(audio, dtype=np.float32), sr, subtype="FLOAT")
        result["chunks"].append({"id": chunk["id"], "file": path, "duration": len(audio) / sr, "words": words})

    json.dump(result, sys.stdout)


if __name__ == "__main__":
    main()
