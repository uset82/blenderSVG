import readline from "node:readline";
import { pathToFileURL } from "node:url";
import { runStdioProxy, stdioProxyTarget } from "./stdioProxy.js";

export async function startStdioProxyCli(input = process.stdin, output = process.stdout): Promise<void> {
  const target = stdioProxyTarget();
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  await runStdioProxy(lines, (line) => output.write(line), target);
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  startStdioProxyCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "The stdio proxy failed.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
