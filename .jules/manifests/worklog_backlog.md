# 📋 Worklog-Extracted Backlog

> **Generated**: 2025-12-31 18:57 (Amsterdam Time)  
> **Source**: Analysis of 47 persona worklogs  
> **Purpose**: Centralized actionable backlog derived from institutional memory

---

## 🔴 Priority 1: Critical Architecture

### ARCH-001: Decouple `constants.ts` Monolith
**Source**: Bolt, Architect  
**Impact**: ~34% bundle bloat, circular dependency risks  
**Status**: Plan documented, execution deferred

**Problem**:
`src/constants.ts` acts as a "God Object" re-exporting massive data sets (ITEMS, NPCS, LOCATIONS). Importing *any* constant from it pulls the entire world data into the bundle.

**Implementation Plan**:
1. Stop re-exporting heavy data from `src/constants.ts`
2. Update ~90 consumer files to import directly from source:
   - `src/data/items` for ITEMS
   - `src/data/world/locations` for LOCATIONS
   - `src/data/npcs` for NPCS
3. Refactor `src/data/dev/dummyCharacter.ts` to export a lazy getter (`getDummyParty()`)
4. Update `appState.ts` and `useGameInitialization.ts` to use lazy getter

**Target Files**:
- `src/state/appState.ts`
- `src/hooks/useGameActions.ts`
- `src/hooks/useGameInitialization.ts`
- `src/hooks/actions/*.ts`
- `src/utils/actionUtils.ts`
- `src/utils/contextUtils.ts`
- `src/services/characterGenerator.ts`
- `src/components/MapTile.tsx`

**Verification**: Run `npm run build` and compare bundle size before/after

---

### ARCH-002: Resolve `ActiveEffect` Circular Dependency
**Source**: Oracle  
**Impact**: `any[]` type in PlayerCharacter, weakened type safety  
**Status**: Full plan documented

**Problem**:
`PlayerCharacter.activeEffects` is typed as `any[]` because properly typing it creates circular dependency (`character` → `combat` → `character`).

**Implementation Plan**:
1. **Move `ActiveEffect`**: From `src/types/combat.ts` to `src/types/effects.ts`
2. **Update `ActiveEffect`**: Use strict `TargetConditionFilter` instead of `any` for `attackerFilter`
3. **Update `character.ts`**: Import from `effects.ts`, replace `any[]` with `ActiveEffect[]`
4. **Update `combat.ts`**: Remove local definition, import from `effects.ts`
5. **Update Consumers**:
   - `src/commands/effects/DefensiveCommand.ts`
   - `src/utils/statUtils.ts`
   - `src/utils/__tests__/statUtils.test.ts`
   - `src/systems/spells/__tests__/DefenderFilter.test.ts`
   - `src/systems/spells/effects/__tests__/ACCalculation.test.ts`

**Verification**: `npm run build` passes with no type errors

---

### ARCH-003: String-to-Enum Migration
**Source**: Taxonomist, Economist  
**Impact**: Magic strings, fragile mappings, no IDE assistance  
**Status**: Pattern established, specific enums pending

**Pending Migrations**:
| Type | Current | Target |
|------|---------|--------|
| `TradeGoodType` | String union | String Enum |
| `ConditionName` | String union | String Enum with traits |
| `ItemType` ↔ `TradeGoodType` | Fuzzy matching | 1:1 Enum alignment |

**Pattern** (from Taxonomist):
1. Create Enum with string values (backward compatible with JSON)
2. Create `*Definitions` registry with traits/descriptions
3. Update type definitions to use Enum
4. Provide migration path TODOs for consumers

---

## 🟡 Priority 2: Feature Completion

### FEAT-001: Naval UI (CaptainDashboard)
**Source**: Captain  
**Status**: Backend complete, frontend pending

**Backend Complete**:
- [x] `NavalState` interface
- [x] `navalReducer.ts` with all actions
- [x] `VoyageManager` integration
- [x] Unit tests

**Frontend TODO**:
- [ ] `src/components/Naval/CaptainDashboard.tsx` - Main container modal
- [ ] `src/components/Naval/VoyageProgress.tsx` - Progress visualization
- [ ] `src/components/Naval/CrewManifest.tsx` - Crew management
- [ ] Update `DevMenu.tsx` with toggle button
- [ ] Add to `GameModals.tsx` (lazy loaded)

**Verification**: Visual check of dashboard, "Advance Day" updates state

---

### FEAT-002: Visibility/Fog of War System
**Source**: Depthcrawler  
**Status**: Architecture documented, implementation deferred

