import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));

/**
 * The deterministic Test baseline the no-mistakes gate must run. The gate reads
 * `commands` only from the trusted default-branch copy of `.no-mistakes.yaml`,
 * and an empty `commands.test` leaves the Test step to an open-ended agent that
 * invents its own validation commands. Keeping the exact strings here makes that
 * silent fallback a test failure instead of a pipeline behaviour change.
 */
const expectedCommands = {
  prepare: "pnpm install --frozen-lockfile",
  test: "pnpm test",
};

type NoMistakesConfig = {
  commands?: Record<string, unknown>;
  allow_repo_commands?: unknown;
};

function readConfig(): NoMistakesConfig {
  const raw = readFileSync(join(root, ".no-mistakes.yaml"), "utf8");
  return (loadYaml(raw) ?? {}) as NoMistakesConfig;
}

describe("no-mistakes trusted configuration", () => {
  it("declares the exact deterministic commands and no others", () => {
    // Exact equality is deliberate: adding a lint/format command here changes
    // what a pipeline step runs, so it must be a considered edit that updates
    // this contract.
    expect(readConfig().commands).toEqual(expectedCommands);
  });

  it("pins commands.test to a terminating, non-watch suite definition", () => {
    const pkg = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const suite = pkg.scripts?.test ?? "";

    // An empty or watch-mode command would hand the Test step back to an agent
    // that never terminates.
    expect(suite).not.toBe("");
    expect(suite).toContain("vitest run");
    expect(suite).not.toMatch(/\bvitest\s+(?:--?watch|watch)\b/);
    expect(suite).not.toBe(pkg.scripts?.["test:watch"]);
  });

  it("keeps observable command execution on the trusted copy", () => {
    // `allow_repo_commands: true` would let a pushed branch supply `commands`
    // and `agent`; the repository deliberately leaves it off.
    expect(readConfig().allow_repo_commands ?? false).toBe(false);
  });
});
