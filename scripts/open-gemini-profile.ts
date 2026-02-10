#!/usr/bin/env tsx
/**
 * Opens a persistent Playwright Chromium profile for Gemini login/consent setup.
 *
 * This is a one-time setup step for browser-automation-based image generation.
 */

import { chromium } from 'playwright';
import * as os from 'os';
import * as path from 'path';

const PROFILE_DIR = process.env.GEMINI_PROFILE_DIR
  || path.join(os.homedir(), '.gemini', 'gemini-browser-profile');

async function main() {
  console.log(`[open-gemini-profile] Using profile dir: ${PROFILE_DIR}`);
  console.log('[open-gemini-profile] Opening Gemini. Complete consent/login in the window.');
  console.log('[open-gemini-profile] Press Ctrl+C here when done.');

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();
  await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded' });

  const cleanup = async () => {
    try { await context.close(); } catch { /* ignore */ }
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Keep the process alive while the user interacts with the browser.
  await new Promise(() => {});
}

main().catch((e) => {
  console.error('[open-gemini-profile] Failed:', e);
  process.exit(1);
});

