import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  test: {
    include: ["server/__tests__/**/*.test.ts"],
    globals: true,
    environment: "node",
    testTimeout: 30_000,
  },
});
