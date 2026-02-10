import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Resolve absolute path to profile
const profileDir = path.resolve(process.cwd(), '.chrome-gemini-profile');

// Ensure it exists
if (!fs.existsSync(profileDir)) {
  fs.mkdirSync(profileDir, { recursive: true });
}

console.log(`🚀 Launching Chrome with Debug Port 9222`);
console.log(`👤 User Data Directory: ${profileDir}`);

// Determine Chrome executable path based on OS
let chromePath = '';
const platform = os.platform();

if (platform === 'win32') {
  const suffixes = [
    process.env.LOCALAPPDATA &&
      path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.PROGRAMFILES &&
      path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env['PROGRAMFILES(X86)'] &&
      path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe')
  ].filter(Boolean);
  chromePath = suffixes.find(p => fs.existsSync(p)) || 'chrome';
} else if (platform === 'darwin') {
  chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
} else {
  chromePath = 'google-chrome';
}

console.log(`Found Chrome at: ${chromePath}`);

const args = [
  '--remote-debugging-port=9222',
  `--user-data-dir=${profileDir}`,
  // Playwright <-> Chrome CDP can currently crash when Chrome attaches to certain
  // new/experimental target types (e.g. shared storage worklets). Disable the
  // feature to keep CDP stable for our Gemini automation.
  '--disable-features=SharedStorageAPI,SharedStorage',
  'https://gemini.google.com/app' // Open Gemini so consent/login can be completed in the debug profile.
];

const child = spawn(chromePath, args, { detached: true, stdio: 'ignore' });
child.unref();

console.log('Chrome launched in background.');
