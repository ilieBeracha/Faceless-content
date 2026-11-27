/**
 * The languages a channel can be made in. A channel's `language` (channel.md) is one of these codes; its voice speaks
 * it (the character's voice.language), the script is written in it, and right-to-left ones are laid out that way.
 */
import { EngineError } from "./errors.ts";

export interface Language {
  code: string;
  /** How the writer is told the language. */
  name: string;
  /** Its own name, for people choosing it. */
  native: string;
  rtl: boolean;
  /** How the language is written for the ear: the register every script and channel text in it keeps. */
  style?: string;
  /** The voice a new channel's host gets in this language (English hosts keep the voice their channel was drafted with). */
  voice?: { provider: string; voice_id: string };
}

export const LANGUAGES: readonly Language[] = [
  { code: "en", name: "English", native: "English", rtl: false },
  {
    code: "he",
    name: "Hebrew",
    native: "עברית",
    rtl: true,
    style:
      "Everyday spoken Israeli Hebrew, said nonchalantly: calm and a little dry, like mentioning something mildly surprising to a friend without making a big deal of it. Short sentences and plain words people actually say (ככה, בעצם, די, סתם, אז). Don't try to sound young or cool: no piled-up slang, no hype, no exclamation marks. Never written or formal Hebrew: no אשר, כיצד, על כן, הנה, אולם, כמו כן, לא יאמן. No vowel marks. Numbers and years the way people say them.",
    // Erez, a native Israeli voice from ElevenLabs' voice library (chosen by ear, 2026-11-21), on the person's own ElevenLabs plan.
    voice: { provider: "elevenlabs-direct", voice_id: "AZzja2JCoYeMe9vDQBll" },
  },
];

/** A channel's language by its code; an unknown code is an error, not English. */
export function languageOf(code: string): Language {
  const l = LANGUAGES.find((x) => x.code === code);
  if (!l) throw new EngineError(`The language "${code}" isn't supported.`, `Channels can be made in: ${LANGUAGES.map((x) => `${x.code} (${x.name})`).join(", ")}.`);
  return l;
}
