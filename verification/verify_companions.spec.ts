
import { test, expect } from '@playwright/test';

test('verify companion reaction bubble', async ({ page }) => {
  // 1. Go to the main game page
  await page.goto('http://localhost:5173');

  // 2. Wait for game to load (skip main menu if dev mode)
  // If not dev mode, we might need to click "New Game".
  // Assuming dev mode is enabled or we can reach the game.

  const newGameButton = page.getByRole('button', { name: /New Game/i });
  if (await newGameButton.isVisible()) {
    await newGameButton.click();
    // Fill character creator quickly or skip
    // Check for "Skip" button
    const skipButton = page.getByRole('button', { name: /Skip/i });
    if (await skipButton.isVisible()) {
        await skipButton.click();
    }
  }

  // 3. Wait for game layout - using specific text found in CompassPane
  await expect(page.getByText('Current Position')).toBeVisible({ timeout: 15000 });

  // 4. Trigger a companion reaction
  // Plan B: The hook triggers randomly (70% chance) on location change.
  // Let's move a few times.

  for (let i = 0; i < 5; i++) {
      // Find the 'N' button in the compass grid
      const moveBtn = page.getByRole('button', { name: 'Move North', exact: true }).first();

      // If "Move North" is not found or hidden, try another direction
      if (!await moveBtn.isVisible()) {
          console.log('North button not visible, trying South');
          const moveSouth = page.getByRole('button', { name: 'Move South', exact: true }).first();
          if (await moveSouth.isVisible()) await moveSouth.click();
      } else {
          await moveBtn.click();
      }

      await page.waitForTimeout(1000); // Wait for reaction

      // Check for bubble - looking for the text from the hook "Another new place"
      const bubbleText = page.getByText('Another new place');
      if (await bubbleText.isVisible()) {
          console.log('Reaction bubble found!');
          break;
      }
  }

  // 5. Take screenshot
  await page.screenshot({ path: 'verification/companion_reaction.png' });
});
