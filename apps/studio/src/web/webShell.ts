export function shouldOfferAppUpdate(input: { waiting: boolean; editing: boolean; streaming: boolean }): boolean {
  return input.waiting && !input.editing && !input.streaming;
}

/**
 * Activates the waiting service worker, then reloads once it controls the page. The message
 * must reach the waiting worker: skipWaiting() in the active one does nothing, and a reload
 * alone keeps the old worker in control, so the update banner would come back on every load.
 */
export async function reloadIntoWaitingWorker(
  container: Pick<ServiceWorkerContainer, "getRegistration" | "addEventListener">,
  reload: () => void,
  fallbackMs = 3000
): Promise<void> {
  const waiting = (await container.getRegistration())?.waiting;
  if (!waiting) {
    reload();
    return;
  }
  let reloaded = false;
  const reloadOnce = () => {
    if (reloaded) return;
    reloaded = true;
    reload();
  };
  container.addEventListener("controllerchange", reloadOnce, { once: true });
  // A worker that never takes over must not leave the button doing nothing.
  setTimeout(reloadOnce, fallbackMs);
  waiting.postMessage("kurva-reload");
}

export function webChatAvailability(online: boolean): string | null {
  return online ? null : "Offline — OpenRouter is unavailable";
}

export const WEB_APP_VERSION = "0.1.0";

export const INSTALL_GUIDANCE = [
  "Chrome and Edge can install Kurva from the address bar after the first visit.",
  "On iPhone or iPad, use Share, then Add to Home Screen. That also keeps Safari from deleting this browser’s data after seven days away."
];
