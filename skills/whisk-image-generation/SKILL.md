---
name: whisk-image-generation
description: Generate D&D character images using Google Gemini or Whisk via manual browser automation (DevTools MCP).
---
# Image Generation Skill (Gemini & Whisk)

Use this skill to generate character art using Google's AI tools. This approach uses the unified `image-gen` MCP server or the agent's native `devtools` tools to drive the browser.

## Prerequisites
- **Chrome Browser**: Must be running with remote debugging enabled.
  - **Command**: `Start-Process "chrome.exe" -ArgumentList "--remote-debugging-port=9222", "--user-data-dir=""$HOME\.gemini\whisk-browser-profile""", "https://gemini.google.com/app"`
- **Unified MCP Server**: The project uses `scripts/image-gen-mcp.ts` to automate these workflows via `mcp-cli`.
  - **Server Name**: `image-gen`
  - **Tools**: `generate_image`, `download_image`

## Core Learnings & Obstacles
- **Whisk vs. Gemini**: Whisk (labs.google) is highly reactive and often ignores automated clicks. **Gemini (gemini.google.com) is much more stable** and is the default provider for the unified tool.
- **Automation**: Use `npm run mcp call image-gen/generate_image '{"prompt": "..."}'` for automated generation.
- **Profile Locking**: If the browser won't connect or the script crashes, Chrome might have a lock on the profile. 
  - **Solution**: Run `taskkill /F /IM chrome.exe /T` and then delete the lock file: `Remove-Item "$HOME\.gemini\whisk-browser-profile\SingletonLock" -Force`.
- **Dynamic UIDs**: Never rely on `uid=XX_YY` from snapshots for long-term logic. They change every time the page updates. Use **Attribute-Based Selectors** (e.g., `button[aria-label="Send message"]`).
- **One-Turn Search & Generate**: Gemini can handle "Search then Generate" in a single prompt. This is faster and more accurate than doing it in two steps.

## Workflow

### 1. Launch & Connect
1.  Kill any existing Chrome instances.
2.  Clear the `SingletonLock` if necessary.
3.  Launch Chrome to `https://gemini.google.com/app`.
4.  Use `list_pages` and `select_page` to focus the tab.

### 2. Optimized Prompting (The "Neutral" Strategy)
Avoid leading prompts. Let the AI find the canon details first.
- **Template**: 
  > "Search for detailed information on the [Race] race from canon D&D 5e sources. Focus on: physical appearance in great detail (skin, build, features), typical habitat/environment, and typical clothing/armor style. Using this information, generate a high-quality, detailed fantasy illustration of a [Gender] [Race] character in a D&D 5e art style, standing in their typical environment. **Aspect ratio 1:1 (square)**. Portrait orientation."

### 3. Submission
- Use `fill` on the prompt box.
- Use `press_key` "Enter" or click the "Send message" button.
- If the UI is unresponsive, use `evaluate_script` to force a click:
  ```javascript
  () => { document.querySelector('button[aria-label="Send message"]').click(); }
  ```

### 4. Downloading & Renaming
Gemini downloads images with random names (e.g., `Gemini_Generated_Image_...`).
1.  Click the "Download full size image" button (usually `aria-label="download"`).
2.  Find the file in `Downloads`:
    ```powershell
    Get-ChildItem -Path "$HOME\Downloads" -Filter "Gemini_Generated_Image_*.png" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    ```
3.  **Rename & Move**: Move it immediately to the project path:
    - **Path**: `public/assets/images/races/[race]_[gender].png`
    - **Constraint**: Always use lowercase filenames.

### 5. Layout Consistency
- **Sizing**: To ensure race images aren't "huge," generate **both Male and Female** (or two variations) for every race. This triggers the `hasDualImages` layout in the glossary, which uses small thumbnails instead of full-card width.

### 6. Cleanup
- **New Chat**: Always start a "New Chat" between different races to prevent context bleed or generating the same image twice.