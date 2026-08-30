import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // Serialize test file execution: tests/setup.ts runs
    // `prisma db push --force-reset` against a shared SQLite file
    // (prisma/test.db) in beforeAll. Vitest's default file parallelism
    // runs multiple test files in separate workers, which race that
    // command against the same file and fail with "database is locked".
    fileParallelism: false,
  },
});
