from playwright.sync_api import Page, expect, sync_playwright
import time

def verify_glossary_styling(page: Page):
    print("Navigating to app...")
    page.goto("http://localhost:3000/Aralia/")

    # Wait for app to settle
    page.wait_for_timeout(5000)

    # Try to find "System" button and click it
    print("Looking for System button...")
    system_btn = page.get_by_text("System")
    if system_btn.count() > 0:
        print("Found System button. Clicking...")
        system_btn.click()
        page.wait_for_timeout(1000) # Wait for menu to open

        # Now look for Glossary in the menu
        print("Looking for Glossary option in System menu...")
        glossary_opt = page.get_by_text("Glossary") # Or "Game Glossary"
        if glossary_opt.count() > 0:
             print("Found Glossary option. Clicking...")
             glossary_opt.click()
        else:
             print("Glossary option not found in System menu.")
             # Check for "Compendium" or similar?
             # Check for Dev Menu?
             dev_opt = page.get_by_text("Dev Tools")
             if dev_opt.count() > 0:
                 print("Found Dev Tools. Maybe Glossary is there?")
    else:
        print("System button not found.")

    # Wait for glossary modal
    print("Waiting for Glossary modal...")
    try:
        glossary_modal = page.locator("[role='dialog'][aria-labelledby='glossary-title']")
        glossary_modal.wait_for(state="visible", timeout=5000)
        print("Glossary modal appeared.")

        # Check for resize handles styling
        handle = page.locator(".cursor-nwse-resize").first
        if handle.count() > 0:
            class_attr = handle.get_attribute("class")
            print(f"Handle classes: {class_attr}")

            if "select-none" in class_attr and "pointer-events-auto" in class_attr:
                print("SUCCESS: Utility classes found.")
            else:
                print("FAILURE: Utility classes NOT found.")

            style_attr = handle.get_attribute("style") or ""
            print(f"Handle style: {style_attr}")

            if "userSelect" not in style_attr and "pointerEvents" not in style_attr:
                print("SUCCESS: Inline styles removed.")
            else:
                print("FAILURE: Inline styles still present.")
        else:
            print("FAILURE: Resize handle not found.")

        page.screenshot(path="verification/glossary_verification.png")
        print("Final screenshot saved.")

    except Exception as e:
        print(f"Error waiting for glossary: {e}")
        page.screenshot(path="verification/error_state.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_glossary_styling(page)
        finally:
            browser.close()
