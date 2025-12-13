# Proposed Time System Refactor

## The Problem: The "Broken Clock" Effect

Imagine a group of friends trying to meet up, but everyone's watch is set to a different time. One person thinks it's 2:00 PM, another thinks it's 14:00, and a third is counting how many seconds have passed since breakfast. This is messy and leads to confusion.

Currently, our application (the "game") handles time in a similar way:
-   **Different Formats:** Some parts of the game show "Day 1, 7:00 AM", while others might show "1/1/351".
-   **Manual Math:** Every time we want to calculate how many days have passed, we do the math from scratch. It's like calculating your age by counting days on a calendar every single time someone asks.
-   **Repeated Code:** The same "time math" is written in many different places. If we ever want to change how time works (e.g., make a year longer), we'd have to find and fix it in a dozen places.

## The Solution: The "Town Clock" (Time Utility)

We want to build a single "Town Clock" that everyone looks at. In technical terms, this is a **Centralized Time Utility**.

Instead of every part of the game figuring out time on its own, they will all ask this new helper:
> "Hey, what time is it?"
> "Hey, please format this date nicely for me."

### Benefits
1.  **Consistency:** Every screen will show dates and times in the exact same way.
2.  **Simplicity:** We write the complicated math once, and everyone else just uses the answer.
3.  **Easy Updates:** If we want to change the date format later, we only change it in one place (the Town Clock), and the whole game updates automatically.

## The Plan: What We Will Change

We will create a new file called `src/utils/timeUtils.ts` (the Town Clock).

### 1. Centralizing the Start Time
Currently, the game's start date (Year 351, Month 0, Day 1) is "hardcoded" (written directly) into multiple files.
-   **Old Way:** `new Date(351, 0, 1, 7, 0, 0, 0)` appears in `appState.ts`, `CompassPane.tsx`, etc.
-   **New Way:** We define `GAME_START_TIME` once in our new file. Everyone else imports it.

### 2. Standardizing "Day" Calculation
To show "Day 5", the game currently subtracts the start time from the current time and does division math.
-   **Old Way:** `(current - start) / (1000 * 60 * 60 * 24)` (scary math looks bad and is prone to errors).
-   **New Way:** We create a function `getTimeSinceEpoch(date)` that does this math for us.

### 3. Consistent Formatting
We will create helper functions to make dates look pretty:
-   `formatGameDate(date)` -> Returns just the date (e.g., "1/1/351").
-   `formatGameTime(date)` -> Returns just the time (e.g., "7:00 AM").
-   `formatGameDateTime(date)` -> Returns both (e.g., "1/1/351, 7:00 AM").

### 4. Updating the Game Components
We will go through the "rooms" of our house (the game components) and tell them to look at the new Town Clock:
-   **Compass:** Used to calculate "Day X" manually. Now uses the new helper.
-   **Journal (Discovery Log):** Used to format dates raw. Now uses `formatGameDate`.
-   **Save/Load Screens:** Used to show when you saved. Now uses `formatGameDateTime` for a clean look.
-   **Main Menu:** Shows "Last Played" time using the new standard.

## Summary for Non-Techies
We are taking a messy system where everyone keeps their own time and replacing it with a single, reliable Master Clock. This doesn't change *how* the game plays, but it makes the code much cleaner, less buggy, and easier to improve in the future.
