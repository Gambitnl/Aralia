# Companion Banter

This capability note tracks the current companion-banter system. The repo already supports both NPC-to-NPC banter and player-directed banter, and it has explicit escalation behavior when the player ignores a directed line.

## Current Status

Companion banter is implemented at the hook level and is not just planned behavior.

## Verified Repo Surfaces

- src/hooks/useCompanionBanter.ts
- src/data/banter.ts
- src/state/actionTypes.ts

## Verified Capabilities

### Companion Banter NPC-To-NPC Mode

- useCompanionBanter.ts defines an NPC_TO_NPC mode for companion-to-companion conversations.
- The hook maintains banter history, participants, and follow-up timing for that mode.

### Companion Banter Player-Directed Mode

- The same hook defines a PLAYER_DIRECTED mode where one companion addresses the player directly.
- The player-directed path includes a response deadline and tracks ignored responses separately from ordinary NPC-to-NPC pacing.

### Companion Banter Escalation Selection

- Ignored player-directed lines trigger escalation behavior through ignore counting and follow-up generation.
- The hook archives banter history and can summarize or extract discovered facts after substantial conversations.

## Remaining Gaps Or Uncertainty

- This pass verified the hook-level behavior and surrounding data surfaces, not the rendered in-game pacing or UI presentation.
- The doc now avoids implying that banter behavior is missing when the core implementation is already present.
