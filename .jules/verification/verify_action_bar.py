from playwright.sync_api import sync_playwright

def verify_free_action_indicator():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Navigate to the app
        page.goto("http://localhost:3000/Aralia/")

        # Wait for the app to load
        page.wait_for_selector('text=Aralia', timeout=10000)

        try:
            # Check if Menu is open
            # We look for "Dev Menu" text visible
            if not page.get_by_text("Dev Menu").is_visible():
                print("Menu not open, clicking 'Menu'...")
                page.get_by_role("button", name="Menu").click()
                page.wait_for_selector('text="Dev Menu"', timeout=5000)

            print("Clicking 'Dev Menu'...")
            # Use get_by_text instead of get_by_role in case the role is weird
            page.get_by_text("Dev Menu").click()

            print("Waiting for 'Battle Map Demo' button...")
            page.wait_for_selector('text="Battle Map Demo"', timeout=5000)

            print("Clicking 'Battle Map Demo'...")
            page.get_by_text("Battle Map Demo").click()

            print("Waiting for Battle Map actions...")
            page.wait_for_selector('h3:has-text("Actions")', timeout=20000)

            # Locate the Action Economy Bar
            action_bar = page.locator('div.bg-gray-800\/80').filter(has_text="Actions").first

            if action_bar.is_visible():
                action_bar.screenshot(path=".jules/verification/action_bar.png")
                print("Screenshot taken: .jules/verification/action_bar.png")
            else:
                page.screenshot(path=".jules/verification/full_page.png")
                print("Action bar not found, full page screenshot taken.")

        except Exception as e:
            print(f"Error during navigation: {e}")
            page.screenshot(path=".jules/verification/error_state_4.png")

        browser.close()

if __name__ == "__main__":
    verify_free_action_indicator()
