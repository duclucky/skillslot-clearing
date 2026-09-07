import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(testDir, "..");
const sourceFiles = [
  resolve(frontendRoot, "api/agent-metadata.ts"),
  resolve(frontendRoot, "api/studionet-rpc.ts"),
  resolve(frontendRoot, "api/a2a-message.ts"),
  resolve(frontendRoot, "api/agent-card.ts"),
  resolve(frontendRoot, "src/providerMetadataApi.ts"),
  resolve(frontendRoot, "src/a2aDispatchApi.ts"),
  resolve(frontendRoot, "src/a2aAgentCard.ts"),
  resolve(frontendRoot, "src/executorPermit.ts"),
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

  it("requires the canonical dispatch view to return the boolean true", () => {
    const source = readFileSync(resolve(frontendRoot, "api/a2a-message.ts"), "utf8");

    expect(source).toContain("canonicalAllowed === true");
    expect(source).toContain('functionName: "can_execute_dispatch"');
    expect(source).toContain("verifyMessage");
    expect(source).toContain("EXECUTOR_EXTENSION_URI");
    expect(source).toContain("Required delegated executor extension is missing");
    expect(source).not.toContain("Boolean(await client.readContract");
  });
});