**Architecture**:
1. **VisibilitySystem Service**:
   - Input: BattleMapData, activeLightSources, CombatCharacter
   - Output: Per-tile visibility state
2. **Light Grid Calculation**: Bright/Dim/Darkness per tile
3. **Line of Sight**: Bresenham's algorithm (exists in `lineOfSight.ts`)
4. **Vision Overlay**:
   - Blocked by wall → Invisible
   - Darkness + no Darkvision → Invisible
   - Darkness + Darkvision → Visible (monochrome)
5. **UI Integration**:
   - `BattleMapTile`: Add `visibilityState` prop ('visible', 'fog', 'hidden')
   - `BattleMap`: Calculate `visibleTiles` for active character

**Combat Impact**:
- `useAbilitySystem.isValidTarget` must check `VisibilitySystem.canSee(caster, target)`
- Attacks against unseen targets carry Disadvantage

---

### FEAT-003: World News Pane
**Source**: Worldsmith  
**Status**: Blocked on action handler registration

**Implementation Done**:
- [x] `NewsPane.tsx` component created
- [x] `isNewsVisible` in GameState
- [x] `uiReducer` handles `TOGGLE_NEWS`
- [x] Registered in `actionHandlers.ts`

**Blocker**:
Dispatching `TOGGLE_NEWS` results in `"Action type TOGGLE_NEWS not recognized"`.

**Debug Checklist**:
1. [ ] Verify `TOGGLE_NEWS` in `src/types/actions.ts` (AppAction)
2. [ ] Verify in `src/types/index.ts` (Action union)
3. [ ] Check `isUiToggle` whitelist in `src/hooks/useGameActions.ts`

---

### FEAT-004: Item Provenance System
**Source**: Recorder  
**Status**: Full design spec documented

**Data Types** (`src/types/provenance.ts`):
```typescript
type ProvenanceEventType = 
  'CRAFTED' | 'FOUND' | 'STOLEN' | 'SOLD' | 
  'USED_IN_COMBAT' | 'ENCHANTED' | 'DAMAGED' | 
  'REPAIRED' | 'GIFTED';

interface ProvenanceEvent {
  date: GameDate;
  type: ProvenanceEventType;
  description: string;
  actorId?: string;
  locationId?: string;
}

interface ItemProvenance {
  creator: string;
  createdDate: GameDate;
  originalName?: string;
  previousOwners: string[];
  history: ProvenanceEvent[];
}
```

**Integration Points**:
- `Item` interface: Add optional `provenance?: ItemProvenance`
- Loot Generation: Call `generateLegendaryHistory()` for Rare+ items
- Crafting: Initialize with `createProvenance()`
- Combat: Append `USED_IN_COMBAT` for boss kills

---

## 🟢 Priority 3: Content & Polish

### CONTENT-001: Implement Tabaxi Race
**Source**: Mythkeeper  
**Status**: Full data structure drafted

**File**: `src/data/races/tabaxi.ts`

```typescript
export const TABAXI_DATA: Race = {
  id: 'tabaxi',
  name: 'Tabaxi',
  description: 'Hailing from a strange and distant land...',
  abilityBonuses: [], // 2024 PHB style
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium or Small',
    'Speed: 30 feet',
    'Darkvision: 60 feet',
    'Cat\'s Claws: 1d6 + Str slashing, climbing speed',
    'Cat\'s Talent: Proficiency in Perception and Stealth',
    'Feline Agility: Double speed until end of turn (resets on 0 movement)',
  ],
  imageUrl: '...' // Needs asset
};
```

**Steps**:
1. Create file with above structure
2. Update `src/data/races/index.ts` to export
3. Verify in Character Creator
4. (Future) Implement `Feline Agility` status effect

---

### CONTENT-002: Immersive Character Creation Text
**Source**: Bard  
**Status**: Copy changes ready

**Changes**:
| Component | Current | Proposed |
|-----------|---------|----------|
| `AbilityScoreAllocation.tsx` | "Set Recommended Stats for {Class}" | "Channel {Class} Archetype" |
| `AbilityScoreAllocation.tsx` | "Confirm Scores" | "Confirm Attributes" |
| `AbilityScoreAllocation.tsx` | "Consider focusing on:" | "Prioritize:" |
| `RaceDetailModal.tsx` | "Racial Stats" | "Ancestral Traits" |

**Rationale**: Replace developer-speak with diegetic fantasy terminology.

---

### CONTENT-003: Regional Pricing
**Source**: Economist  
**Status**: Algorithm drafted

