import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**"],
      exclude: ["src/server.ts", "src/db.ts", "src/**/*.test.*"],
      thresholds: { lines: 50, functions: 50, branches: 50, statements: 50 },
    },
  },
});
