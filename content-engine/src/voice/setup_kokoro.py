#!/usr/bin/env python3
"""Download the Kokoro model + voices and expose the per-phoneme durations as an output.

Usage: setup_kokoro.py <dir> <model_url> <voices_url>
Creates <dir>/kokoro-v1.0.onnx, <dir>/voices-v1.0.bin and <dir>/kokoro-v1.0.timed.onnx.
"""
import os
import sys
import urllib.request

import onnx
from onnx import TensorProto, helper

DURATION_TENSOR = "/encoder/Clip_output_0"  # rounded, clamped phoneme durations (frames of 600 samples)


def download(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        print(f"  ✓ {os.path.basename(path)} already downloaded")
        return
    print(f"  ↓ {url}")
    tmp = path + ".part"
    with urllib.request.urlopen(url) as response, open(tmp, "wb") as out:
        total = int(response.headers.get("Content-Length") or 0)
        done, shown = 0, -1
        while True:
            block = response.read(1 << 20)
            if not block:
                break
            out.write(block)
            done += len(block)
            pct = done * 100 // total if total else 0
            if total and pct // 25 > shown:
                shown = pct // 25
                print(f"    {pct:3d}% of {total // (1 << 20)} MB", flush=True)
    os.replace(tmp, path)


def patch(src, dst):
    if os.path.exists(dst):
        print(f"  ✓ {os.path.basename(dst)} already prepared")
        return
    model = onnx.load(src)
    names = {o for node in model.graph.node for o in node.output}
    if DURATION_TENSOR not in names:
        sys.exit(f"Could not find {DURATION_TENSOR} in the model graph; the model file may have changed.")
    if "duration" not in {o.name for o in model.graph.output}:
        model.graph.node.append(helper.make_node("Identity", [DURATION_TENSOR], ["duration"], name="expose_duration"))
        model.graph.output.append(helper.make_tensor_value_info("duration", TensorProto.FLOAT, None))
    onnx.save(model, dst)
    print(f"  ✓ prepared {os.path.basename(dst)} (word timings enabled)")


def main():
    folder, model_url, voices_url = sys.argv[1:4]
    os.makedirs(folder, exist_ok=True)
    model = os.path.join(folder, "kokoro-v1.0.onnx")
    download(model_url, model)
    download(voices_url, os.path.join(folder, "voices-v1.0.bin"))
    patch(model, os.path.join(folder, "kokoro-v1.0.timed.onnx"))


if __name__ == "__main__":
    main()