**Algorithm** (for `calculatePrice`):
```typescript
const region = REGIONAL_ECONOMIES[regionId];
if (region) {
  if (region.exports.includes(itemCategory)) multiplier -= 0.2; // -20%
  if (region.imports.includes(itemCategory)) multiplier += 0.2; // +20%
}
```

**Integration**:
- `MerchantModal`: Pass `currentLocation.regionId` to `calculatePrice`
- Location Interface: Add optional `regionId: string` field

---

## 🔧 Priority 4: Refactoring

### REFACTOR-001: PartyPane Extraction
**Source**: Architect  
**Status**: Plan documented, reverted prototype

**Plan**:
1. Create `src/components/PartyPane/` directory
2. Extract button logic to `PartyCharacterButton.tsx`
3. Move list logic to `PartyPane.tsx`
4. Export via `index.ts`
5. Integrate `validateCharacterChoices` from `src/utils/characterValidation.ts`
6. Update tests

---

### REFACTOR-002: God Component Splits
**Source**: Core, Architect  
**Status**: Identified, pending

| Component | Size | Issue |
|-----------|------|-------|
| `Glossary.tsx` | 45KB | Mixed responsibilities |
| `App.tsx` | 31KB | Mixed responsibilities |

**Pattern**: Extract `renderTabName` functions into standalone components in subdirectory.

---

## 📚 Appendix: Known Gotchas

| Issue | Symptom | Fix | Source |
|-------|---------|-----|--------|
| Action not recognized | Dispatch fails silently | Check `isUiToggle` whitelist | Worldsmith |
| Factory crashes | Null/undefined errors | Wrap in try-catch, return "error-*" fallback | Warden |
| Ghost systems | Import fails at runtime | Verify import chain to leaf nodes | Navigator |
| Retroactive HP double-count | Bonus too high | Use delta: `(current - previous) * level` | Vector |
| State drift | Cumulative shifts | Recalculate from base, not previous output | Ecologist |
| Chebyshev vs 5e movement | Wrong diagonal cost | Use 5-10-5 rule, track parity in pathfinding | Warlord |

---

## ✅ Acceptance Criteria Template

For each backlog item:
1. **Build**: `npm run build` passes
2. **Lint**: `npm run lint` passes  
3. **Tests**: `npm test -- --run` passes
4. **Type Safety**: No `any` types introduced
5. **Documentation**: Update relevant domain doc in `docs/architecture/domains/`

---

## 🔴 Additional Priority 1 Items

### ARCH-004: ESLint v9 Flat Config Migration
**Source**: Gardener  
**Impact**: `npm run lint` is currently broken  
**Status**: TODO documented

**Problem**:
ESLint v9 is installed but uses legacy `.eslintrc.cjs` configuration. ESLint v9 defaults to "Flat Config" and drops support for the old format.

**Implementation Plan**:
1. Create `eslint.config.js` (Flat Config format)
2. Migrate rules from `.eslintrc.cjs`
3. Ensure all plugins (react, typescript-eslint, imports) are v9 compatible
4. Enable dead code rules (`no-unused-vars`, `unused-imports`)
5. Run `npm run lint` to verify

**Verification**: `npm run lint` passes or correctly flags issues

---

## 🟡 Additional Priority 2 Items

### FEAT-005: Blink Spell Turn-End Trigger
**Source**: Analyst  
**Status**: Planar mechanics implemented, trigger missing

**Problem**:
The *Blink* spell requires an automatic d20 roll at the end of each turn to determine if the caster shifts to the Ethereal Plane. The planar state system (`planarPhase`) exists, but there's no turn-end trigger to invoke it.

**Implementation Plan**:
1. Create turn-end event hook in combat system
2. Check for active "Blink" effect on current character
3. Roll d20, apply planarPhase change if 11+
4. Notify player of result

---

### FEAT-006: MemorySystem → SpellSystem Integration
**Source**: Analyst  
**Status**: MemorySystem created, not wired

**Problem**:
Spells like *Charm Person* have post-effect consequences ("Creature knows it was charmed") but there's no mechanical way to track this. `MemorySystem` exists but isn't triggered when conditions expire.

**Implementation Plan**:
1. Hook `MemorySystem` into `StatusConditionCommand` or `SpellSystem`
2. Trigger `'magical_manipulation'` memory when Charmed condition expires
3. Store memory with caster identity and timestamp

---

### FEAT-007: Ritual Casting System
**Source**: Ritualist  
**Status**: Gap identified, design documented

**Problem**:
Rituals and long-cast spells (minutes/hours) are treated as instant actions. No "start casting" vs "finish casting" state exists.

