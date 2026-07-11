import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeVscode = vi.hoisted(() => {
  const values: Record<string, unknown> = {};
  const updates: Array<[string, unknown, unknown]> = [];
  const configuration = {
    get: vi.fn((key: string, fallback: unknown) => (key in values ? values[key] : fallback)),
    update: vi.fn(async (key: string, value: unknown, target: unknown) => {
      updates.push([key, value, target]);
      if (value === undefined) delete values[key];
      else values[key] = value;
    })
  };
  return {
    values,
    updates,
    api: {
      workspace: { getConfiguration: vi.fn(() => configuration) },
      ConfigurationTarget: { Global: "global" }
    }
  };
});

vi.mock("vscode", () => fakeVscode.api);

import { defaultAvatarConfig, getAvatarConfig, updateAvatarConfig } from "../src/settings.js";

beforeEach(() => {
  for (const key of Object.keys(fakeVscode.values)) delete fakeVscode.values[key];
  fakeVscode.updates.length = 0;
});

describe("avatar settings", () => {
  it("falls back safely for invalid persisted values", () => {
    Object.assign(fakeVscode.values, {
      frameRate: 120,
      particleEffects: "yes",
      idleTimeout: -2,
      sleepTimeout: Number.NaN,
      noAnimation: "false",
      character: "   "
    });

    const config = getAvatarConfig();
    expect(config.frameRate).toBe(defaultAvatarConfig.frameRate);
    expect(config.particleEffects).toBe(defaultAvatarConfig.particleEffects);
    expect(config.idleTimeout).toBe(defaultAvatarConfig.idleTimeout);
    expect(config.sleepTimeout).toBe(defaultAvatarConfig.sleepTimeout);
    expect(config.noAnimation).toBe(defaultAvatarConfig.noAnimation);
    expect(config.character).toBe(defaultAvatarConfig.character);
  });

  it("sanitizes persisted updates and keeps timing bounded", async () => {
    await updateAvatarConfig({
      frameRate: 60,
      idleTimeout: 999_999,
      sleepTimeout: 20,
      particleEffects: false,
      character: "  local-avatar  "
    });

    expect(fakeVscode.updates).toContainEqual(["frameRate", 60, "global"]);
    expect(fakeVscode.updates).toContainEqual(["idleTimeout", 86_400, "global"]);
    expect(fakeVscode.updates).toContainEqual(["sleepTimeout", 20, "global"]);
    expect(fakeVscode.updates).toContainEqual(["character", "local-avatar", "global"]);
  });
});
