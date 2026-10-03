---
name: whisk-image-generation
description: Generate D&D character images using Google Gemini or Whisk via manual browser automation (DevTools MCP).
---
# Image Generation Skill (Gemini)

Use this skill to generate character art with the Gemini web UI. The `image-gen` MCP server drives a headed Chrome with the repo profile `.chrome-gemini-profile`. Whisk support stays in the code but is not maintained.

## Status (verified 2026-09-03)

The pipeline works end to end against the current Gemini UI. A test prompt produced a 2048 x 2048 PNG through `generate_image` and `download_image`. The `verify_image_adherence` upload path is blocked by a one-time Gemini terms dialog (see Obstacles).

## Prerequisites

- **Debug Chrome**: run `npm run mcp:chrome`. This starts Google Chrome with `--remote-debugging-port=9222` and the profile `.chrome-gemini-profile`. The MCP server attaches to it when the port answers. When the port is down, the server launches its own Chrome on the same profile.
- **Manual login**: the profile must hold a Google login. When the server sees a login page, it stops with a "LOGGED OUT" error. Log in by hand in the Chrome window, then retry. Never type credentials through automation.
- **MCP server**: name `image-gen`, command `npx tsx scripts/workflows/gemini/core/image-gen-mcp.ts` (path fixed in `.mcp.json` on 2026-09-03; it pointed at a deleted file before).
- **Tools**: `generate_image`, `download_image`, `verify_image_adherence`. The tool API did not change.

## Environment variables

| Variable | Effect |
| --- | --- |
| `IMAGE_GEN_USE_CDP` | `1` forces attach to port 9222 and fails when it is down. `0` forces a fresh launch. Unset = attach when the port answers. |
| `IMAGE_GEN_CDP_URL` | CDP URL, default `http://localhost:9222`. |
| `GEMINI_PROFILE_DIR` | Profile dir for a fresh launch, default `.chrome-gemini-profile`. |
| `IMAGE_GEN_GEMINI_IMAGE_TIMEOUT_MS` | Wait limit for one image turn, default 240000. |
| `IMAGE_GEN_STRICT_NEW_CHAT` | `1` fails a generation when "New chat" cannot be clicked. |

## Selectors (Gemini UI, 2026-09-03)

Prefer aria labels and custom element tags. Angular class names change often.

| Step | Selector | Note |
| --- | --- | --- |
| Prompt box | `div[role="textbox"][aria-label="Enter a prompt for Gemini"]` | Quill editor inside `rich-textarea`. |
| Send | `button[aria-label="Send message"]` | Appears only after text is typed. The mic button sits there when the box is empty. |
| New chat | `a[aria-label="New chat"]` | Always visible in the left nav. No hamburger step needed. |
| Turn in progress | `button[aria-label="Stop response"]` | Was "Stop generation" before. |
| Response turn | `model-response` | Count before send, wait for count to grow, then wait for Stop to detach. |
| Generated image | `generated-image img` | `src` is a `blob:` URL, 1024 px wide preview. Fetch from Node fails. |
| Download | `button[aria-label="Download full size image"]` | Inside the same `generated-image`. Fires a browser download of a JPEG (2048 x 2048 for a 1:1 prompt). The server converts to PNG with `sharp` when the output path ends in `.png`. |
| Upload menu | `button[aria-label="Upload & tools"]` then `[data-test-id="local-images-files-uploader-button"]` | Opens the file chooser. Used by `verify_image_adherence`. |
| Zero state | `zero-state-v2` or zero `user-query` elements | The greeting text rotates, so do not match on it. |

## What changed on 2026-09-03

- The generated image moved from a `googleusercontent` URL to a `blob:` URL. The old image selector never matched, so generation timed out.
- The Stop button label changed from "Stop generation" to "Stop response".
- The greeting heading changed, so the old welcome selectors never matched.
- The download path now clicks the per-image download button and captures the download event. The URL-fetch and screenshot fallbacks are gone.
- The verify upload now goes through the Upload & tools menu. The old hidden `input[type="file"]` does not exist until the menu opens.
- `.mcp.json` pointed at `scripts/image-gen-mcp.ts`, which no longer exists.

