# Auditor's Journal

## 2024-05-22 - Initial Setup
**Learning:** Systematic audits require consistent frameworks.
**Action:** Established Auditor persona and templates.

## 2025-05-23 - Systematic Spell Validation
**Learning:** Enchantment spells consistently miss specific immunity filters (e.g., Undead, Constructs) in their JSON definitions, relying on descriptive text instead. This pattern extends across multiple spells (`Command`, `Sleep`, etc.), causing the UI to show invalid targets as valid.
**Action:** Created `ConditionValidator` framework to standardize these checks. Future audits should look for "Implicit vs Explicit" data gaps where rules exist in description but not in structured schema.
