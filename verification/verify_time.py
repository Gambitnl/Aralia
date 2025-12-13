
from playwright.sync_api import sync_playwright

def verify_time_display():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to app - using port 3001 and base path /Aralia/
        page.goto('http://localhost:3001/Aralia/')

        try:
            # Wait for Navigation header (Compass pane)
            page.wait_for_selector('text=Navigation', timeout=15000)

            # Check for Time display
            page.wait_for_selector('text=Time:')
            # Day 1 is the starting day
            page.wait_for_selector('text=Day 1')

            # Open Pass Time Modal
            page.click('button[aria-label="Pass Time"]')

            # Wait for modal
            page.wait_for_selector('text=Pass Time', timeout=5000)

            # Check time in modal
            page.wait_for_selector('text=Current Time:')
            page.wait_for_selector('text=Day 1')

            # Screenshot
            page.screenshot(path='verification/time_check_success.png')
            print("Verification successful!")

        except Exception as e:
            print(f"Verification failed: {e}")
            page.screenshot(path='verification/error.png')
            raise e
        finally:
            browser.close()

if __name__ == '__main__':
    verify_time_display()
