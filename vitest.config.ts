import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
    environment: "node",
    globals: false,
    fileParallelism: false,
    include: [
      "packages/*/test/**/*.test.ts",
      "apps/extension/test/**/*.test.ts",
      "apps/studio/test/**/*.test.ts",
      "apps/studio/test/**/*.test.tsx",
      "apps/studio-server/test/**/*.test.ts",
      "apps/webview/test/**/*.test.tsx",
      "apps/desktop/test/**/*.test.ts"
    ],
    restoreMocks: true
  }
});
