import { Capacitor } from "@capacitor/core";
import { createAndroidPlatform } from "./androidPlatform";
import { createElectronPlatform } from "./electronPlatform";
import type { PlatformApi } from "./types";

let platform: PlatformApi | null = null;

export function getPlatform(): PlatformApi {
  if (platform) {
    return platform;
  }
  // Browser integration fixtures are deliberately stripped from production builds.
  if (import.meta.env.DEV) {
    const fixture = (window as Window & { __NATJE_TEST_PLATFORM__?: PlatformApi }).__NATJE_TEST_PLATFORM__;
    if (fixture) { platform = fixture; return platform; }
  }

  if (window.natjePlayer) {
    platform = createElectronPlatform();
    return platform;
  }

  if (Capacitor.isNativePlatform() || Capacitor.getPlatform() === "android") {
    platform = createAndroidPlatform();
    return platform;
  }

  platform = createAndroidPlatform();
  return platform;
}

export type { PlatformApi, RuntimePlatform } from "./types";
