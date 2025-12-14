
from playwright.sync_api import sync_playwright

def verify_game_time(page):
    # Port is 3000 according to vite.config.ts
    print("Navigating to http://localhost:3000/Aralia/")
    page.goto("http://localhost:3000/Aralia/")

    # Wait for "New Game" button
    print("Waiting for New Game button")
    page.screenshot(path="verification/debug_load.png")
    page.wait_for_selector("text=New Game", timeout=60000)

    # Click New Game
    print("Clicking New Game")
    page.click("text=New Game")

    # Check for "Skip Character Creator"
    try:
        if page.wait_for_selector("text=Skip Character Creator", timeout=5000):
            print("Clicking Skip Character Creator")
            page.click("text=Skip Character Creator")
    except:
        print("Skip Character Creator not found, proceeding...")

    # Wait for game to load (logs to appear)
    # The system message style is text-sky-300 italic
    print("Waiting for game logs")
    page.wait_for_selector(".text-sky-300.italic", timeout=60000)

    # Take a screenshot
    print("Taking final screenshot")
    page.screenshot(path="verification/game_time.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify_game_time(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
