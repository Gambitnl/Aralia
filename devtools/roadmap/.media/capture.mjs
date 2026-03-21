/**
 * Roadmap node media capture script.
 * Usage: node devtools/roadmap/.media/capture.mjs
 * Captures static PNG screenshots for spell system roadmap nodes.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEDIA_DIR = __dirname;
const BASE_URL = 'http://localhost:3010/Aralia/devtools/roadmap/roadmap.html';

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 860 });

  console.log('Navigating to roadmap...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // ── Click SPELL BRANCH tab ───────────────────────────────────────────────
  const spellBranchBtn = page.getByText('SPELL BRANCH');
  await spellBranchBtn.click();
  await page.waitForTimeout(1500);

  console.log('On Spell Branch tab');

  // ── 1. Spell Profile Data Feed ───────────────────────────────────────────
  // Show: full navigator loaded with all axes and spell counts
  {
    const el = page.locator('text=Spell Branch').first();
    const box = await el.boundingBox();
    const clip = { x: 0, y: (box?.y ?? 30) - 10, width: 600, height: 580 };
    const buf = await page.screenshot({ clip });
    writeFileSync(join(MEDIA_DIR, 'sub_pillar_dev_tools_roadmap_tool_spell_branch_navigator_spell_profile_data_feed.png'), buf);
    console.log('✓ Spell Profile Data Feed');
  }

  // ── 2. Requirements Component Mapping ────────────────────────────────────
  // Show: Requirements axis with V/S/M human-readable labels
  {
    const el = page.getByText('Requirements', { exact: true }).first();
    await el.scrollIntoViewIfNeeded();
    const box = await el.boundingBox();
    if (box) {
      const clip = { x: 0, y: box.y - 8, width: 700, height: 80 };
      const buf = await page.screenshot({ clip });
      writeFileSync(join(MEDIA_DIR, 'sub_pillar_dev_tools_roadmap_tool_spell_branch_navigator_requirements_component_mapping.png'), buf);
      console.log('✓ Requirements Component Mapping');
    }
  }

  // ── 3. Axis Engine ────────────────────────────────────────────────────────
  // Show: axes with value counts after filtering (click Wizard to filter)
  {
    await page.getByText('Wizard', { exact: false }).first().click();
    await page.waitForTimeout(600);
    const el = page.locator('text=Spell Branch').first();
    const box = await el.boundingBox();
    const clip = { x: 0, y: (box?.y ?? 30) - 10, width: 600, height: 520 };
    const buf = await page.screenshot({ clip });
    writeFileSync(join(MEDIA_DIR, 'sub_pillar_dev_tools_roadmap_tool_spell_branch_navigator_axis_engine.png'), buf);
    console.log('✓ Axis Engine (post-Wizard filter)');
  }

  // ── Switch to ROADMAP tab for graph overlay captures ─────────────────────
  // Tab text is 'Roadmap' in the DOM (CSS transforms it to uppercase visually)
  await page.locator('button').filter({ hasText: /^roadmap$/i }).first().click();
  await page.waitForTimeout(3000);

  // Expand the Spells node — it's a canvas button containing "Spells" text
  const spellsNode = page.locator('button').filter({ hasText: /Spells/ }).first();
  await spellsNode.waitFor({ state: 'visible', timeout: 10000 });
  await spellsNode.click();
  await page.waitForTimeout(2000);

  // ── 4. Canvas-Coordinated Node Layout ─────────────────────────────────────
  // Show: graph overlay expanded, full canvas view showing depth columns
  {
    // Click first available axis in the overlay to expand a level
    const castingTimeBtn = page.locator('button').filter({ hasText: /Casting Time/i }).first();
    if (await castingTimeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await castingTimeBtn.click();
      await page.waitForTimeout(800);
      // Click first value to go another level
      const firstValueBtn = page.locator('button').filter({ hasText: /action \[/i }).first();
      if (await firstValueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstValueBtn.click();
        await page.waitForTimeout(800);
      }
    }
    const buf = await page.screenshot();
    writeFileSync(join(MEDIA_DIR, 'sub_pillar_dev_tools_roadmap_tool_spell_graph_navigation_canvas_coordinated_node_layout.png'), buf);
    console.log('✓ Canvas-Coordinated Node Layout');
  }

  await browser.close();
  console.log('\nAll static captures done.');
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
