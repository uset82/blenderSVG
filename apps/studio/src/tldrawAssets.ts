import { getAssetUrlsByImport } from "@tldraw/assets/imports.vite";

// Vite copies every tldraw font, icon, and translation into the Studio bundle.
// Relative asset URLs work in both the loopback preview and the VS Code Webview.
export const tldrawAssetUrls = getAssetUrlsByImport();
