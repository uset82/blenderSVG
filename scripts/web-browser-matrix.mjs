import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const browsers = (process.env.KURVA_BROWSERS ?? "chromium,firefox,webkit")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);
const scripts = (process.env.KURVA_MATRIX_SCRIPTS ?? "web-canvas-persist.mjs,web-export.mjs")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);

const failures = [];
for (const browser of browsers) {
  for (const script of scripts) {
    const scriptPath = path.join(root, "scripts", script);
    console.log(`\n=== ${browser} · ${script} ===`);
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: root,
      env: { ...process.env, KURVA_BROWSER: browser },
      encoding: "utf8",
      shell: false
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status !== 0) {
      failures.push(`${browser}/${script} exit ${result.status}`);
    }
  }
}

if (failures.length) {
  console.error(`web-browser-matrix failed:\n${failures.join("\n")}`);
  process.exit(1);
}
console.log(`web-browser-matrix ok (${browsers.join(", ")})`);
