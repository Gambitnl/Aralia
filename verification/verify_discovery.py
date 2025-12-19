
from playwright.sync_api import sync_playwright
import time

def verify_discovery_modal():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            # Navigate to local dev server (port 3000 as seen in log)
            page.goto("http://localhost:3000/Aralia/")

            # Wait a bit for React to hydrate
            page.wait_for_timeout(3000)

            # Dump the text content to see where we are
            print("Page Content Snippet:", page.content()[:500])

            # Try a broader check for any text indicating the game is running
            if page.get_by_text("Aralia").count() > 0:
                print("Found 'Aralia' text.")

            if page.get_by_text("New Game").count() > 0:
                print("Found New Game button, clicking...")
                page.click("text=New Game")
            elif page.get_by_text("Continue").count() > 0:
                print("Found Continue button, clicking...")
                page.click("text=Continue")

            page.wait_for_timeout(5000)

            print("Taking screenshot...")
            page.screenshot(path="verification/game_view.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_discovery_modal()
