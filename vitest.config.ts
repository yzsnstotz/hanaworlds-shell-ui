import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.client.spec.tsx'],
    setupFiles: ['test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
})
