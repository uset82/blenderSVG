import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { AvatarPackageRegistry, MAX_AVATAR_PACKAGE_FILE_BYTES, validateAvatarPackage } from "../dist/avatarPackages.js";

const extensionRoot = path.join(import.meta.dirname, "..");

function manifest(entrypoint = "avatar.svg", checksums) {
  return {
    schemaVersion: 1,
    id: "local-test-avatar",
    name: "Local Test Avatar",
    version: "1.0.0",
    author: "Test Author",
    license: "MIT",
    preferredRuntime: "svg",
    fallbackRuntime: "svg",
    entrypoints: { svg: entrypoint },
    capabilities: ["state-animation"],
    states: { idle: "idle_loop" },
    checksums
  };
}

test("validates the built-in manifest and imports, activates, then removes a local package", async () => {
  const builtIn = await validateAvatarPackage(path.join(extensionRoot, "media", "avatars"));
  assert.equal(builtIn.valid, true, builtIn.errors.join("\n"));

  const root = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-package-"));
  const source = path.join(root, "source");
  const workspace = path.join(root, "workspace");
  await mkdir(source, { recursive: true });
  await writeFile(path.join(source, "avatar.svg"), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const svgHash = createHash("sha256")
    .update(await readFile(path.join(source, "avatar.svg")))
    .digest("hex");
  await writeFile(
    path.join(source, "avatar.manifest.json"),
    JSON.stringify(manifest("avatar.svg", { "avatar.svg": svgHash }))
  );

  try {
    const registry = new AvatarPackageRegistry(
      () => workspace,
      () => ".codex-avatar"
    );
    const imported = await registry.importPackage(source);
    assert.equal(imported.id, "local-test-avatar");
    assert.equal((await registry.listPackages()).length, 1);
    await registry.activateAvatar(imported.id);
    assert.equal((await registry.getActivePackage())?.id, imported.id);

    const assetRoot = path.join(workspace, ".codex-avatar");
    await mkdir(path.join(assetRoot, "cache"), { recursive: true });
    await mkdir(path.join(assetRoot, "previews"), { recursive: true });
    await mkdir(path.join(assetRoot, "exports"), { recursive: true });
    await writeFile(path.join(assetRoot, "cache", "generated.tmp"), "generated");
    await writeFile(path.join(assetRoot, "previews", "preview.tmp"), "generated");
    await writeFile(path.join(assetRoot, "exports", "keep.txt"), "user export");
    await registry.clearGeneratedCache();
    await assert.rejects(() => stat(path.join(assetRoot, "cache")));
    await assert.rejects(() => stat(path.join(assetRoot, "previews")));
    assert.equal((await stat(path.join(assetRoot, "exports", "keep.txt"))).isFile(), true);

    assert.equal(await registry.removeAvatar(imported.id), true);
    assert.equal(await registry.getActivePackage(), undefined);
    assert.equal((await registry.listPackages()).length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects traversal, remote entrypoints, and bad checksums", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-invalid-"));
  try {
    await writeFile(path.join(root, "avatar.manifest.json"), JSON.stringify(manifest("../outside.svg")));
    const traversal = await validateAvatarPackage(root);
    assert.equal(traversal.valid, false);
    assert.match(traversal.errors.join("\n"), /safe local relative path|escapes/);

    await writeFile(
      path.join(root, "avatar.manifest.json"),
      JSON.stringify(manifest("https://example.com/avatar.svg"))
    );
    const remote = await validateAvatarPackage(root);
    assert.equal(remote.valid, false);
    assert.match(remote.errors.join("\n"), /safe local relative path/);

    await writeFile(path.join(root, "avatar.svg"), "<svg/>");
    await writeFile(
      path.join(root, "avatar.manifest.json"),
      JSON.stringify(manifest("avatar.svg", { "avatar.svg": "0".repeat(64) }))
    );
    const checksum = await validateAvatarPackage(root);
    assert.equal(checksum.valid, false);
    assert.match(checksum.errors.join("\n"), /Checksum mismatch/);

    await writeFile(path.join(root, "avatar.svg"), `<svg><script>alert(1)</script></svg>`);
    await writeFile(path.join(root, "avatar.manifest.json"), JSON.stringify(manifest("avatar.svg")));
    const unsafeSvg = await validateAvatarPackage(root);
    assert.equal(unsafeSvg.valid, false);
    assert.match(unsafeSvg.errors.join("\n"), /executable or remote SVG/);

    await writeFile(path.join(root, "avatar.svg"), Buffer.alloc(MAX_AVATAR_PACKAGE_FILE_BYTES + 1));
    const oversized = await validateAvatarPackage(root);
    assert.equal(oversized.valid, false);
    assert.match(oversized.errors.join("\n"), /file limit/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects a forged registry path", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-avatar-registry-"));
  const workspace = path.join(root, "workspace");
  const assetRoot = path.join(workspace, ".codex-avatar");
  try {
    await mkdir(assetRoot, { recursive: true });
    await writeFile(
      path.join(assetRoot, "avatar-registry.json"),
      JSON.stringify({ schemaVersion: 1, activeId: "escape", packages: { escape: "../outside" } })
    );
    const registry = new AvatarPackageRegistry(
      () => workspace,
      () => ".codex-avatar"
    );
    await assert.rejects(() => registry.listPackages(), /unsupported format/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
