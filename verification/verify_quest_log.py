from playwright.sync_api import sync_playwright, expect
import sys

def verify_quest_log():
    print("Starting QuestLog verification...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800}) # Larger viewport
        page = context.new_page()
        page.goto("http://localhost:4173/Aralia/")
        print("Page loaded")

        try:
            # Wait for ActionPane
            expect(page.get_by_text("Actions")).to_be_visible(timeout=10000)

            # Click Menu button
            menu_btn = page.get_by_role("button", name="Menu")
            if menu_btn.count() > 0:
                print("Clicking Menu button...")
                menu_btn.click()
                # Wait for Quests button to appear
                expect(page.get_by_text("Quests", exact=True)).to_be_visible()

            quest_btn = page.get_by_text("Quests", exact=True)

            if quest_btn.count() > 0:
                print("Clicking Quests button (by text)...")
                quest_btn.click()

                 # Check for modal header
                expect(page.get_by_text("Quest Log")).to_be_visible()
                print("Quest Log modal is visible!")
                page.screenshot(path="verification/quest_log.png")
                print("Screenshot saved.")

            else:
                 print("Quests button not found!")
                 # Debug: print all button texts
                 print("Visible buttons:")
                 for btn in page.get_by_role("button").all():
                     if btn.is_visible():
                         print(f"- {btn.inner_text()}")

                 page.screenshot(path="verification/failed_no_button_retry.png")

        except Exception as e:
            print(f"Error: {e}")

        browser.close()

if __name__ == "__main__":
    verify_quest_log()