## Obstacles

- **Upload terms dialog**: the first file upload in a profile shows "Creating content from images and files" with Cancel and Agree. The server does not click Agree. Read it and click Agree by hand in the Chrome window, then retry. Seen 2026-09-03; not yet accepted.
- **Info card on load**: a "You're in control of your settings" card with a Dismiss button can appear. It does not block clicks.
- **Rate limits**: none seen on 2026-09-03 across three image turns (about 35 s each). When Gemini answers with text and no image, the server returns the response text and flags limit phrases such as "reached your limit" or "try again later".
- **Whisk**: labs.google ignores automated clicks. Do not use it.

## Workflow

### 1. Launch and connect
1. Run `npm run mcp:chrome`.
2. Check the Gemini tab shows the prompt box. If it shows a login page, log in by hand.
3. Start the MCP server or a caller script. The server attaches over CDP.

### 2. Prompt
Use one prompt per image. Ask for a square 1:1 image and a full body view when the image is a race portrait. The two-step research-then-generate pattern below still works.

**Step 1: Research and describe**
> "Research the visual characteristics of the [Race] race from canon D&D 5e sources. Focus on physical appearance, mundane habitat, and clothing for a COMMON VILLAGER or WORKER. Based on this, write a detailed visual description of a [Gender] [Race] villager in a slice-of-life setting. **DO NOT generate an image yet.**"

**Step 2: Generate**
> "Generate a high-quality, detailed fantasy illustration based on the description above. D&D 5e art style. **Full body view, from head to toe.** Aspect ratio 1:1 (square)."

### 3. Download and rename
Call `download_image(outputPath: "absolute/path/to/Parent_Subrace_Gender.png")`.

- **Path convention**: `public/assets/images/races/[Parent]_[Subrace]_[Gender].png` (TitleCase).
  - Example: `Elf_Wood_Male.png`
  - Example: `Dragonborn_Red_Male.png`
  - Example: `Aarakocra_Female.png` (no subrace)

### 4. Verify
Call `verify_image_adherence(imagePath: "...")`. The tool starts a new chat, uploads the file, and asks Gemini for a JSON verdict. When it returns `complies: false`, regenerate.

### 5. Reset
When the UI wedges, close the Chrome window and run `npm run mcp:chrome` again. Do not delete `.chrome-gemini-profile`; it holds the login.

### 6. Layout Consistency
- **Sizing**: To ensure race images aren't "huge," generate **both Male and Female** (or two variations) for every race. This triggers the `hasDualImages` layout in the glossary, which uses small thumbnails instead of full-card width.

### 7. Automated Wiring & Auditing
Use the `scripts/audit_and_wire_images.ts` script to automatically:
- **Rename** files to the `Parent_Subrace_Gender.png` convention.
- **Wire** the new paths into `src/data/races/*.ts` and `glossary/*.json`.
- **Audit** for missing wiring.

Run with: `npx tsx scripts/audit_and_wire_images.ts`
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

## Completion Criteria

Before concluding any image generation task, you must satisfy the following checklist:

1. **Visual Adherence:** Confirm that the generated image has been validated using the visual verification checks (adhering to Full Body view, common D&D villager aesthetic, slice-of-life setting).
2. **File Naming:** Verify the image is saved to `public/assets/images/races/` and is named strictly under the `Parent_Subrace_Gender.png` title-case convention.
3. **Double Variation:** Confirm that both Male and Female illustrations are generated and successfully saved to trigger the correct dual-image card layout in the UI.
4. **Data Wiring:** Run `npx tsx scripts/audit_and_wire_images.ts` and confirm that all new image paths are successfully wired into the glossary JSON files and Character Creator TypeScript definitions.
5. **No Broken Links:** Verify the images load correctly on the front-end without rendering missing resource fallbacks or broken image placeholders.
