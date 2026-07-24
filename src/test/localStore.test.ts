import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearLegacyCachedScans,
  loadSettings,
  saveSettings,
} from "../storage/localStore";

class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>();

  get length() {
    return this.items.size;
  }

  clear() {
    this.items.clear();
  }

  getItem(key: string) {
    return this.items.get(key) ?? null;
  }

  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.items.delete(key);
  }

  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
}

describe("local storage privacy migration", () => {
  let localStorage: MemoryStorage;

  beforeEach(() => {
    localStorage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("removes every legacy scan while preserving settings and unrelated data", () => {
    localStorage.setItem("definition-companion:scan:word:first", "sensitive scan one");
    localStorage.setItem("definition-companion:settings", '{"inlineMode":"off"}');
    localStorage.setItem("definition-companion:scan:word:second", "sensitive scan two");
    localStorage.setItem("other-app:data", "keep");

    clearLegacyCachedScans();

    expect(localStorage.getItem("definition-companion:scan:word:first")).toBeNull();
    expect(localStorage.getItem("definition-companion:scan:word:second")).toBeNull();
    expect(localStorage.getItem("definition-companion:settings")).toBe('{"inlineMode":"off"}');
    expect(localStorage.getItem("other-app:data")).toBe("keep");
  });

  it("enables highlighting by default and migrates unversioned settings", () => {
    expect(loadSettings().inlineMode).toBe("all");

    localStorage.setItem("definition-companion:settings", '{"inlineMode":"off"}');

    expect(loadSettings().inlineMode).toBe("all");
  });

  it("preserves an explicit highlight preference after it has been saved", () => {
    saveSettings({ language: "en", inlineMode: "off" });

    expect(loadSettings().inlineMode).toBe("off");
  });
});
