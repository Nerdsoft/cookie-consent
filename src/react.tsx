import { useState, useEffect, useCallback } from "react";
import {
  mergeConfig,
  createConsentManager,
  type CookieConsentConfig,
  type ConsentStatus,
} from "./core";

export type { CookieConsentConfig, ConsentStatus };

interface UseCookieConsentReturn {
  status: ConsentStatus;
  isVisible: boolean;
  accept: () => void;
  decline: () => void;
  show: () => void;
  config: ReturnType<typeof mergeConfig>;
}

export function useCookieConsent(
  userConfig: CookieConsentConfig = {}
): UseCookieConsentReturn {
  const [config] = useState(() => mergeConfig(userConfig));
  const [manager] = useState(() => createConsentManager(config));
  const [status, setStatus] = useState<ConsentStatus>(() => manager.getStatus());
  const [isVisible, setIsVisible] = useState(() => manager.shouldShow());

  const accept = useCallback(() => {
    manager.accept();
    setStatus("accepted");
    setIsVisible(false);
  }, [manager]);

  const decline = useCallback(() => {
    manager.decline();
    setStatus("declined");
    setIsVisible(false);
  }, [manager]);

  const show = useCallback(() => setIsVisible(true), []);

  useEffect(() => {
    if (!isVisible) return;
    if (status !== null) return;

    const cleanupFns: (() => void)[] = [];
    const { autoAcceptMs, autoAcceptOnScrollPx } = config.behavior;

    if (autoAcceptMs && autoAcceptMs > 0) {
      const timer = setTimeout(accept, autoAcceptMs);
      cleanupFns.push(() => clearTimeout(timer));
    }

    if (autoAcceptOnScrollPx && autoAcceptOnScrollPx > 0) {
      const onScroll = () => {
        if (window.scrollY > autoAcceptOnScrollPx) accept();
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      cleanupFns.push(() => window.removeEventListener("scroll", onScroll));
    }

    return () => cleanupFns.forEach((fn) => fn());
  }, [isVisible, status, accept, config.behavior]);

  return { status, isVisible, accept, decline, show, config };
}

export function CookieConsentBanner({
  config: userConfig = {},
  className,
  settingsClassName,
}: {
  config?: CookieConsentConfig;
  className?: string;
  settingsClassName?: string;
}) {
  const { isVisible, accept, decline, show, config, status } =
    useCookieConsent(userConfig);

  const isGdpr = config.mode === "gdpr";
  const text = config.text;
  const links = config.links;

  if (status !== null && !isVisible) {
    return (
      <button
        onClick={show}
        className={
          settingsClassName ??
          "fixed bottom-0 right-4 z-50 bg-white rounded-t-lg shadow-lg border border-b-0 border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 transition-all"
        }
      >
        {text.settingsLabel}
      </button>
    );
  }

  if (!isVisible) return null;

  return (
    <div
      className={
        className ??
        "fixed bottom-4 right-4 z-50 max-w-sm bg-white rounded-lg shadow-xl border border-gray-200 p-4"
      }
    >
      <p className="text-sm text-gray-700 mb-3">
        {text.message}{" "}
        {links.privacyPolicy && (
          <a
            href={links.privacyPolicy}
            className="underline hover:opacity-80"
          >
            {text.privacyLinkLabel}
          </a>
        )}
      </p>

      <div className={`flex gap-2 ${isGdpr ? "flex-row" : "flex-col"}`}>
        <button
          onClick={accept}
          className="flex-1 bg-black text-white text-sm font-medium px-4 py-2 rounded hover:opacity-90 transition-opacity"
        >
          {text.acceptLabel}
        </button>

        {isGdpr && (
          <button
            onClick={decline}
            className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded hover:bg-gray-50 transition-colors"
          >
            {text.declineLabel}
          </button>
        )}

        {!isGdpr && links.doNotSell && (
          <a
            href={links.doNotSell}
            className="text-center text-xs text-gray-500 underline hover:text-gray-700"
          >
            Do Not Sell or Share My Personal Information
          </a>
        )}
      </div>
    </div>
  );
}
