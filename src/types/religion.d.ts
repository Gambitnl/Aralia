/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/06/2026, 06:37:00
 * Dependents: components/Religion/TempleModal.tsx, state/initialState.ts, types/index.ts, utils/world/religionUtils.ts, utils/world/templeUtils.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/types/religion.ts
 * Defines types and interfaces for the religion system, including deities,
 * divine favor, and temple services.
 */
import { AbilityScoreName } from './core.js';
import { MechanicalEffect } from './effects.js';
/**
 * Alignment represents the moral and ethical stance of a creature or deity.
 */
export declare enum Alignment {
    LawfulGood = "Lawful Good",
    NeutralGood = "Neutral Good",
    ChaoticGood = "Chaotic Good",
    LawfulNeutral = "Lawful Neutral",
    TrueNeutral = "True Neutral",
    ChaoticNeutral = "Chaotic Neutral",
    LawfulEvil = "Lawful Evil",
    NeutralEvil = "Neutral Evil",
    ChaoticEvil = "Chaotic Evil",
    Unaligned = "Unaligned"
}
export type AlignmentEthicalAxis = 'Lawful' | 'Neutral' | 'Chaotic';
export type AlignmentMoralAxis = 'Good' | 'Neutral' | 'Evil';
export interface AlignmentTraits {
    ethical: AlignmentEthicalAxis;
    moral: AlignmentMoralAxis;
    description: string;
}
/**
 * Standard traits associated with each alignment.
 */
export declare const AlignmentDefinitions: Record<Alignment, AlignmentTraits>;
export type Domain = 'Life' | 'Light' | 'Nature' | 'Tempest' | 'Trickery' | 'War' | 'Death' | 'Knowledge' | 'Arcana' | 'Forge' | 'Grave' | 'Order' | 'Peace' | 'Twilight' | 'Freedom';
export interface DeityActionTrigger {
    trigger: string;
    description: string;
    favorChange: number;
    /**
     * Optional combat taxonomy labels that let the combat adapter map structured
     * log fields to this trigger without guessing from the trigger name alone.
     */
    combatTags?: string[];
}
export interface DeityRelationship {
    targetDeityId: string;
    type: 'ally' | 'enemy' | 'rival';
}
export interface Deity {
    id: string;
    name: string;
    titles: string[];
    domains: Domain[];
    alignment: Alignment;
    symbol: string;
    description: string;
    commandments: string[];
    favoredWeapon?: string;
    approves: DeityActionTrigger[];
    forbids: DeityActionTrigger[];
    relationships?: DeityRelationship[];
    title?: string;
    approvedActions?: string[];
    forbiddenActions?: string[];
}
export type FavorRank = 'Heretic' | 'Shunned' | 'Neutral' | 'Initiate' | 'Devotee' | 'Champion' | 'Chosen';
export interface DivineFavor {
    score: number;
    rank: FavorRank;
    consecutiveDaysPrayed: number;
    lastPrayerTimestamp?: number;
    history: {
        timestamp: number;
        reason: string;
        change: number;
    }[];
    blessings: Blessing[];
}
export interface Blessing {
    id: string;
    name: string;
    description: string;
    duration?: number;
    /**
     * The mechanical effect granted by this blessing.
     * Can be a single effect or a list of effects.
     */
    effect: MechanicalEffect | MechanicalEffect[];
}
export interface TempleServiceRequirement {
    minFavor?: number;
    questId?: string;
    goldCost?: number;
    itemCost?: {
        itemId: string;
        count: number;
    };
}
/**
 * Temple service effects stay backward-compatible with legacy string IDs, but
 * the structured branch is now typed explicitly so non-heal services do not
 * get lumped into the heal path by default.
 */
export type TempleServiceLegacyEffect = 'grant_blessing_minor' | 'heal_20_hp' | 'remove_curse' | 'Divine Intervention' | 'Prevent Undeath' | `grant_blessing_${string}` | `grant_favor_${string}` | `restore_hp_${string}` | `remove_condition_${string}` | `Spell: ${string}`;
export interface TempleHealEffect {
    type: 'heal';
    value?: number;
    description?: string;
}
export interface TempleBuffEffect {
    type: 'buff';
    value?: number;
    stat?: AbilityScoreName;
    duration?: number;
    description?: string;
}
export interface TempleCureEffect {
    type: 'cure';
    value?: number;
    description?: string;
}
export interface TempleIdentifyEffect {
    type: 'identify';
    description?: string;
    itemId?: string;
}
export interface TempleQuestEffect {
    type: 'quest';
    questId?: string;
    description?: string;
}
export interface TempleFavorEffect {
    type: 'favor';
    value?: number;
    deityId?: string;
    description?: string;
}
export interface TempleRestorationEffect {
    type: 'restoration';
    subtype?: 'heal' | 'cure_condition' | 'restore_slot';
    value?: number;
    spellLevel?: number;
    conditions?: string[];
    description?: string;
}
export type TempleStructuredEffect = TempleHealEffect | TempleBuffEffect | TempleCureEffect | TempleIdentifyEffect | TempleQuestEffect | TempleFavorEffect | TempleRestorationEffect;
export type TempleServiceEffect = TempleServiceLegacyEffect | TempleStructuredEffect;
export interface TempleService {
    id: string;
    name: string;
    description: string;
    costGp?: number;
    minFavor?: number;
    requirement?: TempleServiceRequirement;
    effect: TempleServiceEffect;
}
export interface Temple {
    id: string;
    deityId: string;
    name: string;
    description: string;
    locationId?: string;
    services: (TempleService | string)[];
}
export interface ReligionState {
    divineFavor: Record<string, DivineFavor>;
    discoveredDeities: string[];
    activeBlessings: {
        deityId: string;
        effectId: string;
        expirationTimestamp: number;
    }[];
}
export interface DeityAction {
    id: string;
    description: string;
    domain?: string;
    favorChange: number;
}
