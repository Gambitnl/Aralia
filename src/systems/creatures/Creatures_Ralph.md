# Creatures System Documentation (Ralph)

## Overview
This folder contains the Taxonomy logic. It provides a centralized service for classifying entities (Humanoid, Undead, Fiend) and validating whether they are eligible targets for specific abilities.

## Files
- **CreatureTaxonomy.ts**: The Classifier. It handles whitelist/blacklist validation for spell targets and provides a lookup for standard racial/type traits.

## Issues & Opportunities

### **Hybrid Types**: Enhanced Targeting System for Multi-Type Creatures

**Issue Validation**: ✅ CONFIRMED
- `isValidTarget()` uses simple "any match" logic (lines 63-66 in CreatureTaxonomy.ts)
- Creates logical inconsistencies for hybrid creatures
- Example: "Humanoid/Construct" hybrid vs "Hold Person" - current system can't handle nuanced interactions

**Evidence Found**:
- Current implementation: `requiredTypes.some(required => normalizedTargetTypes.includes(required.toLowerCase()))` (lines 63-66)
- Binary valid/invalid outcomes lack nuance for multi-type creatures
- Real examples in codebase: Simic Hybrid (Humanoid + animal traits), Changeling (Fey + Shapechanger)
- Moonbeam spell already shows Shapechanger-specific mechanics (disadvantage on saves)
- **Code Analysis**: The `isValidTarget()` method uses simple array matching without considering:
  - Type dominance/priority (all types treated equally)
  - Partial effectiveness (no graduated responses)
  - Contextual targeting (spell intent vs hybrid nature)
  - Multi-layered resistance (each type could provide partial protection)
- **Legacy Support**: Method handles both `creatureTypes` (array) and `creatureType` (string) for backward compatibility
- **Case Handling**: Proper case-insensitive normalization already implemented

**Current Problems Identified**:
1. **No priority system** - All types treated as equal weight
2. **No partial resistance** - Binary outcomes only
3. **No contextual awareness** - Doesn't consider spell intent vs hybrid nature
4. **Missing hybrid examples** - "Humanoid/Construct" hybrids not represented but conceptually valid

## Detailed Expansion Plans

### Plan 1: **Hybrid Priority System** 🎯
**Concept**: Introduce type dominance hierarchy for hybrid resolution

**Implementation Structure**:
```typescript
interface HybridTypeConfig {
  primary: CreatureType;      // Dominant type for targeting
  secondary: CreatureType[];  // Lesser types
  resistances?: {
    [spellSchool: string]: number; // 0-1 resistance multiplier
  };
}

const HYBRID_CONFIGS: Record<string, HybridTypeConfig> = {
  'simic_hybrid': {
    primary: CreatureType.Humanoid,
    secondary: [CreatureType.Beast],
    resistances: {
      'Enchantment': 0.5, // Half effect due to animal mind
    }
  },
  'changeling': {
    primary: CreatureType.Fey,
    secondary: [CreatureType.Humanoid], // When disguised
    resistances: {
      'Illusion': 0.2, // Strong resistance due to nature
    }
  }
};
```

**Enhanced Method Signature**:
```typescript
static isValidTarget(
  targetTypes: string[], 
  filter: TargetConditionFilter,
  hybridConfig?: HybridTypeConfig,
  context?: TargetingContext
): TargetValidationResult
```

### Plan 2: **Partial Effect System** ⚡
**Concept**: Allow graduated responses instead of binary valid/invalid

**Implementation Structure**:
```typescript
interface TargetValidationResult {
  isValid: boolean;
  effectiveness: number;        // 0.0 - 1.0 multiplier
  reason?: string;             // Human-readable explanation
  alternativeTypes?: string[]; // Suggested targeting alternatives
}

// Example: Hold Person vs Simic Hybrid
// Returns: { 
//   isValid: true, 
//   effectiveness: 0.7, 
//   reason: "Partially humanoid - animal mind provides some resistance" 
// }
```

### Plan 3: **Contextual Targeting Intelligence** 🧠
**Concept**: Consider spell intent and hybrid nature

**Implementation Structure**:
```typescript
interface TargetingContext {
  spellIntent: 'control' | 'damage' | 'healing' | 'utility';
  casterLevel: number;
  hybridAwareness: boolean;    // Does caster know target is hybrid?
}

// Smart logic examples:
// - Control spells: Target the most resistant aspect
// - Damage spells: Use the least resistant type  
// - Healing spells: Consider biological compatibility
```

