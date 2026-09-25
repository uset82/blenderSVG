import { BrandMark } from "../components/BrandMark.js";
import { SUPPORTED_BROWSER_COPY } from "./browserSupport.js";

export function BrowserSupportNotice({ gaps }: { gaps: readonly string[] }) {
  return (
    <main className="studio-browser-support" aria-labelledby="studio-browser-support-title">
      <BrandMark className="studio-browser-support__mark" />
      <p className="studio-browser-support__eyebrow">Kurva</p>
      <h1 id="studio-browser-support-title">This browser can’t run Kurva</h1>
      <p>{SUPPORTED_BROWSER_COPY}</p>
      <p>This browser is missing:</p>
      <ul>
        {gaps.map((gap) => (
          <li key={gap}>{gap}</li>
        ))}
      </ul>
    </main>
  );
}
