import type { NatjePlayerApi } from "../shared/natjePlayerApi";

export type RuntimePlatform = "electron" | "android" | "web";

export type PlatformApi = NatjePlayerApi & {
  runtime: RuntimePlatform;
  supportsNativePlayer: boolean;
  supportsMpv: boolean;
};
