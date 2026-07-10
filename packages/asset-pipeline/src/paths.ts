import path from "node:path";
import { supportedImageExtensions, type SupportedImageExtension } from "./types.js";

export function assertSupportedImagePath(inputPath: string): SupportedImageExtension {
  const extension = path.extname(inputPath).toLowerCase() as SupportedImageExtension;
  if (!supportedImageExtensions.includes(extension)) {
    throw new Error(`Unsupported image type "${extension || "(none)"}". Select PNG, JPG, JPEG, or WebP.`);
  }

  return extension;
}

export function getSvgExportDirectory(workspaceRoot: string, assetWorkspace = ".codex-avatar"): string {
  const root = path.resolve(workspaceRoot);
  const exportDirectory = path.resolve(root, assetWorkspace, "exports", "svg");

  if (!isInsideDirectory(root, exportDirectory)) {
    throw new Error("Resolved export directory is outside the workspace.");
  }

  return exportDirectory;
}

export function createOutputPaths(inputPath: string, exportDirectory: string): {
  rawSvgPath: string;
  optimizedSvgPath: string;
  manifestPath: string;
  safeBaseName: string;
} {
  const parsed = path.parse(inputPath);
  const safeBaseName = sanitizeFileBaseName(parsed.name);

  return {
    rawSvgPath: path.join(exportDirectory, `${safeBaseName}.raw-trace.svg`),
    optimizedSvgPath: path.join(exportDirectory, `${safeBaseName}.optimized.svg`),
    manifestPath: path.join(exportDirectory, `${safeBaseName}.manifest.json`),
    safeBaseName
  };
}

export function sanitizeFileBaseName(value: string): string {
  const sanitized = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return sanitized || "image";
}

export function toWorkspaceRelativePath(workspaceRoot: string, targetPath: string): string {
  const relativePath = path.relative(path.resolve(workspaceRoot), path.resolve(targetPath));
  return relativePath.split(path.sep).join("/");
}

function isInsideDirectory(parent: string, child: string): boolean {
  const relativePath = path.relative(parent, child);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}
