import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// --- Helper to load .env manually ---
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          if (!process.env[key]) {
             process.env[key] = value;
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to load .env', e);
  }
}

async function callGemini(apiKey: string, prompt: string) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{
            parts: [{ text: prompt }]
        }]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`Gemini API Error: ${response.status} - ${errText}`);
            return `[API Error: ${response.status}]`;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return text || "[No response text found]";

    } catch (error) {
        console.error("Network Error calling Gemini:", error);
        return "[Network Error]";
    }
}

async function run() {
  loadEnv();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not found in .env or environment.');
    process.exit(1);
  }

  console.log('Starting Gemini Monitor (Fetch Mode)...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:4173/');
    
    // Handle Name Gate
    if (await page.isVisible('#nameGateInput')) {
      await page.fill('#nameGateInput', 'Gemini Agent');
      await page.click('#nameGateForm button[type="submit"]');
      console.log('Passed Name Gate.');
    } else {
       await page.fill('#nameInput', 'Gemini Agent');
    }

    // Initial state
    await page.waitForSelector('ul#messages');
    const knownMessages = await page.locator('ul#messages li').allTextContents();
    let lastCount = knownMessages.length;
    console.log(`Initial message count: ${lastCount}`);

    let silenceCounter = 0;
    const MAX_SILENCE = 10;
    const CHECK_INTERVAL_MS = 30000;

    while (silenceCounter < MAX_SILENCE) {
      console.log(`Waiting 30s... (Silence count: ${silenceCounter}/${MAX_SILENCE})`);
      await page.waitForTimeout(CHECK_INTERVAL_MS);

      const currentMessages = await page.locator('ul#messages li').allTextContents();
      const currentCount = currentMessages.length;

      if (currentCount > lastCount) {
        console.log('New message detected!');
        const rawText = currentMessages[currentCount - 1]; // Get last message
        
        // Check if I sent it (basic loop protection)
        if (rawText.includes('Gemini Agent:')) {
            console.log("Ignoring my own message.");
            lastCount = currentCount;
            continue;
        }

        console.log(`User said: ${rawText}`);
        const userContent = rawText.replace(/.*?:\s*/, '');

        // Generate AI Response
        const responseText = await callGemini(apiKey, `You are a helpful AI assistant in a chat room. A user just said: "${userContent}". Respond briefly and naturally.`);
        
        await page.fill('#messageInput', responseText);
        await page.click('#composer button[type="submit"]');
        console.log(`Responded: ${responseText}`);

        // Wait for update
        await page.waitForTimeout(1000);
        const updatedMessages = await page.locator('ul#messages li').allTextContents();
        lastCount = updatedMessages.length;
        
        silenceCounter = 0; 
      } else {
        console.log('No new messages.');
        silenceCounter++;
      }
    }

    console.log('Limit reached. Stopping monitor.');

  } catch (error) {
    console.error('Error in monitor:', error);
  } finally {
    await browser.close();
  }
}

run();
