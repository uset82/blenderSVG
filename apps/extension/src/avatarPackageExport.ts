import { randomUUID } from "node:crypto";
import { mkdir, lstat, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AvatarManifest } from "@codex-avatar-studio/avatar-core";
import {
  AvatarPackageError,
  MAX_AVATAR_PACKAGE_FILES,
  MAX_AVATAR_PACKAGE_FILE_BYTES,
  MAX_AVATAR_PACKAGE_TOTAL_BYTES,
  validateAvatarPackage
} from "./avatarPackages.js";

const ZIP_UTF8_FLAG = 0x0800;
const ZIP_VERSION = 20;
const CRC32_TABLE = createCrc32Table();

type PackageFile = {
  archivePath: string;
  bytes: Buffer;
  modifiedAt: Date;
};

type ZipEntry = PackageFile & {
  crc32: number;
  localHeaderOffset: number;
  nameBytes: Buffer;
};

export type AvatarPackageExportResult = {
  archivePath: string;
  byteLength: number;
  fileCount: number;
};

/**
 * Creates a portable ZIP containing one top-level avatar package directory.
 * Package files are stored without compression so the archive can be built
 * locally without a native or remote ZIP dependency.
 */
export async function exportAvatarPackageArchive(
  packageRoot: string,
  destinationPath: string
): Promise<AvatarPackageExportResult> {
  const root = path.resolve(packageRoot);
  const destination = path.resolve(destinationPath);
  if (isPathInside(root, destination)) {
    throw new AvatarPackageError("Choose an export location outside the installed avatar package.");
  }

  const validation = await validateAvatarPackage(root);
  if (!validation.valid || !validation.manifest) {
    throw new AvatarPackageError(
      `Avatar package cannot be exported until validation passes: ${validation.errors.join(" ")}`,
      validation.errors
    );
  }

  const files = await collectPackageFiles(root, validation.manifest);
  const archive = createZipArchive(files);
  const temporaryPath = path.join(path.dirname(destination), `.${path.basename(destination)}.${randomUUID()}.tmp`);

  try {
    await writeFile(temporaryPath, archive, { flag: "wx" });
    await rm(destination, { force: true });
    await rename(temporaryPath, destination);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }

  return {
    archivePath: destination,
    byteLength: archive.byteLength,
    fileCount: files.length
  };
}

export async function extractAvatarPackageArchive(archivePath: string, destinationRoot: string): Promise<string> {
  const archive = await readFile(archivePath);
  const entries = readStoredZipEntries(archive);
  if (!entries.length) throw new AvatarPackageError("The avatar package archive is empty.");
  const destination = path.resolve(destinationRoot);
  await mkdir(destination, { recursive: true });
  for (const entry of entries) {
    const relative = entry.name.replaceAll("\\", "/");
    if (!relative || relative.startsWith("/") || relative.split("/").some((part) => part === ".." || part === "")) {
      throw new AvatarPackageError("The avatar package archive contains an unsafe path.");
    }
    const target = path.resolve(destination, ...relative.split("/"));
    if (!target.startsWith(`${destination}${path.sep}`)) {
      throw new AvatarPackageError("The avatar package archive escapes its folder.");
    }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, entry.bytes);
  }
  const manifest = entries.find(
    (entry) => entry.name.endsWith("/avatar.manifest.json") || entry.name === "avatar.manifest.json"
  );
  if (!manifest) throw new AvatarPackageError("The avatar package archive has no manifest.");
  const folder = path.posix.dirname(manifest.name);
  return folder === "." ? destination : path.resolve(destination, ...folder.split("/"));
}

