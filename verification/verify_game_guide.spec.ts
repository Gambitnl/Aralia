
import { test, expect } from '@playwright/test';

test('GameGuideModal loads and does not crash', async ({ page }) => {
  // 1. Navigate to the app (using port 3000 as per npm_output.log, with base path /Aralia/)
  await page.goto('http://localhost:3000/Aralia/');

  // 2. Click 'Menu' to open the system menu (based on error-context.md "button 'Menu'")
  await page.click('button:has-text("Menu")');

  // 3. Click 'Game Guide' to open the modal
  // We need to see what's in the menu. Usually it's "Game Guide" or similar.
  // Let's assume the menu expands and shows options.
  // If the previous test failed, it means "System" wasn't there.
  // The snapshot shows "Ask the Oracle" as a button in "Actions". This might be the guide?
  // Let's try clicking "Ask the Oracle" if it exists, or check the menu.

  // Wait, "Ask the Oracle" seems like a plausible name for the Game Guide feature in a fantasy RPG.
  // Let's try to find "Game Guide" inside the Menu first.

  // Wait for menu to open (if it's a dropdown)
  // Assuming the "Menu" button opens the options including Game Guide.

  // Alternatively, the prompt is "Ask the Oracle" -> generates guide response?
  // Let's try clicking "Ask the Oracle" directly if it's visible on the main screen.
  // The snapshot shows it under "Actions".

  // Check if "Ask the Oracle" triggers the GameGuideModal.
  // Or check if clicking "Menu" reveals "Game Guide".

  // Strategy: Try "Ask the Oracle" first as it's visible in the snapshot.
  const oracleButton = page.locator('button:has-text("Ask the Oracle")');
  if (await oracleButton.isVisible()) {
      await oracleButton.click();
  } else {
      // Fallback to Menu -> Game Guide
      await page.click('button:has-text("Menu")');
      await page.click('text=Game Guide'); // This text needs to be correct.
  }

  // 4. Verify the modal title
  const title = page.locator('#game-guide-title');
  await expect(title).toBeVisible();

  // 5. Interact with the chat input
  const input = page.locator('input[type="text"][class*="bg-gray-900"]');
  await expect(input).toBeVisible();

  // 6. Screenshot
  await page.screenshot({ path: 'verification/game_guide_modal.png' });
});
