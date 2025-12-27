
import time
from playwright.sync_api import sync_playwright, expect

def verify_passive_scores():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        print("Navigating to app...")
        url = "http://localhost:3000/Aralia/"
        try:
            page.goto(url, timeout=20000)
        except Exception as e:
            print(f"Failed to load {url}: {e}")
            return

        print("Waiting for page load...")
        page.wait_for_timeout(3000)

        print("Checking for Menu button...")
        if page.get_by_text("Menu").is_visible():
            page.get_by_text("Menu").click()
            page.wait_for_timeout(500)

            # Use exact=True to avoid matching "Welcome... party"
            print("Clicking Party menu item...")
            page.get_by_text("Party", exact=True).click()
            page.wait_for_timeout(1000)

        # Now we hope the Party Pane is visible.
        # Look for "Dev Fighter".
        print("Looking for 'Dev Fighter'...")
        # Use exact match or role to avoid log text
        if page.get_by_role("button", name="Dev Fighter").is_visible():
             print("Found Dev Fighter button.")
             page.get_by_role("button", name="Dev Fighter").click()
        elif page.get_by_text("Dev Fighter", exact=True).is_visible():
            print("Found Dev Fighter text.")
            page.get_by_text("Dev Fighter", exact=True).click()
        else:
            print("Dev Fighter not found. Trying loose match...")
            # Try to click the first element with "Dev Fighter" that isn't the log
            # Or just click coordinates if we are desperate, but let's try get_by_role first
            pass

        # Wait for modal
        page.wait_for_timeout(1000)

        # Verify Character Sheet is open
        if page.get_by_role("dialog").is_visible():
            print("Character Sheet open.")

            # Check for our new section
            try:
                # We added "Senses" header.
                expect(page.get_by_text("Senses")).to_be_visible()
                expect(page.get_by_text("Passive Perception")).to_be_visible()
                print("Verified 'Senses' and 'Passive Perception' visible.")

                # Take screenshot
                print("Taking screenshot...")
                page.screenshot(path="verification/passive_scores.png")
            except Exception as e:
                print(f"Assertion failed: {e}")
                page.screenshot(path="verification/debug_assertion_failed.png")
        else:
            print("Character sheet did not open. Taking debug screenshot.")
            page.screenshot(path="verification/debug_failed_open_3.png")

        browser.close()

if __name__ == "__main__":
    verify_passive_scores()
