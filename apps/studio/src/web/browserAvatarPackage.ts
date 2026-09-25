import { prepareSvgPreview } from "@codex-avatar-studio/asset-pipeline/svg-safety";
import { type AvatarManifest, validateAvatarManifest } from "@codex-avatar-studio/avatar-core";
import { buildStoredZip } from "@codex-avatar-studio/avatar-core/storedZip";

export async function buildBrowserAvatarPackage(input: {
  id: string;
  name: string;
  svg: string;
  digest?: (data: Uint8Array) => Promise<ArrayBuffer>;
}): Promise<Uint8Array> {
  const prepared = prepareSvgPreview(input.svg);
  const svgBytes = new TextEncoder().encode(prepared.svg);
  const checksum = await sha256Hex(svgBytes, input.digest);
  const manifest: AvatarManifest = {
    schemaVersion: 1,
    id: input.id,
    name: input.name,
    version: "1.0.0",
    author: "Kurva",
    license: "CC-BY-4.0",
    preferredRuntime: "svg",
    fallbackRuntime: "svg",
    entrypoints: { svg: "svg/avatar.svg" },
    capabilities: ["state-animation"],
    states: { idle: "idle" },
    checksums: { "svg/avatar.svg": checksum }
  };
  const validation = validateAvatarManifest(manifest);
  if (!validation.valid || !validation.manifest) {
    throw new Error(`The avatar package is not valid. ${validation.errors.join(" ")}`);
  }
  return buildStoredZip([
    {
      name: `${input.id}/avatar.manifest.json`,
      data: new TextEncoder().encode(`${JSON.stringify(validation.manifest, null, 2)}\n`)
    },
    { name: `${input.id}/svg/avatar.svg`, data: svgBytes }
  ]);
}

async function sha256Hex(
  bytes: Uint8Array,
  digest: (data: Uint8Array) => Promise<ArrayBuffer> = (data) => crypto.subtle.digest("SHA-256", data as BufferSource)
): Promise<string> {
  const hash = new Uint8Array(await digest(bytes));
  return [...hash].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
