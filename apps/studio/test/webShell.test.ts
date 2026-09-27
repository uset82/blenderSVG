import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { reloadIntoWaitingWorker, shouldOfferAppUpdate, webChatAvailability } from "../src/web/webShell.js";

const root = new URL("../../../", import.meta.url);

describe("web shell", () => {
  it("offers an update only when the visitor is not editing or streaming", () => {
    expect(shouldOfferAppUpdate({ waiting: true, editing: false, streaming: false })).toBe(true);
    expect(shouldOfferAppUpdate({ waiting: true, editing: true, streaming: false })).toBe(false);
    expect(shouldOfferAppUpdate({ waiting: true, editing: false, streaming: true })).toBe(false);
    expect(webChatAvailability(false)).toBe("Offline — OpenRouter is unavailable");
    expect(webChatAvailability(true)).toBeNull();
  });

  it("Reload activates the waiting worker, not the active one, then reloads once it takes over", async () => {
    const waiting = { postMessage: vi.fn() };
    let onControllerChange: (() => void) | undefined;
    const container = {
      getRegistration: vi.fn(async () => ({ waiting }) as unknown as ServiceWorkerRegistration),
      addEventListener: vi.fn((_type: string, listener: () => void) => {
        onControllerChange = listener;
      })
    };
    const reload = vi.fn();
    await reloadIntoWaitingWorker(container as never, reload, 60_000);
    expect(waiting.postMessage).toHaveBeenCalledWith("kurva-reload");
    expect(container.addEventListener).toHaveBeenCalledWith("controllerchange", expect.any(Function), { once: true });
    expect(reload).not.toHaveBeenCalled();
    onControllerChange?.();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("Reload still reloads when no worker is waiting or the worker never takes over", async () => {
    const noWaiting = { getRegistration: vi.fn(async () => undefined), addEventListener: vi.fn() };
    const reload = vi.fn();
    await reloadIntoWaitingWorker(noWaiting as never, reload);
    expect(reload).toHaveBeenCalledOnce();

    vi.useFakeTimers();
    try {
      const stuck = {
        getRegistration: vi.fn(
          async () => ({ waiting: { postMessage: vi.fn() } }) as unknown as ServiceWorkerRegistration
        ),
        addEventListener: vi.fn()
      };
      const fallbackReload = vi.fn();
      await reloadIntoWaitingWorker(stuck as never, fallbackReload, 3000);
      expect(fallbackReload).not.toHaveBeenCalled();
      vi.advanceTimersByTime(3000);
      expect(fallbackReload).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("ships the manifest, service worker, and kill switch without caching OpenRouter", () => {
    const manifest = JSON.parse(readFileSync(new URL("apps/studio/public/manifest.webmanifest", root), "utf8"));
    expect(manifest.name).toBe("Kurva");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.some((icon: { sizes: string }) => icon.sizes === "512x512")).toBe(true);
    const worker = readFileSync(new URL("apps/studio/public/sw.js", root), "utf8");
    expect(worker).toContain("openrouter.ai");
    expect(worker).toContain("caches.match");
    expect(worker).toContain('cache.put(appPath("/index.html")');
    const kill = readFileSync(new URL("apps/studio/public/sw-kill.js", root), "utf8");
    expect(kill).toContain("unregister");
    expect(kill).toContain("caches.delete");
    expect(kill).toContain("includeUncontrolled: true");
    expect(kill).toContain("kurva-kill");
    expect(kill).toContain("kurva-reset");
    const caddy = readFileSync(new URL("apps/studio/web/Caddyfile", root), "utf8");
    expect(caddy).toContain("connect-src 'self' https://openrouter.ai data:");
    const privacy = readFileSync(new URL("apps/studio/public/privacy.html", root), "utf8");
    expect(privacy).toContain("no analytics");
    expect(privacy).toContain("OpenRouter");
    const notices = readFileSync(new URL("apps/studio/public/notices.html", root), "utf8");
    expect(notices).toContain("MIT");
    expect(notices).toContain("ZCode");
    expect(notices).toContain("Apache License, Version 2.0");
    const security = readFileSync(new URL("apps/studio/public/.well-known/security.txt", root), "utf8");
    expect(security).toContain("Contact:");
  });
});
