import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Each integration test file gets its own throwaway SQLite file, so files
    // may run in parallel but tests inside a file run sequentially.
    sequence: { concurrent: false },
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      // Entry points, one-shot scripts and pure type declarations carry no
      // behaviour worth asserting on.
      exclude: ['src/server.ts', 'src/db/seed.ts', 'src/db/migrate.ts', '**/*.d.ts'],
    },
  },
});
