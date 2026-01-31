# Aralia DevTools Catalog PRD

## HR Eng

| Aralia DevTools Catalog |  | A centralized, agent-readable dashboard for local development tools, scripts, and workflows. |
| :---- | :---- | :---- |
| **Author**: Pickle Rick **Contributors**: Remy | **Status**: Draft **Created**: 2026-01-29 | **Self Link**: R:\AraliaV4\Aralia\misc\tooling.html |

## Introduction

The Aralia project has accumulated various scripts, debugging tools, and agent workflows scattered across `scripts/`, `.agent/`, and system folders. Currently, `misc/tooling.html` only lists one tool. We need to expand this into a comprehensive catalog that serves two masters: the human developer (Remy) for debugging/usage, and AI agents for discovery and context.

## Problem Statement

**Current Process:** Tools are hidden in folders. New agents (and the user) forget what exists or how to invoke it.
**Primary Users:** Remy (Human), Gemini/Claude (AI Agents).
**Pain Points:** Low discoverability, duplicated effort (re-writing scripts that exist), hard to find "the command to fix X".
**Importance:** Efficiency. If an agent knows a tool exists, it can use it instead of failing.

## Objective & Scope

**Objective:** Transform `misc/tooling.html` into a "DevHub" that indexes all critical project tooling.
**Ideal Outcome:** A single file I can open to see every script, what it does, and how to run it, with copy-pasteable commands.

### In-scope or Goals
-   **Static HTML Architecture**: Must remain a standalone file (no build step required) so it works when the app is down.
-   **Visual Redesign**: Improve the UI to handle dozens of tools (Grid/List view, Categories).
-   **Content Expansion**: Index scripts from `scripts/`, `.agent/workflows/`, and key root configs.
-   **Agent Metadata**: Add semantic tagging (or hidden JSON-LD) so agents can "read" the catalog efficiently.

### Not-in-scope or Non-Goals
-   **Backend Integration**: The HTML file will not execute commands directly (security risk/complexity). It will provide *commands to copy*.
-   **Auto-Generation**: For now, we will manually populate the list. Auto-updating is a future task.

## Product Requirements

### Critical User Journeys (CUJs)
1.  **Human Debugging**: User encounters a "Drive Disconnected" error -> Opens `tooling.html` -> Searches "Drive" -> Copies repair command -> Fixes issue.
2.  **Agent Discovery**: User tells Agent "Fix the icons" -> Agent reads `tooling.html` -> Finds "Icon Maintenance Workflow" -> Follows instructions.

### Functional Requirements

| Priority | Requirement | User Story |
| :---- | :---- | :---- |
| P0 | **Tool Inventory** | As a user, I want to see a list of at least 10 core scripts/tools populated in the UI. |
| P0 | **Categorization** | As a user, I want tools grouped by type (e.g., "Environment", "Git", "Agent Skills") to find them quickly. |
| P1 | **Copy-to-Clipboard** | As a user, I want a button to copy the execution command for each tool. |
| P1 | **Search/Filter** | As a user, I want to type "test" and see only testing-related tools. |
| P2 | **Agent "Read Me" Block** | As an agent, I want a hidden or clear text block summarizing all tools in a dense format. |

## Content Sources (Initial Scan Targets)
-   `R:\AraliaV4\Aralia\scripts\` (Utility scripts)
-   `R:\AraliaV4\Aralia\.agent\workflows\` (Agent SOPs)
-   `R:\AraliaV4\Aralia\package.json` (Major NPM scripts)
-   `R:\AraliaV4\Aralia\run_worker.ps1` (Core entry points)

## Assumptions
-   The user has access to `R:\` drive.
-   The user prefers a "Dark Mode" aesthetic consistent with the existing file.

## Risks & Mitigations
-   **Risk**: Links become stale if files move.
    -   **Mitigation**: Use relative paths where possible.
