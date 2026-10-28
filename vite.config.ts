import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './', // relative asset paths: the build works from any folder or bucket prefix
  test: { globals: true, include: ['tests/**/*.test.ts'] },
});
