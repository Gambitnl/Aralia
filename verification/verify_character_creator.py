from playwright.sync_api import sync_playwright

def verify_character_creator():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the app (using port 4000)
        page.goto("http://localhost:4000")

        # Wait for the main menu or character creator load
        page.wait_for_timeout(2000)

        # Try to find "New Game" button first
        try:
            new_game_btn = page.get_by_role("button", name="New Game")
            if new_game_btn.is_visible():
                new_game_btn.click()
        except:
            pass

        # Wait for Character Creator to load.
        page.wait_for_timeout(2000)
        page.screenshot(path="verification/step1_initial_load.png")

        # Check if we are at "Select Your Class"
        if page.get_by_text("Select Your Class").is_visible():
             # Select a class, e.g., "Fighter"
             page.get_by_text("Fighter", exact=False).first.click()
             page.get_by_role("button", name="Select Fighter").click()

        # Check if we are at "Select Your Race"
        if page.get_by_text("Select Your Race").is_visible():
            # Verify "Ancestral Traits" in Race Detail Modal
            # Click a race, e.g., "Human"
            page.get_by_text("Human", exact=False).first.click()
            page.wait_for_timeout(500)
            page.screenshot(path="verification/step2_race_modal.png")

            # Select Human to proceed
            page.get_by_role("button", name="Select Human").click()

            # Handle sub-selection if any (Human has Skill Selection)
            try:
                page.get_by_role("button", name="Confirm Skills").click()
            except:
                pass

        # Now we should be at Ability Score Allocation
        page.wait_for_timeout(1000)
        page.screenshot(path="verification/step3_ability_scores.png")

        browser.close()

if __name__ == "__main__":
    verify_character_creator()
