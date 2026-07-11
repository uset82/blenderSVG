import { existsSync } from "node:fs";
import path from "node:path";

export type BlenderExportMode = "svg" | "glb" | "png";

export type BlenderExportResult = {
  mode: BlenderExportMode;
  outputPath: string;
  manifestPath: string;
};

export type BlenderExportPlan = BlenderExportResult & {
  args: string[];
  label: string;
  scriptPath: string;
};

export type BlenderExportPlanOptions = {
  blendPath: string;
  workspaceRoot: string;
  assetWorkspace: string;
  extensionRoot: string;
  modes: BlenderExportMode[];
};

const blenderScripts: Record<BlenderExportMode, { script: string; suffix: string; label: string }> = {
  svg: { script: "export_svg.py", suffix: ".line-art.svg", label: "SVG line art" },
  glb: { script: "export_glb.py", suffix: ".webgl.glb", label: "GLB" },
  png: { script: "render_turntable.py", suffix: ".preview.png", label: "PNG preview" }
};

export function createBlenderExportPlans(options: BlenderExportPlanOptions): {
  outputDirectory: string;
  exports: BlenderExportPlan[];
} {
  const blendPath = path.resolve(options.blendPath);
  if (!isInsideDirectory(options.workspaceRoot, blendPath)) {
    throw new Error("Blender input file is outside the workspace.");
  }

  const outputDirectory = path.resolve(options.workspaceRoot, options.assetWorkspace, "exports", "blender");
  if (!isInsideDirectory(options.workspaceRoot, outputDirectory)) {
    throw new Error("Resolved Blender export directory is outside the workspace.");
  }

  const baseName = sanitizeBlenderBaseName(path.parse(blendPath).name);
  const exports = options.modes.map((mode) => {
    const descriptor = blenderScripts[mode];
    const outputPath = path.join(outputDirectory, `${baseName}${descriptor.suffix}`);
    const manifestPath = path.join(outputDirectory, `${baseName}.${mode}.manifest.json`);
    const scriptPath = resolveBlenderScriptPath(options.extensionRoot, descriptor.script);

    return {
      mode,
      outputPath,
      manifestPath,
      scriptPath,
      label: descriptor.label,
      args: [
        "--background",
        "--python",
        scriptPath,
        "--",
        "--input",
        blendPath,
        "--output",
        outputPath,
        "--manifest",
        manifestPath
      ]
    };
  });

  return { outputDirectory, exports };
}

export function sanitizeBlenderBaseName(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "scene"
  );
}

export function resolveBlenderScriptPath(extensionRoot: string, scriptName: string): string {
  if (path.basename(scriptName) !== scriptName || path.extname(scriptName).toLowerCase() !== ".py") {
    throw new Error("Blender script name must be a local Python file name.");
  }
  const packagedScriptPath = path.resolve(extensionRoot, "media", "blender", scriptName);
  if (existsSync(packagedScriptPath)) {
    return packagedScriptPath;
  }

  return path.resolve(extensionRoot, "..", "..", "scripts", "blender", scriptName);
}

export function isInsideDirectory(parent: string, child: string): boolean {
  const relativePath = path.relative(path.resolve(parent), path.resolve(child));
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}
