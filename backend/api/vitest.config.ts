import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Every test file starts its own embedded Postgres and runs the migrations. With many files
    // starting at once on a laptop, that alone can pass Vitest's default 10 seconds.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
