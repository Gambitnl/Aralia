# Feature Request: Control-Option Sprite Variants

## Goal
Give control effects like `command` visible impact by swapping an enemy's sprite to a pose matching the issued command (e.g., Grovel, Drop, Halt), without blocking the turn flow or breaking sprite sizing.

## Scope
- Control options that dictate posture or stance (Grovel/prone, Drop items, Halt/freeze, Flee/retreat, Approach/move toward).
- Turn-based presentation only (no continuous animation required), with graceful fallback to the base sprite.

## Requirements
- Stable sizing: outputs normalize to a fixed square (e.g., 256x256 PNG with alpha). If the generator can't guarantee size, a post-process crop/pad step enforces it.
- Deterministic style per creature: reuse the same seed/style prompt + base sprite so variants stay visually consistent.
- Performance: cache generated variants by `{creatureSpriteId, controlOption}`; do not block the current turn waiting for generation.
- Fallback: if generation fails or times out, retain the base sprite; never block or error the combat loop.
- Integration point: a control-effect hook that receives the chosen control option and requests/apply a pose variant for the affected creature.

## Proposed Flow
1) **Pose map**: Add a `controlOption → pose descriptor` map (e.g., `{ grovel: "prone, crouched, hands on ground", drop: "standing, hands open, items dropped", halt: "frozen, upright, tense", flee: "turning away, mid-stride", approach: "leaning forward, stepping toward" }`).
2) **Request**: When a control option lands (failed save), emit a sprite-variant request with `{spriteId, option, baseSpritePath}` and the pose descriptor.
3) **Generation (pluggable)**: Call an image generator with the base sprite + pose prompt, request a slightly larger square (e.g., 320x320, transparent bg), then center-crop/pad to 256x256. Strip backgrounds if needed.
4) **Cache & apply**: Store in a variant cache; when ready, swap the target's sprite for the effect duration. If a variant is already cached, apply immediately.
5) **Fallback**: If generation fails/times out, keep the base sprite and continue gameplay; log a non-blocking warning.

## Nice-to-haves
- Pre-generate common poses at load time for high-frequency enemies.
- Allow a simple CSS pose fallback (rotation/offset/overlay) when generator unavailable.
- Small fade/transition when swapping sprites to avoid pop-in.

## Risks & Mitigations
- **Latency**: Make swap non-blocking; use cached variants or stick with base sprite until ready.
- **Inconsistent sizing**: Always post-process to the target square with alpha and center-fit.
- **Style drift**: Fix seed/style params per creature; keep prompts minimal and consistent.
- **API failures**: Fallback silently to base sprite; surface a debug log only.

## Storage & Bestiary Integration
- Persist generated variants to a predictable path keyed by `{bestiaryId}/{spriteId}/{controlOption}.png`, so variants accumulate into a reusable bestiary library.
- Maintain a small manifest (e.g., `public/data/bestiary/variants.json`) that records available poses per creature; load from this manifest before requesting generation.
- Auto-create/update a bestiary entry when a new creature sprite is first seen: include base sprite, any generated pose variants, and minimal metadata (name, type, source). Displayable like the glossary/spellbook UI.
- Provide a "use existing if present" toggle so gameplay uses the stored variant when available, falling back to generation only when missing.
