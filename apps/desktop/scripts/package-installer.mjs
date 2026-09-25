// Builds the one-click Kurva installer for Windows.
// Run `pnpm build` first, then `pnpm --filter @codex-avatar-studio/desktop package:win`.
//
// The installed app needs no Node, Git or pnpm: the Studio host is bundled into one file
// and runs on Electron's own Node, next to the prebuilt Studio UI and the Blender scripts.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as bundle } from "esbuild";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(desktopRoot, "../..");
const stage = path.join(desktopRoot, "dist", "stage");
const output = path.join(desktopRoot, "dist", "installer");
const desktopPackage = JSON.parse(readFileSync(path.join(desktopRoot, "package.json"), "utf8"));
const electronVersion = JSON.parse(
  readFileSync(createRequire(path.join(desktopRoot, "package.json")).resolve("electron/package.json"), "utf8")
).version;

const required = [
  "apps/studio/dist/index.html",
  "packages/studio-host-core/dist/src/hostSecrets.js",
  "packages/asset-pipeline/dist/src/index.js",
  "packages/avatar-core/dist/src/index.js"
];
for (const file of required) {
  if (!existsSync(path.join(repoRoot, file))) throw new Error(`Missing ${file}. Run pnpm build first.`);
}

rmSync(stage, { recursive: true, force: true });
rmSync(output, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

// css-tree and csso (used by svgo) read JSON with createRequire(import.meta.url) at runtime.
// Turn each require("….json") into a static import so the JSON is bundled.
const inlineRuntimeJson = {
  name: "inline-runtime-json",
  setup(build) {
    build.onLoad({ filter: /[\\/](css-tree|csso)[\\/]lib[\\/][^\\/]+\.js$/ }, (args) => {
      const source = readFileSync(args.path, "utf8");
      if (!source.includes("createRequire(import.meta.url)")) return undefined;
      const imports = [];
      const body = source
        .replace(/^import \{ createRequire \} from ['"]module['"];\s*$/m, "")
        .replace(/^const require = createRequire\(import\.meta\.url\);\s*$/m, "")
        .replace(/require\((['"])([^'"]+\.json)\1\)/g, (_match, _quote, specifier) => {
          const name = `__kurvaJson${imports.length}`;
          imports.push(`import ${name} from ${JSON.stringify(specifier)};`);
          return name;
        });
      if (/\brequire\(/.test(body)) throw new Error(`Unhandled runtime require in ${args.path}`);
      return { contents: `${imports.join("\n")}\n${body}`, resolveDir: path.dirname(args.path), loader: "js" };
    });
  }
};
// The OS keychain module is native; it ships next to the bundle instead of inside it.
const vendorKeyring = {
  name: "vendor-keyring",
  setup(build) {
    build.onResolve({ filter: /^@napi-rs\/keyring$/ }, () => ({
      path: "./vendor/napi-keyring/index.js",
      external: true
    }));
  }
};
const shared = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  external: ["bufferutil", "utf-8-validate"],
  // Bundled CommonJS dependencies expect require and __dirname (vtracer finds its .wasm with it).
  banner: {
    js: [
      "import { createRequire as __kurvaRequire } from 'node:module';",
      "import { fileURLToPath as __kurvaPath } from 'node:url';",
      "import { dirname as __kurvaDirname } from 'node:path';",
      "const require = __kurvaRequire(import.meta.url);",
      "const __filename = __kurvaPath(import.meta.url);",
      "const __dirname = __kurvaDirname(__filename);"
    ].join(" ")
  },
  plugins: [inlineRuntimeJson, vendorKeyring],
  logLevel: "warning"
};

// The host resolves the UI and Blender scripts relative to studio-server/src, as in the repo.
await bundle({
  ...shared,
  entryPoints: [path.join(repoRoot, "apps/studio-server/src/index.ts")],
  outfile: path.join(stage, "studio-server/src/index.mjs")
});
await bundle({
  ...shared,
  entryPoints: [path.join(repoRoot, "apps/extension/src/avatarPackageExport.ts")],
  outfile: path.join(stage, "extension/dist/avatarPackageExport.js")
});

// vtracer (local picture → SVG) loads its WebAssembly from the bundle's folder.
const requireFromPipeline = createRequire(path.join(repoRoot, "packages/asset-pipeline/package.json"));
const vtracerRoot = path.dirname(requireFromPipeline.resolve("@visioncortex/vtracer/package.json"));
for (const outDir of ["studio-server/src", "extension/dist"]) {
  cpSync(path.join(vtracerRoot, "pkg/vtracer_wasm_bg.wasm"), path.join(stage, outDir, "vtracer_wasm_bg.wasm"));
}

cpSync(path.join(repoRoot, "apps/studio/dist"), path.join(stage, "studio/dist"), { recursive: true });
cpSync(path.join(repoRoot, "scripts/blender"), path.join(stage, "extension/media/blender"), {
  recursive: true,
  filter: (source) => !source.endsWith("AGENTS.md")
});
for (const file of ["main.mjs", "shellPlan.mjs"]) {
  cpSync(path.join(desktopRoot, "src", file), path.join(stage, file));
}

// Native keychain binding for Windows x64. Its own package.json keeps it CommonJS.
const requireFromHostCore = createRequire(path.join(repoRoot, "packages/studio-host-core/package.json"));
const keyringRoot = path.dirname(requireFromHostCore.resolve("@napi-rs/keyring/package.json"));
const keyringBinaryRoot = path.dirname(
  createRequire(path.join(keyringRoot, "package.json")).resolve("@napi-rs/keyring-win32-x64-msvc/package.json")
);
const vendor = path.join(stage, "studio-server/src/vendor/napi-keyring");
mkdirSync(vendor, { recursive: true });
cpSync(path.join(keyringRoot, "index.js"), path.join(vendor, "index.js"));
cpSync(path.join(keyringRoot, "package.json"), path.join(vendor, "package.json"));
cpSync(path.join(keyringRoot, "LICENSE"), path.join(vendor, "LICENSE"));
cpSync(path.join(keyringBinaryRoot, "keyring.win32-x64-msvc.node"), path.join(vendor, "keyring.win32-x64-msvc.node"));

writeFileSync(
  path.join(stage, "package.json"),
  `${JSON.stringify(
    {
      name: "kurva",
      productName: "Kurva",
      version: desktopPackage.version,
      description: "Kurva: a local-first design canvas for characters, SVG and Blender.",
      author: "Kurva",
      homepage: "https://kurva.agency",
      license: "MIT",
      type: "module",
      main: "main.mjs"
    },
    null,
    2
  )}\n`
);

const { build: buildInstaller, Platform } = await import("electron-builder");
await buildInstaller({
  targets: Platform.WINDOWS.createTarget(["nsis"], 1),
  config: {
    appId: "agency.kurva.studio",
    productName: "Kurva",
    electronVersion,
    directories: { app: stage, output, buildResources: path.join(desktopRoot, "build") },
    asar: false,
    npmRebuild: false,
    compression: "normal",
    win: { icon: path.join(repoRoot, "docs/design/brand/png/icon-512.png") },
    nsis: {
      oneClick: true,
      perMachine: false,
      runAfterFinish: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: "Kurva",
      deleteAppDataOnUninstall: false,
      // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder expands ${version} and ${ext}.
      artifactName: "Kurva-Setup-${version}.${ext}"
    }
  }
});

console.log(`Installer written to ${path.relative(repoRoot, output)}`);
