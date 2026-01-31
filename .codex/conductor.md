# Codex Conductor Adapter

Purpose: Mirror the Gemini CLI Conductor extension's command set in Codex.
Scope: Local-only guidance for this repo. Do not overwrite existing Conductor
config files unless a file is missing and required for the current task.

## Core Files (default paths)
- conductor/index.md
- conductor/product.md
- conductor/product-guidelines.md
- conductor/tech-stack.md
- conductor/workflow.md
- conductor/code_styleguides/
- conductor/tracks.md
- conductor/tracks/<track_id>/spec.md
- conductor/tracks/<track_id>/plan.md
- conductor/tracks/<track_id>/metadata.json
- conductor/tracks/<track_id>/index.md

## Universal File Resolution (Codex)
1) Read conductor/index.md for project context.
2) For track context, read conductor/tracks.md, then the track index.
3) Resolve links relative to the index file's folder.
4) Fallback to the default paths above.
5) Verify the resolved path exists before proceeding.

## Command Mappings (Codex)
- /conductor:setup
  - Confirm Conductor files exist; only scaffold missing files.
  - Respect conductor/setup_state.json if present and treat it as resume state.
- /conductor:newTrack
  - Create a track folder with spec, plan, metadata, and index.
  - Register the track in conductor/tracks.md.
- /conductor:implement
  - Follow conductor/workflow.md for task lifecycle and quality gates.
  - Update plan task status and track status in conductor/tracks.md.
  - After completion, synchronize product/tech-stack/guidelines with user approval.
- /conductor:status
  - Summarize the active track, current phase, and next task from the plan.
- /conductor:revert
  - Use git to roll back per track, phase, or task after explicit confirmation.

## Local Behavior
- Use conductor/codex-bridge.md and conductor/codex-commands.md as the
  Codex-facing workflow source of truth.
- Prefer additive changes; avoid overwriting existing Conductor docs.

## Slash Command Usage
- Gemini CLI: Uses `.gemini/extensions/conductor` to register `/conductor:*`.
- Codex CLI: You can type `/conductor:*` in chat; treat it as a workflow
  request and follow the mapped steps in this file.
