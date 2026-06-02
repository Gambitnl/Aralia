/**
 * @file world-3d-ui-transition.spec.ts
 * Playwright round-trip: PLAYING compass Enter 3D → HUD visible → Atlas exit → layout back.
 *
 * Requires dev auto-start (local build with canUseDevTools). Skips when game-layout
 * does not appear within the timeout (e.g. CI without dev tools).
 */
import { test, expect } from '@playwright/test';
import { ENTRY_TRANSITION_BUDGET_MS } from '../src/components/World3D/transitionTiming';

const GAME_LAYOUT = '#game-layout';
const PERF_SLACK_MS = 800;

test.describe('World 3D UI transition (Plan 4 T11)', () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const dialog = page.locator('div[role="dialog"]');
    if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
      const close = page
        .locator('button[aria-label*="close"], button:has-text("Close"), button:has-text("×")')
        .first();
      if (await close.isVisible({ timeout: 1000 }).catch(() => false)) {
        await close.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }
  });

  test('compass Enter 3D → HUD → Atlas toggle returns to game layout', async ({ page }) => {
    const layout = page.locator(GAME_LAYOUT);
    const hasPlaying = await layout.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!hasPlaying, 'Dev PLAYING layout not available — enable dev tools or load a save');

    const enter3d = page.getByRole('button', { name: /Enter 3D World/i });
    await expect(enter3d).toBeVisible({ timeout: 10_000 });

    const t0 = Date.now();
    await enter3d.click();

    const hud = page.getByTestId('world-3d-hud');
    await expect(hud).toBeVisible({ timeout: ENTRY_TRANSITION_BUDGET_MS + PERF_SLACK_MS });

    const entryMs = Date.now() - t0;
    expect(entryMs).toBeLessThan(ENTRY_TRANSITION_BUDGET_MS + PERF_SLACK_MS);

    await page.getByTestId('hud-atlas-toggle').click();

    await expect(layout).toBeVisible({ timeout: 5000 });
    await expect(hud).toBeHidden({ timeout: 5000 });
  });

  test('3D movement updates atlas marker position after exit (W3DUI-25)', async ({ page }) => {
    const layout = page.locator(GAME_LAYOUT);
    const hasPlaying = await layout.isVisible({ timeout: 15_000 }).catch(() => false);
    test.skip(!hasPlaying, 'Dev PLAYING layout not available — enable dev tools or load a save');

    // 1. Enter 3D mode
    const enter3d = page.getByRole('button', { name: /Enter 3D World/i });
    await enter3d.click();

    const hud = page.getByTestId('world-3d-hud');
    await expect(hud).toBeVisible({ timeout: ENTRY_TRANSITION_BUDGET_MS + PERF_SLACK_MS });

    // 2. Exit back to Atlas immediately to get baseline marker position
    await page.getByTestId('hud-atlas-toggle').click();
    await expect(layout).toBeVisible({ timeout: 5000 });

    // 3. Wait for WorldAtlasStrip to appear and read marker position
    const atlasStrip = page.getByTestId('world-atlas-strip');
    await expect(atlasStrip).toBeVisible({ timeout: 5000 });
    
    // AtlasPlayerMarker is an absolute positioned div inside the strip
    const marker = atlasStrip.locator('.absolute.z-\\[3\\]').first();
    await expect(marker).toBeVisible({ timeout: 2000 });
    
    const initialLeft = await marker.evaluate(el => el.style.left);
    const initialTop = await marker.evaluate(el => el.style.top);
    expect(initialLeft).toBeTruthy();
    expect(initialTop).toBeTruthy();

    // 4. Enter 3D again
    await enter3d.click();
    await expect(hud).toBeVisible({ timeout: ENTRY_TRANSITION_BUDGET_MS + PERF_SLACK_MS });

    // 5. Simulate camera movement by dragging on the 3D canvas
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 5000 });
    
    // Pan the map camera
    const box = await canvas.boundingBox();
    if (box) {
      const startX = box.x + box.width / 2;
      const startY = box.y + box.height / 2;
      
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      // Move aggressively to ensure significant coordinate change
      await page.mouse.move(startX - 200, startY - 200, { steps: 10 });
      await page.mouse.up();
    }
    
    // Wait for the throttled dispatch (POSITION_DISPATCH_INTERVAL_MS is 100ms)
    await page.waitForTimeout(500);

    // 6. Exit back to Atlas
    await page.getByTestId('hud-atlas-toggle').click();
    await expect(layout).toBeVisible({ timeout: 5000 });

    // 7. Verify marker moved
    await expect(atlasStrip).toBeVisible({ timeout: 5000 });
    await expect(marker).toBeVisible({ timeout: 2000 });
    
    const newLeft = await marker.evaluate(el => el.style.left);
    const newTop = await marker.evaluate(el => el.style.top);
    
    // The position should have changed due to our pan
    expect(newLeft).not.toBe(initialLeft);
    expect(newTop).not.toBe(initialTop);
  });
});
