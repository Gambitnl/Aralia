---
name: stitch-ui-design
description: Generate React/Tailwind UI components using Google Stitch (MCP).
---

# Stitch UI Design

Use this skill to generate high-quality, production-ready UI components using Google's Stitch AI model.

## Prerequisites
- The **Stitch MCP Server** must be running and authenticated.
- You must verify the specific tool names using `list_tools` before the first call (common names: `stitch_create`, `generate_ui`, `design`).

## Workflow

### 1. Discovery
Always start by checking available tools if you haven't yet:
```javascript
// Pseudo-code
const tools = await list_tools();
const stitchTool = tools.find(t => t.name.includes("stitch"));
```

### 2. Creation
Use the Stitch tool to generate the component. Provide a detailed prompt including:
- **Component Name**: e.g., "InventoryCard"
- **Style**: "Modern, Dark Mode, Tailwind CSS"
- **Functionality**: Describe the interactive elements.

**Example Prompt**:
> "Create a React component for a D&D Character Sheet 'Ability Score' display. It should show the score (large number), modifier (small number), and label. Use a stone-textured background, gold borders, and Tailwind CSS. Dark mode."

### 3. Integration
Stitch will return code (usually in a `content` block).
1.  **Review Code**: Check for imports and syntax.
2.  **Save File**: Write the code to a new `.tsx` file in `src/components/...`.
3.  **Wire Up**: Import and use the component in the main application.

## Troubleshooting
- **"Server Not Found"**: The user needs to restart their IDE/Agent or fix `gcloud` auth.
- **"Auth Error"**: Run `scripts/fix_stitch_auth.ps1`.
