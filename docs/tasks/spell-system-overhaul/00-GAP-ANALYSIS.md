# Gap Analysis: AI Arbitration System

**Last Updated:** Dec 2025
**Owner:** Agent Epsilon

> **Status Note (2026-03-11):**
> - this file remains a useful gap index for the AI arbitration slice of the spell system
> - the core backend surfaces named here (`AISpellArbitrator`, `MaterialTagService`) still exist
> - the repo now contains an `AISpellInputModal` component plus `onRequestInput` hook handling, so GAP-01 is now about wiring/proof-of-life rather than total UI absence
> - treat this file as a narrow gap registry, not as proof that the whole AI arbitration stack is production-ready

## Overview
The **AI Arbitration System** (Agent Epsilon) has been implemented in its core backend logic (`AISpellArbitrator`, `MaterialTagService`), but several gaps remain to make it fully playable and robust.

## Identified Gaps

| ID | Title | Priority | Description |
|----|-------|----------|-------------|
| **GAP-01** | [AI Input UI Integration](GAP-01-AI-INPUT-UI.md) | **High** | Input UI surfaces exist, but the live spell-casting wiring still needs proof-of-life. |
| **GAP-02** | [Curated Example AI Spells](GAP-02-EXAMPLE-AI-SPELLS.md) | **Medium** | AI-tagged spell JSON exists, but the examples still need stronger prompts and proof-of-life coverage. |
| **GAP-03** | [Missing Caching](GAP-03-AI-CACHING.md) | **Medium** | No caching layer exists, leading to slow and expensive redundant AI calls. |
| **GAP-04** | [Terrain Data Fallback Correctness](GAP-04-REAL-TERRAIN-DATA.md) | **High** | Material tagging can read concrete tile data, but still falls back to biome-level guesses when that context is unavailable. |

## Next Steps
1. **Immediate:** Verify or repair the live `onRequestInput` -> modal wiring for AI-input spells.
2. **Follow-up:** Tighten the current AI-tagged spell examples so they act as real proof-of-life test cases.
3. **Polish:** Address terrain fallback correctness and add caching if AI arbitration becomes a live performance hotspot.