function readStoredZipEntries(archive: Buffer): Array<{ name: string; bytes: Buffer }> {
  const endOffset = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (endOffset < 0) throw new AvatarPackageError("The avatar package archive is not a ZIP file.");
  const count = archive.readUInt16LE(endOffset + 10);
  let offset = archive.readUInt32LE(endOffset + 16);
  const entries: Array<{ name: string; bytes: Buffer }> = [];
  if (count > MAX_AVATAR_PACKAGE_FILES) throw new AvatarPackageError("The avatar package archive has too many files.");
  for (let index = 0; index < count; index += 1) {
    if (archive.readUInt32LE(offset) !== 0x02014b50)
      throw new AvatarPackageError("The avatar package archive is damaged.");
    const method = archive.readUInt16LE(offset + 10);
    const size = archive.readUInt32LE(offset + 20);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const name = archive.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (method !== 0) throw new AvatarPackageError("The avatar package archive must be stored without compression.");
    if (size > MAX_AVATAR_PACKAGE_FILE_BYTES) throw new AvatarPackageError("An archived avatar file is too large.");
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    entries.push({ name, bytes: archive.subarray(dataStart, dataStart + size) });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export function avatarPackageArchiveFileName(manifest: Pick<AvatarManifest, "id" | "version">): string {
  const safeVersion = manifest.version.replace(/[^0-9A-Za-z._-]+/g, "-").replace(/^-+|-+$/g, "") || "package";
  return `${manifest.id}-${safeVersion}.codex-avatar.zip`;
}

export function licenseNeedsRedistributionWarning(license: string): boolean {
  return /(?:no\s+redistribut|local\s+(?:test|use)\s+only|rights?\s+not\s+asserted|all\s+rights\s+reserved|\bunlicensed\b)/i.test(
    license
  );
}

async function collectPackageFiles(root: string, manifest: AvatarManifest): Promise<PackageFile[]> {
  const files: PackageFile[] = [];
  let totalBytes = 0;

  const visit = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath);
      if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        throw new AvatarPackageError("Avatar package export encountered an unsafe path.");
      }
      if (entry.isSymbolicLink()) {
        throw new AvatarPackageError("Avatar package export does not include symbolic links.");
      }
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        throw new AvatarPackageError("Avatar package export supports regular files only.");
      }

      const fileStat = await lstat(absolutePath);
      if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
        throw new AvatarPackageError("Avatar package export supports regular files only.");
      }
      if (fileStat.size > MAX_AVATAR_PACKAGE_FILE_BYTES) {
        throw new AvatarPackageError("Avatar package export exceeds the per-file size limit.");
      }
      totalBytes += fileStat.size;
      if (totalBytes > MAX_AVATAR_PACKAGE_TOTAL_BYTES) {
        throw new AvatarPackageError("Avatar package export exceeds the total size limit.");
      }
      if (files.length >= MAX_AVATAR_PACKAGE_FILES) {
        throw new AvatarPackageError("Avatar package export exceeds the file-count limit.");
      }

      const bytes = await readFile(absolutePath);
      if (bytes.byteLength !== fileStat.size) {
        throw new AvatarPackageError("An avatar package file changed while it was being exported. Try again.");
      }
      const portableRelativePath = relativePath.split(path.sep).join("/");
      files.push({
        archivePath: `${manifest.id}/${portableRelativePath}`,
        bytes,
        modifiedAt: fileStat.mtime
      });
    }
  };

  await visit(root);
  if (!files.some((file) => file.archivePath === `${manifest.id}/avatar.manifest.json`)) {
    throw new AvatarPackageError("Avatar package manifest is missing from the export.");
  }
  return files;
}

function createZipArchive(files: PackageFile[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  const entries: ZipEntry[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = Buffer.from(file.archivePath, "utf8");
    if (nameBytes.byteLength > 0xffff) throw new AvatarPackageError("Avatar package export path is too long.");
    const entry: ZipEntry = {
      ...file,
      crc32: calculateCrc32(file.bytes),
      localHeaderOffset: offset,
      nameBytes
    };
    const localHeader = createLocalHeader(entry);
    localParts.push(localHeader, entry.nameBytes, entry.bytes);
    offset += localHeader.byteLength + entry.nameBytes.byteLength + entry.bytes.byteLength;
    entries.push(entry);
  }

  const centralDirectoryOffset = offset;
  for (const entry of entries) {
    const centralHeader = createCentralHeader(entry);
    centralParts.push(centralHeader, entry.nameBytes);
    offset += centralHeader.byteLength + entry.nameBytes.byteLength;
  }
  const centralDirectorySize = offset - centralDirectoryOffset;
  if (entries.length > 0xffff || offset > 0xffffffff) {
    throw new AvatarPackageError("Avatar package export is too large for the ZIP format.");
  }

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectorySize, 12);
  end.writeUInt32LE(centralDirectoryOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

function createLocalHeader(entry: ZipEntry): Buffer {
  const { date, time } = toDosDateTime(entry.modifiedAt);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(ZIP_VERSION, 4);
  header.writeUInt16LE(ZIP_UTF8_FLAG, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(time, 10);
  header.writeUInt16LE(date, 12);
  header.writeUInt32LE(entry.crc32, 14);
  header.writeUInt32LE(entry.bytes.byteLength, 18);
  header.writeUInt32LE(entry.bytes.byteLength, 22);
  header.writeUInt16LE(entry.nameBytes.byteLength, 26);
  header.writeUInt16LE(0, 28);
  return header;
}

function createCentralHeader(entry: ZipEntry): Buffer {
  const { date, time } = toDosDateTime(entry.modifiedAt);
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(0x0314, 4);
  header.writeUInt16LE(ZIP_VERSION, 6);
  header.writeUInt16LE(ZIP_UTF8_FLAG, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(time, 12);
  header.writeUInt16LE(date, 14);
  header.writeUInt32LE(entry.crc32, 16);
  header.writeUInt32LE(entry.bytes.byteLength, 20);
  header.writeUInt32LE(entry.bytes.byteLength, 24);
  header.writeUInt16LE(entry.nameBytes.byteLength, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE((0o100644 << 16) >>> 0, 38);
  header.writeUInt32LE(entry.localHeaderOffset, 42);
  return header;
}

function toDosDateTime(value: Date): { date: number; time: number } {
  const year = Math.min(2107, Math.max(1980, value.getFullYear()));
  const month = value.getMonth() + 1;
  const day = value.getDate();
  const hours = value.getHours();
  const minutes = value.getMinutes();
  const seconds = Math.floor(value.getSeconds() / 2);
  return {
    date: ((year - 1980) << 9) | (month << 5) | day,
    time: (hours << 11) | (minutes << 5) | seconds
  };
}

function calculateCrc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (CRC32_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let value = 0; value < table.length; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    table[value] = crc >>> 0;
  }
  return table;
}

function isPathInside(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
