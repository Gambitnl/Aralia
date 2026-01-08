/**
 * Gemini Browser Image Generation Server
 *
 * Connects to an existing Chrome instance to automate image generation
 * through gemini.google.com using your logged-in session.
 *
 * Setup:
 *   1. Launch Chrome with remote debugging:
 *      "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --profile-directory="Profile 3"
 *   2. Run: npx tsx scripts/gemini-browser-server.ts
 *
 * Then POST to http://localhost:3001/api/gemini-image with { prompt: "..." }
 */

import express from 'express';
import cors from 'cors';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';

const PORT = 3001;
const CHROME_DEBUG_URL = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9222';

const app = express();
app.use(cors());
app.use(express.json());

let browser: Browser | null = null;
let browserContext: BrowserContext | null = null;
let geminiPage: Page | null = null;

// Connect to existing Chrome instance via CDP
async function connectToBrowser(): Promise<void> {
  if (browser && browser.isConnected()) return;

  console.log('[Browser] Connecting to Chrome at', CHROME_DEBUG_URL);

  try {
    browser = await chromium.connectOverCDP(CHROME_DEBUG_URL);
    console.log('[Browser] Connected successfully!');

    const contexts = browser.contexts();
    console.log('[Browser] Contexts:', contexts.length);

    if (contexts.length > 0) {
      browserContext = contexts[0];
    }
  } catch (error) {
    console.error('[Browser] Failed to connect:', error);
    throw new Error(`Failed to connect to Chrome. Make sure Chrome is running with --remote-debugging-port=9222`);
  }
}

// Get or create a fresh Gemini page
async function getGeminiPage(forceNewChat: boolean = false): Promise<Page> {
  if (!browserContext) {
    await connectToBrowser();
  }

  // If we want a fresh chat, navigate to a new conversation
  if (forceNewChat && geminiPage && !geminiPage.isClosed()) {
    console.log('[Browser] Starting fresh Gemini chat...');

    // Click New chat button/link to ensure fresh conversation
    const newChatLink = await geminiPage.$('a:has-text("New chat"), button:has-text("New chat")');
    if (newChatLink) {
      console.log('[Browser] Clicking New chat link...');
      await newChatLink.click();
      await geminiPage.waitForTimeout(1000);
    } else {
      // Fallback: navigate to homepage
      await geminiPage.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded', timeout: 60000 });
    }

    // Verify we're on a fresh chat by waiting for "Create image" button
    try {
      await geminiPage.waitForSelector('button:has-text("Create image")', { timeout: 15000 });
      console.log('[Browser] Fresh chat homepage loaded');
    } catch {
      console.log('[Browser] Warning: Could not verify fresh chat page');
    }

    await geminiPage.waitForTimeout(500);
    return geminiPage;
  }

  // Check if we already have a usable page
  if (geminiPage && !geminiPage.isClosed()) {
    const url = geminiPage.url();
    if (url.includes('gemini.google.com')) {
      return geminiPage;
    }
  }

  // Find an existing Gemini page in our context
  const pages = browserContext!.pages();
  for (const page of pages) {
    const url = page.url();
    if (url.includes('gemini.google.com')) {
      console.log('[Browser] Found existing Gemini page');
      geminiPage = page;
      return page;
    }
  }

  // Create a new page and navigate to Gemini
  console.log('[Browser] Creating new Gemini page...');
  geminiPage = await browserContext!.newPage();
  await geminiPage.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Wait for the prompt input to be ready
  await geminiPage.waitForSelector('div[contenteditable="true"]', { timeout: 30000 });
  await geminiPage.waitForTimeout(500);
  return geminiPage;
}

