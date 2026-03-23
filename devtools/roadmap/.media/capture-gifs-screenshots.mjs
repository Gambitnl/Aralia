/**
 * GIF capture via screenshot stitching for graph overlay features.
 * Takes timed page.screenshot() calls during interaction, combines with ffmpeg.
 * Usage: node devtools/roadmap/.media/capture-gifs-screenshots.mjs
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync, unlinkSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEDIA_DIR = __dirname;
const FRAMES_DIR = join(MEDIA_DIR, '_frames_tmp');
const BASE_URL = 'http://localhost:3010/Aralia/devtools/roadmap/roadmap.html';

if (!existsSync(FRAMES_DIR)) mkdirSync(FRAMES_DIR, { recursive: true });

function cleanFrames() {
  for (const f of readdirSync(FRAMES_DIR)) {
    try { unlinkSync(join(FRAMES_DIR, f)); } catch { /* ignore */ }
  }
}

async function screenshotLoop(page, durationMs, intervalMs, prefix) {
  const frames = [];
  const end = Date.now() + durationMs;
  let i = 0;
  while (Date.now() < end) {
    const framePath = join(FRAMES_DIR, `${prefix}_${String(i).padStart(4, '0')}.png`);
    const buf = await page.screenshot();
    writeFileSync(framePath, buf);
    frames.push(framePath);
    i++;
    await page.waitForTimeout(intervalMs);
  }
  return frames;
}

function framesToGif(framesDir, prefix, outputPath, cropFilter) {
  const vfBase = cropFilter ? `${cropFilter},scale=700:-1:flags=lanczos` : `scale=700:-1:flags=lanczos`;
  const paletteFile = join(framesDir, `${prefix}_palette.png`);
  const pattern = join(framesDir, `${prefix}_%04d.png`);
  execSync(
    `ffmpeg -y -framerate 4 -i "${pattern}" -vf "${vfBase},palettegen" "${paletteFile}"`,
    { stdio: 'pipe' }
  );
  execSync(
    `ffmpeg -y -framerate 4 -i "${pattern}" -i "${paletteFile}" -filter_complex "${vfBase} [x]; [x][1:v] paletteuse" "${outputPath}"`,
    { stdio: 'pipe' }
  );
  try { unlinkSync(paletteFile); } catch { /* ignore */ }
}

async function captureLiveAxisFiltering() {
  cleanFrames();
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1400, height: 860 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Frame set A: roadmap showing Spells node (2 frames)
  for (let i = 0; i < 2; i++) {
    const buf = await page.screenshot();
    writeFileSync(join(FRAMES_DIR, `axis_${String(i).padStart(4, '0')}.png`), buf);
    await page.waitForTimeout(250);
  }

  // Click Spells node
  const spellBtn = page.locator('button').filter({ hasText: /Spells/ }).first();
  await spellBtn.click();
  await page.waitForTimeout(2000);

  // Close info panel
  const closePanel = page.locator('aside button').filter({ hasText: /^X$/ }).first();
  if (await closePanel.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closePanel.click();
    await page.waitForTimeout(500);
  }

  // Frame set B: overlay with axis choices (3 frames)
  let idx = 2;
  for (let i = 0; i < 3; i++) {
    const buf = await page.screenshot();
    writeFileSync(join(FRAMES_DIR, `axis_${String(idx++).padStart(4, '0')}.png`), buf);
    await page.waitForTimeout(300);
  }

  // Click Casting Time axis
  const castingTimeHandle = await page.locator('button').filter({ hasText: /Casting Time/i }).first().elementHandle();
  if (castingTimeHandle) {
    await page.evaluate(el => el.click(), castingTimeHandle);
    await page.waitForTimeout(1000);
  }

  // Frame set C: casting time expanded (3 frames)
  for (let i = 0; i < 3; i++) {
    const buf = await page.screenshot();
    writeFileSync(join(FRAMES_DIR, `axis_${String(idx++).padStart(4, '0')}.png`), buf);
    await page.waitForTimeout(300);
  }

  // Click bonus_action value
  const bonusHandle = await page.locator('button').filter({ hasText: /bonus.action/i }).first().elementHandle().catch(() => null);
  if (bonusHandle) {
    await page.evaluate(el => el.click(), bonusHandle);
    await page.waitForTimeout(1200);
  }

  // Frame set D: filtered result (3 frames)
  for (let i = 0; i < 3; i++) {
    const buf = await page.screenshot();
    writeFileSync(join(FRAMES_DIR, `axis_${String(idx++).padStart(4, '0')}.png`), buf);
    await page.waitForTimeout(300);
  }

  await browser.close();

  const outputPath = join(MEDIA_DIR, 'sub_pillar_dev_tools_roadmap_tool_spell_graph_navigation_live_axis_filtering_engine.gif');
  framesToGif(FRAMES_DIR, 'axis', outputPath, 'crop=700:860:0:0');
  console.log('✓ Live Axis Filtering Engine GIF saved');
}