**Implementation Plan**:
1. Design `RitualState` interface to track ongoing casts
2. Update `CombatCharacter` to include `currentRitual?: RitualState`
3. Create `RitualManager` service to handle progress and interruptions
4. Update `spellAbilityFactory.ts` to recognize minute/hour casting times

---

## 🟢 Additional Priority 3 Items

### CONTENT-004: TimeWidget Quest Urgency Indicators
**Source**: Timekeeper  
**Status**: Widget exists, feature missing

**Problem**:
`TimeWidget` displays Season and Time of Day but doesn't indicate quest urgency when deadlines approach.

**Implementation Plan**:
1. Add optional `urgentQuests` prop to `TimeWidget`
2. Display warning icon/color when quest deadline is within X days
3. Tooltip showing deadline details

---

## 📐 Design Patterns Compendium

### Observer/Adapter Pattern
**Source**: Templar  
**Use Case**: Decoupling combat events from domain meaning

Combat engines emit agnostic events ("X killed Y"). Adapters translate to domain meaning:
- `CombatReligionAdapter`: "Undead destroyed" → "TRIGGER_DEITY_ACTION"
- Future: `CombatReputationAdapter`: "Noble killed" → "DECREASE_FACTION_STANDING"

**Key Insight**: Keep core engines pure; use adapters for interpretation.

---

### Resolver Classes
**Source**: Templar  
**Use Case**: Decoupling service definition from execution

Services are defined in data (JSON/TS objects) but executed by system classes:
- `TempleSystem` resolves temple service definitions
- Enables simple string effects (legacy) AND complex object effects (future)

**Apply To**: Shop purchases, faction requests, crafting orders

---

### Elemental Cancellation
**Source**: Simulator  
**Use Case**: Handling opposing elemental states

When opposed elements interact:
- Fire + Cold = null (cancel both)
- Acid + Web = null (dissolve)

**Key Insight**: Prefer cancellation over creating mixed states ("Burning Ice").

---

### Consequence Layer
**Source**: Wanderer  
**Use Case**: Procedural generation

Players ignore procedural content lacking mechanical weight.

**Rule**: All procedural events MUST include:
- Reward (gold, items, health)
- OR Risk (combat, resource loss)
- NOT just description

---

### Ephemeral vs Authored Topics
**Source**: Dialogist  
**Use Case**: Dialogue topic management

| Type | Storage | Lifecycle |
|------|---------|-----------|
| Authored Topics | `TOPIC_REGISTRY` | Permanent |
| Procedural Topics (Rumors) | Generated on-the-fly | Ephemeral |

**Key Insight**: Prevents memory leaks from expired/regenerated rumors polluting registry.

---

### Feature Directory Standard
**Source**: Lens  
**Use Case**: Component organization

**Rule**: Always create `src/components/<Feature>/` directory, never flat files.

**Anti-Pattern**: `src/components/MerchantModal.tsx` (orphan)  
**Correct**: `src/components/Trade/MerchantModal.tsx`

---

## 🔐 Security & Best Practices

### Centralized Logging
**Source**: Sentinel  
**Mandate**: Never use `console.log` directly in production code.

**Use**: `src/utils/logger.ts`
- Leveled output (debug/info/warn/error)
- Timestamped
- Production-suppressible
- Guard dev logs with `canUseDevTools()`

---

### AI JSON Parsing
**Source**: Sentinel  
**Mandate**: Always sanitize AI responses before parsing.

```typescript
import { cleanAIJSON, safeJSONParse } from 'src/utils/securityUtils';

const data = safeJSONParse(cleanAIJSON(aiResponse));
```

**Reason**: AI responses often contain Markdown code blocks; `JSON.parse` on raw input crashes.

---

### DOMPurify Hardening
**Source**: Sentinel  
**Mandate**: Prevent Reverse Tabnabbing attacks.

```typescript
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});
```

---

### Entity Resolution
**Source**: Linker  
**Mandate**: Validate AI-generated entities against GameState.

Use `EntityResolverService` to:
1. Parse AI text for entity mentions
2. Validate against known Factions/Locations
3. Create stubs for unknown entities (future)

---

### Vite Environment Types
**Source**: Forge  
**Mandate**: Strictly type `import.meta.env`.

In `vite-env.d.ts`:
```typescript
interface ImportMetaEnv {
  readonly VITE_API_KEY: string;
  readonly VITE_DEBUG_MODE: string;
}
```

Removes need for `@ts-ignore` in config files.

---

### Focus Trap for Modals
**Source**: Palette  
**Mandate**: Use `useFocusTrap` over manual `useEffect` focus.

**Benefits**:
- Consistent default focus (first interactive element)
- Safer for destructive actions (Cancel focused, not Confirm)
- Standard a11y pattern

