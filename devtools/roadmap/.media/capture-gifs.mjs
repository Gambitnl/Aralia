/**
 * Roadmap node GIF capture script.
 * Usage: node devtools/roadmap/.media/capture-gifs.mjs
 * Records animated GIFs for interactive spell system roadmap nodes.
 * Requires: playwright, ffmpeg on PATH
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
  // Two-pass: generate palette then encode GIF for quality
  const paletteFile = videoPath.replace('.webm', '_palette.png');
  const vf = cropFilter ? `fps=12,${cropFilter},scale=700:-1:flags=lanczos` : `fps=12,scale=700:-1:flags=lanczos`;
  execSync(
    `ffmpeg -y -i "${videoPath}" -vf "${vf},palettegen" "${paletteFile}"`,
    { stdio: 'pipe' }
  );
  execSync(
    `ffmpeg -y -i "${videoPath}" -i "${paletteFile}" -filter_complex "${vf} [x]; [x][1:v] paletteuse" "${outputPath}"`,
    { stdio: 'pipe' }
  );
  try { unlinkSync(paletteFile); } catch { /* ignore */ }
  console.log(`✓ GIF saved: ${outputPath}`);
}

async function captureVsmDrillDown() {
  // GIF: VSM Drill-Down Navigator
  // Show: clicking Casting Time → bonus_action, then School → Evocation, axes update live
  const ctx = await chromium.launchPersistentContext('', {
    headless: true,
    recordVideo: { dir: VIDEO_TMP, size: { width: 900, height: 700 } },
  });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 900, height: 700 });

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Switch to Spell Branch
  await page.locator('button').filter({ hasText: /^spell branch$/i }).first().click();
  await page.waitForTimeout(1500);

  // Pause on the full navigator so viewer sees the initial state
  await page.waitForTimeout(1200);

  // Click bonus_action in Casting Time
  await page.locator('button').filter({ hasText: /^bonus.action/i }).first().click();
  await page.waitForTimeout(1000);

  // Click Evocation in School (button text is "Evocation10" — label+count concat)
  await page.locator('button').filter({ hasText: /^Evocation/i }).first().click();
  await page.waitForTimeout(1200);

  // Pause on the filtered result to show the outcome
  await page.waitForTimeout(1000);

  const videoPath = join(VIDEO_TMP, 'vsm-drilldown.webm');
  await ctx.close();

  // Find the recorded video file (playwright names it automatically)
  const files = readdirSync(VIDEO_TMP).filter(f => f.endsWith('.webm'));
  if (!files.length) throw new Error('No video recorded');
  const recorded = join(VIDEO_TMP, files[0]);

  // Crop to top portion (axes area) — full width, top 600px
  toGif(recorded, join(MEDIA_DIR, 'sub_pillar_dev_tools_roadmap_tool_spell_branch_navigator_vsm_drill_down_navigator.gif'), 'crop=900:600:0:0');
  unlinkSync(recorded);
}

async function captureLiveAxisFiltering() {
  // GIF: Live Axis Filtering Engine (Spell Graph Overlay)
  // Show: expanding Spells node → overlay appears, clicking Casting Time → values with counts
  const ctx = await chromium.launchPersistentContext('', {
    headless: true,
    recordVideo: { dir: VIDEO_TMP, size: { width: 1400, height: 860 } },
  });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1400, height: 860 });

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Click Spells node on canvas
  const spellsNode = page.locator('button').filter({ hasText: /Spells/ }).first();
  await spellsNode.waitFor({ state: 'visible', timeout: 10000 });
  await spellsNode.click();
  await page.waitForTimeout(2000);

  // Click Casting Time in the overlay
  const castingTimeBtn = page.locator('button').filter({ hasText: /Casting Time/i }).first();
  if (await castingTimeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await castingTimeBtn.click();
    await page.waitForTimeout(1000);

    // Click bonus_action value
    const bonusActionBtn = page.locator('button').filter({ hasText: /^bonus.action/i }).first();
    if (await bonusActionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await bonusActionBtn.click();
      await page.waitForTimeout(1200);
    }
  }

  await page.waitForTimeout(800);

  await ctx.close();

  const files = readdirSync(VIDEO_TMP).filter(f => f.endsWith('.webm'));
  if (!files.length) throw new Error('No video recorded');
  const recorded = join(VIDEO_TMP, files[0]);

  // Crop to left side where overlay lives — e.g. left 700px, full height
  toGif(recorded, join(MEDIA_DIR, 'sub_pillar_dev_tools_roadmap_tool_spell_graph_navigation_live_axis_filtering_engine.gif'), 'crop=700:860:0:0');
  unlinkSync(recorded);
}

async function captureSpellBranchHandoff() {
  // GIF: Spell Branch Tab Handoff
  // Show: "Open in Spell Branch" clicked from graph overlay → tab switches, pre-seeded filter
  const ctx = await chromium.launchPersistentContext('', {
    headless: true,
    recordVideo: { dir: VIDEO_TMP, size: { width: 1400, height: 860 } },
  });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1400, height: 860 });

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Open Spells overlay
  const spellsNode = page.locator('button').filter({ hasText: /Spells/ }).first();
  await spellsNode.waitFor({ state: 'visible', timeout: 10000 });
  await spellsNode.click();
  await page.waitForTimeout(2000);

  // Drill into Casting Time → action
  const castingTimeBtn = page.locator('button').filter({ hasText: /Casting Time/i }).first();
  if (await castingTimeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await castingTimeBtn.click();
    await page.waitForTimeout(800);

    // Select "action" value → leads to "Show Spells" node
    const actionBtn = page.locator('button').filter({ hasText: /^action/i }).first();
    if (await actionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await actionBtn.click();
      await page.waitForTimeout(1000);
    }
  }

  // Click "Open in Spell Branch" button if visible
  const openBtn = page.getByText('Open in Spell Branch', { exact: false }).first();
  if (await openBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await openBtn.click();
    await page.waitForTimeout(2000);
  }

  await page.waitForTimeout(800);

  await ctx.close();

  const files = readdirSync(VIDEO_TMP).filter(f => f.endsWith('.webm'));
  if (!files.length) throw new Error('No video recorded');
  const recorded = join(VIDEO_TMP, files[0]);

  // Crop to top-right area: tab bar + button area
  toGif(recorded, join(MEDIA_DIR, 'sub_pillar_dev_tools_roadmap_tool_spell_graph_navigation_spell_branch_tab_handoff.gif'), null);
  unlinkSync(recorded);
}

async function main() {
  console.log('Capturing GIF 1: VSM Drill-Down Navigator...');
  await captureVsmDrillDown();

  console.log('Capturing GIF 2: Live Axis Filtering Engine...');
  await captureLiveAxisFiltering();

  console.log('Capturing GIF 3: Spell Branch Tab Handoff...');
  await captureSpellBranchHandoff();

  console.log('\nAll GIF captures done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
