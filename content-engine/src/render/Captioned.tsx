import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { Captions } from "../skills/captions/Captions.tsx";
import { loadEngineFonts } from "./fonts.ts";
import { CLEAN_VIDEO_FILE, type EpisodeProps } from "./types.ts";

loadEngineFonts();

/**
 * The finished video: the clean render (pictures, motion, sound) with the captions drawn over it. Changing how the
 * captions look renders only this, never the pictures again (render-episode.ts bakeCaptions).
 */
export const Captioned: React.FC<EpisodeProps> = (props) => (
  <AbsoluteFill style={{ direction: props.direction }}>
    <OffthreadVideo src={staticFile(CLEAN_VIDEO_FILE)} />
    {props.captionsSkill && <Captions props={props} />}
  </AbsoluteFill>
);
