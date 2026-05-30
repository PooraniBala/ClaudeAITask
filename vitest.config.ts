import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'node',
    globals: true,
    fileParallelism: false,
    setupFiles: ['__tests__/setup.ts'],
    env: {
      DATABASE_URL:
        'postgresql://postgres:myadmin@localhost:5432/devpulse_test?schema=public',
      JWT_SECRET: 'test-secret-for-vitest-do-not-use-in-production',
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'istanbul',
      include: ['app/api/**', 'lib/**', 'components/**'],
      exclude: ['lib/prisma.ts', '**/*.d.ts', '**/node_modules/**'],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
})
