/**
 * @file character-creator-flow.spec.ts
 * Visual E2E tests for the Character Creator flow.
 * 
 * These tests walk through the complete character creation process,
 * taking screenshots at key steps and recording video of the entire flow.
 * The Human Fighter path also proves the final handoff reaches live gameplay
 * instead of only proving that screenshots were captured.
 * 
 * Run with: npx playwright test tests/character-creator-flow.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';

// ============================================================================
// Shared Test State Helpers
// ============================================================================
// These helpers keep the E2E run independent from local draft/save state and
// let the final assertion verify the same read-only state probe used by other
// Aralia browser audits.
// ============================================================================

type AraliaStateProbe = {
    phase?: string;
    partySize?: number;
    partyNames?: string[];
    error?: string | null;
    isLoading?: boolean;
};

const TEST_CHARACTER_NAME = 'Sir Testalot';

const clearBrowserRunStateBeforeAppBoot = async (page: Page) => {
    // Clear synchronous browser storage before React mounts so stale creator
    // drafts cannot silently replace the intended Human Fighter path.
    await page.addInitScript(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
    });
};

const clearBrowserRunStateAfterFirstLoad = async (page: Page) => {
    // Some local dev sessions can already have app storage attached before the
    // first script hook takes effect. Clear it again from the page itself, then
    // reload so the creator mounts from an empty draft.
    await page.evaluate(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'networkidle' });
};

const waitForCompletedGameplayState = async (page: Page) => {
    // Wait for App.tsx's read-only audit probe to report the game phase and
    // party roster created by the final Character Creator submit.
    const stateHandle = await page.waitForFunction(
        (characterName) => {
            const state = (window as Window & { __araliaState?: AraliaStateProbe }).__araliaState;
            const hasCreatedCharacter = state?.partyNames?.includes(characterName) ?? false;

            if (state?.phase === 'PLAYING' && state.partySize === 1 && hasCreatedCharacter && !state.isLoading && !state.error) {
                return state;
            }

            return null;
        },
        TEST_CHARACTER_NAME,
        { timeout: 15000 },
    );

    const finalState = await stateHandle.jsonValue() as AraliaStateProbe;

    // Assert the exact completion contract so a stuck creator, empty party, or
    // wrong character name fails before any screenshot can hide the regression.
    expect(finalState).toMatchObject({
        phase: 'PLAYING',
        partySize: 1,
        error: null,
        isLoading: false,
    });
    expect(finalState.partyNames).toContain(TEST_CHARACTER_NAME);
};

test.describe('Character Creator Visual E2E', () => {
    test.setTimeout(90000); // Give the full visible E2E flow enough room to finish.
    test.beforeEach(async ({ page }) => {
        await clearBrowserRunStateBeforeAppBoot(page);

        // Navigate to the app
        await page.goto('/');
        // Wait for the main menu to be visible
        await page.waitForLoadState('networkidle');
        await clearBrowserRunStateAfterFirstLoad(page);
        await expect(page.getByTestId('main-menu')).toBeVisible({ timeout: 10000 });

        // Handle any modal dialogs that might block interactions (like Ollama modal)
        const modalDialog = page.locator('div[role="dialog"]');
        if (await modalDialog.isVisible({ timeout: 3000 })) {
            // Try to find and click a close button
            const closeButton = page.locator('button[aria-label*="close"], button:has-text("Close"), button:has-text("×")').first();
            if (await closeButton.isVisible({ timeout: 1000 })) {
                await closeButton.click();
                await page.waitForTimeout(500);
            } else {
                // Try pressing Escape
                await page.keyboard.press('Escape');
                await page.waitForTimeout(500);
            }
        }
    });

    test('Complete Human Fighter creation flow', async ({ page }) => {
        // Take initial screenshot
        await page.screenshot({ path: 'test-results/screenshots/01-main-menu.png', fullPage: true });

        // Step 0: Handle Dev Mode Auto-Start if present
        // The app might load directly into the game. We need to go to Main Menu.
        const devModeIndicator = page.getByText(/Dev Mode|Welcome, Dev Fighter/i);
        if (await devModeIndicator.isVisible({ timeout: 2000 })) {
            console.log('Dev mode auto-start detected. Navigating to Main Menu...');
            // Click Menu button (bottom right usually, or burger menu)
            const menuButton = page.getByRole('button', { name: /Menu/i }).first();
            if (await menuButton.isVisible()) {
                await menuButton.click();
                await page.waitForTimeout(500);
                const mainMenuOption = page.getByRole('button', { name: /Main Menu/i });
                if (await mainMenuOption.isVisible()) {
                    await mainMenuOption.click();
                    await page.waitForTimeout(1000);
                }
            }
        }

        // Step 1: Click "Begin Legend" (New Game) to start character creation
        const beginLegendButton = page.getByRole('button', { name: /Begin Legend/i });
        if (await beginLegendButton.isVisible({ timeout: 5000 })) {
            await beginLegendButton.click();
        } else {
            // Fallback to "New Game" or similar if text changes
            const newGameButton = page.getByRole('button', { name: /New Game|Start Adventure/i }).first();
            if (await newGameButton.isVisible({ timeout: 3000 })) {
                await newGameButton.click();
            }
        }

        // Wait for character creator to load
        await expect(page.getByRole('heading', { name: /Choose Your Race/i })).toBeVisible({ timeout: 15000 });
        await page.screenshot({ path: 'test-results/screenshots/02-race-selection.png', fullPage: true });

        // Step 2: Select Human race
        const humanButton = page.getByRole('button', { name: /Human/i }).first();
        await expect(humanButton).toBeVisible({ timeout: 5000 });
        await humanButton.click();
        await page.waitForTimeout(500);

        // Expanding the Human family is not enough: choose the concrete Human
        // variant so later generic Confirm buttons cannot approve the default
        // Aasimar detail pane by accident.
        const humanVariantButton = page.getByRole('button', { name: /^Human$/ });
        await expect(humanVariantButton).toBeVisible({ timeout: 3000 });
        await humanVariantButton.click();

        // Confirm Human selection in the header.
        const selectHumanButton = page.getByRole('button', { name: /Confirm Human|Select Human/i });
        await expect(selectHumanButton).toBeVisible({ timeout: 3000 });
        await page.screenshot({ path: 'test-results/screenshots/03-human-detail-modal.png', fullPage: true });
        await selectHumanButton.click();
        await expect(page.getByRole('button', { name: /1\. Race: Human/i })).toBeVisible({ timeout: 5000 });

        await page.waitForTimeout(500);
        await page.screenshot({ path: 'test-results/screenshots/04-after-race.png', fullPage: true });

        // Step 3: Age Selection - just click Next
        const nextButton = page.getByRole('button', { name: /Next/i }).first();
        if (await nextButton.isVisible({ timeout: 3000 })) {
            await page.screenshot({ path: 'test-results/screenshots/05-age-selection.png', fullPage: true });
            await nextButton.click();
        }

        await page.waitForTimeout(500);

        // Step 4: Background Selection
        const soldierButton = page.getByRole('button', { name: /Soldier/i }).first();
        if (await soldierButton.isVisible({ timeout: 3000 })) {
            await page.screenshot({ path: 'test-results/screenshots/06-background-selection.png', fullPage: true });
            await soldierButton.click();
            await page.waitForTimeout(300);

            // Confirm the selected background explicitly; this step no longer
            // advances through a generic Next button.
            const confirmSoldierButton = page.getByRole('button', { name: /Confirm Soldier/i });
            await expect(confirmSoldierButton).toBeVisible({ timeout: 2000 });
            await confirmSoldierButton.click();
            await expect(page.getByRole('button', { name: /3\. Background: Soldier/i })).toBeVisible({ timeout: 5000 });
        }

        await page.waitForTimeout(500);

        // Step 5: Visuals Selection
        await page.screenshot({ path: 'test-results/screenshots/07-visuals-selection.png', fullPage: true });
        const nextAfterVisuals = page.getByRole('button', { name: /Next/i }).first();
        if (await nextAfterVisuals.isVisible({ timeout: 3000 })) {
            await nextAfterVisuals.click();
        }

        await page.waitForTimeout(500);

        // Step 6: Class Selection
        await page.screenshot({ path: 'test-results/screenshots/08-class-selection.png', fullPage: true });

        const fighterButton = page.getByRole('button', { name: /Fighter/i }).first();
        if (await fighterButton.isVisible({ timeout: 3000 })) {
            await fighterButton.click();
            await page.waitForTimeout(300);

            // Confirm Fighter selection if modal appears
            const selectFighterButton = page.getByRole('button', { name: /Select Fighter|Choose Fighter|Confirm/i });
            if (await selectFighterButton.isVisible({ timeout: 2000 })) {
                await page.screenshot({ path: 'test-results/screenshots/09-fighter-detail-modal.png', fullPage: true });
                await selectFighterButton.click();
            }
        }

        await page.waitForTimeout(500);

        // Step 7: Ability Scores
        await page.screenshot({ path: 'test-results/screenshots/10-ability-scores.png', fullPage: true });

        // Spend the point-buy pool using the class recommendation before
        // confirming. The flow intentionally blocks empty 8/8/8/8/8/8 scores.
        const applyFighterScoresButton = page.getByRole('button', { name: /Apply Fighter Recommended/i });
        await expect(applyFighterScoresButton).toBeVisible({ timeout: 3000 });
        await applyFighterScoresButton.click();

        const confirmScoresButton = page.getByRole('button', { name: /Confirm Attributes/i }).first();
        await expect(confirmScoresButton).toBeVisible({ timeout: 3000 });
        await confirmScoresButton.click();

        await page.waitForTimeout(500);

        // Step 8: Human Skill Choice (Human gets an extra skill)
        await page.screenshot({ path: 'test-results/screenshots/11-human-skill-choice.png', fullPage: true });

        // Human Skillful is rendered as skill buttons, not checkboxes. Pick one
        // visible skill card so the step's Confirm button becomes active.
        const humanSkillButton = page.getByRole('button', { name: /Perception/i });
        await expect(humanSkillButton).toBeVisible({ timeout: 2000 });
        await humanSkillButton.click();

        const confirmSkillButton = page.getByRole('button', { name: /Confirm Skill/i }).first();
        await expect(confirmSkillButton).toBeEnabled({ timeout: 2000 });
        await confirmSkillButton.click();

        await page.waitForTimeout(500);

        // Step 9: Skills Selection
        await page.screenshot({ path: 'test-results/screenshots/12-skills-selection.png', fullPage: true });

        // Pick two enabled class-skill choices that are not already granted by
        // the Soldier background or Human Skillful pick, proving the class-skill
        // requirement is actually met.
        for (const skillName of ['Arcana', 'Deception']) {
            const classSkillButton = page.getByRole('button', { name: new RegExp(`^${skillName}$`) });
            await expect(classSkillButton).toBeVisible({ timeout: 2000 });
            await classSkillButton.click();
            await page.waitForTimeout(200);
        }

        const confirmSkillsButton = page.getByRole('button', { name: /Confirm Skills/i }).first();
        await expect(confirmSkillsButton).toBeEnabled({ timeout: 2000 });
        await confirmSkillsButton.click();

        await page.waitForTimeout(500);

        // Step 10: Class Features (Fighting Style for Fighter)
        await page.screenshot({ path: 'test-results/screenshots/13-class-features.png', fullPage: true });

        // Select a fighting style
        const fightingStyleButton = page.getByRole('button', { name: /Defense|Archery|Dueling/i }).first();
        if (await fightingStyleButton.isVisible({ timeout: 2000 })) {
            await fightingStyleButton.click();
        }

        const confirmFeaturesButton = page.getByRole('button', { name: /Confirm|Next|Continue/i }).first();
        if (await confirmFeaturesButton.isVisible({ timeout: 2000 })) {
            await confirmFeaturesButton.click();
        }

        await page.waitForTimeout(500);

        // Step 11: Weapon Mastery
        await page.screenshot({ path: 'test-results/screenshots/14-weapon-mastery.png', fullPage: true });

        // Select weapon masteries
        const masteryCheckboxes = page.getByRole('checkbox');
        const masteryCount = await masteryCheckboxes.count();
        for (let i = 0; i < Math.min(3, masteryCount); i++) {
            const checkbox = masteryCheckboxes.nth(i);
            if (await checkbox.isVisible() && !(await checkbox.isChecked())) {
                await checkbox.click();
                await page.waitForTimeout(200);
            }
        }

        const confirmMasteryButton = page.getByRole('button', { name: /Confirm|Next|Continue/i }).first();
        if (await confirmMasteryButton.isVisible({ timeout: 2000 })) {
            await confirmMasteryButton.click();
        }

        await page.waitForTimeout(500);

        // Step 12: Origin Feat from Soldier background
        await page.screenshot({ path: 'test-results/screenshots/15-feat-selection.png', fullPage: true });

        // Soldier grants Savage Attacker, which has no extra choices; confirm
        // it explicitly so the Human racial feat step can follow.
        const confirmOriginFeatButton = page.getByRole('button', { name: /Confirm Feat/i }).first();
        await expect(confirmOriginFeatButton).toBeEnabled({ timeout: 3000 });
        await confirmOriginFeatButton.click();

        await page.waitForTimeout(500);

        // Step 12b: Human racial feat
        await expect(page.getByRole('heading', { name: /Racial Feat/i })).toBeVisible({ timeout: 5000 });

        // Pick a simple eligible feat with no extra choice UI. This keeps G5 on
        // final-state proof instead of expanding into feat subchoice coverage.
        const alertFeatButton = page.getByRole('button', { name: /^Alert\b/i });
        await expect(alertFeatButton).toBeVisible({ timeout: 3000 });
        await alertFeatButton.click();

        const confirmRacialFeatButton = page.getByRole('button', { name: /Confirm Feat/i }).first();
        await expect(confirmRacialFeatButton).toBeEnabled({ timeout: 3000 });
        await confirmRacialFeatButton.click();

        await page.waitForTimeout(500);

        // Step 13: Name and Review
        await expect(page.getByRole('heading', { name: /Name|Review/i })).toBeVisible({ timeout: 5000 });
        await page.screenshot({ path: 'test-results/screenshots/16-name-and-review.png', fullPage: true });

        // Enter character name
        const nameInput = page.getByRole('textbox', { name: /name/i }).first();
        if (await nameInput.isVisible({ timeout: 2000 })) {
            await nameInput.fill(TEST_CHARACTER_NAME);
        } else {
            // Try finding by placeholder
            const nameInputAlt = page.getByPlaceholder(/name/i).first();
            if (await nameInputAlt.isVisible({ timeout: 1000 })) {
                await nameInputAlt.fill(TEST_CHARACTER_NAME);
            }
        }

        await page.waitForTimeout(300);
        await page.screenshot({ path: 'test-results/screenshots/17-name-entered.png', fullPage: true });

        // Complete character creation
        // Match the actual final-submit control. A broad "Complete" regex can
        // accidentally hit sidebar step buttons whose names include "(completed)"
        // and navigate backward instead of starting the game.
        const createButton = page.getByRole('button', { name: /^Begin Adventure!?$/i });
        await expect(createButton).toBeVisible({ timeout: 3000 });
        await createButton.click();

        // The final submit must leave the creator and render the live
        // exploration UI. This visible check catches regressions where the
        // reducer state changes but the player never sees the adventure screen.
        await expect(page.getByTestId('game-layout')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('action-pane')).toBeVisible();
        await expect(page.getByTestId('world-pane')).toBeVisible();
        await waitForCompletedGameplayState(page);

        // Final screenshot - should be in the game now
        await page.screenshot({ path: 'test-results/screenshots/18-character-complete.png', fullPage: true });
    });

    test('Changeling Wizard creation flow (race with sub-selection)', async ({ page }) => {
        // This test covers a more complex path with race-specific sub-selections

        // Start character creation
        const newGameButton = page.getByRole('button', { name: /New Game/i });
        if (await newGameButton.isVisible({ timeout: 5000 })) {
            await newGameButton.click();
        }

        await page.waitForTimeout(1000);

        // Select Changeling
        const changelingButton = page.getByRole('button', { name: /Changeling/i }).first();
        if (await changelingButton.isVisible({ timeout: 5000 })) {
            await changelingButton.click();
            await page.waitForTimeout(500);

            // Confirm selection
            const selectChangelingButton = page.getByRole('button', { name: /Select Changeling/i });
            if (await selectChangelingButton.isVisible({ timeout: 2000 })) {
                await selectChangelingButton.click();
            }
        }

        await page.waitForTimeout(500);
        await page.screenshot({ path: 'test-results/screenshots/changeling-01-instincts.png', fullPage: true });

        // Changeling Instincts - select 2 skills
        const skillCheckboxes = page.getByRole('checkbox');
        const count = await skillCheckboxes.count();
        for (let i = 0; i < Math.min(2, count); i++) {
            const checkbox = skillCheckboxes.nth(i);
            if (await checkbox.isVisible()) {
                await checkbox.click();
                await page.waitForTimeout(200);
            }
        }

        // Confirm skills
        const confirmButton = page.getByRole('button', { name: /Confirm.*Skills|Next/i }).first();
        if (await confirmButton.isVisible({ timeout: 2000 })) {
            await confirmButton.click();
        }

        await page.waitForTimeout(500);
        await page.screenshot({ path: 'test-results/screenshots/changeling-02-after-instincts.png', fullPage: true });

        // Continue through the rest...
        console.log('Changeling creation flow - instincts step completed!');
    });
});

test.describe('Character Creator Accessibility', () => {
    test('All interactive elements are keyboard accessible', async ({ page }) => {
        await page.goto('/');

        // Start character creation
        const newGameButton = page.getByRole('button', { name: /New Game/i });
        if (await newGameButton.isVisible({ timeout: 5000 })) {
            await newGameButton.click();
        }

        await page.waitForTimeout(1000);

        // Tab through the race selection buttons
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

        // Take a screenshot showing focus state
        await page.screenshot({ path: 'test-results/screenshots/accessibility-focus.png', fullPage: true });

        // Press Enter to select the focused element
        await page.keyboard.press('Enter');

        await page.waitForTimeout(500);
        await page.screenshot({ path: 'test-results/screenshots/accessibility-after-enter.png', fullPage: true });
    });
});
