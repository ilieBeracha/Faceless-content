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
  /** The voice a new channel's host gets in this language (English hosts keep the voice their channel was drafted with). */
  voice?: { provider: string; voice_id: string };
}

export const LANGUAGES: readonly Language[] = [
  { code: "en", name: "English", native: "English", rtl: false },
  { code: "he", name: "Hebrew", native: "עברית", rtl: true, voice: { provider: "elevenlabs", voice_id: "George" } },
];

/** A channel's language by its code; an unknown code is an error, not English. */
export function languageOf(code: string): Language {
  const l = LANGUAGES.find((x) => x.code === code);
  if (!l) throw new EngineError(`The language "${code}" isn't supported.`, `Channels can be made in: ${LANGUAGES.map((x) => `${x.code} (${x.name})`).join(", ")}.`);
  return l;
}
