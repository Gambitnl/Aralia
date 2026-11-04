import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for Aralia RPG
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
    testDir: './tests',
    /* Only *.spec.ts files are Playwright tests. Vitest owns *.test.ts here (it
       excludes *.spec.ts); loading tests/VoxelLogic.test.ts made the whole run fail. */
    testMatch: '**/*.spec.ts',
    /* Run tests in files in parallel */
    fullyParallel: true,
    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,
    /* Retry on CI only */
    retries: process.env.CI ? 2 : 0,
    /* Opt out of parallel tests on CI. */
    workers: process.env.CI ? 1 : undefined,
    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: [
        ['html', { outputFolder: 'playwright-report' }],
        ['list'],
    ],
    /* Shared settings for all the projects below. */
    use: {
        // Use installed Chrome updates and keep its process sandbox enabled.
        channel: 'chrome',
        launchOptions: { chromiumSandbox: true },

        /* Base URL to use in actions like `await page.goto('/')`. */
        baseURL: 'http://localhost:3001/Aralia/',

        /* Collect trace when retrying the failed test. */
        trace: 'on-first-retry',

        /* Record video for all tests */
        video: 'on',

        /* Take screenshots on failure */
        screenshot: 'on',
    },

    /* Configure projects for major browsers */
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    /* Output folder for test artifacts */
    outputDir: 'test-results/',

    /* Run your local dev server before starting the tests */
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3001/Aralia/',
        reuseExistingServer: true,
        timeout: 120 * 1000,
    },
});
