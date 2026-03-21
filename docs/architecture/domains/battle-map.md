# Battle Map

## Purpose

The Battle Map domain covers the tactical grid-rendering layer used during combat, including tiles, tokens, overlays, initiative-adjacent UI, targeting presentation, and battle-map generation helpers.

## Verified Current Entry Points

High-signal current entry points verified in this pass:
- src/components/BattleMap/BattleMap.tsx
- src/components/BattleMap/BattleMapDemo.tsx
- src/hooks/useBattleMap.ts
- src/hooks/useBattleMapGeneration.ts
- src/services/battleMapGenerator.ts
- src/components/Combat/CombatView.tsx

## Current Domain Shape

The live battle-map domain is not just a standalone map widget.
The current split is:
- BattleMap.tsx renders tiles, character tokens, overlays, and turn-action controls.
- useBattleMap.ts owns selection, path, move, and click orchestration.
- useBattleMapGeneration.ts now exports stateless battle-setup generation logic even though its name still looks hook-like.
- CombatView.tsx is the main live combat surface that imports BattleMap and related battle-map UI pieces.
- BattleMapDemo.tsx still exists as a narrower demo/testing lane.

The verified BattleMap subtree already includes more surrounding UI than the older doc called out, including ActionEconomyBar, InitiativeTracker, CombatLog, PartyDisplay, DamageNumberOverlay, AbilityPalette, and AISpellInputModal.

## Historical Drift Corrected

The older version of this file drifted in a few concrete ways:
- it treated useBattleMapGeneration.ts as a hook, but the file now explicitly describes itself as a stateless utility function
- it implied App.tsx was the direct live battle-map entry, but the current live combat flow runs through CombatView.tsx while App.tsx separately lazy-loads BattleMapDemo
- it described the domain accurately at a high level, but it under-described how much battle-map UI now lives alongside the core tile grid

That older explanation should not be treated as the current implementation guide.

## Boundaries And Constraints

- Battle Map remains the tactical presentation and interaction layer, not the owner of all combat rules.
- CombatView and the combat hooks still own a large part of the live orchestration, so battle-map docs should not overclaim execution ownership.
- The generation utility, map renderer, token layer, and targeting overlays now form a broader cluster than one component-plus-hook summary can capture.
- Demo surfaces should stay clearly distinguished from the live combat path.

## What Is Materially Implemented

This pass verified that the battle-map domain already has:
- a live BattleMap renderer used by CombatView
- a separate BattleMapDemo surface
- a useBattleMap orchestration hook
- a battle-setup generation utility and generator service
- token, overlay, initiative, action-economy, party, combat-log, and AI-spell-input UI pieces
- verified test coverage for several BattleMap subtree components and the generation utility

## Verified Test Surface

Verified tests in this pass:
- src/components/BattleMap/__tests__/AbilityButton.test.tsx
- src/components/BattleMap/__tests__/ActionEconomyBar.test.tsx
- src/components/BattleMap/__tests__/BattleMapTile.test.tsx
- src/hooks/__tests__/useBattleMapGeneration.test.ts
- src/components/__tests__/EncounterModal.test.tsx

## Open Follow-Through Questions

- Which docs should describe the handoff between CombatView and the BattleMap subtree more explicitly?
- Should useBattleMapGeneration.ts be renamed later to match its current utility role, or should the docs simply keep calling out the drift?
- Which targeting, overlay, and token-positioning details need tighter current-state reference docs as combat continues to evolve?
