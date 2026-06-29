> Archived-status note (reviewed 2026-03-11): This report is preserved as a Dec 2025 audit snapshot.
> The current pass verified that its source files still exist, but did not fully rerun the PHB comparison against fresh external sources.
>
> Current-maintained replacement (generated 2026-06-28): use
> `docs/projects/spells/subprojects/spell-completeness-audit/SPELL_COMPLETENESS_COVERAGE_SNAPSHOT.md`
> for live repo corpus counts and the separated Dataset Coverage, Canonical
> Source, and Runtime Verification gates. Regenerate it with
> `npm run spells:completeness`.

# Spell Completeness Report (Local vs PHB 2024)

Created: 2025-12-04 15:48 UTC
Last Updated: 2025-12-04 16:35 UTC
- Local inventory: `public/data/spells/` (levels 1-9, cantrips excluded)
- PHB reference: Kassoon 2024 spell list (`PHB'24` entries only)

## Summary

> Update (2026-06-28): 14 previously-missing PHB-2024 spells were authored, manifested, and bundled in this pass (8 Summon spells plus Fount of Moonlight, Jallarzi's Storm of Radiance, Yolande's Regal Presence, Tasha's Bubbling Cauldron, Power Word Fortify, and Befuddlement). The Summary table and per-level Missing lists below have been updated to remove them. Mordenkainen's Sword was NOT re-created: in PHB 2024 it is renamed "Arcane Sword" and already exists locally at `public/data/spells/level-7/arcane-sword.json` (with "Mordenkainen's Sword" retained in its `aliases`).

| Level | PASSED Present | FAILED Missing | ❓ Extra |
| --- | --- | --- | --- |
| 1 | 62 | 2 | 3 |
| 2 | 58 | 5 | 2 |
| 3 | 49 | 3 | 4 |
| 4 | 38 | 3 | 1 |
| 5 | 47 | 1 | 2 |
| 6 | 32 | 2 | 0 |
| 7 | 21 | 0 | 0 |
| 8 | 17 | 1 | 0 |
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

- PASSED Present: 49
- FAILED Missing: 3
- ❓ Extra: 4

**Missing (in PHB 2024, not in local):**
- Counterspell (`counterspell`)
- Leomund's Tiny Hut (`leomunds-tiny-hut`)
- Phantom Steed (`phantom-steed`)
- ~~Summon Fey (`summon-fey`)~~ — ADDED 2026-06-28 (`public/data/spells/level-3/summon-fey.json`)
- ~~Summon Undead (`summon-undead`)~~ — ADDED 2026-06-28 (`public/data/spells/level-3/summon-undead.json`)

**Extra (in local, not in PHB 2024):**
- Catnap (`catnap`)
- Flame Arrows (`flame-arrows`)
- Intellect Fortress (`intellect-fortress`)
- Tiny Servant (`tiny-servant`)

### Level 4

- PASSED Present: 38
- FAILED Missing: 3
- ❓ Extra: 1

**Missing (in PHB 2024, not in local):**
- Evard's Black Tentacles (`evards-black-tentacles`)
- ~~Fount of Moonlight (`fount-of-moonlight`)~~ — ADDED 2026-06-28 (`public/data/spells/level-4/fount-of-moonlight.json`)
- Leomund's Secret Chest (`leomunds-secret-chest`)
- ~~Summon Aberration (`summon-aberration`)~~ — ADDED 2026-06-28 (`public/data/spells/level-4/summon-aberration.json`)
- ~~Summon Construct (`summon-construct`)~~ — ADDED 2026-06-28 (`public/data/spells/level-4/summon-construct.json`)
- ~~Summon Elemental (`summon-elemental`)~~ — ADDED 2026-06-28 (`public/data/spells/level-4/summon-elemental.json`)
- Vitriolic Sphere (`vitriolic-sphere`)

**Extra (in local, not in PHB 2024):**
- Elemental Bane (`elemental-bane`)

### Level 5

- PASSED Present: 47
- FAILED Missing: 1
- ❓ Extra: 2

**Missing (in PHB 2024, not in local):**
- Banishing Smite (`banishing-smite`)
- ~~Jallarzi's Storm of Radiance (`jallarzis-storm-of-radiance`)~~ — ADDED 2026-06-28 (`public/data/spells/level-5/jallarzis-storm-of-radiance.json`)
- ~~Summon Celestial (`summon-celestial`)~~ — ADDED 2026-06-28 (`public/data/spells/level-5/summon-celestial.json`)
- ~~Summon Dragon (`summon-dragon`)~~ — ADDED 2026-06-28 (`public/data/spells/level-5/summon-dragon.json`)
- ~~Yolande's Regal Presence (`yolandes-regal-presence`)~~ — ADDED 2026-06-28 (`public/data/spells/level-5/yolandes-regal-presence.json`)

**Extra (in local, not in PHB 2024):**
- Shining Smite (`shining-smite`)
- Skill Empowerment (`skill-empowerment`)

### Level 6

- PASSED Present: 32
- FAILED Missing: 2
- ❓ Extra: 0

**Missing (in PHB 2024, not in local):**
- Arcane Gate (`arcane-gate`)
- Drawmij's Instant Summons (`drawmijs-instant-summons`)
- ~~Summon Fiend (`summon-fiend`)~~ — ADDED 2026-06-28 (`public/data/spells/level-6/summon-fiend.json`)
- ~~Tasha's Bubbling Cauldron (`tashas-bubbling-cauldron`)~~ — ADDED 2026-06-28 (`public/data/spells/level-6/tashas-bubbling-cauldron.json`)

**Extra (in local, not in PHB 2024):**
- None

### Level 7

- PASSED Present: 21
- FAILED Missing: 0
- ❓ Extra: 0

**Missing (in PHB 2024, not in local):**
- ~~Power Word Fortify (`power-word-fortify`)~~ — ADDED 2026-06-28 (`public/data/spells/level-7/power-word-fortify.json`)

**Note (Mordenkainen's Sword):** In PHB 2024 this spell is renamed "Arcane Sword". It already exists locally at `public/data/spells/level-7/arcane-sword.json` (id `arcane-sword`, with "Mordenkainen's Sword" preserved in `aliases`), so it was NOT re-created as a separate `mordenkainens-sword.json`.

**Extra (in local, not in PHB 2024):**
- None

### Level 8

- PASSED Present: 17
- FAILED Missing: 1
- ❓ Extra: 0

**Missing (in PHB 2024, not in local):**
- ~~Befuddlement (`befuddlement`)~~ — ADDED 2026-06-28 (`public/data/spells/level-8/befuddlement.json`)
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
