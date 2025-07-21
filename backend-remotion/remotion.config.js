import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setConcurrency(1); // Reduce concurrency for stability
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');
Config.setCrf(23);
Config.setImageSequence(false);
Config.setLogLevel('info');
Config.setTimeoutInMilliseconds(120000); // 2 minutes timeout
Config.setChromiumDisableWebSecurity(true); // Allow cross-origin requests

// Set output directory
Config.setPublicDir('./public');
