> Archived-status note (reviewed 2026-03-11): This report is preserved as a Dec 2025 audit snapshot.
> The current pass verified that its source files still exist, but did not fully rerun the PHB comparison against fresh external sources.

# Spell Completeness Report (Local vs PHB 2024)

Created: 2025-12-04 15:48 UTC
Last Updated: 2025-12-04 16:35 UTC
- Local inventory: `public/data/spells/` (levels 1-9, cantrips excluded)
- PHB reference: Kassoon 2024 spell list (`PHB'24` entries only)

## Summary

| Level | PASSED Present | FAILED Missing | ❓ Extra |
| --- | --- | --- | --- |
| 1 | 62 | 2 | 3 |
| 2 | 58 | 5 | 2 |
| 3 | 47 | 5 | 4 |
| 4 | 34 | 7 | 1 |
| 5 | 43 | 5 | 2 |
| 6 | 30 | 4 | 0 |
| 7 | 20 | 1 | 0 |
| 8 | 16 | 2 | 0 |
| 9 | 15 | 1 | 0 |

## Details by Level

### Level 1

- PASSED Present: 62
- FAILED Missing: 2
- ❓ Extra: 3

**Missing (in PHB 2024, not in local):**
- Divine Smite (`divine-smite`)
- Tenser's Floating Disk (`tensers-floating-disk`)

**Extra (in local, not in PHB 2024):**
- Absorb Elements (`absorb-elements`)
- Catapult (`catapult`)
- Snare (`snare`)

### Level 2

- PASSED Present: 58
- FAILED Missing: 5
- ❓ Extra: 2

**Missing (in PHB 2024, not in local):**
- Arcane Vigor (`arcane-vigor`)
- Mirror Image (`mirror-image`)
- Nystul's Magic Aura (`nystuls-magic-aura`)
- Shining Smite (`shining-smite`)
- Summon Beast (`summon-beast`)

**Extra (in local, not in PHB 2024):**
- Pyrotechnics (`pyrotechnics`)
- Skywrite (`skywrite`)

### Level 3

- PASSED Present: 47
- FAILED Missing: 5
- ❓ Extra: 4

**Missing (in PHB 2024, not in local):**
- Counterspell (`counterspell`)
- Leomund's Tiny Hut (`leomunds-tiny-hut`)
- Phantom Steed (`phantom-steed`)
- Summon Fey (`summon-fey`)
- Summon Undead (`summon-undead`)

**Extra (in local, not in PHB 2024):**
- Catnap (`catnap`)
- Flame Arrows (`flame-arrows`)
- Intellect Fortress (`intellect-fortress`)
- Tiny Servant (`tiny-servant`)

### Level 4

- PASSED Present: 34
- FAILED Missing: 7
- ❓ Extra: 1

**Missing (in PHB 2024, not in local):**
- Evard's Black Tentacles (`evards-black-tentacles`)
- Fount of Moonlight (`fount-of-moonlight`)
- Leomund's Secret Chest (`leomunds-secret-chest`)
- Summon Aberration (`summon-aberration`)
- Summon Construct (`summon-construct`)
- Summon Elemental (`summon-elemental`)
- Vitriolic Sphere (`vitriolic-sphere`)

**Extra (in local, not in PHB 2024):**
- Elemental Bane (`elemental-bane`)

### Level 5

- PASSED Present: 43
- FAILED Missing: 5
- ❓ Extra: 2

**Missing (in PHB 2024, not in local):**
- Banishing Smite (`banishing-smite`)
- Jallarzi's Storm of Radiance (`jallarzis-storm-of-radiance`)
- Summon Celestial (`summon-celestial`)
- Summon Dragon (`summon-dragon`)
- Yolande's Regal Presence (`yolandes-regal-presence`)

**Extra (in local, not in PHB 2024):**
- Shining Smite (`shining-smite`)
- Skill Empowerment (`skill-empowerment`)

### Level 6

- PASSED Present: 30
- FAILED Missing: 4
- ❓ Extra: 0

**Missing (in PHB 2024, not in local):**
- Arcane Gate (`arcane-gate`)
- Drawmij's Instant Summons (`drawmijs-instant-summons`)
- Summon Fiend (`summon-fiend`)
- Tasha's Bubbling Cauldron (`tashas-bubbling-cauldron`)

**Extra (in local, not in PHB 2024):**
- None

### Level 7

- PASSED Present: 20
- FAILED Missing: 1
- ❓ Extra: 0

**Missing (in PHB 2024, not in local):**
- Power Word Fortify (`power-word-fortify`)

**Extra (in local, not in PHB 2024):**
- None

### Level 8

- PASSED Present: 16
- FAILED Missing: 2
- ❓ Extra: 0

**Missing (in PHB 2024, not in local):**
- Befuddlement (`befuddlement`)
- Telepathy (`telepathy`)

**Extra (in local, not in PHB 2024):**
- None

### Level 9

- PASSED Present: 15
- FAILED Missing: 1
- ❓ Extra: 0

**Missing (in PHB 2024, not in local):**
- Power Word Heal (`power-word-heal`)

**Extra (in local, not in PHB 2024):**
- None

### Notes

- Level differences surface as missing/extra pairs (e.g., `shining-smite` appears at level 2 in PHB 2024 but level 5 locally).
- PHB spell list derived from Kassoon's 2024 reference; verify against the printed handbook for publication-critical changes.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spell-completeness-audit/@SPELL-COMPLETENESS-REPORT.md","sha256WithoutMarker":"66df744497b4960cd21f99582279ba4f0d3b270943b8baa3d0ddf394e2e0b234","markedAtUtc":"2026-06-25T22:29:38.644Z"} -->
