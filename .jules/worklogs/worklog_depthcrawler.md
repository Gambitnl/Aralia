# Depthcrawler Worklog

## 2024-05-20 - Darkness is just a word
**Learning:** The current combat engine tracks `LightSource`s but does not mechanically enforce visibility. Characters can target anything regardless of lighting.
**Action:** Implementing a `LightSystem` and `VisibilitySystem` to enforce Darkvision rules. The Underdark must be mechanically dark.

## 2024-05-20 - Abyssal Vision Implementation
**Learning:** D&D 5e visibility rules are complex (Bright > Dim > Darkness). To support this, `CharacterStats` needs an explicit `senses` field.
**Action:** Created `LightingSystem` (calculates light levels per tile) and `VisibilitySystem` (checks LoS and Darkvision). Updated `CombatCharacter` to include `senses`.
