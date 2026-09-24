import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { openSystemKeyring } from "@codex-avatar-studio/studio-host-core/hostSecrets";
import { defaultStudioLibraryRoot, ensureStudioLibrary } from "@codex-avatar-studio/studio-host-core/studioLibrary";
import { startStudioServer } from "./server.ts";

const port = Number(process.env.STUDIO_PORT ?? 0);
const launchToken = randomBytes(32).toString("hex");
const keyring = await openSystemKeyring().catch(() => undefined);
const library = await ensureStudioLibrary(defaultStudioLibraryRoot());
const server = await startStudioServer(
  Number.isInteger(port) && port >= 0 ? port : 0,
  undefined,
  launchToken,
  keyring,
  library.root
);
const address = server.address();
if (!address || typeof address === "string" || address.address !== "127.0.0.1") {
  console.error("Studio server failed to bind to 127.0.0.1.");
  process.exit(1);
}

const url = `http://127.0.0.1:${address.port}/?studioToken=${launchToken}`;
console.log(url);
if (process.env.STUDIO_OPEN !== "0") openBrowser(url);

function openBrowser(target: string): void {
  if (process.platform === "win32")
    spawn("cmd", ["/c", "start", "", target], { detached: true, stdio: "ignore" }).unref();
  else if (process.platform === "darwin") spawn("open", [target], { detached: true, stdio: "ignore" }).unref();
  else spawn("xdg-open", [target], { detached: true, stdio: "ignore" }).unref();
}
