> **ARCHIVED 2026-07-01 (doc-triage batch 1).** Project complete — 810 SVG assets verified on disk at `public/assets/icons/items/` and 810 registry references in `src/data/items/generatedGlossaryItems.ts`. Future art-direction passes may replace icons in place (these acceptance criteria remain reusable for such a pass). Taxonomy questions live in `docs/projects/item_categorization/GAPS.md`.

# Jules Acceptance Criteria: Item SVGs

**Target Audience**: Jules (AI Agent)

## The Mission
Your job is to generate highly detailed, premium, beautiful custom SVG icons for in-game items. 

## Iron Rules
1. **Output Location**: You must ONLY output the SVG file to `public/assets/icons/items/{item_id}.svg`. Do NOT modify any other files (no TypeScript, no React components).
2. **SVG Format**: 
   - Must use `viewBox="0 0 24 24"`
   - Must be a complete, well-formed `<svg>` element.
   - Use beautiful overlapping shapes, paths, and opacity to create a "glassmorphic" or premium layered aesthetic.
   - Do not use `currentColor`—instead, use hardcoded hex colors that fit the theme of the item (e.g., green/gold for a nature item, crimson/dark gray for a blood sword).
3. **Uniqueness**: Every single item must have a completely unique visual composition, even if they share the same category (e.g., two swords should look completely different).
4. **No Code Edits**: Do not update the icon registry or any item definitions. The system automatically detects the SVG file presence during the next build!

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/item-icons/JULES_ACCEPTANCE_CRITERIA.md","sha256WithoutMarker":"4c96c96218a7ae7ec24264b66c7bda9d1fc58002fa1eeee1ac447b1b3e1d2ed9","markedAtUtc":"2026-06-25T22:29:38.311Z"} -->
