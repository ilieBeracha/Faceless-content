// Settings for `npm run studio` (Remotion Studio previews). Renders done by the
// engine (`./engine make episode`) pass the same options programmatically.
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setChromiumOpenGlRenderer((process.env.REMOTION_GL as "angle" | "swangle" | undefined) ?? "angle");
