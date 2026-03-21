# Weapon Proficiency Data Audit

Current-state header added 2026-03-12.

This report is preserved as historical audit evidence from the original December 2025 weapon-data review. It is still useful because it documents why mixed category and isMartial handling was considered risky.

Do not treat every recommendation below as already-landed truth. Manual repo verification on 2026-03-12 confirmed that the current helper in src/utils/character/weaponUtils.ts still keeps category as primary source and isMartial as a compatibility fallback, so the repo did not fully collapse to one final data-field strategy.

## Historical audit body

The original audit packet is intentionally preserved below for provenance. It records the December 2025 inspection of weapon data and the cleanup direction proposed at that time.

---

# Weapon Proficiency Data Audit

## Overview
This report analyzes the consistency of weapon proficiency data in src/data/items/index.ts. The goal is to identify discrepancies between the category field and the isMartial flag to standardize the data model.

Total weapons analyzed in the original audit: 32

## Preserved findings

- Simple melee weapons were mostly implicit in the old snapshot.
- Simple ranged weapons were explicitly flagged in the old snapshot.
- Martial melee and martial ranged weapons were explicitly flagged in the old snapshot.
- The old recommendation favored category as the long-term single source of truth.

## Preserved recommendation

The historical audit recommended eventually removing isMartial from the data once category coverage was trustworthy enough. That recommendation is preserved for provenance only. The current repo still uses a mixed compatibility model.