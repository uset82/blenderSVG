export function shouldOfferAppUpdate(input: { waiting: boolean; editing: boolean; streaming: boolean }): boolean {
  return input.waiting && !input.editing && !input.streaming;
}

export function webChatAvailability(online: boolean): string | null {
  return online ? null : "Offline — OpenRouter is unavailable";
}

export const WEB_APP_VERSION = "0.1.0";

export const INSTALL_GUIDANCE = [
  "Chrome and Edge can install Kurva from the address bar after the first visit.",
  "On iPhone or iPad, use Share, then Add to Home Screen. That also keeps Safari from deleting this browser’s data after seven days away."
];
