import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30000, // Firebase emulator tests can be slow
    hookTimeout: 30000,
    environment: 'node',
  },
});
