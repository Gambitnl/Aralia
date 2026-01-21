---
name: whisk-image-generation
description: Generate D&D character images using Google Gemini or Whisk via manual browser automation (DevTools MCP).
---
# Image Generation Skill (Gemini & Whisk)

Use this skill to generate character art using Google's AI tools. This approach uses the unified `image-gen` MCP server or the agent's native `devtools` tools to drive the browser.

## Prerequisites
- **Chrome Browser**: The script `scripts/image-gen-mcp.ts` manages the browser session (launching `chrome` with a persistent profile).
  - **Manual Login**: Required on the first run. The script will pause and alert you if you are not logged in.
- **Unified MCP Server**:
  - **Server Name**: `image-gen`
  - **Tools**: `generate_image`, `download_image`, `verify_image_adherence`

## Core Learnings & Obstacles
- **Whisk vs. Gemini**: Whisk (labs.google) is highly reactive and often ignores automated clicks. **Gemini (gemini.google.com) is much more stable** and is the default provider for the unified tool.
- **Visual Verification**: Use `verify_image_adherence` to check generated images against the "Full Body D&D Villager" guidelines. This tool re-uploads the image to Gemini and asks for a critique.
- **One-Turn Search & Generate**: Gemini can handle "Search then Generate" in a single prompt. This is faster and more accurate than doing it in two steps.

## Workflow

### 1. Launch & Connect
The script handles launching automatically.
1.  Run the server or script: `npx tsx scripts/image-gen-mcp.ts`
2.  If it's your first time, the window will open. **Log in to Google.**
3.  Once logged in, the script will be ready to accept tool calls.

### 2. Optimized Prompting (Two-Step Strategy)
To ensure accuracy and "mundane/slice-of-life" grounding, use a two-step approach.

**Step 1: Research & Describe**
> "Research the visual characteristics of the [Race] race from canon D&D 5e sources. Focus on: physical appearance (skin, features, build), typical mundane habitat, and typical clothing for a COMMON VILLAGER or WORKER (not an adventurer/hero).
>
> based on this, write a detailed visual description of a [Gender] [Race] Villager in a slice-of-life setting. The description should be vivid and suitable for image generation. **DO NOT generate an image yet.**"

**Step 2: Generate**
> "Generate a high-quality, detailed fantasy illustration based on the description above. D&D 5e art style. **Full body view, showing the character from head to toe.** Aspect ratio 1:1 (square)."

### 3. Submission & Interaction
- Use `evaluate_script` to insert text and click send (see Fast-Path Automation below).
- Always wait for the first response to complete (approx 10-15s) before sending the second prompt.

### 4. Downloading & Renaming
Use the `download_image` tool. It automatically handles finding the high-res URL or clicking the download button.

- **Tool Call**: `download_image(outputPath: "absolute/path/to/Parent_Subrace_Gender.png")`
- **Path Convention**: `public/assets/images/races/[Parent]_[Subrace]_[Gender].png` (TitleCase).
  - Example: `Elf_Wood_Male.png`
  - Example: `Dragonborn_Red_Male.png`
  - Example: `Aarakocra_Female.png` (No subrace)

### 5. Verification
Use the `verify_image_adherence` tool to ensure quality.

- **Tool Call**: `verify_image_adherence(imagePath: "...")`
- **Guidelines Checked**: Full Body (Head to Toe), Common Villager/Worker, Slice-of-Life, D&D 5e Style.
- **Action**: If verification returns `complies: false`, consider regenerating the image.

### 6. Layout Consistency
- **Sizing**: To ensure race images aren't "huge," generate **both Male and Female** (or two variations) for every race. This triggers the `hasDualImages` layout in the glossary, which uses small thumbnails instead of full-card width.

### 6. Automated Wiring & Auditing
Use the `scripts/audit_and_wire_images.ts` script to automatically:
- **Rename** files to the `Parent_Subrace_Gender.png` convention.
- **Wire** the new paths into `src/data/races/*.ts` and `glossary/*.json`.
- **Audit** for missing wiring.

Run with: `npx tsx scripts/audit_and_wire_images.ts`
### 7. Cleanup & Efficiency
- **New Chat Protocol**: The script automatically handles "New Chat" logic when necessary to avoid context bleed.
- **Session Reset**: If you encounter issues, kill the terminal and run `taskkill /F /IM chrome.exe /T` to fully reset the browser.
- **Fast-Path Automation**: To save tokens and time, avoid `take_snapshot` for known static elements. Use `evaluate_script` with stable CSS selectors:

### 8. Implementation (Linking Images)
You must wire up the images in **TWO** places: the Glossary (JSON) and the Character Creator (TypeScript).

#### A. Glossary Data (JSON)
1.  Open `public/data/glossary/entries/races/[race].json`.
2.  Add/Update:
    ```json
    "maleImageUrl": "/assets/images/races/[race]_male.png",
    "femaleImageUrl": "/assets/images/races/[race]_female.png"
    ```

#### B. Character Creator Data (TypeScript)
1.  Open `src/data/races/[race].ts`.
2.  Update the `visual` object within the race constant:
    ```typescript
    visual: {
      // ... keep existing icon/color
      maleIllustrationPath: 'assets/images/races/[race]_male.png',
      femaleIllustrationPath: 'assets/images/races/[race]_female.png',
    },
    ```
    *(Note: No leading slash for the TS file paths)*

## Status Checklist (as of 2026-01-20)

**Completed**:
- [x] Aarakocra (M/F)
- [x] Aasimar (M/F)
- [x] Air Genasi (M/F)
- [x] Astral Elf (M/F)
- [x] Autognome (M/F)
- [x] Bugbear (M/F)
- [x] Centaur (M/F)
- [x] Changeling (M/F)
- [x] Duergar (M/F)
- [x] Dwarf (M/F)
- [x] Earth Genasi (M/F)
- [x] Eladrin (M/F)
- [x] Elf (M/F)
- [x] Fairy (M/F)
- [x] Firbolg (M/F)
- [x] Fire Genasi (M/F)
- [x] Giff (M/F)
- [x] Githyanki (M/F)
- [x] Githzerai (M/F)
- [x] Gnome (M/F)
- [x] Goblin (M/F)
- [x] Goliath (M/F)
- [x] Half-Elf (M/F)
- [x] Half-Orc (M/F)
- [x] Halfling (M/F)
- [x] Hill Dwarf (M/F)
- [x] Hobgoblin (M/F)
- [x] Human (M/F)
- [x] Kalashtar (M/F)
- [x] Kender (M/F)
- [x] Kenku (M/F)
- [x] Kobold (M/F)
- [x] Orc (M/F)
- [x] Plasmoid (M/F)
- [x] Satyr (M/F)
- [x] Shifter (M/F)
- [x] Simic Hybrid (M/F)
- [x] Tabaxi (M/F)
- [x] Tiefling (M/F)
- [x] Triton (M/F)
- [x] Vedalken (M/F)
- [x] Verdan (M/F)
- [x] Warforged (M/F)
- [x] Water Genasi (M/F)

**Missing Subraces (To-Do)**:

**Elves**:
- [x] High Elf (Male)
- [x] High Elf (Female)
- [x] Wood Elf (Male)
- [x] Wood Elf (Female)
- [x] Drow (Dark Elf) (Male)
- [x] Drow (Dark Elf) (Female)
- [x] Sea Elf (Male)
- [x] Sea Elf (Female)
- [x] Shadar-Kai (Male)
- [x] Shadar-Kai (Female)
- [x] Pallid Elf (Male)
- [x] Pallid Elf (Female)
- [x] Shadowveil Elf (Male)
- [x] Shadowveil Elf (Female)

**Dwarves**:
- [x] Mountain Dwarf (Male)
- [x] Mountain Dwarf (Female)
- [x] Runeward Dwarf (Male)
- [x] Runeward Dwarf (Female)

**Gnomes**:
- [x] Rock Gnome (Male)
- [x] Rock Gnome (Female)
- [x] Forest Gnome (Male)
- [x] Forest Gnome (Female)
- [x] Deep Gnome (Svirfneblin) (Male)
- [x] Deep Gnome (Svirfneblin) (Female)
- [x] Wordweaver Gnome (Male)
- [x] Wordweaver Gnome (Female)

**Halflings**:
- [x] Lightfoot Halfling (Male)
- [x] Lightfoot Halfling (Female)
- [x] Stout Halfling (Male)
- [x] Stout Halfling (Female)
- [x] Lotusden Halfling (Male)
- [x] Lotusden Halfling (Female)
- [x] Hearthkeeper Halfling (Male)
- [x] Hearthkeeper Halfling (Female)
- [x] Mender Halfling (Male)
- [x] Mender Halfling (Female)

