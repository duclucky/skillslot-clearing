import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(resolve(testDir, "../src/styles.css"), "utf8");

describe("interactive target sizing", () => {
  afterEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it.each(["button button-secondary", "nav-item", "filter-button"])(
    "keeps %s at least 44 CSS pixels high",
    (className) => {
      const style = document.createElement("style");
      style.textContent = styles;
      document.head.append(style);
      const button = document.createElement("button");
      button.className = className;
      document.body.append(button);

      expect(Number.parseFloat(getComputedStyle(button).minHeight)).toBeGreaterThanOrEqual(44);
    },
  );
});
