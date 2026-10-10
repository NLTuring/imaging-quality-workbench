import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './src/features/hologram/tests',
  testMatch: '**/*.spec.ts',
  timeout: 45000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'artifacts/hologram/e2e-results.json' }]],
  outputDir: 'artifacts/hologram/test-results',
  webServer: { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI, timeout: 30000 },
  use: {
    channel: process.env.PW_CHANNEL || 'chrome',
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: { args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
});
