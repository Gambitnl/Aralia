# GAPS: Item Categorization & Project Audit

## 1. Glossary Ingestion & 5etools Parsing Gaps
1. **[~~Missing `itemType`~~]**: (Resolved - Fallbacks added to `ingestPhbGlossary.ts`)
2. **[~~Missing Rarity/Tier~~]**: (Resolved - Extracted mechanically via generateItemRegistry)
3. **[~~Missing Attunement~~]**: (Resolved - Mapped to magicProperties.attunement via generateItemRegistry)
4. **[Missing ItemGroup]**: The script completely ignores `itemGroup` which could bundle "Arcane Focus" or "Artisan's Tools".
5. **[Missing `entriesHigherLevel`]**: Spells/features with `entriesHigherLevel` array lose their upcast effects because it is not processed.
6. **[Missing Feat Prerequisites]**: Feat prerequisites are not extracted and injected into the markdown.
7. **[Missing Background Proficiencies]**: Background `skillProficiencies` and `languageProficiencies` are dropped.
8. **[Missing Background Equipment]**: Background `startingEquipment` is dropped.
9. **[~~{@dice} Markup Gap~~]**: (Resolved)
10. **[~~{@damage} Markup Gap~~]**: (Resolved)
11. **[~~{@chance} Markup Gap~~]**: (Resolved)
12. **[~~{@recharge} Markup Gap~~]**: (Resolved)
13. **[~~{@hit} Markup Gap~~]**: (Resolved)
14. **[~~Empty `seeAlso` arrays~~]**: (Resolved)
15. **[Missing Classes]**: Character Classes from XPHB are not fully ingested.
16. **[Missing Races]**: Races from XPHB are not fully ingested.
17. **[Missing Spells]**: Spells from XPHB are not fully ingested.
18. **[Unlinked Weapon Properties]**: Weapon properties (e.g., Finesse, Light) are printed as plain text instead of linking to their glossary rules.
19. **[Unlinked Damage Types]**: Damage types (Slashing, Fire) are plain text instead of linking to the rules glossary.
20. **[Raw Item Value]**: Item value is hardcoded as `/ 100 gp`, ignoring silver/copper specifics in 5etools or strange edge cases.

## 2. Visual & UI Aesthetic Gaps
21. **[No Glassmorphism]**: The UI uses plain `bg-gray-800` backgrounds instead of modern glassmorphic `backdrop-blur` utilities.
22. **[Default Font]**: The project falls back to generic `-apple-system` instead of modern Google Fonts like Inter or Roboto, violating visual excellence.
23. **[Missing Hover Micro-animations]**: Sidebar list items (`GlossaryEntryNode`) lack `transition-all duration-300` smooth micro-animations.
24. **[Missing Focus Rings]**: Many buttons lack custom `focus:ring` states for accessibility.
25. **[Scrollbar Aesthetics]**: There's no modern styled scrollbar in the glossary sidebar; `scrollable-content` may be using default browser bars.
26. **[Bland Gradients]**: There are no subtle gradients behind main containers to make the UI feel premium and alive.
27. **[Image Modal Transition]**: `ImageModal.tsx` probably lacks smooth scale-in and fade-in transitions.
28. **[Hard Shadows]**: Using basic `shadow-lg` instead of premium soft shadow arrays (`box-shadow: 0 10px 40px -10px rgba(...)`).
29. **[Glossary Divider]**: `spell-card-divider` is likely a flat border line; a fading gradient line would look much more premium.
30. **[Empty States]**: The "Male"/"Female" fallback boxes for missing images are flat gray blocks instead of styled placeholders.
31. **[Missing Entry Fade-in]**: When selecting a new glossary entry, the content snaps into place instead of gently fading in.
32. **[Sidebar Collapse Snapping]**: Expanding/collapsing the sidebar categories snaps abruptly because it relies on React re-renders rather than CSS transitions on `max-height`.
33. **[Search Highlight Contrast]**: The search term highlighter colors may not contrast well against the background.
34. **[Layout Reflow on Load]**: Images inside `GlossaryEntryTemplate` don't have aspect ratios explicitly declared (just `w-full h-auto`), causing reflow jumps.
35. **[Z-Index Collisions]**: `GlossaryDisplay` uses a magic constant `z-[var(--z-index-content-overlay-low)]` which may collide with other absolute UI.

## 3. Protocol, Code Debt, and Logic Gaps
36. **[AI Model Fallback]**: Missing settings to toggle between Ollama/Gemini with graceful fallback (`src/App.tsx:126`).
37. **[Performance Bottleneck]**: `useGameActions` may cause re-render hotspots (`src/App.tsx:330`).
38. **[Combat Log Duck Typing]**: Combat log data shapes are not formalized (`ConcentrationCommands.ts:57`).
39. **[Heavy Armor Tracking]**: Damage calculation ignores whether the target is wearing heavy armor (`DamageCommand.ts:188`).
40. **[Teleport Clamping]**: Teleports do not correctly clamp at map boundaries if no map data exists (`MovementCommand.ts:447`).
41. **[Pathfinding Reaction]**: Reactions use straight-line stepping instead of A* pathfinding (`MovementCommand.ts:290`).
42. **[Teleport Units]**: Unnormalized `distance` causes mismatch between tiles vs feet (`MovementCommand.ts:242`).
43. **[Condition Expiration]**: ActiveConditions are not wired into the turn pipeline to automatically expire (`StatusConditionCommand.ts:73`).
44. **[State Map Tagging]**: `applyStateToTags` is missing for elemental conditions like 'Ignited' (`StatusConditionCommand.ts:102`).
45. **[Legacy Durations]**: 'hours' or 'instantaneous' are not normalized before entering the StatusConditionCommand (`StatusConditionCommand.ts:171`).
46. **[Persistent Terrain Maps]**: Effect terrain doesn't persist properly in map-less encounters (`TerrainCommand.ts:43`).
47. **[Light Source Expiration]**: UtilityCommand light sources do not properly expire or update the renderer (`UtilityCommand.ts:53`).
48. **[Taunt Break Conditions]**: Taunt status effects do not enforce mechanical leash distance or disadvantage mechanics (`UtilityCommand.ts:184`).
49. **[Test Flakiness]**: `ReactiveEffectCommand.test.ts` relies on logger spies instead of proper EventEmitter mocking (`ReactiveEffectCommand.test.ts:9`).
50. **[Effect Parsing Loop]**: `AbilityCommandFactory` ignores MOVEMENT and UTILITY effects during parse loops (`AbilityCommandFactory.ts:295`).
