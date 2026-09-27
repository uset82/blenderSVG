import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const noticesPath = path.join(root, "THIRD_PARTY_NOTICES.md");
const licensingPath = path.join(root, "docs", "LICENSING.md");
const notices = readFileSync(noticesPath, "utf8");
const licensing = readFileSync(licensingPath, "utf8");

const workspacePackageDirs = [
  ".",
  "apps/extension",
  "apps/studio",
  "apps/studio-server",
  "apps/webview",
  "packages/asset-pipeline",
  "packages/avatar-core",
  "packages/studio-host-core",
  "packages/runtime-pixi"
];

const requiredPackages = new Set();
for (const relativeDir of workspacePackageDirs) {
  const manifest = JSON.parse(readFileSync(path.join(root, relativeDir, "package.json"), "utf8"));
  for (const section of ["dependencies", "devDependencies"]) {
    for (const name of Object.keys(manifest[section] ?? {})) {
      if (name.startsWith("@codex-avatar-studio/")) continue;
      requiredPackages.add(name.startsWith("@types/") ? "@types/" : name);
    }
  }
}

for (const name of [...requiredPackages].sort()) {
  if (name === "@types/") {
    assert.match(notices, /`@types\/node`/, "THIRD_PARTY_NOTICES.md lists DefinitelyTyped packages");
    continue;
  }
  assert.match(
    notices,
    new RegExp(`\`${escapeRegExp(name)}\``),
    `THIRD_PARTY_NOTICES.md lists installed dependency ${name}`
  );
}

for (const forbiddenCurrent of ["potrace", "@rive-app/react-webgl2"]) {
  assert.doesNotMatch(
    notices.split("## Deferred or not installed")[0] ?? notices,
    new RegExp(`\`${escapeRegExp(forbiddenCurrent)}\``),
    `${forbiddenCurrent} must not appear as a current installed dependency in THIRD_PARTY_NOTICES.md`
  );
}

assert.doesNotMatch(
  readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8"),
  /\bpotrace@/,
  "lockfile has no Potrace package"
);

const builtInAssets = [
  "apps/extension/media/avatars/svg/placeholder-avatar.svg",
  "apps/extension/media/avatars/pixi/placeholder-spritesheet.svg",
  "apps/extension/media/avatars/pixi/placeholder-spritesheet.json",
  "apps/extension/media/icon.png"
];

const manifest = JSON.parse(readFileSync(path.join(root, "apps/extension/media/avatars/avatar.manifest.json"), "utf8"));
assert.match(
  String(manifest.license ?? ""),
  /UNLICENSED|original project/i,
  "built-in manifest declares original project license"
);
assert.match(String(manifest.author ?? ""), /Codex Avatar Studio/i, "built-in manifest declares project authorship");

for (const relativePath of builtInAssets) {
  const absolutePath = path.join(root, relativePath);
  const hash = createHash("sha256").update(readFileSync(absolutePath)).digest("hex").toUpperCase();
  assert.match(licensing, new RegExp(hash, "i"), `docs/LICENSING.md attests SHA-256 for ${relativePath}`);
  if (relativePath.includes("/avatars/")) {
    const keyed = relativePath.replace(/^apps\/extension\/media\/avatars\//, "");
    if (manifest.checksums?.[keyed]) {
      assert.equal(manifest.checksums[keyed].toLowerCase(), hash.toLowerCase(), `manifest checksum matches ${keyed}`);
    }
  }
}

assert.match(licensing, /clean-room|original project work/i, "docs/LICENSING.md records clean-room asset attestation");

const optionalRoots = ["optional", "research", "fixtures"].map((name) => path.join(root, name));
for (const optionalRoot of optionalRoots) {
  try {
    readdirSync(optionalRoot);
  } catch {
    // optional trees may be absent
  }
}

console.log(
  `Third-party notices validated against ${requiredPackages.size} direct dependency names; built-in asset attestation hashes checked.`
);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Ported ZCode source keeps its attribution: a header per file, a notice row per file, the license
// text next to the files, and no Node built-ins or ZCode package imports.
const ZCODE_COMMIT = "29628c9acdb81b703bbd4080c207a0e7ce5e276e";
const zcodeDir = path.join(root, "packages", "studio-agent", "src", "zcode");
assert.match(
  readFileSync(path.join(zcodeDir, "LICENSE"), "utf8"),
  /Apache License\s+Version 2\.0/,
  "packages/studio-agent/src/zcode/LICENSE carries the Apache-2.0 text"
);
const adr = readFileSync(path.join(root, "docs", "adr", "0002-agent-harness.md"), "utf8");
assert.match(adr, new RegExp(ZCODE_COMMIT), "ADR 0002 names the ZCode source pin");
const portedFiles = readdirSync(zcodeDir).filter((name) => name.endsWith(".ts") && name !== "contracts.ts");
assert.ok(portedFiles.length > 0, "ported ZCode files are present");
for (const name of portedFiles) {
  const relative = `packages/studio-agent/src/zcode/${name}`;
  const source = readFileSync(path.join(zcodeDir, name), "utf8");
  const header = source.split("\n").slice(0, 20).join("\n");
  assert.match(header, /^\/\/ Ported from ZCode \(https:\/\/github\.com\/zai-org\/ZCode\)/, `${relative} names ZCode`);
  assert.match(header, new RegExp(`// Commit: ${ZCODE_COMMIT}`), `${relative} names the pinned commit`);
  assert.match(header, /\/\/ Upstream file: apps\/zcode-cli\/packages\//, `${relative} names its upstream file`);
  assert.match(header, /Apache License, Version 2\.0/, `${relative} names the Apache-2.0 license`);
  assert.match(header, /Modifications by the Kurva authors/, `${relative} lists its modifications`);
  assert.doesNotMatch(
    source,
    /from "node:|require\("node:|from "@zcode\//,
    `${relative} imports no Node built-ins or ZCode packages`
  );
  assert.match(notices, new RegExp(escapeRegExp(`\`${relative}\``)), `THIRD_PARTY_NOTICES.md lists ${relative}`);
}
console.log(`ZCode ports attributed: ${portedFiles.length} files.`);
