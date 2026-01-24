---
name: stitch-ui-generation
description: Generate UI components and screens using Google Stitch MCP for web applications.
---

# Stitch UI Generation

Use Google Stitch to generate high-quality, production-ready UI components and full application screens.

## Prerequisites

1. **Stitch MCP Server** must be installed and patched (see `resources/windows_patch.md`).
2. **gcloud authentication** must be configured (run `scripts/fix_stitch_auth.ps1`).
3. **Bridge Script** is available at `scripts/inspect_stitch.ts`.

## Available Tools

| Tool | Description |
|------|-------------|
| `create_project` | Create a new Stitch project container |
| `list_projects` | List all existing projects |
| `generate_screen_from_text` | Generate a UI screen from a text prompt |
| `get_screen` | Get details of a specific screen |
| `list_screens` | List all screens in a project |

## Workflow

### 1. Create a Project (First Time Only)
```bash
npx tsx scripts/inspect_stitch.ts --call=create_project --prompt="My Project Name"
```
Note the returned `project_id` (numeric ID like `14416455431383903182`).

### 2. Generate a Screen
```bash
npx tsx scripts/inspect_stitch.ts --call=generate_screen_from_text \
  --project-id=YOUR_PROJECT_ID \
  --prompt="A login page with email and password fields, dark theme, modern design"
```

With a specific model:
```bash
npx tsx scripts/inspect_stitch.ts --call=generate_screen_from_text \
  --project-id=YOUR_PROJECT_ID \
  --prompt-file=scripts/stitch_prompt.txt \
  --model-id=GEMINI_3_PRO
```

**Model IDs:**
- `GEMINI_3_FLASH` (default) - Faster generation
- `GEMINI_3_PRO` - Higher quality output

### Parameter Formatting (CRITICAL)

| Tool | Parameter | Format |
|------|-----------|--------|
| `generate_screen_from_text` | `projectId` | Numeric ID ONLY (e.g., `14416455431383903182`) |
| `get_screen` | `projectId`, `screenId` | Numeric IDs ONLY |
| `list_screens` | `projectId` | `projects/{numeric_id}` |
| `get_project` | `name` | `projects/{numeric_id}` |

> [!WARNING]
> Using the wrong format (e.g., adding `projects/` to generation) will result in "Entity not found" errors.

### Conversion & Integration Workflow

Official Stitch guidance recommends the following integration path:
1. **Generate**: Create the screen in Stitch.
2. **Download**: Use `curl -L` on the `downloadUrl` to get the generated HTML/Tailwind document.
3. **Convert**: Prompt the AI agent to "Convert this HTML into a set of reusable React components using our design tokens."
4. **Integrate**: Add the converted components to the Aralia codebase.

### 3. Test All Models
```bash
npx tsx scripts/inspect_stitch.ts --test-all-models --project-id=YOUR_PROJECT_ID
```

### 3. View Results
- Check [stitch.withgoogle.com](https://stitch.withgoogle.com) for the generated design.
- Use `list_screens` to get screen IDs for further operations.

## Effective Prompting

See `resources/prompting_guide.md` for detailed prompting strategies.

**Quick Tips:**
- Be specific about the component type (card, form, modal, page)
- Specify technology (React, Tailwind CSS, web application)
- Use adjectives for mood (dark, minimal, vibrant, elegant)
- Reference specific UI elements (navigation bar, hero section, CTA button)

**Example Prompts:**
```
A dark fantasy-themed character ability score card component for a web application. 
Uses parchment texture, gold accents, and serif font. React with Tailwind CSS.
```

---

## Race Portrait Generation Workflow

When generating race portraits for the Glossary/Character Creator, follow this **lore-first** approach:

### Step 1: Research the Race
Before generating any images, research the race's lore from sources like the Forgotten Realms Wiki:
- **Physical Appearance**: Skin tone, eye color, hair, distinctive features
- **Typical Dwelling**: Where they live (urban, rural, nomadic)
- **Typical Attire**: Everyday clothing, NOT adventurer armor
- **Typical Environment**: The habitat/biome they prefer
- **Society Type**: Social structure, solitary vs. communal
- **Typical Association**: Alignment tendencies, behavioral traits

### Step 2: Update Glossary Entry
Add a `lore` object to the race's glossary JSON with descriptive prose for each field:
```json
"lore": {
  "typicalDwelling": "Descriptive paragraph about where they live...",
  "typicalAttire": "Descriptive paragraph about their clothing...",
  "typicalEnvironment": "Descriptive paragraph about their habitat...",
  "societyType": "Descriptive paragraph about their social structure...",
  "typicalAssociation": "Descriptive paragraph about their alignment/behavior...",
  "physicalAppearance": "Detailed description of their physical features..."
}
```

### Step 3: Craft the Stitch Prompt
Use a **minimalist UI** prompt to extract a clean portrait:

```
A single framed portrait on a pure white background.

The portrait shows a [GENDER] [RACE/SUBRACE] in their typical habitat.
[Insert physicalAppearance description from lore]

Setting: [typicalEnvironment] - an everyday peaceful moment, not adventuring.
Attire: [typicalAttire] - comfortable daily wear, not armor.

Full-body composition, 1:1 square aspect ratio.
High fantasy illustration style with [warm/cool] lighting.
No UI elements, no buttons, no text—just the elegant framed portrait.
SINGLE IMAGE ONLY.
```

### Step 4: Extract and Wire
1. Use `list_screens` to find the generated screen
2. Download the image via `curl -L [downloadUrl]`
3. Rename to `Race_Subrace_Gender.png`
4. Place in `public/assets/images/races/`
5. Run `npx tsx scripts/audit_and_wire_images.ts` to wire automatically


## Troubleshooting

| Issue | Solution |
|-------|----------|
| `spawn EINVAL` | Library patch needed. See `resources/windows_patch.md` |
| Request timeout | Generation takes 1-2 minutes. Check stitch.withgoogle.com |
| Auth error | Run `scripts/fix_stitch_auth.ps1` |
| Invalid argument | Ensure `project_id` is numeric only (no `projects/` prefix) |

## Files

- `scripts/inspect_stitch.ts` - Bridge script for MCP communication
- `scripts/fix_stitch_auth.ps1` - Authentication fix script
- `scripts/stitch_prompt.txt` - Example prompt file
- `resources/prompting_guide.md` - Detailed prompting strategies
- `resources/windows_patch.md` - Windows compatibility patch instructions
