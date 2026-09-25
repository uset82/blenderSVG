import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, Menu, safeStorage, shell } from "electron";
import { desktopShellPlan, rememberDesktopSecret } from "./shellPlan.mjs";

const plan = desktopShellPlan();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

let host;
let window;
let hostOrigin = "";

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
        { label: "Kurva website", click: () => shell.openExternal("https://kurva.agency/") },
        {
          label: `About Kurva ${app.getVersion()}`,
          click: () =>
            dialog.showMessageBox({
              type: "info",
              title: "About Kurva",
              message: `Kurva ${app.getVersion()}`,
              detail: "every line finds its curve.\nRuns on your computer. https://kurva.agency"
            })
        }
      ]
    }
  ]);
}

/**
 * Packaged builds run the bundled host with Electron's own Node (ELECTRON_RUN_AS_NODE),
 * so users need no Node, Git or pnpm. Development runs the TypeScript host from the repo.
 */
function hostCommand() {
  if (app.isPackaged) {
    return {
      command: process.execPath,
      args: [path.join(app.getAppPath(), "studio-server", "src", "index.mjs")],
      cwd: app.getAppPath(),
      env: { ELECTRON_RUN_AS_NODE: "1" }
    };
  }
  return {
    command: process.env.npm_node_execpath || "node",
    args: ["--experimental-strip-types", "apps/studio-server/src/index.ts"],
    cwd: root,
    env: {}
  };
}

function startHost() {
  const { command, args, cwd, env } = hostCommand();
  host = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env, STUDIO_OPEN: "0" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  let buffer = "";
  let errors = "";
  host.stderr.on("data", (chunk) => {
    errors = (errors + chunk.toString()).slice(-2000);
  });
  return new Promise((resolve, reject) => {
    host.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const line = buffer.split(/\r?\n/).find((item) => item.startsWith("http://127.0.0.1:"));
      if (line) resolve(line.trim());
    });
    host.once("error", reject);
    host.once("exit", (code) => reject(new Error(`The Kurva host stopped (code ${code ?? 0}).\n${errors.trim()}`)));
  });
}

/** Keep the window on the local Studio; open web links in the user's browser. */
function lockWindowToHost(contents) {
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url) && !url.startsWith(hostOrigin)) shell.openExternal(url);
    return { action: "deny" };
  });
  contents.on("will-navigate", (event, url) => {
    if (url.startsWith(hostOrigin)) return;
    event.preventDefault();
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
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
    hostOrigin = new URL(url).origin;
    window = new BrowserWindow({
      width: 1440,
      height: 900,
      title: "Kurva",
      backgroundColor: "#f3eee3",
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    lockWindowToHost(window.webContents);
    window.once("ready-to-show", () => window?.show());
    await window.loadURL(url);
    if (process.env.DESKTOP_SMOKE === "1") {
      console.log("desktop-ready");
      app.quit();
    }
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    if (process.env.DESKTOP_SMOKE !== "1") dialog.showErrorBox("Kurva could not start", message);
    app.quit();
  });

app.on("second-instance", () => {
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.focus();
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => host?.kill());
