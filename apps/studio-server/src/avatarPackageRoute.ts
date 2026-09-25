import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateAvatarManifest } from "@codex-avatar-studio/avatar-core";
import { prepareSvgPreview } from "@codex-avatar-studio/asset-pipeline/svg-safety";
import type { Context } from "hono";
import { MAX_AVATAR_PACKAGE_REQUEST_BYTES } from "./hostSecurity.ts";

const MAX_AVATAR_SVG_BYTES = 750_000;

type AvatarPackageRequest = {
  name: string;
  svg: string;
};

export async function handleAvatarPackageRoute(c: Context, headers: Record<string, string>): Promise<Response> {
  if (c.req.method !== "POST") return c.text("Method not allowed.", 405, headers);
  const parsed = await readBoundedJson(c.req.raw, MAX_AVATAR_PACKAGE_REQUEST_BYTES);
  if (parsed.kind === "too-large") return c.json({ message: "The avatar package request is too large." }, 413, headers);
  if (parsed.kind !== "ok" || !isAvatarPackageRequest(parsed.value)) {
    return c.json({ message: "Provide an avatar name and its SVG artwork." }, 400, headers);
  }

  const name = parsed.value.name.trim().slice(0, 80);
  if (!name) return c.json({ message: "Name the avatar before saving a package." }, 400, headers);
  if (Buffer.byteLength(parsed.value.svg, "utf8") > MAX_AVATAR_SVG_BYTES) {
    return c.json({ message: "The avatar SVG exceeds the 750 KB package limit." }, 413, headers);
  }

  let svg: string;
  try {
    svg = prepareSvgPreview(parsed.value.svg).svg;
  } catch {
    return c.json({ message: "The avatar SVG is malformed or contains unsupported content." }, 400, headers);
  }

  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const checksum = createHash("sha256").update(svg).digest("hex");
  const candidate = {
    schemaVersion: 1,
    id: id || "studio-avatar",
    name,
    version: "1.0.0",
    author: "Codex Avatar Studio",
    license: "CC-BY-4.0",
    preferredRuntime: "svg",
    fallbackRuntime: "svg",
    entrypoints: { svg: "svg/avatar.svg" },
    capabilities: ["state-animation"],
    states: { idle: "idle" },
    checksums: { "svg/avatar.svg": checksum }
  };
  const validation = validateAvatarManifest(candidate);
  if (!validation.valid || !validation.manifest) {
    return c.json({ message: "The avatar package manifest could not be validated." }, 400, headers);
  }

  const manifest = validation.manifest;
  const root = path.join(tmpdir(), `studio-avatar-${randomUUID()}`);
  const packageRoot = path.join(root, "package");
  const destination = path.join(root, "avatar.codex-avatar.zip");
  try {
    await mkdir(path.join(packageRoot, "svg"), { recursive: true });
    await writeFile(path.join(packageRoot, "svg", "avatar.svg"), svg, { flag: "wx" });
    await writeFile(path.join(packageRoot, "avatar.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: "wx"
    });
    const exporter = await loadAvatarExporter();
    const fileName = exporter.avatarPackageArchiveFileName(manifest);
    await exporter.exportAvatarPackageArchive(packageRoot, destination);
    const archive = await readFile(destination);
    return c.body(archive, 200, {
      ...headers,
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${fileName}"`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The avatar package could not be saved.";
    const status = /build the extension/i.test(message) ? 503 : 400;
    return c.json({ message }, status, headers);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function readBoundedJson(
  request: Request,
  maxBytes: number
): Promise<{ kind: "ok"; value: unknown } | { kind: "invalid" } | { kind: "too-large" }> {
  const reader = request.body?.getReader();
  if (!reader) return { kind: "invalid" };
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { kind: "too-large" };
      }
      chunks.push(value);
    }
  } catch {
    return { kind: "invalid" };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { kind: "ok", value: JSON.parse(new TextDecoder().decode(bytes)) as unknown };
  } catch {
    return { kind: "invalid" };
  }
}

function isAvatarPackageRequest(value: unknown): value is AvatarPackageRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).every((key) => key === "name" || key === "svg") &&
    typeof record.name === "string" &&
    typeof record.svg === "string"
  );
}

async function loadAvatarExporter(): Promise<{
  exportAvatarPackageArchive: (packageRoot: string, destinationPath: string) => Promise<unknown>;
  avatarPackageArchiveFileName: (manifest: { id: string; version: string }) => string;
}> {
  const modulePath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../extension/dist/avatarPackageExport.js"
  );
  try {
    return (await import(pathToFileURL(modulePath).href)) as {
      exportAvatarPackageArchive: (packageRoot: string, destinationPath: string) => Promise<unknown>;
      avatarPackageArchiveFileName: (manifest: { id: string; version: string }) => string;
    };
  } catch {
    throw new Error("Build the extension before saving an avatar package.");
  }
}
