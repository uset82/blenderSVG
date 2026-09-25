import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

/**
 * Minimal read-only ZIP reader for CI scripts. Replaces the earlier `tar` calls:
 * Windows ships bsdtar (reads ZIP), but GNU tar on Linux runners does not.
 * Supports stored (0) and deflated (8) entries, which covers vsce output and the
 * extension's stored avatar-package writer. Not a general-purpose ZIP library.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const MAX_ENTRIES = 10_000;
const MAX_UNCOMPRESSED_BYTES = 256 * 1024 * 1024;

function findEndOfCentralDirectory(buffer) {
  const earliest = Math.max(0, buffer.length - 22 - 65_536);
  for (let offset = buffer.length - 22; offset >= earliest; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  throw new Error("Not a ZIP archive: end of central directory not found.");
}

function readCentralDirectory(zipPath) {
  const buffer = readFileSync(zipPath);
  const eocd = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  if (entryCount > MAX_ENTRIES) throw new Error(`ZIP archive has too many entries (${entryCount}).`);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      throw new Error("Not a ZIP archive: corrupt central directory.");
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return { buffer, entries };
}

export function listZipEntries(zipPath) {
  if (!existsSync(zipPath)) throw new Error(`ZIP archive does not exist: ${zipPath}`);
  return readCentralDirectory(zipPath).entries.map((entry) => entry.name);
}

export function readZipEntry(zipPath, entryName) {
  const { buffer, entries } = readCentralDirectory(zipPath);
  const entry = entries.find((candidate) => candidate.name === entryName);
  if (!entry) throw new Error(`ZIP archive has no entry named ${entryName}.`);
  if (entry.uncompressedSize > MAX_UNCOMPRESSED_BYTES) {
    throw new Error(`ZIP entry ${entryName} is too large to read (${entry.uncompressedSize} bytes).`);
  }
  const local = entry.localHeaderOffset;
  if (buffer.readUInt32LE(local) !== LOCAL_SIGNATURE) {
    throw new Error(`ZIP entry ${entryName} has a corrupt local header.`);
  }
  const dataStart = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(compressed);
  if (entry.method === 8) return inflateRawSync(compressed);
  throw new Error(`ZIP entry ${entryName} uses unsupported compression method ${entry.method}.`);
}

export function extractZip(zipPath, outputDirectory) {
  const { entries } = readCentralDirectory(zipPath);
  const root = path.resolve(outputDirectory);
  for (const entry of entries) {
    const target = path.resolve(root, entry.name);
    if (!target.startsWith(root + path.sep)) {
      throw new Error(`ZIP entry escapes the output directory: ${entry.name}`);
    }
    if (entry.name.endsWith("/")) {
      mkdirSync(target, { recursive: true });
      continue;
    }
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, readZipEntry(zipPath, entry.name));
  }
}
