import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AvatarPackageRegistry } from "../../extension/src/avatarPackages.js";
import { assertSvgPathCount } from "../src/components/vtracerPresets.js";
import { buildBrowserAvatarPackage } from "../src/web/browserAvatarPackage.js";
import { assertPortableAssetSources } from "../src/web/portableAssets.js";

const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/><script>alert(1)</script></svg>';
let directory = "";

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

describe("browser avatar package", () => {
  it("builds a sanitized ZIP that AvatarPackageRegistry.importPackage accepts", async () => {
    const bytes = await buildBrowserAvatarPackage({ id: "shareable-avatar", name: "Shareable Avatar", svg });
    const decoded = new TextDecoder().decode(bytes);
    expect(decoded).not.toContain("<script");
    directory = await mkdtemp(path.join(tmpdir(), "kurva-avatar-"));
    const archive = path.join(directory, "shareable-avatar.codex-avatar.zip");
    await writeFile(archive, bytes);
    const registry = new AvatarPackageRegistry(
      () => directory,
      () => directory
    );
    const imported = await registry.importPackage(archive);
    expect(imported.id).toBe("shareable-avatar");
    expect(imported.manifest.checksums["svg/avatar.svg"]).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects remote and script asset addresses and oversized traces", () => {
    expect(() => assertPortableAssetSources('{"src":"javascript:alert(1)"}')).toThrow(/will not load/);
    expect(() => assertPortableAssetSources('{"src":"https://example.com/a.png"}')).toThrow(/will not load/);
    expect(() =>
      assertPortableAssetSources(
        '{"src":"data:image/png;base64,aaaa","src":"kurva-asset:44a4252c-5bc5-41e6-b7b7-68a79736c7d5"}'
      )
    ).not.toThrow();
    const many = `<svg>${'<path d="M0 0h1v1z"/>'.repeat(20_001)}</svg>`;
    expect(() => assertSvgPathCount(many)).toThrow();
  });
});
