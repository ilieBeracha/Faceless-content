import { loadFont } from "@remotion/fonts";
import baloo800 from "@fontsource/baloo-2/files/baloo-2-latin-800-normal.woff2";
import fredoka600 from "@fontsource/fredoka/files/fredoka-latin-600-normal.woff2";
import fredoka700 from "@fontsource/fredoka/files/fredoka-latin-700-normal.woff2";
import montserrat800 from "@fontsource/montserrat/files/montserrat-latin-800-normal.woff2";
import montserrat900 from "@fontsource/montserrat/files/montserrat-latin-900-normal.woff2";
import grotesk500 from "@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2";
import grotesk700 from "@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2";

/** Fonts bundled with the engine (all SIL Open Font License). Channel brand.font picks one key. */
export const FONTS: Record<string, { family: string; files: { url: string; weight: string }[]; heavy: number; regular: number }> = {
  montserrat: { family: "Montserrat", files: [{ url: montserrat800, weight: "800" }, { url: montserrat900, weight: "900" }], heavy: 900, regular: 800 },
  "space-grotesk": { family: "Space Grotesk", files: [{ url: grotesk500, weight: "500" }, { url: grotesk700, weight: "700" }], heavy: 700, regular: 500 },
  fredoka: { family: "Fredoka", files: [{ url: fredoka600, weight: "600" }, { url: fredoka700, weight: "700" }], heavy: 700, regular: 600 },
  "baloo-2": { family: "Baloo 2", files: [{ url: baloo800, weight: "800" }], heavy: 800, regular: 800 },
};

let loaded = false;
export function loadEngineFonts(): void {
  if (loaded) return;
  loaded = true;
  for (const font of Object.values(FONTS)) {
    for (const file of font.files) void loadFont({ family: font.family, url: file.url, weight: file.weight });
  }
}

export function fontFor(key: string) {
  return FONTS[key] ?? FONTS.montserrat;
}
