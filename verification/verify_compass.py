
from playwright.sync_api import sync_playwright

def verify_compass_pane():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to app
        page.goto('http://localhost:3000/Aralia/')

        # Wait for loading to finish and compass to appear
        # The compass is part of the main layout, so it should be there after load
        # Wait for a compass button to be visible
        page.wait_for_selector('button[aria-label="Move North"]')

        # Take screenshot of the compass area
        # We can try to locate the CompassPane container.
        # It has 'bg-gray-800 p-4 rounded-lg shadow-xl' classes
        compass = page.locator('button[aria-label="Move North"]').locator('xpath=../../..')

        compass.screenshot(path='verification/compass_pane.png')

        browser.close()

if __name__ == '__main__':
    verify_compass_pane()
