import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const STUDIO_URL = /http:\/\/127\.0\.0\.1:\d+\/\?studioToken=[A-Za-z0-9]+/;

export function studioServerEntry(workspaceRoot: string | undefined): string | null {
  if (!workspaceRoot) return null;
  const entry = path.join(workspaceRoot, "apps", "studio-server", "src", "index.ts");
  return existsSync(entry) ? entry : null;
}

export function parseStudioLaunchUrl(output: string): string | null {
  return output.match(STUDIO_URL)?.[0] ?? null;
}

export async function launchStandaloneStudio(options: {
  serverEntry: string | null;
  openExternal: (url: string) => void | PromiseLike<unknown>;
  spawnProcess?: typeof spawn;
  timeoutMs?: number;
}): Promise<"opened" | "missing" | "failed"> {
  if (!options.serverEntry) return "missing";
  const spawnProcess = options.spawnProcess ?? spawn;
  const child = spawnProcess(process.execPath, ["--experimental-strip-types", options.serverEntry], {
    env: { ...process.env, STUDIO_OPEN: "0" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const url = await readLaunchUrl(child, options.timeoutMs ?? 15_000);
  if (!url) {
    child.kill();
    return "failed";
  }
  await options.openExternal(url);
  return "opened";
}

function readLaunchUrl(child: ChildProcess, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    let output = "";
    const finish = (value: string | null) => {
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(parseStudioLaunchUrl(output)), timeoutMs);
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      output += chunk;
      const url = parseStudioLaunchUrl(output);
      if (url) finish(url);
    });
    child.once("exit", () => finish(parseStudioLaunchUrl(output)));
  });
}