---

## 📚 Additional Gotchas

| Issue | Symptom | Fix | Source |
|-------|---------|-----|--------|
| Shallow copy mutation | Nested arrays mutated in original state | Explicitly copy nested arrays: `newState.arr = [...state.arr]` | Gardener |
| Spell tag mismatch | `concentration: true` but no tag | Use `SpellIntegrityValidator` | Auditor |
| Enchantment targeting open | Charm affects Constructs | Flag single-target Enchantment spells without type filters | Auditor |
| Dual lockfiles | Module resolution failures | Delete `pnpm-lock.yaml` if using npm | Forge |
| Game day vs Date mismatch | Rumor expiration broken | Use `getGameDay(date)` helper from `timeUtils` | Dialogist |
| `console.log` in production | Secrets logged to browser | Audit new components, use `logger.ts` | Sentinel |
---

## 🗑️ Empty/Inactive Worklogs

The following worklogs contain no actionable content:

| Worklog | Status |
|---------|--------|
| `worklog_intriguer.md` | Empty (placeholder only) |
| `worklog_steward.md` | Initialization only, no learnings |

---

## 🟢 Additional Content Items

### CONTENT-005: Implement Triton Race
**Source**: Mythkeeper  
**Status**: Identified as missing

**Reference**: *Mordenkainen's Monsters of the Multiverse*

**Traits to implement**:
- Amphibious (breathe air and water)
- Control Air and Water (spells: Fog Cloud, Gust of Wind, Wall of Water)
- Darkvision 60ft
- Emissary of the Sea (communicate with sea creatures)
- Guardian of the Depths (cold resistance, ignore deep water pressure)

---

### CONTENT-006: Implement Tortle Race
**Source**: Mythkeeper  
**Status**: Identified as missing

**Reference**: *Mordenkainen's Monsters of the Multiverse*

**Traits to implement**:
- Natural Armor (AC = 17, no Dex bonus)
- Shell Defense (action to withdraw, +4 AC, prone, speed 0)
- Claws (1d4 slashing unarmed)
- Hold Breath (1 hour)
- Nature's Intuition (proficiency: Animal Handling or Nature)

---

## 🔧 Additional Integration Work

### INTEGRATION-001: TravelNavigation → Travel Loop
**Source**: Navigator  
**Status**: System created, not wired

**Problem**:
`TravelNavigation.checkNavigation()` exists but isn't integrated into the main travel loop.

**Implementation**:
1. Find travel loop entry point (likely in movement handler)
2. Call `checkNavigation()` when party travels between locations
3. Apply drift direction and time penalty to party state
4. Trigger 'lost' events when navigation fails

---

### INTEGRATION-002: Critical Failure Pattern for Transformation Systems
**Source**: Alchemist  
**Status**: Philosophy documented, not universally applied

**Philosophy**: "Failure teaches" - destroying items on failed transformation creates meaningful stakes.

**Implementation Plan**:
1. Audit existing transformation systems:
   - Crafting (has failure?)
   - Salvage (has failure ✓)
   - Refining (has failure?)
   - **Enchanting** (needs failure state)
2. For each system without critical failure:
   - Add failure roll based on difficulty
   - Consume resources on failure
   - Add `materialsLost: boolean` to result
   - Display appropriate UI feedback

**Verification**: Each transformation system has a non-zero failure chance that consumes resources

---

## 🔮 Operational Persona Improvements

These suggestions apply to special operational personas (Codex, Core) that coordinate agent workflows:

### META-001: Standard Agent Worklog Template
**Source**: Codex worklog suggestion  
**Target**: Agent onboarding documentation

**Suggestion**: Create a standard agent worklog template that includes:
- `last_seen_id` tracking for chat polling
- Manual-reply reminder protocol
- Standard entry format

---

### META-002: Core as Architecture Arbiter
**Source**: Core worklog suggestion  
**Target**: Architecture documentation

**Suggestion**: Ensure the 'Core' persona is documented as the final arbiter for all domain assignments in the architecture compendium. When domain assignment conflicts arise, Core has final say.

---

## 📊 Backlog Statistics

| Priority | Count | Status |
|----------|-------|--------|
| 🔴 P1: Critical Architecture | 4 | Documented |
| 🟡 P2: Feature Completion | 7 | Documented |
| 🟢 P3: Content & Polish | 6 | Documented |
| 🔧 P4: Refactoring | 2 | Documented |
| 🔧 P4: Integrations | 2 | Documented |
| 🔮 Meta: Operational | 2 | Documented |
| **Total** | **23** | - |

