# Unified Combat Messaging System
This file was re-verified on 2026-03-14.
It now reads as a preserved feature packet for a partial combat-messaging lane rather than as proof of a fully integrated finished system.

Current reality:
- the documented combat-message types, factory utilities, hook, and demo surfaces do exist in the repo
- full adoption across the live combat UI is still not something this packet can safely claim without broader runtime integration verification


Purpose: current-state overview for the richer combat messaging layer now present in the repo.

## Verified Baseline

Repo-verified anchors:
- `src/types/combatMessages.ts`
- `src/utils/combat/messageFactory.ts`
- `src/hooks/combat/useCombatMessaging.ts`
- `src/components/BattleMap/CombatLog.tsx`
- `src/components/Combat/CombatView.tsx`
- `src/components/demo/CombatMessagingDemo.tsx`

## What Exists Now

The repo already contains a structured combat messaging lane with:
- typed combat message categories
- message factory helpers
- a React hook for message state, filtering, and convenience creators
- a richer combat log path that can render typed messages
- a demo surface for the messaging layer
- integration into the combat view rather than only a standalone concept doc

## What Still Looks Open

The remaining questions are no longer about whether the system exists.

They are about follow-through such as:
- how completely the messaging layer covers all combat events
- whether visual and audio embellishments are still intentionally deferred
- whether the current combat view uses the richer message lane in every important path
- whether the player-facing filtering or preferences should expand beyond the current baseline

## Scope Note

This file should now be read as a verified system overview, not as a proposal for creating the messaging layer from scratch.
