# Aralia Agent Skills

This directory is the canonical, version-controlled home for agent skills in the Aralia repository. All shared skills required for developer and coding agent workflows are tracked here so that fresh clones retain full agent capabilities.

---

## Skills Inventory

| Skill | Directory | Description |
|---|---|---|
| **Code Commentary** | [`code_commentary/`](./code_commentary/SKILL.md) | Universal commenting standard for all agents working on Aralia. Requires plain-English 3-layer comments (file header, section dividers, block-level intent) and debt flagging (`DEBT:`, `HACK:`, `TODO:`, `REVIEW_INTENT:`). |
| **Manage Icons** | [`manage_icons/`](./manage_icons/SKILL.md) | Workflow for adding, auditing, and validating SVG icons in the Aralia registry (`IconRegistry.tsx` and `VALID_ICONS`). |
| **AntiGravityCeption** | [`antigravityception/`](./antigravityception/SKILL.md) | Continuous learning system for Antigravity/Gemini agents to extract reusable knowledge and conventions from sessions. |
| **Character Creator Steps** | [`character-creator-steps/`](./character-creator-steps/SKILL.md) | Guidance for creating and modifying character creation steps and validation rules. |
| **Gemini Interactions API** | [`gemini-interactions-api/`](./gemini-interactions-api/SKILL.md) | Integration guidelines for calling Gemini API endpoints via `@google/genai`. |
| **Glossary Modal Editor** | [`glossary-modal-editor/`](./glossary-modal-editor/SKILL.md) | Component architecture and data-editing guidelines for the in-game Glossary and trait tables. |
| **Node.js Port Cleanup** | [`nodejs-port-cleanup/`](./nodejs-port-cleanup/SKILL.md) | Safe procedures for diagnosing and releasing locked dev-server ports on Windows hosts. |
| **Typecheck Preservationist** | [`typecheck-preservationist/`](./typecheck-preservationist/SKILL.md) | Type-preservation rules to fix TypeScript diagnostics without destructive refactoring or any-casting. |
| **Whisk Image Generation** | [`whisk-image-generation/`](./whisk-image-generation/SKILL.md) | Image generation workflows using Whisk / Imagen integrations. |

---

## Agent Harness Discovery Roots

Different AI agent harnesses look for skills in specific directories:
- **`skills/`**: Universal tracked skills root (this directory). All persistent, repo-wide skills live here.
- **`.agent/skills/`**: Local scratch/discovery root for Google Antigravity. Core skills (`code_commentary`, `manage_icons`) are mirrored here so Antigravity runtime picks them up automatically.
- **`.agents/skills/`**: Secondary discovery root used by multi-agent tooling (e.g. Gemini interactions API).
- **`.codex/skills/`**: Local skills directory used by OpenAI Codex CLI.
- **`Claudeception/`**: Machine-local Claude learning directory (ignored by `.gitignore:367`).

---

## Authoring a New Skill

Every skill directory must contain:
1. `SKILL.md` with standard YAML frontmatter:
   ```yaml
   ---
   name: Skill Name
   description: Plain-English summary of what this skill does and when to use it.
   ---
   ```
2. Clear trigger conditions, instructions, and concrete examples.
3. Plain-English commentary standard per [`code_commentary`](./code_commentary/SKILL.md).
