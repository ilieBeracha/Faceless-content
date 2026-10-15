"""
Generates the storybook paper textures (run once; the PNGs are committed):
  wash-0..3.png  low-frequency mottling that makes flat fills look like watercolour washes
  grain.png      fine paper grain
Same look as the SVG feTurbulence filters they replace, but computed once instead of every frame.

  .venv/bin/python src/skills/render-storybook/textures/make_textures.py   (needs numpy + ffmpeg)
"""
import pathlib
import subprocess

import numpy as np

HERE = pathlib.Path(__file__).parent


def value_noise(size: int, cells: int, rng: np.random.Generator) -> np.ndarray:
    """Smooth noise: a random grid upsampled with smoothstep interpolation, tiling seamlessly."""
    grid = rng.uniform(-1, 1, (cells + 1, cells + 1))
    grid[-1, :] = grid[0, :]
    grid[:, -1] = grid[:, 0]
    pos = np.linspace(0, cells, size, endpoint=False)
    i = pos.astype(int)
    f = pos - i
    f = f * f * (3 - 2 * f)
    a = grid[np.ix_(i, i)]
    b = grid[np.ix_(i, i + 1)]
    c = grid[np.ix_(i + 1, i)]
    d = grid[np.ix_(i + 1, i + 1)]
    fx = f[None, :]
    fy = f[:, None]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fractal(size: int, base_cells: int, octaves: int, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    total = np.zeros((size, size))
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        total += amp * value_noise(size, base_cells * 2**o, rng)
        norm += amp
        amp /= 2
    z = total / norm
    return (z - z.mean()) / z.std()


def write_png(path: pathlib.Path, rgb: tuple[float, float, float], alpha: np.ndarray) -> None:
    size = alpha.shape[0]
    img = np.zeros((size, size, 4), dtype=np.uint8)
    img[..., 0], img[..., 1], img[..., 2] = (round(c * 255) for c in rgb)
    img[..., 3] = np.clip(alpha * 255, 0, 255).astype(np.uint8)
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{size}x{size}", "-i", "-", "-frames:v", "1", str(path)],
        input=img.tobytes(),
        check=True,
    )


if __name__ == "__main__":
    for k in range(4):
        # Covers 1120 scene units (-60…1060) at ~1 px per unit; ~8 blotches across, 3 octaves.
        z = fractal(1120, 8, 3, 11 + k * 17)
        write_png(HERE / f"wash-{k}.png", (0.42, 0.33, 0.22), np.clip(0.2 + 0.12 * z, 0, 1))
    z = fractal(1080, 540, 2, 4)
    write_png(HERE / "grain.png", (0.35, 0.28, 0.2), np.clip(0.27 + 0.07 * z, 0, 1))
    print("textures written to", HERE)
