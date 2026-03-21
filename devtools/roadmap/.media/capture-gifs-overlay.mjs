/**
 * GIF capture for graph overlay features using headful Playwright.
 * Uses non-headless mode to avoid rendering issues with the canvas overlay.
 * Usage: node devtools/roadmap/.media/capture-gifs-overlay.mjs
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEDIA_DIR = __dirname;
const VIDEO_TMP = join(MEDIA_DIR, '_video_tmp');
const BASE_URL = 'http://localhost:3010/Aralia/devtools/roadmap/roadmap.html';

if (!existsSync(VIDEO_TMP)) mkdirSync(VIDEO_TMP, { recursive: true });

function toGif(videoPath, outputPath, cropFilter) {
  const paletteFile = videoPath.replace('.webm', '_palette.png');
  const vf = cropFilter
    ? `fps=10,${cropFilter},scale=700:-1:flags=lanczos`
    : `fps=10,scale=700:-1:flags=lanczos`;
  execSync(`ffmpeg -y -i "${videoPath}" -vf "${vf},palettegen" "${paletteFile}"`, { stdio: 'pipe' });
  execSync(
    `ffmpeg -y -i "${videoPath}" -i "${paletteFile}" -filter_complex "${vf} [x]; [x][1:v] paletteuse" "${outputPath}"`,
    { stdio: 'pipe' }
  );
  try { unlinkSync(paletteFile); } catch { /* ignore */ }
}

function cleanVideoTmp() {
  for (const f of readdirSync(VIDEO_TMP)) {
    try { unlinkSync(join(VIDEO_TMP, f)); } catch { /* ignore */ }
  }
}

async function captureLiveAxisFiltering() {
  cleanVideoTmp();
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: ['--window-size=1400,900', '--window-position=0,0'],
    recordVideo: { dir: VIDEO_TMP, size: { width: 1400, height: 860 } },
  });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1400, height: 860 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Click Spells node
  const spellsNode = page.locator('button').filter({ hasText: /Spells/ }).first();
  await spellsNode.waitFor({ state: 'visible', timeout: 10000 });
  await spellsNode.click();
  await page.waitForTimeout(2500);

  // Dismiss tutorial if shown
  const dismiss = page.locator('button').filter({ hasText: /dismiss/i }).first();
  if (await dismiss.isVisible({ timeout: 1000 }).catch(() => false)) await dismiss.click();

  // Close the info panel that opens on Spells node click (it intercepts overlay clicks)
  const closePanel = page.locator('aside button').filter({ hasText: /^X$/ }).first();
  if (await closePanel.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closePanel.click();
    await page.waitForTimeout(500);
  }

  // Overlay shows axis buttons like "Casting Time▸ expand"
  const castingTimeBtn = page.locator('button').filter({ hasText: /Casting Time/i }).first();
  if (await castingTimeBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await castingTimeBtn.click();
    await page.waitForTimeout(1200);
    // After expansion, value buttons appear. They may be positioned outside viewport
    // due to the canvas transform wrapper — use evaluate() to bypass Playwright's
    // viewport restriction and fire the click directly on the DOM element.
    const bonusHandle = await page.locator('button').filter({ hasText: /bonus.action/i }).first().elementHandle();
    if (bonusHandle) {
      await page.evaluate(el => el.click(), bonusHandle);
      await page.waitForTimeout(1500);
    }
  }
  await page.waitForTimeout(800);

  const video = await page.video();
  await ctx.close();
  if (!video) throw new Error('No video recorded');
  const recorded = await video.path();

  const outputPath = join(MEDIA_DIR, 'sub_pillar_dev_tools_roadmap_tool_spell_graph_navigation_live_axis_filtering_engine.gif');
  // Crop to left portion where overlay renders
  toGif(recorded, outputPath, 'crop=700:860:0:0');
  console.log('✓ Live Axis Filtering Engine GIF saved');
  try { unlinkSync(recorded); } catch { /* ignore */ }
}

async function captureSpellBranchHandoff() {
  cleanVideoTmp();
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: ['--window-size=1400,900', '--window-position=0,0'],
    recordVideo: { dir: VIDEO_TMP, size: { width: 1400, height: 860 } },
  });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1400, height: 860 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Open overlay
  const spellsNode = page.locator('button').filter({ hasText: /Spells/ }).first();
  await spellsNode.waitFor({ state: 'visible', timeout: 10000 });
  await spellsNode.click();
  await page.waitForTimeout(2500);

  // Dismiss tutorial if shown
  const dismiss2 = page.locator('button').filter({ hasText: /dismiss/i }).first();
  if (await dismiss2.isVisible({ timeout: 1000 }).catch(() => false)) await dismiss2.click();

  // Close the info panel
  const closePanel2 = page.locator('aside button').filter({ hasText: /^X$/ }).first();
  if (await closePanel2.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closePanel2.click();
    await page.waitForTimeout(500);
  }

  // Overlay axis buttons have "▸ expand" suffix
  const castingTimeBtn2 = page.locator('button').filter({ hasText: /Casting Time/i }).first();
  if (await castingTimeBtn2.isVisible({ timeout: 4000 }).catch(() => false)) {
    await castingTimeBtn2.click();
    await page.waitForTimeout(1000);
    // Click "action" value (not bonus_action — action has most spells so it leads to "Show Spells")
    const actionHandle = await page.locator('button').filter({ hasText: /^action/i }).first().elementHandle();
    if (actionHandle) {
      await page.evaluate(el => el.click(), actionHandle);
      await page.waitForTimeout(1500);
    }
  }

  // Click "Open in Spell Branch" button (may also be outside viewport)
  const openHandle = await page.getByText('Open in Spell Branch', { exact: false }).first().elementHandle().catch(() => null);
  if (openHandle) {
    await page.evaluate(el => el.click(), openHandle);
    await page.waitForTimeout(2500);
  }
  await page.waitForTimeout(500);

  const video = await page.video();
  await ctx.close();
  if (!video) throw new Error('No video recorded');
  const recorded = await video.path();

  const outputPath = join(MEDIA_DIR, 'sub_pillar_dev_tools_roadmap_tool_spell_graph_navigation_spell_branch_tab_handoff.gif');
  toGif(recorded, outputPath, null);
  console.log('✓ Spell Branch Tab Handoff GIF saved');
  try { unlinkSync(recorded); } catch { /* ignore */ }
}

async function main() {
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
