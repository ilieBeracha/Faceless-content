#!/usr/bin/env python3
"""Word timings for speech the engine didn't synthesize (video-model clips), without a speech recognizer.

For every clip the engine also reads the same line with the local Kokoro voice, whose word timings are
exact. Both recordings become MFCC frames (per-file normalized, so the two voices are comparable) and a
subsequence DTW finds where the reference line sits inside the clip and how its frames map. Each word's
start/end in the reference is carried over to the clip.

Input (JSON on stdin):
  {"items": [{"id": str, "clip": path_to_16k_mono_wav, "ref": path_to_16k_mono_wav,
              "words": [{"start": s, "end": s}, ...]}]}
Output (JSON on stdout):
  {"items": [{"id", "words": [{"start", "end"}], "speech_start", "speech_end", "cost", "method"}]}
"""
import json
import sys

import numpy as np
import soundfile as sf

SR = 16000
HOP = 160  # 10 ms
WIN = 400  # 25 ms
N_MELS = 40
N_MFCC = 13


def mel_filters():
    def hz_to_mel(f):
        return 2595 * np.log10(1 + f / 700)

    def mel_to_hz(m):
        return 700 * (10 ** (m / 2595) - 1)

    n_fft = 512
    mels = np.linspace(hz_to_mel(80), hz_to_mel(7600), N_MELS + 2)
    bins = np.floor((n_fft + 1) * mel_to_hz(mels) / SR).astype(int)
    fb = np.zeros((N_MELS, n_fft // 2 + 1))
    for m in range(1, N_MELS + 1):
        a, b, c = bins[m - 1], bins[m], bins[m + 1]
        for k in range(a, b):
            fb[m - 1, k] = (k - a) / max(1, b - a)
        for k in range(b, c):
            fb[m - 1, k] = (c - k) / max(1, c - b)
    return fb


FB = mel_filters()
DCT = np.cos(np.pi / N_MELS * (np.arange(N_MELS) + 0.5)[None, :] * np.arange(1, N_MFCC + 1)[:, None])


def load(path):
    x, sr = sf.read(path, dtype="float32", always_2d=True)
    x = x.mean(axis=1)
    if sr != SR:
        raise SystemExit(f"{path}: expected {SR} Hz, got {sr}")
    return x


def frames(x):
    if len(x) < WIN:
        x = np.pad(x, (0, WIN - len(x)))
    n = 1 + (len(x) - WIN) // HOP
    idx = np.arange(WIN)[None, :] + HOP * np.arange(n)[:, None]
    return x[idx] * np.hamming(WIN)[None, :]


def features(x):
    f = frames(np.append(x[0], x[1:] - 0.97 * x[:-1]))
    power = np.abs(np.fft.rfft(f, 512)) ** 2
    logmel = np.log(power @ FB.T + 1e-8)
    energy = logmel.max(axis=1)
    mfcc = logmel @ DCT.T
    d = np.diff(mfcc, axis=0, prepend=mfcc[:1])
    feats = np.hstack([mfcc, d])
    feats = (feats - feats.mean(axis=0)) / (feats.std(axis=0) + 1e-6)
    return feats, energy


def speech_span(energy):
    """Rough voiced region from frame energy (fallback when DTW looks wrong)."""
    thr = np.percentile(energy, 20) + 0.45 * (np.percentile(energy, 95) - np.percentile(energy, 20))
    on = np.where(energy > thr)[0]
    if len(on) == 0:
        return 0, len(energy)
    return int(on[0]), int(on[-1]) + 1


def subsequence_dtw(ref, clip):
    """Each reference frame advances one row; the clip may advance 0–3 frames per row (slope 0..3)."""
    a = ref / (np.linalg.norm(ref, axis=1, keepdims=True) + 1e-9)
    b = clip / (np.linalg.norm(clip, axis=1, keepdims=True) + 1e-9)
    cost = 1 - a @ b.T  # cosine distance, N x M
    n, m = cost.shape
    inf = np.inf
    D = np.full((n, m), inf)
    back = np.zeros((n, m), dtype=np.int8)
    D[0] = cost[0]  # free start anywhere in the clip
    for i in range(1, n):
        prev = D[i - 1]
        options = np.full((4, m), inf)
        options[0] = prev
        options[1, 1:] = prev[:-1]
        options[2, 2:] = prev[:-2]
        options[3, 3:] = prev[:-3]
        k = options.argmin(axis=0)
        D[i] = cost[i] + options[k, np.arange(m)]
        back[i] = k
    end = int(np.argmin(D[-1]))
    path = np.zeros(n, dtype=int)
    j = end
    for i in range(n - 1, -1, -1):
        path[i] = j
        if i > 0:
            j -= int(back[i, j])
    return path, float(D[-1, end] / n)


def align_item(item):
    clip = load(item["clip"])
    ref = load(item["ref"])
    cf, ce = features(clip)
    rf, _ = features(ref)
    words = item["words"]
    s0, s1 = speech_span(ce)
    path, cost = subsequence_dtw(rf, cf)
    span = (path[-1] - path[0]) * HOP / SR
    ref_span = (words[-1]["end"] - words[0]["start"]) if words else 0
    ok = words and cost < 0.75 and 0.4 * ref_span <= span <= 3.0 * ref_span + 0.5
    out = []
    if ok:
        last = len(path) - 1
        for w in words:
            a = min(last, int(w["start"] * SR / HOP))
            b = min(last, max(a, int(w["end"] * SR / HOP) - 1))
            out.append({"start": round(path[a] * HOP / SR, 3), "end": round((path[b] + 1) * HOP / SR, 3)})
        method = "dtw"
    else:
        # Fallback: spread the words over the voiced region in proportion to their reference length.
        t0, t1 = s0 * HOP / SR, s1 * HOP / SR
        total = sum(w["end"] - w["start"] for w in words) or 1
        t = t0
        for w in words:
            d = (w["end"] - w["start"]) / total * (t1 - t0)
            out.append({"start": round(t, 3), "end": round(t + d, 3)})
            t += d
        method = "energy"
    for i in range(1, len(out)):  # keep words ordered and non-overlapping
        if out[i]["start"] < out[i - 1]["end"]:
            out[i]["start"] = out[i - 1]["end"]
        if out[i]["end"] < out[i]["start"]:
            out[i]["end"] = out[i]["start"]
    return {
        "id": item["id"],
        "words": out,
        "speech_start": out[0]["start"] if out else s0 * HOP / SR,
        "speech_end": out[-1]["end"] if out else s1 * HOP / SR,
        "cost": round(cost, 4),
        "method": method,
        "clip_seconds": round(len(clip) / SR, 3),
    }


def main():
    req = json.load(sys.stdin)
    json.dump({"items": [align_item(it) for it in req["items"]]}, sys.stdout)


if __name__ == "__main__":
    main()
