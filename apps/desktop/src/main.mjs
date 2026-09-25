import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, Menu, safeStorage } from "electron";
import { desktopShellPlan, rememberDesktopSecret } from "./shellPlan.mjs";

const plan = desktopShellPlan();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

let host;
let window;

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        {
          label: "New",
          accelerator: "CmdOrCtrl+N",
          click: () => window?.webContents.executeJavaScript("location.hash='#/'")
        },
        { role: "quit" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" }
      ]
    },
    { label: "View", submenu: [{ role: "reload" }, { role: "togglefullscreen" }] },
    { label: "Window", submenu: [{ role: "minimize" }, { role: "close" }] },
    {
      label: "Help",
      submenu: [
        {
          label: "About blenderSVG Studio",
          click: () => window?.webContents.executeJavaScript("alert('blenderSVG Studio')")
        }
      ]
    }
  ]);
}

function startHost() {
  const node = process.env.npm_node_execpath || "node";
  host = spawn(node, ["--experimental-strip-types", "apps/studio-server/src/index.ts"], {
    cwd: root,
    env: { ...process.env, STUDIO_OPEN: "0" },
    stdio: ["ignore", "pipe", "inherit"]
  });
  let buffer = "";
  return new Promise((resolve, reject) => {
    host.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const line = buffer.split(/\r?\n/).find((item) => item.startsWith("http://127.0.0.1:"));
      if (line) resolve(line.trim());
    });
    host.once("exit", (code) => reject(new Error(`Studio host exited ${code ?? 0}`)));
  });
}

app
  .whenReady()
  .then(async () => {
    if (!plan.singleInstance || plan.autoUpdate || plan.secretStore !== "safeStorage") {
      throw new Error("The desktop shell plan is incomplete.");
    }
    Menu.setApplicationMenu(buildMenu());
    if (safeStorage.isEncryptionAvailable()) rememberDesktopSecret(safeStorage, "desktop-ready");
    const url = await startHost();
    window = new BrowserWindow({
      width: 1440,
      height: 900,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    await window.loadURL(url);
    if (process.env.DESKTOP_SMOKE === "1") {
      console.log("desktop-ready");
      app.quit();
    }
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    app.quit();
  });

app.on("second-instance", () => {
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.focus();
});

app.on("before-quit", () => host?.kill());
