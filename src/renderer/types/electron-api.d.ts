import type { NatjePlayerApi } from "../../shared/natjePlayerApi";

declare global {
  interface Window {
    natjePlayer?: NatjePlayerApi;
  }
}

export {};
