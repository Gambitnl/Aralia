from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Port is 3000 based on lsof check
        page.goto("http://localhost:3000")

        # Wait for page load
        page.wait_for_timeout(3000)

        page.screenshot(path="verification/app_running.png")

        browser.close()

if __name__ == "__main__":
    run()
