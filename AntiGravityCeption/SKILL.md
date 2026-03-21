---
name: antigravityception
description: |
  AntiGravityCeption is a continuous learning system for the AntiGravity (Gemini) agent.
  It extracts reusable knowledge from work sessions and codifies it into agent skills,
  workflow improvements, and environment learnings. Triggers: (1) /antigravityception
  command to review session learnings, (2) "save this as a skill" or "extract a skill
  from this", (3) "what did we learn?", (4) After any task involving non-obvious
  debugging, workarounds, or trial-and-error discovery. Creates new skills and updates
  existing agent configuration when valuable, reusable knowledge is identified.
author: AntiGravity
version: 1.0.0
---

# AntiGravityCeption

A continuous learning system for the AntiGravity (Gemini) agent that extracts reusable
knowledge from work sessions and persists it across conversations.

## Core Principle

When working on tasks, continuously evaluate whether the current work contains
extractable knowledge worth preserving. Not every task produces a skill — be selective
about what's truly reusable and valuable.

## What Makes This Different from Claudeception

AntiGravity operates in a different environment than Claude Code:

| Aspect | Claude Code | AntiGravity |
|--------|-------------|-------------|
| **Skill location** | `.claude/skills/` | `.agent/skills/` |
| **Environment rules** | `.claude/settings.json` | `.agent/rules/Terminal.md`, `GEMINI.md` |
| **Workflow files** | `.claude/commands/` | `.agent/workflows/` |
| **User profile** | N/A | `.agent/workflows/USER.local.md` |
| **Session hooks** | Shell hooks | Tidy-up chain (Step 5) |
| **Shell** | Bash/Zsh | PowerShell (Windows) |
| **Browser tools** | None | Browser subagent |
| **Image tools** | None | `generate_image` tool |

So extracted learnings go to different places depending on their type.

## When to Extract

Extract knowledge when you encounter:

1. **Non-obvious Solutions**: Debugging techniques, workarounds, or solutions that
   required significant investigation and wouldn't be immediately apparent.

2. **Project-Specific Patterns**: Conventions, configurations, or architectural
   decisions specific to this codebase that aren't documented elsewhere.

3. **Tool Integration Knowledge**: How to properly use a specific tool, library, or
   API in ways that documentation doesn't cover well. Especially relevant for
   AntiGravity-specific tools (browser subagent, image generation, MCP servers).

4. **Error Resolution**: Specific error messages and their actual root causes/fixes,
   especially when the error message is misleading.

5. **Environment Workarounds**: Windows/PowerShell-specific quirks, path resolution
   issues, or tool compatibility problems discovered during the session.

6. **Workflow Improvements**: Process improvements to the tidy-up chain, session
   ritual, or other agent workflows discovered through practice.

## Quality Criteria

Before extracting, verify the knowledge meets these criteria:

- **Reusable**: Will this help with future tasks? (Not just this one instance)
- **Non-trivial**: Is this knowledge that requires discovery, not just documentation?
- **Specific**: Can you describe the exact trigger conditions and solution?
- **Verified**: Has this solution actually worked, not just theoretically?

## Where Learnings Go

Different types of knowledge go to different persistence surfaces:

### 1. Environment/CLI Learnings → `.agent/rules/Terminal.md`
PowerShell quirks, path resolution issues, tool-specific workarounds.
These are operational knowledge that any agent on this Windows machine needs.

