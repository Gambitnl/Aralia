---
title: Light
type: spell
tags:
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
    <p>You touch one object that is no larger than 10 feet in any dimension. Until the spell ends, the object sheds bright light in a 20-foot radius and dim light for an additional 20 feet. The light can be colored as you like. Completely covering the object with something opaque blocks the light. The spell ends if you cast it again or dismiss it as an action.</p>
    <p>If you target an object held or worn by a hostile creature, that creature must succeed on a Dexterity saving throw to avoid the spell.</p>
  </div>
  <div class="spell-classes">
    <strong>Classes:</strong> Artificer, Bard, Cleric, Sorcerer, Wizard, Warlock (Celestial)
  </div>
</div>

## Mechanics
- **Casting Time**: 1 action
- **Range**: Touch (5 ft)
- **Duration**: 1 hour
- **Target**: Object
- **Effect**: Sheds light (20ft bright + 20ft dim)

## Implementation Notes
This spell applies a light effect to a target object. In the current engine, this is tracked as a utility effect. Dynamic lighting interactions are simulated via description.
