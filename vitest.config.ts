import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
    environment: "node",
    globals: false,
    include: ["packages/*/test/**/*.test.ts", "apps/extension/test/**/*.test.ts"],
    restoreMocks: true
  }
});
