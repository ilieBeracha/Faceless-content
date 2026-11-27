import React from "react";
import { AbsoluteFill } from "remotion";
import { Captions } from "../skills/captions/Captions.tsx";
import { loadEngineFonts } from "./fonts.ts";
import type { EpisodeProps } from "./types.ts";

loadEngineFonts();

/**
 * The captions alone, on a transparent background: rendered as PNG frames and laid over the clean render with ffmpeg
 * (render-episode.ts bakeCaptions), so changing how the captions look never decodes or renders the pictures again.
 */
export const CaptionLayer: React.FC<EpisodeProps> = (props) => (
  <AbsoluteFill style={{ direction: props.direction }}>{props.captionsSkill && <Captions props={props} />}</AbsoluteFill>
);
