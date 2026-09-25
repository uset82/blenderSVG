import { DESKTOP_ONLY_REASON, KURVA_DESKTOP_APP_URL } from "./studioCapabilities.js";

export function DesktopOnlyNotice({ feature }: { feature: string }) {
  return (
    <p className="studio-desktop-only">
      {feature}: {DESKTOP_ONLY_REASON}.{" "}
      <a href={KURVA_DESKTOP_APP_URL} rel="noreferrer">
        Get the desktop app
      </a>
    </p>
  );
}
