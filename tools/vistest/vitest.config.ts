import { defineConfig } from 'vitest/config';

// Capture safety tests use real HTTP and Vite services. Browser mocks would
// replace fetch and mix DOM/Node typed-array realms, obscuring stale transforms.
// This lane leaves the application's shared test environment unchanged.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tools/vistest/__tests__/*.test.ts'],
    maxWorkers: 1,
    testTimeout: 20_000,
  },
});
