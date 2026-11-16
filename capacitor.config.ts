import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "nl.natje.iptvplayer",
  appName: "Natje's IPTV-player",
  webDir: "dist/renderer",
  server: {
    androidScheme: "https",
    cleartext: true
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
