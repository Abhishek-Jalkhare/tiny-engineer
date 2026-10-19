import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOutput } from "../src/util/output.js";
import { createStyle } from "../src/util/style.js";
import { checkHealth, configHasHook, runDoctor } from "../src/wizard/doctor.js";

test("configHasHook finds hook cursor command", () => {
  const dir = mkdtempSync(join(tmpdir(), "te-doc-"));
  try {
    mkdirSync(join(dir, ".cursor"), { recursive: true });
    writeFileSync(
      join(dir, ".cursor", "hooks.json"),
      JSON.stringify({
        version: 1,
        hooks: { stop: [{ command: 'node "/x" hook cursor', timeout: 5 }] },
      }),
      "utf8",
    );
    assert.equal(configHasHook(dir, "cursor", ".cursor/hooks.json"), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("checkHealth returns ok on 200", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    /** @type {Response} */ ({
      ok: true,
      status: 200,
      text: async () => '{"ok":true}',
    });
  try {
    const result = await checkHealth("http://robot.test");
    assert.equal(result.ok, true);
  } finally {
    globalThis.fetch = original;
  }
});

test("checkHealth returns fail on throw", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  try {
    const result = await checkHealth("http://robot.test");
    assert.equal(result.ok, false);
    assert.ok(result.detail.includes("offline"));
  } finally {
    globalThis.fetch = original;
  }
});

test("runDoctor prints without throwing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "te-doc-"));
  const cfg = mkdtempSync(join(tmpdir(), "te-ucfg-"));
  const prev = process.env.TINY_ENGINEER_CONFIG_DIR;
  process.env.TINY_ENGINEER_CONFIG_DIR = cfg;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  /** @type {string[]} */
  const lines = [];
  const out = createOutput({
    quiet: false,
    style: createStyle({ color: false }),
    log: (m) => lines.push(String(m)),
    error: (m) => lines.push(String(m)),
  });
  try {
    writeFileSync(join(dir, ".env"), "TINY_ENGINEER_URL=http://override\nTINY_ENGINEER_TOKEN=sekrit\n", "utf8");
    await runDoctor(out, [], { projectRoot: dir });
    assert.ok(lines.some((l) => l.includes("url:")));
    assert.ok(lines.some((l) => l.includes("cursor:")));
    assert.ok(lines.some((l) => l.includes("user config:")));
    assert.ok(lines.some((l) => l.includes("overrides") && l.includes("TINY_ENGINEER_URL")));
    assert.ok(lines.some((l) => l.includes("TINY_ENGINEER_TOKEN (set)")));
    assert.ok(!lines.some((l) => l.includes("sekrit")));
  } finally {
    globalThis.fetch = original;
    if (prev === undefined) delete process.env.TINY_ENGINEER_CONFIG_DIR;
    else process.env.TINY_ENGINEER_CONFIG_DIR = prev;
    rmSync(dir, { recursive: true, force: true });
    rmSync(cfg, { recursive: true, force: true });
    process.exitCode = 0;
  }
});