// Generate image via Gemini web interface
async function generateImage(prompt: string): Promise<{ imageUrl: string }> {
  // Always start with a fresh chat to avoid grabbing old images
  const page = await getGeminiPage(true);

  console.log('[Generate] Starting image generation...');
  console.log('[Generate] Prompt:', prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''));

  // Click the "Create image" button to enable image generation mode
  console.log('[Generate] Enabling image mode...');
  const createImageButton = await page.$('button:has-text("Create image")');
  if (createImageButton) {
    await createImageButton.click();
    await page.waitForTimeout(500);
    console.log('[Generate] Image mode enabled');
  } else {
    console.log('[Generate] Create image button not found, proceeding anyway...');
  }

  // Find the prompt input - Gemini uses various selectors
  console.log('[Generate] Looking for prompt input...');
  const inputSelectors = [
    'div[contenteditable="true"]',
    'textarea[aria-label*="prompt" i]',
    '.ql-editor',
    'rich-textarea',
    '[data-placeholder*="Enter" i]'
  ];

  let promptInput = null;
  for (const selector of inputSelectors) {
    promptInput = await page.$(selector);
    if (promptInput) {
      console.log('[Generate] Found input with selector:', selector);
      break;
    }
  }

  if (!promptInput) {
    throw new Error('Could not find prompt input. Are you logged into Gemini?');
  }

  // Clear and type the prompt
  console.log('[Generate] Entering prompt...');
  await promptInput.click();
  await page.waitForTimeout(300);

  // Select all and delete to clear
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(200);

  // Type the prompt
  await page.keyboard.type(prompt, { delay: 20 });
  await page.waitForTimeout(500);

  // Find and click send button
  console.log('[Generate] Submitting prompt...');
  const sendSelectors = [
    'button[aria-label*="Send" i]',
    'button[aria-label*="Submit" i]',
    'button.send-button',
    '[data-testid="send-button"]',
    'button:has(svg[viewBox*="24"])'  // Common icon button pattern
  ];

  let sendButton = null;
  for (const selector of sendSelectors) {
    sendButton = await page.$(selector);
    if (sendButton) {
      const isEnabled = await sendButton.isEnabled();
      if (isEnabled) {
        console.log('[Generate] Found send button with selector:', selector);
        break;
      }
    }
    sendButton = null;
  }

  if (sendButton) {
    await sendButton.click();
  } else {
    // Fallback to Enter key
    console.log('[Generate] No send button found, using Enter key');
    await page.keyboard.press('Enter');
  }

  // Wait for image generation
  console.log('[Generate] Waiting for image to generate (up to 120s)...');

  try {
    // Wait for an actual large image to appear (not just the Download button)
    await page.waitForFunction(
      () => {
        const images = Array.from(document.querySelectorAll('img[src*="googleusercontent.com"], img[src*="lh3.google"]'));
        return images.some(img => {
          const rect = (img as HTMLElement).getBoundingClientRect();
          return rect.width > 200 && rect.height > 200;
        });
      },
      { timeout: 120000 }
    );
    console.log('[Generate] Image detected!');
  } catch {
    throw new Error('Timeout waiting for image generation (120s)');
  }

  // Give it a moment to fully render
  await page.waitForTimeout(1000);

  // Extract the image URL
  console.log('[Generate] Extracting image URL...');

  const imageUrl = await page.evaluate(() => {
    const images = Array.from(document.querySelectorAll('img[src*="googleusercontent.com"], img[src*="lh3.google"]'));
    const largeImages = images.filter(img => {
      const rect = (img as HTMLElement).getBoundingClientRect();
      return rect.width > 200 && rect.height > 200;
    });
    const lastImage = largeImages[largeImages.length - 1] as HTMLImageElement | undefined;
    if (lastImage?.src) {
      // Get full resolution by removing size constraints
      let url = lastImage.src;
      url = url.replace(/=w\d+-h\d+.*$/, '=s0');
      url = url.replace(/=s\d+(-rj)?$/, '=s0');
      return url;
    }
    return null;
  });

  if (!imageUrl) {
    throw new Error('Could not find generated image. The generation may have failed or returned text instead.');
  }

  console.log('[Generate] Found image URL, fetching full resolution...');

  // Fetch the image using the browser's authenticated context
  const response = await page.context().request.get(imageUrl);

  if (!response.ok()) {
    throw new Error(`Failed to fetch image: ${response.status()}`);
  }

  const imageBuffer = await response.body();

  // Generate a unique filename
  const timestamp = Date.now();
  const filename = `gemini-${timestamp}.png`;
  const filepath = path.join(generatedDir, filename);

  // Save the image
  console.log('[Generate] Saving image to:', filename);
  fs.writeFileSync(filepath, imageBuffer);

  console.log('[Generate] Success! Saved', imageBuffer.length, 'bytes to:', filename);

  // Return the local URL that can be served by the app
  return {
    imageUrl: `/generated/${filename}`,
    localPath: filepath
  };
}

// API endpoint
app.post('/api/gemini-image', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid prompt' });
  }

  if (prompt.length > 2000) {
    return res.status(400).json({ error: 'Prompt too long (max 2000 characters)' });
  }

  try {
    const result = await generateImage(prompt);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Error:', message);
    res.status(500).json({ error: message });
  }
});

// Health check
app.get('/health', async (req, res) => {
  let browserStatus = 'not connected';
  try {
    if (browser && browser.isConnected()) {
      browserStatus = 'connected';
    }
  } catch {
    browserStatus = 'error';
  }

  res.json({
    status: 'ok',
    browser: browserStatus,
    chromeDebugUrl: CHROME_DEBUG_URL,
    timestamp: new Date().toISOString()
  });
});

// Serve generated images
const generatedDir = path.join(process.cwd(), 'generated');
if (!fs.existsSync(generatedDir)) {
  fs.mkdirSync(generatedDir, { recursive: true });
}
app.use('/generated', express.static(generatedDir));

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Gemini Browser Image Generation Server                   ║
╠════════════════════════════════════════════════════════════╣
║  Server:   http://localhost:${PORT}                          ║
║  Endpoint: POST /api/gemini-image { prompt: "..." }        ║
║  Health:   GET /health                                     ║
╠════════════════════════════════════════════════════════════╣
║  Chrome:   ${CHROME_DEBUG_URL}                       ║
╚════════════════════════════════════════════════════════════╝

Launch Chrome with your profile (Bobbenhouzer):
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --profile-directory="Profile 3"

Waiting for requests...
`);
});

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n[Shutdown] Disconnecting from browser...');
  if (browser) {
    browser.close();
  }
  process.exit(0);
});
