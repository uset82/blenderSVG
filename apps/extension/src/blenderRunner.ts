import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import type * as vscode from "vscode";
import type { AvatarExtensionConfig } from "./avatarState.js";
import {
  createBlenderExportPlans,
  type BlenderExportMode,
  type BlenderExportResult
} from "./blenderPlan.js";

export type { BlenderExportMode, BlenderExportResult } from "./blenderPlan.js";

type RunBlenderExportOptions = {
  blenderPath: string;
  blendPath: string;
  workspaceRoot: string;
  assetWorkspace: string;
  extensionRoot: string;
  modes: BlenderExportMode[];
  outputChannel: vscode.OutputChannel;
};

export async function findBlenderExecutable(config: AvatarExtensionConfig, outputChannel: vscode.OutputChannel): Promise<string | null> {
  const configuredPath = config.blenderPath.trim();
  if (configuredPath) {
    await assertBlenderVersion(configuredPath, outputChannel);
    return configuredPath;
  }

  for (const candidate of getBlenderCandidates()) {
    try {
      await assertBlenderVersion(candidate, outputChannel);
      return candidate;
    } catch {
      // Continue probing other local candidates.
    }
  }

  return null;
}

export async function assertBlenderVersion(blenderPath: string, outputChannel: vscode.OutputChannel): Promise<string> {
  const result = await spawnProcess(blenderPath, ["--version"], outputChannel, { timeoutMs: 5000 });
  const firstLine = result.stdout.split(/\r?\n/).find(Boolean) ?? "Blender version detected";
  outputChannel.appendLine(firstLine);
  return firstLine;
}

export async function runBlenderExports(options: RunBlenderExportOptions): Promise<BlenderExportResult[]> {
  const plan = createBlenderExportPlans(options);
  await mkdir(plan.outputDirectory, { recursive: true });
  const results: BlenderExportResult[] = [];

  for (const exportPlan of plan.exports) {
    options.outputChannel.appendLine(`Starting Blender ${exportPlan.label} export...`);
    await spawnProcess(options.blenderPath, exportPlan.args, options.outputChannel, { timeoutMs: 120_000 });
    await assertBlenderExportArtifacts(exportPlan);

    results.push({
      mode: exportPlan.mode,
      outputPath: exportPlan.outputPath,
      manifestPath: exportPlan.manifestPath
    });
  }

  return results;
}

export async function assertBlenderExportArtifacts(result: BlenderExportResult): Promise<void> {
  await assertFileExists(result.outputPath, `${result.mode} export output`);
  await assertFileExists(result.manifestPath, `${result.mode} export manifest`);
}

function getBlenderCandidates(): string[] {
  const candidates = new Set<string>();
  if (process.env.BLENDER_PATH) {
    candidates.add(process.env.BLENDER_PATH);
  }

  candidates.add("blender");

  const programFiles = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter(Boolean) as string[];
  for (const root of programFiles) {
    for (const version of ["4.4", "4.3", "4.2", "4.1", "4.0", "3.6"]) {
      candidates.add(path.join(root, "Blender Foundation", `Blender ${version}`, "blender.exe"));
    }
  }

  return [...candidates];
}

async function assertFileExists(filePath: string, label: string): Promise<void> {
  try {
    await access(filePath);
  } catch {
    throw new Error(`Expected Blender ${label} was not created: ${filePath}`);
  }
}

function spawnProcess(
  command: string,
  args: string[],
  outputChannel: vscode.OutputChannel,
  options: { timeoutMs: number }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      child.kill();
      reject(new Error(`Blender command timed out after ${options.timeoutMs / 1000} seconds.`));
    }, options.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      outputChannel.append(text);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      outputChannel.append(text);
    });

    child.on("error", error => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      reject(new Error(`Could not start Blender command "${command}": ${error.message}`));
    });

    child.on("close", code => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Blender exited with code ${code ?? "unknown"}.\n${stderr || stdout}`));
      }
    });
  });
}
