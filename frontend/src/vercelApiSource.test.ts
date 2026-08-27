import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceFiles = [
  resolve(__dirname, "../api/agent-metadata.ts"),
  resolve(__dirname, "providerMetadataApi.ts"),
];

describe("Vercel API source", () => {
  it("uses explicit .js extensions for relative ESM imports", () => {
    const relativeImport = /from\s+["'](\.{1,2}\/[^"']+)["']/g;
    const violations: string[] = [];

    for (const file of sourceFiles) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(relativeImport)) {
        if (!match[1].endsWith(".js")) {
          violations.push(`${file}: ${match[1]}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
