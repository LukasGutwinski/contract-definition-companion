import { describe, expect, it } from "vitest";
import indexHtml from "../../index.html?raw";
import packageJson from "../../package.json?raw";
import headers from "../../public/_headers?raw";

const APPLICATION_SOURCES = import.meta.glob("../**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const NETWORK_SINKS: Array<[name: string, pattern: RegExp]> = [
  ["fetch", /\bfetch\s*\(/],
  ["XMLHttpRequest", /\bXMLHttpRequest\b/],
  ["WebSocket", /\bWebSocket\s*\(/],
  ["EventSource", /\bEventSource\s*\(/],
  ["sendBeacon", /\bsendBeacon\s*\(/],
  ["postMessage", /\bpostMessage\s*\(/],
];

describe("privacy boundary", () => {
  it("contains no application network sink", () => {
    const violations = Object.entries(APPLICATION_SOURCES).flatMap(([file, source]) => {
      if (file.includes("/test/")) return [];
      return NETWORK_SINKS.flatMap(([name, pattern]) =>
        pattern.test(source)
          ? [`${file.replace(/^\.\.\//, "src/")} uses ${name}`]
          : [],
      );
    });

    expect(violations).toEqual([]);
  });

  it("blocks application network connections in both CSP layers", () => {
    expect(indexHtml).toContain("connect-src 'none'");
    expect(headers).toContain("connect-src 'none'");
  });

  it("keeps runtime dependencies on the reviewed UI-only allowlist", () => {
    const manifest = JSON.parse(packageJson) as {
      dependencies?: Record<string, string>;
    };

    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual([
      "lucide-react",
      "react",
      "react-dom",
    ]);
  });
});
