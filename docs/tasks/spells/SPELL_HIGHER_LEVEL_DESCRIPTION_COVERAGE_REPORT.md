# Spell Higher-Level Description Coverage Report

This report audits the `higher-level-text-missing` description sub-bucket and asks whether the missing canonical upcast text is already represented elsewhere in the spell file.

Generated: 2026-04-09T10:52:46.626Z
Higher-level description mismatches analyzed: 7

## Coverage Buckets

### Represented Elsewhere

- Bucket Id: `represented-elsewhere`
- Occurrences: 7
- Rationale: The missing higher-level text in the Description field is already captured elsewhere in the spell file through the structured Higher Levels field and/or explicit scaling data.
- Sample spells: banishment, blight, freedom-of-movement, mordenkainens-private-sanctum, vitriolic-sphere, animate-objects, mass-suggestion

## Sample Spell Assignments

### Banishment

- Bucket: `represented-elsewhere`
- File: F:\Repos\Aralia\docs\spells\reference\level-4\banishment.md
- Reason: The spell already carries explicit higher-level text plus scaling evidence elsewhere, and that evidence appears to cover the canonical upcast mechanic.
- Structured Higher Levels: Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 4.
- JSON Higher Levels: Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 4.
- Canonical Higher-Level Text: None
- Scaling Evidence: json.higherLevels: Using a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 4. | effects[0].scaling: type=slot_level | effects[1].scaling: type=slot_level

### Blight

- Bucket: `represented-elsewhere`
- File: F:\Repos\Aralia\docs\spells\reference\level-4\blight.md
- Reason: The spell already carries explicit higher-level text plus scaling evidence elsewhere, and that evidence appears to cover the canonical upcast mechanic.
- Structured Higher Levels: Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 4.
- JSON Higher Levels: Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 4.
- Canonical Higher-Level Text: None
- Scaling Evidence: json.higherLevels: Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 4. | effects[0].scaling: type=slot_level; bonusPerLevel=+1d8

### Freedom of Movement

- Bucket: `represented-elsewhere`
- File: F:\Repos\Aralia\docs\spells\reference\level-4\freedom-of-movement.md
- Reason: The spell already carries explicit higher-level text plus scaling evidence elsewhere, and that evidence appears to cover the canonical upcast mechanic.
- Structured Higher Levels: You can target one additional creature for each spell slot level above 4.
- JSON Higher Levels: You can target one additional creature for each spell slot level above 4.
- Canonical Higher-Level Text: None
- Scaling Evidence: json.higherLevels: You can target one additional creature for each spell slot level above 4. | effects[0].scaling: type=slot_level

### Mordenkainen's Private Sanctum

- Bucket: `represented-elsewhere`
- File: F:\Repos\Aralia\docs\spells\reference\level-4\mordenkainens-private-sanctum.md
- Reason: The spell already carries explicit higher-level text plus scaling evidence elsewhere, and that evidence appears to cover the canonical upcast mechanic.
- Structured Higher Levels: You can increase the size of the Cube by 100 feet for each spell slot level above 4.
- JSON Higher Levels: You can increase the size of the Cube by 100 feet for each spell slot level above 4.
- Canonical Higher-Level Text: None
- Scaling Evidence: json.higherLevels: You can increase the size of the Cube by 100 feet for each spell slot level above 4. | effects[0].scaling: type=slot_level

### Vitriolic Sphere

- Bucket: `represented-elsewhere`
- File: F:\Repos\Aralia\docs\spells\reference\level-4\vitriolic-sphere.md
- Reason: The spell already carries explicit higher-level text plus scaling evidence elsewhere, and that evidence appears to cover the canonical upcast mechanic.
- Structured Higher Levels: Using a Higher-Level Spell Slot. The initial damage increases by 2d4 for each spell slot level above 4.
- JSON Higher Levels: Using a Higher-Level Spell Slot. The initial damage increases by 2d4 for each spell slot level above 4.
- Canonical Higher-Level Text: None
- Scaling Evidence: json.higherLevels: Using a Higher-Level Spell Slot. The initial damage increases by 2d4 for each spell slot level above 4. | effects[0].scaling: type=slot_level

### Animate Objects

- Bucket: `represented-elsewhere`
- File: F:\Repos\Aralia\docs\spells\reference\level-5\animate-objects.md
- Reason: The spell already carries explicit higher-level text plus scaling evidence elsewhere, and that evidence appears to cover the canonical upcast mechanic.
- Structured Higher Levels: The creature's Slam damage increases by 1d4 (Medium or smaller), 1d6 (Large), or 1d12 (Huge) for each spell slot level above 5.
- JSON Higher Levels: The creature's Slam damage increases by 1d4 (Medium or smaller), 1d6 (Large), or 1d12 (Huge) for each spell slot level above 5.
- Canonical Higher-Level Text: None
- Scaling Evidence: json.higherLevels: The creature's Slam damage increases by 1d4 (Medium or smaller), 1d6 (Large), or 1d12 (Huge) for each spell slot level above 5. | effects[0].scaling: type=slot_level

### Mass Suggestion

- Bucket: `represented-elsewhere`
- File: F:\Repos\Aralia\docs\spells\reference\level-6\mass-suggestion.md
- Reason: The spell already carries explicit higher-level text plus scaling evidence elsewhere, and that evidence appears to cover the canonical upcast mechanic.
- Structured Higher Levels: Using a Higher-Level Spell Slot. The duration is longer with a spell slot of level 7 (10 days), 8 (30 days), or 9 (366 days).
- JSON Higher Levels: The duration is longer with a spell slot of level 7 (10 days), 8 (30 days), or 9 (366 days).
- Canonical Higher-Level Text: None
- Scaling Evidence: json.higherLevels: The duration is longer with a spell slot of level 7 (10 days), 8 (30 days), or 9 (366 days). | effects[0].scaling: type=slot_level

