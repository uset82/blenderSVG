import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
    environment: "node",
    globals: false,
    include: ["packages/*/test/**/*.test.ts"],
    restoreMocks: true
  }
});
