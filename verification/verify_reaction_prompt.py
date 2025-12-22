
import time
from playwright.sync_api import sync_playwright

def verify_reaction_prompt():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            # Use port 3000 as seen in lsof output
            page.goto("http://localhost:3000")

            # Wait for app to load
            page.wait_for_selector("text=New Game", timeout=20000)

            page.screenshot(path="verification/app_running.png")
            print("Screenshot taken.")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_reaction_prompt()
