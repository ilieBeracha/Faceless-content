import React from "react";
import { Composition } from "remotion";
import { HOST_STILL_SIZE, HostStill } from "../skills/render-talking-character/HostStill.tsx";
import type { CharacterModel } from "../skills/render-talking-character/rigs.ts";
import { Captioned } from "./Captioned.tsx";
import { Episode } from "./Episode.tsx";
import { demoProps } from "./demo-props.ts";
import type { EpisodeProps } from "./types.ts";

/**
 * A single composition renders every channel's episodes. The engine passes the props (script,
 * timings, characters, brand) when rendering; the defaults are a neutral demo for Remotion Studio.
 */
export const Root: React.FC = () => (
  <>
  <Composition
    id="Episode"
    component={Episode}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={300}
    defaultProps={demoProps as EpisodeProps}
    calculateMetadata={({ props }) => ({
      durationInFrames: props.durationInFrames,
      width: props.width,
      height: props.height,
      fps: props.fps,
    })}
  />
  {/* The clean Episode render with the captions drawn over it: the finished video. */}
  <Composition
    id="Captioned"
    component={Captioned}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={300}
    defaultProps={demoProps as EpisodeProps}
    calculateMetadata={({ props }) => ({ durationInFrames: props.durationInFrames, width: props.width, height: props.height, fps: props.fps })}
  />
  {/* The host on white, for painted worlds (see render-themed/paint.ts). */}
  <Composition id="HostStill" component={HostStill} width={HOST_STILL_SIZE} height={HOST_STILL_SIZE} fps={30} durationInFrames={1} defaultProps={{ model: demoProps.characters[Object.keys(demoProps.characters)[0]].model as CharacterModel }} />
  </>
);
