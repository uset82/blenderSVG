const key = process.env.VITE_TLDRAW_LICENSE_KEY?.trim() ?? "";
const allowMissing = process.env.KURVA_ALLOW_MISSING_TLDRAW_LICENSE === "1";
const ci = process.env.CI === "true" || process.env.CI === "1";

if (key || allowMissing || !ci) {
  if (!key && !ci) {
    console.warn(
      "build:web: VITE_TLDRAW_LICENSE_KEY is empty. The canvas shows the setup notice until a key is provided."
    );
  }
  process.exit(0);
}

console.error(
  "build:web refuses to build in CI without VITE_TLDRAW_LICENSE_KEY. Set KURVA_ALLOW_MISSING_TLDRAW_LICENSE=1 for a local development build."
);
process.exit(1);
