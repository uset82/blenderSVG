export const DESKTOP_MENUS = ["File", "Edit", "View", "Window", "Help"];

export function desktopShellPlan() {
  return {
    singleInstance: true,
    autoUpdate: false,
    secretStore: "safeStorage",
    menus: DESKTOP_MENUS
  };
}

export function rememberDesktopSecret(safeStorage, plain) {
  if (!plain || typeof plain !== "string") throw new Error("A desktop secret must be text.");
  if (!safeStorage.isEncryptionAvailable()) throw new Error("This computer cannot encrypt desktop secrets.");
  return safeStorage.encryptString(plain);
}

export function readDesktopSecret(safeStorage, encrypted) {
  return safeStorage.decryptString(encrypted);
}
