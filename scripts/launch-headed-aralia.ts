import { chromium } from 'playwright';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const PROFILE_DIR = path.join(os.homedir(), '.gemini', 'aralia-debug-profile');

async function main() {
  console.log(`🚀 Launching Headed Chromium with Playwright`);
  console.log(`👤 User Data Directory: ${PROFILE_DIR}`);
  console.log(`🔌 Remote Debugging Port: 9222`);
  
  if (!fs.existsSync(PROFILE_DIR)) {
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
  }

  // Launch persistent context in headed mode
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1366, height: 768 },
    args: [
      '--remote-debugging-port=9222',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();
  
  console.log('🔗 Navigating to Aralia RPG dev server (http://localhost:3001/Aralia/)...');
  await page.goto('http://localhost:3001/Aralia/', { waitUntil: 'domcontentloaded' });
  
  console.log('✅ Browser launched and navigated successfully!');
  console.log('👉 Keep this terminal open to keep the browser running.');
  console.log('👉 Chrome DevTools MCP can now connect to port 9222.');
  console.log('👉 Press Ctrl+C in this terminal to close the browser.');

  // Keep the process alive
  await new Promise(() => {});
}

main().catch((error) => {
  console.error('❌ Failed to launch browser:', error);
  process.exit(1);
});
