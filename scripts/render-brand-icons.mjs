import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "docs", "design", "brand", "png");
const appIcon = await readFile(path.join(root, "docs", "design", "brand", "kurva-app-icon.svg"), "utf8");
const mark = await readFile(path.join(root, "docs", "design", "brand", "kurva-mark.svg"), "utf8");

await mkdir(outDir, { recursive: true });

const sizes = [
  { name: "favicon-16.png", svg: mark, size: 16 },
  { name: "favicon-32.png", svg: mark, size: 32 },
  { name: "apple-touch-icon.png", svg: appIcon, size: 180 },
  { name: "icon-512.png", svg: appIcon, size: 512 },
  { name: "extension-icon.png", svg: appIcon, size: 128 }
];

for (const item of sizes) {
  const png = new Resvg(item.svg, { fitTo: { mode: "width", value: item.size } }).render().asPng();
  await writeFile(path.join(outDir, item.name), png);
  if (item.name === "extension-icon.png") {
    await writeFile(path.join(root, "apps", "extension", "media", "icon.png"), png);
  }
  if (item.name === "favicon-32.png") {
    await writeFile(path.join(root, "apps", "studio", "public", "favicon-32.png"), png);
  }
}

console.log(`Wrote ${sizes.length} brand PNGs.`);
