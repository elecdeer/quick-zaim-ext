import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'oauth',
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,js}'],
    exclude: ['node_modules/**', 'dist/**'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
})