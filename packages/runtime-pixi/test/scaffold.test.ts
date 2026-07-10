import { expect, test } from "vitest";
import { runtimePixiPackageId } from "../src/index.js";

test("reserves the Pixi runtime package boundary without loading PixiJS", () => {
  expect(runtimePixiPackageId).toBe("@codex-avatar-studio/runtime-pixi");
});
