import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readFile, realpath, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAvatarManifest, type AvatarManifest } from "@codex-avatar-studio/avatar-core";
import { sanitizeSvg } from "@codex-avatar-studio/asset-pipeline";

const REGISTRY_SCHEMA_VERSION = 1;
const MANIFEST_FILE = "avatar.manifest.json";
const GENERATED_CACHE_DIRECTORIES = ["cache", "previews"] as const;

export const MAX_AVATAR_PACKAGE_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_AVATAR_PACKAGE_TOTAL_BYTES = 64 * 1024 * 1024;
export const MAX_AVATAR_PACKAGE_FILES = 128;

export type AvatarPackage = {
  id: string;
  rootPath: string;
  manifest: AvatarManifest;
};

export type AvatarPackageValidation = {
  valid: boolean;
  manifest?: AvatarManifest | undefined;
  errors: string[];
  warnings: string[];
};

type RegistryFile = {
  schemaVersion: 1;
  activeId?: string;
  packages: Record<string, string>;
};

export class AvatarPackageError extends Error {
  public constructor(
    message: string,
    public readonly errors: string[] = [message]
  ) {
    super(message);
    this.name = "AvatarPackageError";
  }
}

export class AvatarPackageRegistry {
  public constructor(
    private readonly workspaceRootProvider: () => string | undefined,
    private readonly assetWorkspaceProvider: () => string
  ) {}

  public getAssetRoot(): string | undefined {
    const workspaceRoot = this.workspaceRootProvider();
    if (!workspaceRoot) return undefined;
    const assetWorkspace = this.assetWorkspaceProvider();
    const assetRoot = path.resolve(
      path.isAbsolute(assetWorkspace) ? assetWorkspace : path.join(workspaceRoot, assetWorkspace)
    );
    return isPathInside(workspaceRoot, assetRoot) ? assetRoot : undefined;
  }

  public async importPackage(sourcePath: string): Promise<AvatarPackage> {
    const assetRoot = this.requireAssetRoot();
    const sourceRoot = await resolvePackageRoot(sourcePath);
    const sourcePackage = await loadAvatarPackage(sourceRoot);
    const targetRoot = path.join(assetRoot, "avatars", sourcePackage.id);
    assertInside(assetRoot, targetRoot, "Avatar package target");

    if (await exists(targetRoot)) {
      throw new AvatarPackageError(`Avatar package "${sourcePackage.id}" is already imported.`);
    }

    await mkdir(path.dirname(targetRoot), { recursive: true });
    await cp(sourceRoot, targetRoot, { recursive: true, errorOnExist: true });
    try {
      const importedPackage = await loadAvatarPackage(targetRoot);
      const registry = await this.readRegistry();
      registry.packages[importedPackage.id] = path.relative(assetRoot, targetRoot);
      await this.writeRegistry(registry);
      return importedPackage;
    } catch (error) {
      await rm(targetRoot, { recursive: true, force: true });
      throw error;
    }
  }

  public async listPackages(): Promise<AvatarPackage[]> {
    const registry = await this.readRegistry();
    const packages: AvatarPackage[] = [];
    for (const [id, relativeRoot] of Object.entries(registry.packages)) {
      const rootPath = this.resolveRegisteredRoot(relativeRoot);
      const avatarPackage = await loadAvatarPackage(rootPath);
      assertInside(this.requireAssetRoot(), avatarPackage.rootPath, "Registry package path");
      if (avatarPackage.id !== id) {
        throw new AvatarPackageError(`Registry id "${id}" does not match package id "${avatarPackage.id}".`);
      }
      packages.push(avatarPackage);
    }
    return packages;
  }

  public async getActivePackage(): Promise<AvatarPackage | undefined> {
    const registry = await this.readRegistry();
    if (!registry.activeId) return undefined;
    const relativeRoot = registry.packages[registry.activeId];
    if (!relativeRoot) throw new AvatarPackageError(`Active avatar "${registry.activeId}" is not registered.`);
    const avatarPackage = await loadAvatarPackage(this.resolveRegisteredRoot(relativeRoot));
    assertInside(this.requireAssetRoot(), avatarPackage.rootPath, "Registry package path");
    return avatarPackage;
  }

