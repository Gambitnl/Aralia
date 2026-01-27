## Gemini Added Memories
- The user is using Visual Studio Code.
- When posting timestamps, use NL Amsterdam time (CEST in summer, CET in winter).
- **Automatic Task Hygiene**: At the end of every significant task (during the final steps of the `VERIFICATION` phase), automatically run the logic from `/extract-terminal-learnings` to keep `.agent/rules/Terminal.md` up-to-date with environment-specific CLI quirks or fixes discovered during the session.

## System Assets Inventory

### 🛡️ Custom Rules
These files in `.agent/rules/` define how I should handle specific tools, personas, and troubleshooting.

| Rule | Description |
| :--- | :--- |
| [Terminal.md](file:///C:/Users/gambi/Documents/Git/AraliaV4/Aralia/.agent/rules/Terminal.md) | **Critical** CLI quirks, PowerShell quoting, and error workarounds. |
| [Jules.md](file:///C:/Users/gambi/Documents/Git/AraliaV4/Aralia/.agent/rules/Jules.md) | Instructions for dispatching `jules` tasks via CLI (prioritize shell over tools). |
| [UPLINK.md](file:///C:/Users/gambi/Documents/Git/AraliaV4/Aralia/.agent/rules/UPLINK.md) | Persona workflows for Scout and Core (PR bridging, arbitration). |
| [Troubleshooting.md](file:///C:/Users/gambi/Documents/Git/AraliaV4/Aralia/.agent/rules/Troubleshooting.md) | General auth errors and debugging tips. |
| [FAQ.md](file:///C:/Users/gambi/Documents/Git/AraliaV4/Aralia/.agent/rules/FAQ.md) | Quick answers to recurring implementation questions. |

### 🛠️ Skills
Advanced capabilities extending standard model tools, located in `.agent/skills/`.

| Skill | Description |
| :--- | :--- |
| [stitch-ui-generation](file:///C:/Users/gambi/Documents/Git/AraliaV4/Aralia/.agent/skills/stitch_ui_generation/SKILL.md) | High-fidelity UI generation using Google Stitch MCP. |
| [maintain_icon_system](file:///C:/Users/gambi/Documents/Git/AraliaV4/Aralia/.agent/skills/maintain_icon_system/SKILL.md) | Auditing, sourcing, and configuring MDI icons via Design Preview. |
| [manage_icons](file:///C:/Users/gambi/Documents/Git/AraliaV4/Aralia/.agent/skills/manage_icons/SKILL.md) | standard instructions for adding/updating icons in the codebase. |

### 🔄 Workflows
Manual procedures triggered via slash commands (e.g., `/extract-terminal-learnings`), in `.agent/workflows/`.

| Command | Workflow Description |
| :--- | :--- |
| [/extract-terminal-learnings](file:///C:/Users/gambi/Documents/Git/AraliaV4/Aralia/.agent/workflows/extract-terminal-learnings.md) | Scans history to update `Terminal.md` with new CLI insights. |
| [/stitch-generate](file:///C:/Users/gambi/Documents/Git/AraliaV4/Aralia/.agent/workflows/stitch-generate.md) | Steps for generating UI screens from text prompts via Stitch. |
| [/stitch-prompt](file:///C:/Users/gambi/Documents/Git/AraliaV4/Aralia/.agent/workflows/stitch-prompt.md) | Helper for crafting effective prompts for UI generation. |
| [/maintain-icons](file:///C:/Users/gambi/Documents/Git/AraliaV4/Aralia/.agent/workflows/maintain-icons.md) | End-to-end icon audit and update procedure. |
| [/check-doc-naming](file:///C:/Users/gambi/Documents/Git/AraliaV4/Aralia/.agent/workflows/check-doc-naming.md) | Enforces naming conventions before creating documentation. |


