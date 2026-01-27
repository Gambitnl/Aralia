# Specification: Remove Stitch Track Artifacts

## Overview
This track involves the removal of the "Stitch AI-Driven UI & Asset Pipeline" **Conductor track only**. The goal is to clean up the project management artifacts (plans, specs) without uninstalling or deleting the actual Stitch MCP server or its core configurations, which may be needed for future work.

## Functional Requirements
1.  **Track Directory Removal:** Delete the directory `conductor/tracks/stitch_pipeline_20260121/` and all its contents (spec, plan, etc.).
2.  **Registry Cleanup:** Remove the "Stitch AI-Driven UI & Asset Pipeline" entry from the `conductor/tracks.md` registry file.

## Non-Functional Requirements
1.  **Safety Guardrail:** A "Removal Plan" listing the specific conductor files to be deleted must be presented for user approval before execution.
2.  **Preservation:** **DO NOT** delete or uninstall the `stitch-mcp` server, its NPM packages, or core `glama` configurations. This operation is strictly limited to Conductor documentation.

## Out of Scope
*   Uninstalling `stitch-mcp` or related npm packages.
*   Modifying global agent configuration rules regarding Stitch.
