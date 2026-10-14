#!/usr/bin/env python3
"""Kokoro text-to-speech with exact word timings, for the content engine.

Kokoro predicts how long every phoneme lasts before it generates audio. The engine's setup step
exposes those durations as a model output ("duration"), so each caption word's start/end comes
straight from the model — no speech recognition or guessing.

Input (JSON on stdin):
  {"model": path, "voices": path, "out_dir": path,
   "chunks": [{"id": str, "voice": str, "lang": "en-us", "speed": float, "sentence_pause": float,
               "clause_pause": float, "say": [str, ...]}]}
  `say` has one entry per caption word: the text the voice should say for that word.

Output (JSON on stdout):
  {"sample_rate": 24000, "chunks": [{"id", "file", "duration", "words": [{"i", "start", "end"}]}]}
"""
import json
import os
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

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


def align(counts, n_groups):
    """Assign each caption word a run of phoneme words; counts[i] is what word i produces alone."""
    if sum(counts) == n_groups:
        out, g = [], 0
        for c in counts:
            out.append((g, g + c - 1) if c > 0 else None)
            g += c
        return out
    inf = float("inf")
    n = len(counts)
    dp = [[inf] * (n_groups + 1) for _ in range(n + 1)]
    back = [[None] * (n_groups + 1) for _ in range(n + 1)]
    dp[0][0] = 0
    for i in range(n):
        for j in range(n_groups + 1):
            if dp[i][j] == inf:
                continue
            for k in range(0, 5):
                if j + k > n_groups:
                    break
                cost = dp[i][j] + abs(k - counts[i]) * 10 + (3 if k == 0 else 0)
                if cost < dp[i + 1][j + k]:
                    dp[i + 1][j + k] = cost
                    back[i + 1][j + k] = k
    out, j = [], n_groups
    for i in range(n, 0, -1):
        k = back[i][j]
        if k is None:
            return [None] * n
        out.append((j - k, j - 1) if k > 0 else None)
        j -= k
    return list(reversed(out))


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
        audio, sr, spoken = kokoro.create_timed(
            " ".join(say),
            chunk["voice"],
            speed=float(chunk.get("speed", 1.0)),
            lang=lang,
            sentence_pause=float(chunk.get("sentence_pause", 0.25)),
            clause_pause=float(chunk.get("clause_pause", 0.1)),
        )
        groups = phoneme_groups(spoken)
        counts = [len(kokoro.tokenizer.phonemize(w, lang).split()) for w in say]
        assignment = align(counts, len(groups))

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
