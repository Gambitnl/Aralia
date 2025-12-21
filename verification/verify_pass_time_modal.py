from playwright.sync_api import sync_playwright, expect
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1280, 'height': 720})

        print("Navigating...")
        try:
            page.goto("http://localhost:5173/Aralia/", timeout=60000)
        except:
             page.goto("http://localhost:3001/Aralia/", timeout=60000)

        # Wait for loading to finish - wait for "Loading" to disappear
        print("Waiting for loading to finish (max 60s)...")
        try:
            page.get_by_text("Loading", exact=False).wait_for(state="hidden", timeout=60000)
        except:
            print("Loading screen might still be there or we missed it.")

        # Check if we are at main menu or already in game
        in_game = False
        try:
            # Look for the Pass Time button directly
            print("Checking for Pass Time button...")
            page.get_by_label("Pass Time").wait_for(timeout=5000)
            print("Detected active game session.")
            in_game = True
        except:
            print("Pass Time button not found yet.")

        if not in_game:
            print("At Main Menu (or loading), starting new game...")
            try:
                # Check for New Game button
                # Use a catch-all wait first to see what's on screen
                page.wait_for_timeout(2000)

                new_game_btn = page.get_by_role("button", name="Begin Legend")
                if new_game_btn.is_visible():
                    new_game_btn.click()
                    page.get_by_text("Character Identity").wait_for()
                    page.get_by_role("button", name="Use Premade").click()
                else:
                    # Maybe we are still loading?
                    print("New Game button not visible. Taking screenshot.")
                    page.screenshot(path="verification/stuck_state.png")

                print("Waiting for game interface...")
                page.get_by_label("Pass Time").wait_for(timeout=60000)
            except Exception as e:
                print(f"Failed to start game: {e}")
                page.screenshot(path="verification/failed_start.png")
                raise e

        # Now we are in game.
        print("Opening Pass Time modal...")
        page.get_by_label("Pass Time").click()

        # Wait for modal
        print("Waiting for modal...")
        modal = page.get_by_role("dialog", name="Pass Time")
        modal.wait_for()

        # Take screenshot of the modal open
        page.screenshot(path="verification/pass_time_modal_open.png")
        print("Screenshot taken")

        # Test Enter key confirm
        print("Testing Enter key...")
        page.get_by_label("Minutes").fill("30")
        page.keyboard.press("Enter")

        # Modal should close
        expect(modal).not_to_be_visible()

        print("Verification script completed successfully.")
        browser.close()

if __name__ == "__main__":
    run()
