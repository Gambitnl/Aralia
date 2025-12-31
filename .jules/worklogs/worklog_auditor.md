
## 2025-12-29 - Concentration Tag Sync & Enchantment Targeting

**Learning:** An audit of Level 2 spells revealed that while `duration.concentration` was often correctly set to `true`, the corresponding `"concentration"` string in the `tags` array was frequently missing (5+ instances). This creates a UI/Engine mismatch where the engine tracks concentration but the UI fails to display the icon/warning.

**Action:** Created `SpellIntegrityValidator` to enforce `duration.concentration => tags.includes('concentration')`. Future audits should always cross-reference boolean flags with their string tag counterparts.

**Learning:** Enchantment spells targeting "single creature" often lacked any filters, implicitly assuming "Humanoid" or "Not Construct/Undead" based on flavor text, but leaving the engine targeting open to everything.

**Action:** Updated `SpellIntegrityValidator` to flag single-target Enchantment spells that lack both inclusions (e.g. `['Humanoid']`) and exclusions.
