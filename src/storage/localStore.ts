import type { ContractLanguage } from "../parser/types";

const SETTINGS_KEY = "definition-companion:settings";
const LEGACY_SCAN_PREFIX = "definition-companion:scan:";
const SETTINGS_VERSION = 2;

export interface AppSettings {
  language: ContractLanguage;
  inlineMode: InlineMode;
}

export type InlineMode = "off" | "selected" | "all";

export const DEFAULT_SETTINGS: AppSettings = {
  language: "en",
  inlineMode: "all",
};

export function loadSettings(): AppSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<AppSettings> & {
      inlineMode?: InlineMode | boolean;
      version?: number;
    };
    if (parsed.version !== SETTINGS_VERSION) return DEFAULT_SETTINGS;

    const inlineMode =
      typeof parsed.inlineMode === "boolean"
        ? parsed.inlineMode
          ? "all"
          : "off"
        : parsed.inlineMode === "off"
          ? "off"
          : "all";

    return { ...DEFAULT_SETTINGS, ...parsed, language: "en", inlineMode };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    window.localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ ...settings, version: SETTINGS_VERSION }),
    );
  } catch {
    // Browser storage can be disabled by policy. The app still works without persistence.
  }
}

export function clearLegacyCachedScans(): void {
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(LEGACY_SCAN_PREFIX)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Storage may be disabled by policy. No new scan data is persisted.
  }
}
