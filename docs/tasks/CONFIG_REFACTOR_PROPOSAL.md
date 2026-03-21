# Configuration Refactor Proposal: Centralize BASE_URL

**Status**: Preserved improvement note  
**Purpose**: Record the motivation for centralizing `BASE_URL` handling while distinguishing what has already landed from what still remains inconsistent.

## Current Verification

During the 2026-03 documentation pass, `src/config/env.ts` was verified as the current centralized config surface and it already exports:
- `ENV.BASE_URL`

That means the proposal is no longer purely hypothetical.

## What Has Landed

Verified current state:
- `src/config/env.ts` centralizes `BASE_URL`
- `assetUrl()` uses that normalized value for asset-path composition

## What Still Looks Incomplete

The repo is not fully converged on that path yet.

This pass still found a direct `import.meta.env.BASE_URL` access in:
- `src/hooks/useDiceBox.ts`

So the correct current reading is:
- the central config lane exists
- some consumers have been migrated
- at least one direct raw consumer still remains

## Recommended Disposition

Keep this file as a preserved architecture-improvement note rather than deleting it.

It still captures a real configuration hygiene issue:
- use the centralized environment surface
- reduce raw environment access at leaf call sites

But it should not claim that the consumer-migration backlog is still exactly the file list originally proposed.
