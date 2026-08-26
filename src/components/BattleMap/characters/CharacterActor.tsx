/**
 * @file CharacterActor.tsx
 * 3D character representation for the combat map.
 *
 * Each CombatCharacter is rendered as a CharacterActor containing:
 * - Generated body: a skinned EntityModel assembled by systems/entities3d
 *   from the character's race/class (PCs) or creature type x size (monsters).
 *   The box-primitive placeholders it replaced were retired 2026-09-20
 *   (agora-b8b9); adopting IMPORTED pack-rigged base meshes here is a separate,
 *   unmade call that waits on the skeleton canon (agora-9dbc).
 * - Animation state machine (idle sway, walk bob, attack, hit react, death)
 * - BG3-style selection decal (cyan/red ground ring)
 * - Active turn golden ring with pulse animation
 * - Enhanced nameplate with HP bar, name, and status
 * - Smooth position interpolation for movement
 *
 * Research references:
 * - BG3 character selection UI: screenshot analysis from design spec
 * - Three.js AnimationMixer: https://threejs.org/docs/#api/en/animation/AnimationMixer
 * - R3F useFrame for animation: https://r3f.docs.pmnd.rs/api/hooks#useframe
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md — "Character System" section
 */

// This entry file is now a thin facade (move-only split, W1-P7): the
// implementation moved into ./characterActor/{defenseBadges,conditionBadges,
// models,CharacterActor}. The default export is unchanged, so the barrel and
// every importer keeps importing CharacterActor from './CharacterActor'.
export { default } from './characterActor/CharacterActor';