async function captureSpellBranchHandoff() {
  cleanFrames();
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1400, height: 860 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Open overlay
  const spellBtn = page.locator('button').filter({ hasText: /Spells/ }).first();
  await spellBtn.click();
  await page.waitForTimeout(2000);

  // Close info panel
  const closePanel = page.locator('aside button').filter({ hasText: /^X$/ }).first();
  if (await closePanel.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closePanel.click();
    await page.waitForTimeout(500);
  }

  // Click Casting Time
  const ctHandle = await page.locator('button').filter({ hasText: /Casting Time/i }).first().elementHandle();
  if (ctHandle) {
    await page.evaluate(el => el.click(), ctHandle);
    await page.waitForTimeout(800);
  }

  // Click action value — it expands to show "Show Spells (359)" node
  const actionHandle = await page.locator('button').filter({ hasText: /^action/i }).first().elementHandle().catch(() => null);
  if (actionHandle) {
    await page.evaluate(el => el.click(), actionHandle);
    await page.waitForTimeout(1200);
  }

  // Frame set A: overlay state showing "Show Spells" node (3 frames)
  let idx = 0;
  for (let i = 0; i < 3; i++) {
    const buf = await page.screenshot();
    writeFileSync(join(FRAMES_DIR, `handoff_${String(idx++).padStart(4, '0')}.png`), buf);
    await page.waitForTimeout(300);
  }

  // Click "Show Spells" to open its info panel (which has "Open in Spell Branch" button)
  const showSpellsHandle = await page.locator('button').filter({ hasText: /Show Spells/i }).first().elementHandle().catch(() => null);
  if (showSpellsHandle) {
    await page.evaluate(el => el.click(), showSpellsHandle);
    await page.waitForTimeout(1000);
  }

  // Frame set B: info panel with "Open in Spell Branch" visible (2 frames)
  for (let i = 0; i < 2; i++) {
    const buf = await page.screenshot();
    writeFileSync(join(FRAMES_DIR, `handoff_${String(idx++).padStart(4, '0')}.png`), buf);
    await page.waitForTimeout(300);
  }

  // Click "Open in Spell Branch"
  const openHandle = await page.getByText('Open in Spell Branch', { exact: false }).first().elementHandle().catch(() => null);
  if (openHandle) {
    await page.evaluate(el => el.click(), openHandle);
    await page.waitForTimeout(2000);
  }

  // Frame set B: Spell Branch tab active with pre-filtered axes (4 frames)
  for (let i = 0; i < 4; i++) {
    const buf = await page.screenshot();
    writeFileSync(join(FRAMES_DIR, `handoff_${String(idx++).padStart(4, '0')}.png`), buf);
    await page.waitForTimeout(300);
  }

  await browser.close();

  const outputPath = join(MEDIA_DIR, 'sub_pillar_dev_tools_roadmap_tool_spell_graph_navigation_spell_branch_tab_handoff.gif');
  framesToGif(FRAMES_DIR, 'handoff', outputPath, null);
  console.log('✓ Spell Branch Tab Handoff GIF saved');
}

async function captureSpellBranchNavigatorOverview() {
  cleanFrames();
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Switch to Spell Branch tab
  await page.locator('button').filter({ hasText: /^spell branch$/i }).first().click();
  await page.waitForTimeout(1500);

  // Frame set A: full navigator, all axes visible (3 frames)
  let idx = 0;
  for (let i = 0; i < 3; i++) {
    const buf = await page.screenshot();
    writeFileSync(join(FRAMES_DIR, `sbn_${String(idx++).padStart(4, '0')}.png`), buf);
    await page.waitForTimeout(300);
  }

  // Click Wizard under Class to show filtering in action
  const wizardBtn = page.locator('button').filter({ hasText: /^Wizard$/i }).first();
  if (await wizardBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await wizardBtn.click();
    await page.waitForTimeout(1000);
  }

  // Frame set B: navigator filtered by Wizard (4 frames)
  for (let i = 0; i < 4; i++) {
    const buf = await page.screenshot();
    writeFileSync(join(FRAMES_DIR, `sbn_${String(idx++).padStart(4, '0')}.png`), buf);
    await page.waitForTimeout(300);
  }

  await browser.close();

  const outputPath = join(MEDIA_DIR, 'sub_pillar_dev_tools_roadmap_tool_spell_branch_navigator.gif');
  framesToGif(FRAMES_DIR, 'sbn', outputPath, null);
  console.log('✓ Spell Branch Navigator overview GIF saved');
}

async function main() {
  console.log('Capturing GIF: Spell Branch Navigator Overview...');
  await captureSpellBranchNavigatorOverview();

  console.log('Capturing GIF: Live Axis Filtering Engine...');
  await captureLiveAxisFiltering();

  console.log('Capturing GIF: Spell Branch Tab Handoff...');
  await captureSpellBranchHandoff();

  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
