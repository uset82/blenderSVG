import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shouldOfferAppUpdate, webChatAvailability } from "../src/web/webShell.js";

const root = new URL("../../../", import.meta.url);

describe("web shell", () => {
  it("offers an update only when the visitor is not editing or streaming", () => {
    expect(shouldOfferAppUpdate({ waiting: true, editing: false, streaming: false })).toBe(true);
    expect(shouldOfferAppUpdate({ waiting: true, editing: true, streaming: false })).toBe(false);
    expect(shouldOfferAppUpdate({ waiting: true, editing: false, streaming: true })).toBe(false);
    expect(webChatAvailability(false)).toBe("Offline — OpenRouter is unavailable");
    expect(webChatAvailability(true)).toBeNull();
  });

  it("ships the manifest, service worker, and kill switch without caching OpenRouter", () => {
    const manifest = JSON.parse(readFileSync(new URL("apps/studio/public/manifest.webmanifest", root), "utf8"));
    expect(manifest.name).toBe("Kurva");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.some((icon: { sizes: string }) => icon.sizes === "512x512")).toBe(true);
    const worker = readFileSync(new URL("apps/studio/public/sw.js", root), "utf8");
    expect(worker).toContain("openrouter.ai");
    expect(worker).toContain("caches.match");
    const kill = readFileSync(new URL("apps/studio/public/sw-kill.js", root), "utf8");
    expect(kill).toContain("unregister");
    expect(kill).toContain("caches.delete");
    const caddy = readFileSync(new URL("apps/studio/web/Caddyfile", root), "utf8");
    expect(caddy).toContain("connect-src 'self' https://openrouter.ai");
    const privacy = readFileSync(new URL("apps/studio/public/privacy.html", root), "utf8");
    expect(privacy).toContain("no analytics");
    expect(privacy).toContain("OpenRouter");
    const notices = readFileSync(new URL("apps/studio/public/notices.html", root), "utf8");
    expect(notices).toContain("MIT");
    const security = readFileSync(new URL("apps/studio/public/.well-known/security.txt", root), "utf8");
    expect(security).toContain("Contact:");
  });
});