**Dragonborn (Chromatic/Metallic/Gem)**:
- [x] Black Dragonborn (Male)
- [x] Black Dragonborn (Female)
- [x] Blue Dragonborn (Male)
- [x] Blue Dragonborn (Female)
- [x] Brass Dragonborn (Male)
- [x] Brass Dragonborn (Female)
- [x] Bronze Dragonborn (Male)
- [x] Bronze Dragonborn (Female)
- [x] Copper Dragonborn (Male)
- [x] Copper Dragonborn (Female)
- [ ] Gold Dragonborn (Male)
- [ ] Gold Dragonborn (Female)
- [ ] Green Dragonborn (Male)
- [ ] Green Dragonborn (Female)
- [ ] Red Dragonborn (Male)
- [ ] Red Dragonborn (Female)
- [ ] Silver Dragonborn (Male)
- [ ] Silver Dragonborn (Female)
- [ ] White Dragonborn (Male)
- [ ] White Dragonborn (Female)
- [ ] Ravenite Dragonborn (Male)
- [ ] Ravenite Dragonborn (Female)
- [ ] Draconblood Dragonborn (Male)
- [ ] Draconblood Dragonborn (Female)

**Tieflings**:
- [ ] Infernal Tiefling (Male)
- [ ] Infernal Tiefling (Female)
- [ ] Chthonic Tiefling (Male)
- [ ] Chthonic Tiefling (Female)

**Aasimar**:
- [ ] Protector Aasimar (Male)
- [ ] Protector Aasimar (Female)
- [ ] Scourge Aasimar (Male)
- [ ] Scourge Aasimar (Female)
- [ ] Fallen Aasimar (Male)
- [ ] Fallen Aasimar (Female)

**Goliaths**:
- [ ] Cloud Giant Goliath (Male)
- [ ] Cloud Giant Goliath (Female)
- [ ] Fire Giant Goliath (Male)
- [ ] Fire Giant Goliath (Female)
- [ ] Frost Giant Goliath (Male)
- [ ] Frost Giant Goliath (Female)
- [ ] Hill Giant Goliath (Male)
- [ ] Hill Giant Goliath (Female)
- [ ] Stone Giant Goliath (Male)
- [ ] Stone Giant Goliath (Female)
- [ ] Storm Giant Goliath (Male)
- [ ] Storm Giant Goliath (Female)

**Shifters**:
- [ ] Beasthide Shifter (Male)
- [ ] Beasthide Shifter (Female)
- [ ] Longtooth Shifter (Male)
- [ ] Longtooth Shifter (Female)
- [ ] Swiftstride Shifter (Male)
- [ ] Swiftstride Shifter (Female)
- [ ] Wildhunt Shifter (Male)
- [ ] Wildhunt Shifter (Female)

**Eladrin**:
- [ ] Autumn Eladrin (Male)
- [ ] Autumn Eladrin (Female)
- [ ] Winter Eladrin (Male)
- [ ] Winter Eladrin (Female)
- [ ] Spring Eladrin (Male)
- [ ] Spring Eladrin (Female)
- [ ] Summer Eladrin (Male)
- [ ] Summer Eladrin (Female)

**Humans (Variants)**:
- [ ] Beastborn Human (Male)
- [ ] Beastborn Human (Female)
- [ ] Forgeborn Human (Male)
- [ ] Forgeborn Human (Female)
- [ ] Guardian Human (Male)
- [ ] Guardian Human (Female)
- [ ] Wayfarer Human (Male)
- [ ] Wayfarer Human (Female)

**Half-Elves (Variants)**:
- [ ] Aquatic Half-Elf (Male)
- [ ] Aquatic Half-Elf (Female)
- [ ] Drow Half-Elf (Male)
- [ ] Drow Half-Elf (Female)
- [ ] High Half-Elf (Male)
- [ ] High Half-Elf (Female)
- [ ] Wood Half-Elf (Male)
- [ ] Wood Half-Elf (Female)
- [ ] Stormborn Half-Elf (Male)
- [ ] Stormborn Half-Elf (Female)
- [ ] Seersight Half-Elf (Male)
- [ ] Seersight Half-Elf (Female)