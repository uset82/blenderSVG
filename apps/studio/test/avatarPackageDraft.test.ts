import { describe, expect, it } from "vitest";
import { avatarPackageManifest, avatarPackageSvg } from "../src/shapes/avatarPackageDraft.js";

describe("avatar package draft", () => {
  it("builds a manifest the avatar-core validator accepts", () => {
    const manifest = avatarPackageManifest("Cholita 3D");
    expect(manifest.id).toBe("cholita-3d");
    expect(manifest.entrypoints.svg).toBe("svg/avatar.svg");
    expect(manifest.states.idle).toBe("idle");
    expect(avatarPackageSvg()).toContain("<svg");
  });
});
