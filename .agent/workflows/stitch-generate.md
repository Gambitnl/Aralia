---
description: Generate UI components using Google Stitch MCP
---

# Stitch UI Generation Workflow

## Prerequisites Check

1. Verify Stitch is installed and patched:
```bash
npx tsx scripts/inspect_stitch.ts --list-tools
```
Expected: `[Bridge] Connected!` + tool list

If you see `spawn EINVAL`, apply the Windows patch (see `.agent/skills/stitch_ui_generation/resources/windows_patch.md`).

## Generate UI

### Step 1: List Existing Projects
```bash
npx tsx scripts/inspect_stitch.ts --call=list_projects
```

### Step 2: Create a New Project (if needed)
```bash
npx tsx scripts/inspect_stitch.ts --call=create_project --prompt="Project Name"
```
Note the returned `project_id` (numeric ID).

### Step 3: Write Your Prompt
Create a prompt file at `scripts/stitch_prompt.txt`:
```
A [adjective] [component type] for a [platform] application.
[Specific details about layout, colors, styling].
[Technology stack: React, Tailwind CSS, etc.]
```

### Step 4: Generate the Screen
```bash
npx tsx scripts/inspect_stitch.ts --call=generate_screen_from_text --project-id=YOUR_PROJECT_ID --prompt-file=scripts/stitch_prompt.txt
```

To use a specific model:
```bash
npx tsx scripts/inspect_stitch.ts --call=generate_screen_from_text --project-id=YOUR_PROJECT_ID --prompt-file=scripts/stitch_prompt.txt --model-id=GEMINI_3_PRO
```

**Models:** `GEMINI_3_FLASH` (faster, default) | `GEMINI_3_PRO` (higher quality)

**Note:** Generation takes 1-2 minutes. If timeout occurs, check stitch.withgoogle.com for results.

### Step 5: View and Use Results
1. Open [stitch.withgoogle.com](https://stitch.withgoogle.com)
2. Find your project
3. Export HTML/CSS/React code
4. Integrate into your codebase

## Tips

- Use `deviceType: "DESKTOP"` for web applications
- Be specific about styling (colors, fonts, spacing)
- Reference existing components for consistency
- See `.agent/skills/stitch_ui_generation/resources/prompting_guide.md` for detailed prompting strategies