  public async activateAvatar(id: string | undefined): Promise<AvatarPackage | undefined> {
    const registry = await this.readRegistry();
    if (id === undefined) {
      delete registry.activeId;
      await this.writeRegistry(registry);
      return undefined;
    }
    const relativeRoot = registry.packages[id];
    if (!relativeRoot) throw new AvatarPackageError(`Avatar package "${id}" is not registered.`);
    const avatarPackage = await loadAvatarPackage(this.resolveRegisteredRoot(relativeRoot));
    assertInside(this.requireAssetRoot(), avatarPackage.rootPath, "Registry package path");
    registry.activeId = id;
    await this.writeRegistry(registry);
    return avatarPackage;
  }

  public async removeAvatar(id: string): Promise<boolean> {
    const registry = await this.readRegistry();
    const relativeRoot = registry.packages[id];
    if (!relativeRoot) throw new AvatarPackageError(`Avatar package "${id}" is not registered.`);
    const rootPath = this.resolveRegisteredRoot(relativeRoot);
    await rm(rootPath, { recursive: true, force: false });
    delete registry.packages[id];
    const wasActive = registry.activeId === id;
    if (wasActive) delete registry.activeId;
    await this.writeRegistry(registry);
    return wasActive;
  }

  public async clearGeneratedCache(): Promise<void> {
    const assetRoot = this.requireAssetRoot();
    for (const directory of GENERATED_CACHE_DIRECTORIES) {
      const target = path.join(assetRoot, directory);
      assertInside(assetRoot, target, `Generated ${directory} directory`);
      const targetStat = await lstat(target).catch((error: unknown) => {
        if (isFileNotFound(error)) return undefined;
        throw error;
      });
      if (!targetStat) continue;
      if (targetStat.isSymbolicLink()) {
        throw new AvatarPackageError(`Generated ${directory} directory must not be a symbolic link.`);
      }
      if (!targetStat.isDirectory()) {
        throw new AvatarPackageError(`Generated ${directory} path is not a directory.`);
      }
      await rm(target, { recursive: true, force: true });
    }
  }

  private requireAssetRoot(): string {
    const assetRoot = this.getAssetRoot();
    if (!assetRoot) throw new AvatarPackageError("Open a workspace folder before managing avatar packages.");
    return assetRoot;
  }

  private resolveRegisteredRoot(relativeRoot: string): string {
    const assetRoot = this.requireAssetRoot();
    assertSafeRelativePath(relativeRoot, "Registry package path");
    const rootPath = path.resolve(assetRoot, relativeRoot);
    assertInside(assetRoot, rootPath, "Registry package path");
    return rootPath;
  }

  private async readRegistry(): Promise<RegistryFile> {
    const assetRoot = this.requireAssetRoot();
    const registryPath = path.join(assetRoot, "avatar-registry.json");
    try {
      const value: unknown = JSON.parse(await readFile(registryPath, "utf8"));
      if (!isRegistryFile(value)) throw new AvatarPackageError("Avatar registry has an unsupported format.");
      return value;
    } catch (error) {
      if (isFileNotFound(error)) return { schemaVersion: REGISTRY_SCHEMA_VERSION, packages: {} };
      if (error instanceof AvatarPackageError) throw error;
      throw new AvatarPackageError(`Avatar registry could not be read: ${toErrorMessage(error)}`);
    }
  }

