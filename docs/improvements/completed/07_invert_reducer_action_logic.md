# Improvement Note: Invert Logic For Complex Reducer Actions

## Status

This is now a preserved completion note.
The take_item example it describes is materially in the post-inversion shape, but the older file overstates how broadly that pattern has already been generalized across the whole reducer system.

## Verified Current State

- src/hooks/actions/handleItemInteraction.ts performs the take_item validation and constructs the DiscoveryEntry before dispatch.
- The dispatched action is now APPLY_TAKE_ITEM_UPDATE, not a simpler older TAKE_ITEM action.
- src/state/actionTypes.ts defines that richer action shape as item, locationId, and discoveryEntry.
- src/state/appState.ts handles APPLY_TAKE_ITEM_UPDATE by applying the prepared inventory, location-item, and discovery-log updates without recreating that business logic from scratch.

That confirms the main example in the note did land:

- the handler now prepares the meaningful payload
- the reducer applies the prepared state update
- the older direct TAKE_ITEM action path is no longer the live pattern for this case

## Historical Drift To Note

The older note described this as the start of a larger inversion pattern for complex reducer actions in general.
This pass did verify the take_item example, but it did not re-prove that the same inversion has already been completed for every other complex action family in the repo.

So the accurate split is:

- take_item inversion example: materially complete
- wider reducer-architecture rollout: still a broader architectural direction, not something this file should present as universally finished

## What This Means

- this file should be preserved as a completion record for one concrete state-management improvement
- it should not be treated as proof that all complex actions in the repo now follow the same pattern
- future reducer cleanup should extend the existing handler-prepared payload approach where it makes sense, starting from this live example rather than re-proposing it from scratch

## Preserved Value

This note still captures a durable state-management principle:

- action handlers can own contextual business logic when they have the right runtime knowledge
- reducers are easier to reason about when they apply prepared state changes instead of re-deriving the whole action meaning
- rich, descriptive action payloads can make cross-system updates easier to audit than vague action names with implicit logic
