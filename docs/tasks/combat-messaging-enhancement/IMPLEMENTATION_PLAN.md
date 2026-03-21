# Implementation Plan: Unified Combat Messaging System
This file was re-verified on 2026-03-14.
It remains a useful design and integration plan, but it should be read against the current partial implementation rather than as a brand-new untouched proposal.

Current reality:
- the core infrastructure it proposes already exists in the repo
- the larger question is integration breadth, not whether the basic message system was ever created


Purpose: preserved implementation-plan note for the combat messaging system, rebased against the current repo so it no longer overstates missing foundations.

## Verified Current State

Repo-verified anchors:
- `src/types/combatMessages.ts` already defines the core message types and interfaces
- `src/utils/combat/messageFactory.ts` already exists
- `src/hooks/combat/useCombatMessaging.ts` already exists
- `src/components/demo/CombatMessagingDemo.tsx` already exists
- `src/components/BattleMap/CombatLog.tsx` already consumes rich message styling support
- `src/components/Combat/CombatView.tsx` already imports and uses `useCombatMessaging`

## Rebased Interpretation

The core infrastructure described by the original plan has largely landed.

So the remaining implementation work is narrower:
- extend coverage where combat events still bypass the richer message lane
- verify whether notification and visual-effect follow-through are intentionally partial or simply unfinished
- tighten performance and presentation only where the live system shows strain
- decide whether the demo-only affordances should move into broader player-facing surfaces

## What This Plan Still Preserves

This file still has value because it explains:
- why a unified combat feedback layer was desired
- the intended benefit of structured message categories
- the kinds of follow-through that still make sense after the base system exists

## What Was Stale

The original version overstated several foundations as unbuilt.

Those foundations now exist, so this file should no longer be treated as a greenfield implementation backlog.
