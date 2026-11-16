import { getElectronApi } from "../renderer/lib/electronApi";
import type { PlatformApi } from "./types";

export function createElectronPlatform(): PlatformApi {
  const api = getElectronApi();
  return {
    ...api,
    runtime: "electron",
    supportsNativePlayer: false,
    supportsMpv: true
  };
}
