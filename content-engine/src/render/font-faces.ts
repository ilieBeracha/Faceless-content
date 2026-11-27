/**
 * The engine's fonts by key: their family, weights and @fontsource files (paths under node_modules/@fontsource).
 * Plain data, so the storefront can serve and name them; render/fonts.ts loads the same files into the renderer.
 * `hebrew`: the font's own Hebrew letters; without it, Hebrew is drawn with Fredoka's.
 */
export const FONT_FACES: Record<string, { family: string; heavy: number; regular: number; latin: string; hebrew?: string }> = {
  montserrat: { family: "Montserrat", heavy: 900, regular: 800, latin: "montserrat/files/montserrat-latin-900-normal.woff2" },
  "space-grotesk": { family: "Space Grotesk", heavy: 700, regular: 500, latin: "space-grotesk/files/space-grotesk-latin-700-normal.woff2" },
  fredoka: { family: "Fredoka", heavy: 700, regular: 600, latin: "fredoka/files/fredoka-latin-700-normal.woff2", hebrew: "fredoka/files/fredoka-hebrew-700-normal.woff2" },
  "baloo-2": { family: "Baloo 2", heavy: 800, regular: 800, latin: "baloo-2/files/baloo-2-latin-800-normal.woff2" },
  anton: { family: "Anton", heavy: 400, regular: 400, latin: "anton/files/anton-latin-400-normal.woff2" },
  rubik: { family: "Rubik", heavy: 800, regular: 800, latin: "rubik/files/rubik-latin-800-normal.woff2", hebrew: "rubik/files/rubik-hebrew-800-normal.woff2" },
  heebo: { family: "Heebo", heavy: 900, regular: 900, latin: "heebo/files/heebo-latin-900-normal.woff2", hebrew: "heebo/files/heebo-hebrew-900-normal.woff2" },
  "secular-one": { family: "Secular One", heavy: 400, regular: 400, latin: "secular-one/files/secular-one-latin-400-normal.woff2", hebrew: "secular-one/files/secular-one-hebrew-400-normal.woff2" },
};

/** The Hebrew file a font's heavy weight is drawn with: its own, else Fredoka's. */
export function hebrewFile(key: string): string {
  return FONT_FACES[key].hebrew ?? FONT_FACES.fredoka.hebrew!;
}

/** The characters the Hebrew files cover (letters, points, punctuation, the shekel sign). */
export const HEBREW_RANGE = "U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F";
