import type { CharacterModel } from "../skills/render-talking-character/rigs.ts";
import type { Beat, Script } from "../skills/write-script/schema.ts";

export interface SafeArea {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface Brand {
  primary_color: string;
  accent_color: string;
  background: [string, string];
  text_color: string;
  font: string;
  caption_case: "normal" | "upper";
  /** Single-word captions colour (defaults to the accent colour). */
  caption_color?: string;
}

export interface TimedWord {
  i: number;
  beat: string;
  text: string;
  start: number;
  end: number;
}

export interface TimedBeat {
  id: string;
  speaker: string;
  start: number;
  end: number;
}

export interface CharacterInfo {
  name: string;
  display_name: string;
  model: CharacterModel;
}

/** Everything the Episode composition needs. Built from the episode folder by render-episode.ts. */
export interface EpisodeProps {
  [key: string]: unknown;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  safeArea: SafeArea;
  brand: Brand;
  script: Script;
  words: TimedWord[];
  beats: TimedBeat[];
  envelope: number[];
  characters: Record<string, CharacterInfo>;
  renderSkills: string[];
  captionsSkill: string | null;
  /** "pages" = a short block of words with the spoken one highlighted; "single-word" = one word at a time. */
  captionStyle: "pages" | "single-word";
  audioFile: string | null;
  showSafeAreas: boolean;
  qaProbe: boolean;
}

/** A beat on the video timeline (visual span: from just before its voice starts until the next beat). */
export interface BeatSpan {
  index: number;
  id: string;
  beat: Beat;
  /** Seconds. */
  start: number;
  end: number;
  voiceStart: number;
  voiceEnd: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
