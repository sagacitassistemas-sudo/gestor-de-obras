import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    testTimeout: 15000,          // 15s — testes de integração podem ser lentos
    hookTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['server.ts', 'src/middleware/**/*.ts'],
      exclude: ['node_modules', 'dist', 'tests']
    },
    clearMocks: true,
    restoreMocks: true
  }
});

