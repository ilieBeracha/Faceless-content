import { loadFont } from "@remotion/fonts";
import { FONT_FACES, HEBREW_RANGE } from "./font-faces.ts";
import anton400 from "@fontsource/anton/files/anton-latin-400-normal.woff2";
import baloo800 from "@fontsource/baloo-2/files/baloo-2-latin-800-normal.woff2";
import patrickHand400 from "@fontsource/patrick-hand/files/patrick-hand-latin-400-normal.woff2";
import fredoka600 from "@fontsource/fredoka/files/fredoka-latin-600-normal.woff2";
import fredoka700 from "@fontsource/fredoka/files/fredoka-latin-700-normal.woff2";
import montserrat800 from "@fontsource/montserrat/files/montserrat-latin-800-normal.woff2";
import montserrat900 from "@fontsource/montserrat/files/montserrat-latin-900-normal.woff2";
import grotesk500 from "@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2";
import grotesk700 from "@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2";
import fredokaHebrew400 from "@fontsource/fredoka/files/fredoka-hebrew-400-normal.woff2";
import fredokaHebrew500 from "@fontsource/fredoka/files/fredoka-hebrew-500-normal.woff2";
import fredokaHebrew600 from "@fontsource/fredoka/files/fredoka-hebrew-600-normal.woff2";
import fredokaHebrew700 from "@fontsource/fredoka/files/fredoka-hebrew-700-normal.woff2";
import rubik800 from "@fontsource/rubik/files/rubik-latin-800-normal.woff2";
import rubikHebrew800 from "@fontsource/rubik/files/rubik-hebrew-800-normal.woff2";
import heebo900 from "@fontsource/heebo/files/heebo-latin-900-normal.woff2";
import heeboHebrew900 from "@fontsource/heebo/files/heebo-hebrew-900-normal.woff2";
import secularOne400 from "@fontsource/secular-one/files/secular-one-latin-400-normal.woff2";
import secularOneHebrew400 from "@fontsource/secular-one/files/secular-one-hebrew-400-normal.woff2";

/** A font's name and weights (font-faces.ts), for FONTS below. */
const face = (key: string) => {
  const { family, heavy, regular } = FONT_FACES[key];
  return { family, heavy, regular };
};

/**
 * Fonts bundled with the engine (all SIL Open Font License). Channel brand.font and a video's caption font pick one key.
 * `hebrewFiles`: the font's own Hebrew letters; a font without them draws Hebrew with Fredoka's.
 */
export const FONTS: Record<string, { family: string; files: { url: string; weight: string }[]; heavy: number; regular: number; hebrewFiles?: { url: string; weight: string }[] }> = {
  montserrat: { ...face("montserrat"), files: [{ url: montserrat800, weight: "800" }, { url: montserrat900, weight: "900" }] },
  "space-grotesk": { ...face("space-grotesk"), files: [{ url: grotesk500, weight: "500" }, { url: grotesk700, weight: "700" }] },
  fredoka: { ...face("fredoka"), files: [{ url: fredoka600, weight: "600" }, { url: fredoka700, weight: "700" }] },
  "baloo-2": { ...face("baloo-2"), files: [{ url: baloo800, weight: "800" }] },
  anton: { ...face("anton"), files: [{ url: anton400, weight: "400" }] },
  rubik: { ...face("rubik"), files: [{ url: rubik800, weight: "800" }], hebrewFiles: [{ url: rubikHebrew800, weight: "800" }] },
  heebo: { ...face("heebo"), files: [{ url: heebo900, weight: "900" }], hebrewFiles: [{ url: heeboHebrew900, weight: "900" }] },
  "secular-one": { ...face("secular-one"), files: [{ url: secularOne400, weight: "400" }], hebrewFiles: [{ url: secularOneHebrew400, weight: "400" }] },
};

/** Not a brand choice: the handwriting used for lettering inside storybook scenes. */
const EXTRA_FONTS = [{ family: "Patrick Hand", url: patrickHand400, weight: "400" }];

let loaded = false;
export function loadEngineFonts(): void {
  if (loaded) return;
  loaded = true;
  for (const font of Object.values(FONTS)) {
    for (const file of font.files) void loadFont({ family: font.family, url: file.url, weight: file.weight });
  }
  for (const f of EXTRA_FONTS) void loadFont({ family: f.family, url: f.url, weight: f.weight });
  // Hebrew letters for every font, under its own name: its own when it has them, else Fredoka's (the nearest weight
  // it has), so a Hebrew character in any font is drawn, and Latin text keeps the font.
  for (const font of Object.values(FONTS)) {
    const hebrew = font.hebrewFiles ?? font.files.map((file) => ({ url: HEBREW[Math.min(700, Math.max(400, Math.round(Number(file.weight) / 100) * 100))], weight: file.weight }));
    for (const file of hebrew) void loadFont({ family: font.family, url: file.url, weight: file.weight, unicodeRange: HEBREW_RANGE });
  }
}

/** Fredoka's Hebrew letters by weight. */
const HEBREW: Record<number, string> = { 400: fredokaHebrew400, 500: fredokaHebrew500, 600: fredokaHebrew600, 700: fredokaHebrew700 };

export function fontFor(key: string) {
  return FONTS[key] ?? FONTS.montserrat;
}
