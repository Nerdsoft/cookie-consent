export type ConsentMode = "ccpa" | "gdpr";

export type ConsentStatus = "accepted" | "declined" | null;

export interface CookieConsentText {
  message?: string;
  acceptLabel?: string;
  declineLabel?: string;
  settingsLabel?: string;
  privacyLinkLabel?: string;
}

export interface CookieConsentLinks {
  privacyPolicy?: string;
  doNotSell?: string;
}

export interface CookieConsentBehavior {
  /** Auto-accept after N ms. 0 = disabled. CCPA default: 5000. GDPR default: 0. */
  autoAcceptMs?: number;
  /** Auto-accept after scrolling N px. 0 = disabled. CCPA default: 100. GDPR default: 0. */
  autoAcceptOnScrollPx?: number;
  /** Cookie name used to store consent status. */
  storageKey?: string;
  /** How many days to store consent. Default: 365. */
  consentDays?: number;
}

export interface CookieConsentSignals {
  /** Fire window.uetq ad_storage consent update (Bing UET). Default: false. */
  bingUet?: boolean;
  /** Fire gtag consent update (Google Consent Mode v2). Default: false. */
  googleConsent?: boolean;
}

export interface CookieConsentConfig {
  mode?: ConsentMode;
  text?: CookieConsentText;
  links?: CookieConsentLinks;
  behavior?: CookieConsentBehavior;
  signals?: CookieConsentSignals;
  onAccept?: () => void;
  onDecline?: () => void;
}

const DEFAULTS: Required<CookieConsentConfig> = {
  mode: "ccpa",
  text: {
    message:
      "By using this website, you agree to our Terms of Use. This website uses cookies to ensure you get the best experience.",
    acceptLabel: "Accept",
    declineLabel: "Decline",
    settingsLabel: "Cookie Settings",
    privacyLinkLabel: "Privacy Policy",
  },
  links: {
    privacyPolicy: "/privacy-policy/",
    doNotSell: "/do-not-sell/",
  },
  behavior: {
    autoAcceptMs: 0,
    autoAcceptOnScrollPx: 0,
    storageKey: "cookie_consent_status",
    consentDays: 365,
  },
  signals: {
    bingUet: false,
    googleConsent: false,
  },
  onAccept: () => {},
  onDecline: () => {},
};

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? match[2] : null;
}

function setCookie(name: string, value: string, days: number): void {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

function fireSignals(
  granted: boolean,
  signals: CookieConsentSignals
): void {
  if (signals.bingUet) {
    const uetq: unknown[] = (window as any).uetq ?? [];
    (window as any).uetq = uetq;
    uetq.push("consent", "update", {
      ad_storage: granted ? "granted" : "denied",
    });
  }

  if (signals.googleConsent && typeof (window as any).gtag === "function") {
    (window as any).gtag("consent", "update", {
      ad_storage: granted ? "granted" : "denied",
      analytics_storage: granted ? "granted" : "denied",
    });
  }
}

export function mergeConfig(user: CookieConsentConfig): Required<CookieConsentConfig> {
  const mode = user.mode ?? DEFAULTS.mode;
  const isGdpr = mode === "gdpr";

  return {
    mode,
    text: { ...DEFAULTS.text, ...user.text },
    links: { ...DEFAULTS.links, ...user.links },
    behavior: {
      autoAcceptMs: isGdpr ? 0 : 5000,
      autoAcceptOnScrollPx: isGdpr ? 0 : 100,
      ...DEFAULTS.behavior,
      ...user.behavior,
    },
    signals: { ...DEFAULTS.signals, ...user.signals },
    onAccept: user.onAccept ?? DEFAULTS.onAccept,
    onDecline: user.onDecline ?? DEFAULTS.onDecline,
  };
}

export type ConsentManager = {
  getStatus: () => ConsentStatus;
  accept: () => void;
  decline: () => void;
  /** True if the banner should be shown. */
  shouldShow: () => boolean;
};

export function createConsentManager(
  config: Required<CookieConsentConfig>
): ConsentManager {
  const key = config.behavior.storageKey!;
  const days = config.behavior.consentDays!;

  function getStatus(): ConsentStatus {
    const val = getCookie(key);
    if (val === "accepted") return "accepted";
    if (val === "declined") return "declined";
    return null;
  }

  function shouldShow(): boolean {
    return getStatus() === null;
  }

  function accept(): void {
    setCookie(key, "accepted", days);
    fireSignals(true, config.signals);
    config.onAccept();
  }

  function decline(): void {
    setCookie(key, "declined", days);
    fireSignals(false, config.signals);
    config.onDecline();
  }

  return { getStatus, accept, decline, shouldShow };
}
