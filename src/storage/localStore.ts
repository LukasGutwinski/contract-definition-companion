import type { ContractLanguage, ScanResult } from "../parser/types";

const SETTINGS_KEY = "definition-companion:settings";
const SCAN_PREFIX = "definition-companion:scan:";

export interface AppSettings {
  language: ContractLanguage;
  inlineMode: boolean;
  persistDefinitions: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: "auto",
  inlineMode: false,
  persistDefinitions: true,
};

export function loadSettings(): AppSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Browser storage can be disabled by policy. The app still works without persistence.
  }
}

export function loadCachedScan(documentKey: string): ScanResult | undefined {
  try {
    const raw = window.localStorage.getItem(SCAN_PREFIX + documentKey);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

export function saveCachedScan(documentKey: string, scan: ScanResult): void {
  try {
    window.localStorage.setItem(
      SCAN_PREFIX + documentKey,
      JSON.stringify({
        ...scan,
        cachedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // Large documents can exceed localStorage limits. Re-scanning remains available.
  }
}

export function clearCachedScan(documentKey: string): void {
  try {
    window.localStorage.removeItem(SCAN_PREFIX + documentKey);
  } catch {
    // Ignore storage failures; cache clearing is best effort only.
  }
}
