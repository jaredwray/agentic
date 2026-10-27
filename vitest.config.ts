import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Skill folders ship their own Node test runners. Those files are catalog content,
    // not this package's suite.
    include: ['test/**/*.test.ts'],
  },
});
