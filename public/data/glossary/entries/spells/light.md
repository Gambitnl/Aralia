---
title: Light
type: spell
tags:
  - level 0
  - cantrip
  - evocation
  - utility
  - light
---

# Light

<div class="spell-card">
  <div class="spell-header">
    <div class="spell-level">Evocation Cantrip</div>
    <div class="spell-meta">
      <span class="casting-time">1 Action</span>
      <span class="range">Touch</span>
      <span class="components">V, M (a firefly or phosphorescent moss)</span>
      <span class="duration">1 Hour</span>
    </div>
  </div>
  <div class="spell-description">
    <p>You touch one Large or smaller object that isn't being worn or carried by someone else. Until the spell ends, the object sheds bright light in a 20-foot radius and dim light for an additional 20 feet. The light can be colored as you like. Covering the object with something opaque blocks the light. The spell ends if you cast it again.</p>
  </div>
  <div class="spell-classes">
    <strong>Classes:</strong> Artificer, Bard, Cleric, Sorcerer, Wizard, Warlock (Celestial Patron)
  </div>
</div>

## Mechanics
- **Casting Time**: 1 action
- **Range**: Touch (0 ft)
- **Duration**: 1 hour
- **Target**: Object
- **Effect**: Sheds light (20ft bright + 20ft dim)

## Implementation Notes
This spell applies a light effect to a target object. In the current engine, this is tracked as a utility effect. Dynamic lighting interactions are simulated via description.
