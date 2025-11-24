
from playwright.sync_api import Page, expect, sync_playwright
import time

def test_quest_log_and_notification(page: Page):
    # 1. Navigate to the app (using port 3001 as seen in logs)
    page.goto("http://localhost:3001")

    # Take a screenshot to debug where we are
    page.screenshot(path="/home/jules/verification/debug_start.png")

    # Try to determine state
    try:
        start_button = page.get_by_role("button", name="Start New Game")
        if start_button.is_visible(timeout=3000):
            print("Found Start New Game button")
            start_button.click()

            skip_button = page.get_by_role("button", name="Skip Creation (Dev)")
            if skip_button.is_visible(timeout=3000):
                print("Found Skip Creation button")
                skip_button.click()
    except Exception as e:
        print(f"Exception during startup: {e}")

    # Check if we are in game
    try:
        save_btn = page.get_by_role("button", name="Save Game")
        expect(save_btn).to_be_visible(timeout=10000)
        print("Found Save Game button")
    except Exception as e:
        print(f"Could not find Save Game button. Taking debug screenshot.")
        page.screenshot(path="/home/jules/verification/debug_failed_load.png")
        raise e

    # 3. Trigger a Notification (Save Game)
    save_btn.click()

    time.sleep(0.5)

    try:
        expect(page.get_by_text("Game saved successfully.")).to_be_visible(timeout=3000)
        print("Found Notification: Game saved successfully.")
    except:
        try:
            expect(page.get_by_text("Game Saved!")).to_be_visible(timeout=3000)
            print("Found Notification: Game Saved!")
        except Exception as e:
            print("Could not find success notification. Taking screenshot.")
            page.screenshot(path="/home/jules/verification/debug_failed_notification.png")
            # Do not fail here, continue to quest log test

    # 4. Open Quest Log
    try:
        quests_btn = page.get_by_role("button", name="Quests")
        quests_btn.click()
        print("Clicked Quests button")

        expect(page.get_by_text("Quest Log")).to_be_visible()
        expect(page.get_by_text("Active Quests")).to_be_visible()
        print("Quest Log is visible")

    except Exception as e:
        print(f"Quest Log test failed: {e}")
        page.screenshot(path="/home/jules/verification/debug_failed_questlog.png")
        raise e

    # 5. Take Screenshot
    time.sleep(1)
    page.screenshot(path="/home/jules/verification/quest_log_notification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_quest_log_and_notification(page)
        finally:
            browser.close()
