# Handover: full economy player-facing UX pass

**Status:** ready to pick up. Written 2026-07-09 for a fresh agent. Remy asked for this to be handed off (not tackled inline) and captured on the plan map (`economy-player-surface` topic).

## The prompt to hand the agent

> You are picking up the "economy player-facing UX pass" for Aralia (F:\Repos\Aralia, master). The economy engine is built and wired into the world reducer, but it has **no honest player-facing surface**: the investment board, economy ledger, courier pouch, trade-route dashboard, and merchant modal are reachable **only from the dev menu**, and most gold movements bypass the transaction framework. Your job is to give the economy a real in-game surface so a player earns, spends, and sees money move through the framework — not through dev tooling.
>
> **Start with brainstorming, not code.** Remy's standing rule is "mock up + look-approve first" — never build a visual/UX slice before he approves the look and the flow. So:
> 1. Use the `superpowers:brainstorming` skill to explore intent with Remy before any implementation.
> 2. Map the current state first (read-only): which economy modals exist, what each shows, how each is opened today (grep `isInvestmentBoardVisible`, `isEconomyLedgerVisible`, `isCourierPouchVisible`, `isTradeRouteDashboardVisible`, `OPEN_MERCHANT`, and the `MODIFY_GOLD` action). Note that `OPEN_MERCHANT` has **no dispatch sites** in the app today — the merchant modal opens only from the dev menu, and there is no player path that threads a real merchant NPC id. Confirm where player gold lives (`gameState.gold`) and which transactions route through the framework vs. bypass it.
> 3. Bring Remy a concrete proposal: where each economy surface should be reachable in normal play (town interactions, merchant NPCs, a wallet/ledger HUD affordance, etc.), what the minimal honest entry points are, and a mock of the primary flow. Get look-approval before building.
> 4. Only then implement, in disjoint slices, each verified end-to-end (this repo's rule: eyeball every visual slice, don't rely on goldens alone).
>
> **Known gaps this unblocks:** economy-ui G4 (add player entry points), G8, G9 (new transaction UIs). **Related shipped work:** the merchant Haggle control now exists (`HAGGLE_ITEM`) but its discount does not persist because no `merchantId` is threaded through `OPEN_MERCHANT` → `uiReducer` merchantModal state → the modal — plumbing that `merchantId` is part of this pass. **Key files:** `src/components/layout/GameModals.tsx` (modal host + escape chain), `src/components/Trade/MerchantModal.tsx`, `src/hooks/actions/handleMerchantInteraction.ts`, `src/state/reducers/uiReducer.ts`, `src/state/actionTypes.ts` (`OPEN_MERCHANT`, `MODIFY_GOLD`), and the economy system under `src/systems/` (worldReducer Steps 5b/5c wire the engine).
>
> **Coordinate via Agora** (register, lock-before-edit, task board) since this is a shared checkout — see `.claude/skills/agora-coordination`. This is a large, product-shaped effort: expect several look-approval gates with Remy, not a single blind build.

## Why this is decision-gated (context for whoever assigns it)
The merchant modal has no player open-path, so "where gold moves in play" is a genuine product/UX decision — it can't be defaulted safely. That's why it's a supervised UX pass with Remy in the loop, not an autonomous packet.
