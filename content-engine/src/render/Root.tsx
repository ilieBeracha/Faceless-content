import React from "react";
import { Composition } from "remotion";
import { Episode } from "./Episode.tsx";
import { demoProps } from "./demo-props.ts";
import type { EpisodeProps } from "./types.ts";

/**
 * A single composition renders every channel's episodes. The engine passes the props (script,
 * timings, characters, brand) when rendering; the defaults are a neutral demo for Remotion Studio.
 */
export const Root: React.FC = () => (
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
);
