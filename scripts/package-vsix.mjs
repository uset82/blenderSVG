import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const extensionRoot = path.join(root, "apps", "extension");
const dist = path.join(root, "dist");
const stage = path.join(dist, `vsix-stage-${process.pid}`);
const packageName = "codex-avatar-studio-0.1.0.vsix";
const output = path.join(dist, packageName);
const vsceExecutable = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "vsce.CMD" : "vsce");

mkdirSync(dist, { recursive: true });
cleanupOldStages();
mkdirSync(stage, { recursive: true });

run(process.execPath, [path.join(root, "scripts", "workspace-checks.mjs"), "build"], root);

for (const fileName of ["README.md", "CHANGELOG.md", "LICENSE"]) {
  copyFileSync(path.join(root, fileName), path.join(stage, fileName));
}

copyFileSync(path.join(extensionRoot, "package.json"), path.join(stage, "package.json"));
copyFileSync(path.join(extensionRoot, ".vscodeignore"), path.join(stage, ".vscodeignore"));
cpSync(path.join(extensionRoot, "media"), path.join(stage, "media"), {
  dereference: true,
  recursive: true
});
cpSync(path.join(root, "scripts", "blender"), path.join(stage, "media", "blender"), {
  dereference: true,
  filter: source => !source.endsWith("AGENTS.md"),
  recursive: true
});
mkdirSync(path.join(stage, "dist"), { recursive: true });

buildSync({
  absWorkingDir: root,
  bundle: true,
  entryPoints: [path.join(root, "apps", "extension", "src", "extension.ts")],
  external: ["vscode"],
  format: "cjs",
  logLevel: "silent",
  outfile: path.join(stage, "dist", "extension.js"),
  platform: "node",
  sourcemap: true,
  target: "node20"
});

const manifestPath = path.join(stage, "package.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.private = false;
manifest.scripts = {};
delete manifest.dependencies;
delete manifest.devDependencies;
delete manifest.packageManager;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

rmSync(output, { force: true });
run(vsceExecutable, ["package", "--allow-missing-repository", "--no-dependencies", "--out", output], stage);
rmSync(stage, { force: true, recursive: true });

console.log(`Created ${path.relative(root, output)}`);

function cleanupOldStages() {
  for (const entry of readdirSync(dist, { withFileTypes: true })) {
    if (entry.isDirectory() && /^vsix-stage(?:-\d+)?$/.test(entry.name)) {
      rmSync(path.join(dist, entry.name), { force: true, recursive: true });
    }
  }
}

function run(command, args, cwd) {
  const useShell = process.platform === "win32" && command.toLowerCase().endsWith(".cmd");
  execFileSync(command, args, { cwd, shell: useShell, stdio: "inherit" });
}
