import { describe, expect, it } from "vitest";
import {
  clipForState,
  clipForTrigger,
  validateSpriteSheetManifest,
  type SpriteSheetManifest
} from "../src/spritesheet.js";

const manifest: SpriteSheetManifest = {
  schemaVersion: 1,
  image: "avatar.png",
  frameWidth: 64,
  frameHeight: 64,
  clips: {
    idle_loop: { name: "idle_loop", frames: [0, 1], loop: true },
    error_once: { name: "error_once", frames: [2], loop: false },
    nod_once: { name: "nod_once", frames: [3], loop: false }
  }
};

describe("spritesheet metadata", () => {
  it("validates metadata and resolves state/trigger clips", () => {
    expect(validateSpriteSheetManifest(manifest).valid).toBe(true);
    expect(clipForState(manifest, "error").name).toBe("error_once");
    expect(clipForTrigger(manifest, "nod")?.name).toBe("nod_once");
  });

  it("falls back to idle and rejects malformed metadata", () => {
    expect(clipForState(manifest, "thinking").name).toBe("idle_loop");
    const result = validateSpriteSheetManifest({ ...manifest, frameWidth: 0, clips: { bad: { frames: [-1] } } });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
