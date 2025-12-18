# Auditor Worklog

## 2024-05-22 - Cantrip Scaling Data vs. Engine Mismatch

**Learning:** The spell data files were using `bonusPerLevel` (a linear scaling concept) or unparseable text strings for cantrips, while the `ScalingEngine` was hardcoded to use a 5/11/17 multiplier logic. This mismatch meant that any cantrip deviating from standard dice multiplication (e.g. Acid Splash or Eldritch Blast) was impossible to implement correctly.

**Action:** When auditing systems driven by data files, always verify that the engine actually *reads* the fields present in the data. Just because a field like `customFormula` exists in the JSON doesn't mean the code uses it.