**Example**: The `/tmp/` path resolution issue on Windows — Node.js resolves
`/tmp/script.mjs` relative to the drive letter of the CWD, not to `C:\tmp\`.

### 2. Project-Specific Skills → `.agent/skills/[skill-name]/SKILL.md`
Reusable patterns for working with the Aralia codebase — icon management,
UI generation, code commentary standards.

**Example**: The checkerboard removal technique for AI-generated sprites
(pattern detection → flood fill → preservation of character details).

### 3. Workflow Improvements → `.agent/workflows/[workflow].md`
Process improvements discovered during tidy-up or other workflows.

**Example**: Adding a multi-agent scoping step to the session ritual so each
agent only reviews its own changes during tidy-up.

### 4. User Profile Updates → `.agent/workflows/USER.local.md`
Observations about the user's reasoning style, trust model, or preferences
that help calibrate future interactions.

**Example**: The user stress-tests proof-of-concepts against full-scale
requirements before investing in implementation.

### 5. Agent Memory → `GEMINI.md` (user rules)
Cross-session operational facts that the agent system should always know.

**Example**: Discord communication instructions, environment-specific paths.

## Extraction Process

### Step 1: Identify the Knowledge

Analyze what was learned during the session:
- What was the problem or task?
- What was non-obvious about the solution?
- What would someone need to know to solve this faster next time?
- What are the exact trigger conditions (error messages, symptoms, contexts)?

### Step 2: Classify the Knowledge

Determine which persistence surface it belongs to (see "Where Learnings Go" above).
Some learnings may update multiple surfaces.

### Step 3: Structure the Extraction

For new skills, use this structure:

```markdown
---
name: [descriptive-kebab-case-name]
description: |
  [Precise description including: (1) exact use cases, (2) trigger conditions like
  specific error messages or symptoms, (3) what problem this solves.]
author: AntiGravity
version: 1.0.0
date: [YYYY-MM-DD]
---

# [Skill Name]

## Problem
[Clear description of the problem this skill addresses]

## Context / Trigger Conditions
[When should this skill be used? Include exact error messages, symptoms, or scenarios]

## Solution
[Step-by-step solution or knowledge to apply]

## Verification
[How to verify the solution worked]

## Example
[Concrete example of applying this skill]

## Notes
[Any caveats, edge cases, or related considerations]
```

For environment learnings, append to the relevant section in `Terminal.md` using
the established format (bold error label, cause, solution).

### Step 4: Write and Verify

- Save the extraction to the appropriate file
- Verify the file parses correctly (no broken YAML frontmatter, etc.)
- If a skill was created, confirm it's discoverable by checking the description
  contains specific trigger conditions

## Retrospective Mode

When `/antigravityception` is invoked at the end of a session (typically as the
final step of `/tidy-up`):

1. **Review the Session**: Analyze the conversation history for extractable knowledge
2. **Self-Reflection Prompts**:
   - "What did I just learn that wasn't obvious before starting?"
   - "If I faced this exact problem again, what would I wish I knew?"
   - "What error message or symptom led me here, and what was the actual cause?"
   - "Did any tool behave unexpectedly on this Windows/PowerShell environment?"
   - "Did the user correct me on something that reveals a pattern I should learn?"
3. **Identify Candidates**: List potential learnings with brief justifications
4. **Classify**: Determine the right persistence surface for each
5. **Extract**: Write the learnings (typically 1-5 per session)
6. **Report**: Summarize what was extracted and where

## Required Output Block

```
AntiGravityCeption: yes|no (with reason)
Session Reviewed: yes|no
Candidates Identified: <count>
Extractions Made:
  - <type>: <description> → <target file>
  - ...
Skills Created: <count>
Environment Learnings Added: <count>
Workflow Improvements: <count>
User Profile Updates: <count>
Skipped Candidates: <list with reasons, or none>
```

## Anti-Patterns to Avoid

- **Over-extraction**: Not every task deserves a skill. Routine work doesn't need
  preservation.
- **Vague descriptions**: "Helps with sprite problems" won't surface when needed.
- **Unverified solutions**: Only extract what actually worked.
- **Documentation duplication**: Don't recreate official docs; link to them and add
  what's missing.
- **Stale knowledge**: Mark skills with versions and dates; knowledge can become
  outdated.
- **Wrong surface**: Don't put environment quirks in skills or user preferences in
  Terminal.md. Use the right persistence surface.

## Integration with Tidy-Up

This workflow is invoked as the final step of `/tidy-up` (Step 5: "Extract Reusable
Learnings from the Run"). It should capture learnings from the entire tidy-up run,
including any issues discovered during verification, roadmap orchestration, or
session ritual execution.

When running as part of tidy-up, the terminal learnings extraction (session ritual
Step 6) has already run. AntiGravityCeption should focus on higher-level learnings
(skills, workflow improvements, patterns) rather than duplicating CLI quirks already
captured in Terminal.md.
