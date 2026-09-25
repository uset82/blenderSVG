import { ArrowUpRight, KeyRound } from "lucide-react";

const licenseDocsUrl = "https://tldraw.dev/sdk-features/license-key";

export function CanvasLicenseNotice() {
  return (
    <section className="studio-canvas-license" aria-labelledby="studio-canvas-license-title" role="status">
      <div className="studio-canvas-license__mark" aria-hidden="true">
        <KeyRound size={18} strokeWidth={1.7} />
      </div>
      <p className="studio-canvas-license__eyebrow">CANVAS ENGINE</p>
      <h2 id="studio-canvas-license-title">A license key is needed</h2>
      <p className="studio-canvas-license__copy">
        This production build can’t display or edit canvases until a tldraw license is configured.
      </p>
      <a className="studio-canvas-license__link" href={licenseDocsUrl} rel="noreferrer" target="_blank">
        Read the license setup guide <ArrowUpRight size={14} aria-hidden="true" />
      </a>
      <p className="studio-canvas-license__setup">
        Set <code>VITE_TLDRAW_LICENSE_KEY</code> before rebuilding Studio.
      </p>
    </section>
  );
}
