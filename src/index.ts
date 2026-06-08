import {
  mergeConfig,
  createConsentManager,
  type CookieConsentConfig,
  type ConsentStatus,
} from "./core";

export type { CookieConsentConfig, ConsentStatus };
export { createConsentManager, mergeConfig };

let _cleanup: (() => void) | null = null;

export const CookieConsent = {
  init(userConfig: CookieConsentConfig = {}): void {
    if (typeof window === "undefined") return;
    if (_cleanup) _cleanup();

    const config = mergeConfig(userConfig);
    const manager = createConsentManager(config);

    if (!manager.shouldShow()) {
      if (manager.getStatus() === "accepted") {
        const { fireSignals } = _internals(config);
        fireSignals(true);
      }
      return;
    }

    const cleanupFns: (() => void)[] = [];

    const { autoAcceptMs, autoAcceptOnScrollPx } = config.behavior;

    if (autoAcceptMs && autoAcceptMs > 0) {
      const timer = setTimeout(() => manager.accept(), autoAcceptMs);
      cleanupFns.push(() => clearTimeout(timer));
    }

    if (autoAcceptOnScrollPx && autoAcceptOnScrollPx > 0) {
      const onScroll = () => {
        if (window.scrollY > autoAcceptOnScrollPx) manager.accept();
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      cleanupFns.push(() => window.removeEventListener("scroll", onScroll));
    }

    _cleanup = () => cleanupFns.forEach((fn) => fn());
  },

  destroy(): void {
    if (_cleanup) {
      _cleanup();
      _cleanup = null;
    }
  },
};

function _internals(config: ReturnType<typeof mergeConfig>) {
  return {
    fireSignals(granted: boolean) {
      if (config.signals.bingUet) {
        const uetq: unknown[] = (window as any).uetq ?? [];
        (window as any).uetq = uetq;
        uetq.push("consent", "update", {
          ad_storage: granted ? "granted" : "denied",
        });
      }
      if (
        config.signals.googleConsent &&
        typeof (window as any).gtag === "function"
      ) {
        (window as any).gtag("consent", "update", {
          ad_storage: granted ? "granted" : "denied",
          analytics_storage: granted ? "granted" : "denied",
        });
      }
    },
  };
}
