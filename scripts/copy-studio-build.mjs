import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, realpathSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = path.join(root, "apps", "studio", "dist");
const destination = path.join(root, "apps", "extension", "media", "studio");

if (!existsSync(path.join(source, "index.html"))) {
  throw new Error("Studio build output is missing apps/studio/dist/index.html.");
}

assertInsideWorkspace(source);
assertInsideWorkspace(destination);
if (existsSync(destination) && lstatSync(destination).isSymbolicLink()) {
  throw new Error("Refusing to replace a symlinked Studio bundle destination.");
}
for (const file of collectFiles(source)) {
  const relative = path.relative(source, file);
  if (/\.map$|\.blend\d?$|\.glb$|\.env(?:\.|$)|(^|[\\/])\.codex-avatar([\\/]|$)|cholita/i.test(relative)) {
    throw new Error(`Private or development asset cannot enter Studio bundle: ${relative}`);
  }
}

if (existsSync(destination)) rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
cpSync(source, destination, { recursive: true, dereference: false });
console.log(`Copied Studio build to ${path.relative(root, destination)}`);

function assertInsideWorkspace(target) {
  const absolute = path.resolve(target);
  const resolved = existsSync(absolute) ? realpathSync(absolute) : absolute;
  const relative = path.relative(root, resolved);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to operate outside the workspace: ${target}`);
  }
}

function collectFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    const stat = lstatSync(fullPath);
    if (stat.isSymbolicLink()) throw new Error(`Studio build contains a symlink: ${fullPath}`);
    return stat.isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}