  private async writeRegistry(registry: RegistryFile): Promise<void> {
    const assetRoot = this.requireAssetRoot();
    await mkdir(assetRoot, { recursive: true });
    await writeFile(path.join(assetRoot, "avatar-registry.json"), `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  }
}

export async function validateAvatarPackage(packageRoot: string): Promise<AvatarPackageValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let manifest: AvatarManifest | undefined;
  try {
    const packagePath = await realpath(packageRoot);
    await validatePackageTree(packagePath, errors);
    const manifestPath = path.join(packagePath, MANIFEST_FILE);
    const parsed: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
    const manifestResult = validateAvatarManifest(parsed);
    if (!manifestResult.valid || !manifestResult.manifest) {
      return { valid: false, errors: manifestResult.errors, warnings: manifestResult.warnings };
    }
    manifest = manifestResult.manifest;
    warnings.push(...manifestResult.warnings);

    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(manifest.id)) {
      errors.push("id must contain only letters, numbers, dots, underscores, or hyphens.");
    }

    const referencedFiles = new Set<string>();
    for (const [runtime, entrypoint] of Object.entries(manifest.entrypoints)) {
      await addReferencedFile(packagePath, entrypoint, `entrypoints.${runtime}`, referencedFiles, errors);
    }
    for (const [runtime, asset] of Object.entries(manifest.assets ?? {})) {
      await addReferencedFile(packagePath, asset, `assets.${runtime}`, referencedFiles, errors);
    }
    if (manifest.previewImage) {
      await addReferencedFile(packagePath, manifest.previewImage, "previewImage", referencedFiles, errors);
    }
    for (const checksumPath of Object.keys(manifest.checksums ?? {})) {
      await addReferencedFile(packagePath, checksumPath, `checksums.${checksumPath}`, referencedFiles, errors);
    }

    for (const filePath of referencedFiles) {
      const relativePath = path.relative(packagePath, filePath);
      const normalizedRelativePath = relativePath.split(path.sep).join("/");
      const checksum = manifest.checksums?.[normalizedRelativePath] ?? manifest.checksums?.[relativePath];
      if (checksum) {
        const actual = createHash("sha256")
          .update(await readFile(filePath))
          .digest("hex");
        if (actual.toLowerCase() !== checksum.toLowerCase()) {
          errors.push(`Checksum mismatch for "${path.relative(packagePath, filePath)}".`);
        }
      }
    }
  } catch (error) {
    errors.push(toErrorMessage(error));
  }
  return { valid: errors.length === 0, manifest, errors, warnings };
}

export async function loadAvatarPackage(packageRoot: string): Promise<AvatarPackage> {
  const validation = await validateAvatarPackage(packageRoot);
  if (!validation.valid || !validation.manifest) {
    throw new AvatarPackageError(
      `Invalid avatar package: ${validation.errors.join(" ") || "manifest is missing"}`,
      validation.errors
    );
  }
  return { id: validation.manifest.id, rootPath: await realpath(packageRoot), manifest: validation.manifest };
}

async function resolvePackageRoot(sourcePath: string): Promise<string> {
  const sourceStat = await stat(sourcePath).catch((error: unknown) => {
    throw new AvatarPackageError(`Avatar package source is not accessible: ${toErrorMessage(error)}`);
  });
  const candidate = sourceStat.isDirectory() ? sourcePath : path.dirname(sourcePath);
  return realpath(candidate);
}

async function addReferencedFile(
  packageRoot: string,
  relativePath: string,
  field: string,
  referencedFiles: Set<string>,
  errors: string[]
): Promise<void> {
  let filePath: string;
  try {
    assertSafeRelativePath(relativePath, field);
    filePath = path.resolve(packageRoot, relativePath);
    assertInside(packageRoot, filePath, field);
  } catch (error) {
    errors.push(toErrorMessage(error));
    return;
  }

  try {
    const result = await lstat(filePath);
    if (result.isSymbolicLink()) {
      throw new AvatarPackageError(`${field} must not reference a symbolic link: "${relativePath}".`);
    }
    if (!result.isFile()) {
      errors.push(`${field} must reference a file: "${relativePath}".`);
      return;
    }
    if (result.size > MAX_AVATAR_PACKAGE_FILE_BYTES) {
      errors.push(`${field} exceeds the ${MAX_AVATAR_PACKAGE_FILE_BYTES}-byte avatar asset limit: "${relativePath}".`);
      return;
    }
    const realFilePath = await realpath(filePath);
    assertInside(packageRoot, realFilePath, field);
    if (path.extname(filePath).toLowerCase() === ".svg") {
      const source = await readFile(filePath, "utf8");
      if (sanitizeSvg(source) !== source) {
        errors.push(`${field} contains executable or remote SVG content: "${relativePath}".`);
      }
    }
    referencedFiles.add(filePath);
  } catch (error) {
    errors.push(`${field} is not a safe readable file: "${relativePath}" (${toErrorMessage(error)}).`);
  }
}

async function validatePackageTree(packageRoot: string, errors: string[]): Promise<void> {
  let fileCount = 0;
  let totalBytes = 0;

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const filePath = path.join(directory, entry.name);
      const entryStat = await lstat(filePath);
      if (entryStat.isSymbolicLink()) {
        errors.push(`Avatar packages must not contain symbolic links: "${path.relative(packageRoot, filePath)}".`);
        continue;
      }
      if (entryStat.isDirectory()) {
        await visit(filePath);
        continue;
      }
      if (!entryStat.isFile()) {
        errors.push(
          `Avatar packages may contain only regular files and directories: "${path.relative(packageRoot, filePath)}".`
        );
        continue;
      }

      fileCount += 1;
      totalBytes += entryStat.size;
      if (fileCount > MAX_AVATAR_PACKAGE_FILES) {
        errors.push(`Avatar package contains more than the ${MAX_AVATAR_PACKAGE_FILES}-file limit.`);
        return;
      }
      if (entryStat.size > MAX_AVATAR_PACKAGE_FILE_BYTES) {
        errors.push(
          `Avatar asset exceeds the ${MAX_AVATAR_PACKAGE_FILE_BYTES}-byte file limit: "${path.relative(packageRoot, filePath)}".`
        );
      }
      if (totalBytes > MAX_AVATAR_PACKAGE_TOTAL_BYTES) {
        errors.push(`Avatar package exceeds the ${MAX_AVATAR_PACKAGE_TOTAL_BYTES}-byte total size limit.`);
        return;
      }
    }
  }

  await visit(packageRoot);
}

function assertSafeRelativePath(value: string, field: string): void {
  if (
    value.trim().length === 0 ||
    value.includes("\0") ||
    value.startsWith("/") ||
    value.startsWith("\\") ||
    path.posix.isAbsolute(value) ||
    path.win32.isAbsolute(value) ||
    /^[a-z][a-z\d+.-]*:/i.test(value) ||
    value.split(/[\\/]+/).some((segment) => segment === "..")
  ) {
    throw new AvatarPackageError(`${field} must be a safe local relative path: "${value}".`);
  }
}

function assertInside(parent: string, child: string, field: string): void {
  if (!isPathInside(parent, child)) {
    throw new AvatarPackageError(`${field} escapes the approved avatar directory.`);
  }
}

function isPathInside(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

function isRegistryFile(value: unknown): value is RegistryFile {
  if (!value || typeof value !== "object") return false;
  const registry = value as Partial<RegistryFile>;
  if (
    registry.schemaVersion !== REGISTRY_SCHEMA_VERSION ||
    !registry.packages ||
    typeof registry.packages !== "object" ||
    Array.isArray(registry.packages)
  ) {
    return false;
  }
  if (
    registry.activeId !== undefined &&
    (typeof registry.activeId !== "string" || !isValidPackageId(registry.activeId))
  ) {
    return false;
  }
  for (const [id, relativeRoot] of Object.entries(registry.packages)) {
    if (!isValidPackageId(id) || typeof relativeRoot !== "string" || !isSafeRelativePath(relativeRoot)) {
      return false;
    }
  }
  return registry.activeId === undefined || registry.activeId in registry.packages;
}

function isValidPackageId(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/i.test(value);
}

function isSafeRelativePath(value: string): boolean {
  try {
    assertSafeRelativePath(value, "Path");
    return true;
  } catch {
    return false;
  }
}

function isFileNotFound(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && error.code === "ENOENT";
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function exists(target: string): Promise<boolean> {
  return stat(target).then(
    () => true,
    () => false
  );
}