### Plan 4: **Dynamic Type Expression System** 🔄
**Concept**: Allow creatures to express different "dominant" types based on context

**Implementation Structure**:
```typescript
interface DynamicTypeExpression {
  getDominantType(context: TargetingContext): CreatureType;
  getEffectiveTypes(filter: TargetConditionFilter): CreatureType[];
  getTypeAffinity(type: CreatureType): number; // 0-1 how much this creature "is" that type
}

// Changeling example:
// - Against Divination: Expresses as Humanoid (hides Fey nature)
// - Against Illusion: Expresses as Fey (leverages natural affinity)
```

### Plan 5: **Hybrid-Specific Mechanics Library** 📚
**Concept**: Pre-built hybrid interactions for common scenarios

**Implementation Structure**:
```typescript
const HYBRID_MECHANICS = {
  'Humanoid/Construct': {
    vsMindControl: 'advantage_save', // Construct mind resists
    vsHealing: 'half_effect',        // Only biological part heals
    vsCriticalHits: 'immune_critical' // No vital organs
  },
  
  'Fey/Shapechanger': {
    vsCompulsion: 'disadvantage_save', // Fey nature is susceptible
    vsDetection: 'advantage_stealth',  // Shapechanging helps hide
    vsPolymorph: 'auto_succeed'        // Natural affinity
  }
};
```

## Creative Feature Expansion Opportunities

### 1. **Hybrid Discovery System** 🕵️
- Players must discover hybrid natures through interaction
- Knowledge checks reveal hybrid traits
- Bestiary entries fill with hybrid information over time
- Arcana/Nature checks provide hints about creature composition

### 2. **Adaptive Spell Mechanics** 🎭
- Spells that adapt to hybrid targets
- "Hold Person" becomes "Hold Mind" - works on any intelligent creature
- "Dominate Beast" adapts to target animal aspects
- Spell descriptions update based on hybrid detection

### 3. **Hybrid Evolution System** 🧬
- Creatures can shift their dominant type over time
- Simic Hybrids can lean more into animal or humanoid aspects
- Temporary transformations affect targeting
- Character progression choices influence hybrid expression

### 4. **Synergy Detection** ⚡
- Detect when multiple spells interact with hybrid targets
- Combine effects for unique outcomes
- Example: "Hold Person" + "Heat Metal" on Humanoid/Construct hybrid
- Spell combination warnings and opportunities

### 5. **Hybrid Resistance Layers** 🛡️
- Multi-layered resistance system
- Each type provides partial protection
- Spells must overcome multiple layers
- Visual feedback for layer penetration

## Implementation Priority

### Phase 1: Core Enhancement (Immediate)
- Implement Plan 1: Hybrid Priority System
- Add Plan 2: Partial Effect System
- Update existing tests in `CreatureTaxonomy.test.ts`
- Extend type definitions in `creatures.ts`

### Phase 2: Advanced Features (Short-term)
- Implement Plan 3: Contextual Targeting Intelligence
- Add Plan 4: Dynamic Type Expression System
- Create hybrid configuration files for existing creatures
- Update spell data to support hybrid contexts

### Phase 3: Creative Expansion (Long-term)
- Implement Plan 5: Hybrid-Specific Mechanics Library
- Add discovery and evolution systems
- Create UI components for hybrid information display
- Integrate with character creation and progression

## Testing Strategy

### Unit Tests Required:
- Hybrid priority resolution logic
- Partial effect calculations
- Context-aware targeting decisions
- Dynamic type expression scenarios

### Integration Tests Needed:
- Spell targeting with hybrid creatures
- Multi-spell synergy detection
- Evolution system progression
- Discovery mechanics validation

### User Experience Tests:
- UI clarity for hybrid interactions
- Player understanding of hybrid mechanics
- DM tools for hybrid creature management

## Backward Compatibility

- Existing `isValidTarget()` calls remain functional
- New parameters are optional with sensible defaults
- Legacy spell data continues to work
- Gradual migration path for hybrid adoption

---

## **Next Steps**

1. **Review and approve** the detailed expansion plans
2. **Prioritize implementation phases** based on development resources
3. **Begin Phase 1** with core Hybrid Priority System
4. **Update test suite** to cover hybrid scenarios
5. **Document migration path** for existing content

This enhancement transforms a targeting limitation into a rich, strategic feature that enhances gameplay depth while maintaining mechanical clarity.
