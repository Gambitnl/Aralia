# Plan: Adding a Settings Menu to Aralia

This document outlines the plan to add a **Settings Menu** to the game. This feature will allow you to customize your experience, starting with the ability to turn off animations.

## What is the Goal?

We want to give you control over how the game looks and feels. Specifically, we want to let you disable "animations" (the smooth movements when windows open or close) if you prefer a faster, snappier interface or if motion makes you uncomfortable.

## The Solution: A New Settings Screen

We will build a new pop-up window (often called a "Modal") that acts as your control panel.

### 1. Where will I find it?

You will be able to access this new menu from two places:

1.  **The Main Menu:** When you first start the game, right below the "Glossary" button, there will be a new button labeled **"Settings"**.
2.  **The In-Game System Menu:** While you are playing, if you click the "System" button (the menu that has Save, Load, etc.), you will see a new **"Settings"** option there too.

### 2. What will it look like?

When you click "Settings", a small window will appear in the center of the screen. It will have:
*   A title saying **"Settings"**.
*   A close button (an 'X') in the corner to leave.
*   A list of options (currently just one).
*   A **"Done"** button at the bottom to save your changes and close the window.

### 3. The "Enable Animations" Option

Inside the window, you will see a row for **"Enable Animations"**.
*   Next to it will be a switch (a toggle).
*   **ON (Green/Right):** Animations are active. Windows fade in and out smoothly.
*   **OFF (Gray/Left):** Animations are disabled. Windows appear and disappear instantly.

## Technical Explanation (Simplified)

To make this work, we need to update the game's "memory" (State) to remember your choice.

1.  **Remembering the Choice:** We will add a small note in the game's brain that says `enableAnimations: true` (Yes) or `false` (No).
2.  **The Switch:** We will create the visual switch that changes this note from Yes to No.
3.  **The Listener:** We will teach the existing windows (like the "Save Game" confirmation or the "Load Game" screen) to check this note before they open.
    *   If the note says **Yes**, they will perform their usual fade-in dance.
    *   If the note says **No**, they will skip the dance and appear immediately.

## Why is this good?

*   **Comfort:** Some players get motion sickness from too much movement on screen. This helps them.
*   **Speed:** Players who want to move very fast through menus can turn off animations to save milliseconds.
*   **Control:** It lays the groundwork for adding more settings later, like volume controls or text size.
