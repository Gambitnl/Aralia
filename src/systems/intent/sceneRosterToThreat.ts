/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intent/sceneRosterToThreat.ts
 *
 * Turns the people standing in front of the player into a real enemy roster.
 *
 * A peaceful scene carries no authored threat, so when the player attacks the
 * festival organizer there is nothing for combat to fight. This module builds
 * that roster from the scene itself.
 *
 * NO FALLBACK, and this is the reason the module exists rather than a one-line
 * map: `createEnemyFromMonster` looks each name up in the bestiary and, on a
 * miss, logs a warning and spawns a generic 10-HP stub with a 4-damage punch.
 * Emitting "Finnley Swiftfoot" as a monster name would hit that stub every time.
 * So every archetype below is a REAL statblock key, verified present in
 * `src/data/monsters.generated.ts`, and the person's own name is carried in the
 * description instead.
 *
 * Pure and deterministic.
 */
import type { SituationThreat } from '../gameEntry/types';

/** A person present in the scene, reduced to what the mapping needs. */
export interface SceneParticipant {
    name: string;
    /** What they are to the scene: "a festival organizer", "a city guard". */
    role: string;
}

/**
 * Bestiary archetype with its canonical 5e Challenge Rating. Keys match the
 * registry after `getMonster` lowercases and underscores the name.
 */
interface Archetype {
    monster: string;
    cr: string;
}

const COMMONER: Archetype = { monster: 'Commoner', cr: '0' };

/**
 * Role keyword to statblock. Ordered: the first matching entry wins, so the
 * specific ranks sit above the general ones ("guard captain" before "guard").
 */
const ROLE_ARCHETYPES: ReadonlyArray<{ keywords: readonly string[]; archetype: Archetype }> = [
    { keywords: ['guard captain', 'watch captain', 'sergeant'], archetype: { monster: 'Guard Captain', cr: '4' } },
    { keywords: ['bandit captain', 'brigand chief', 'outlaw leader'], archetype: { monster: 'Bandit Captain', cr: '2' } },
    { keywords: ['knight', 'paladin', 'champion'], archetype: { monster: 'Knight', cr: '3' } },
    { keywords: ['veteran', 'mercenary', 'sellsword', 'soldier'], archetype: { monster: 'Veteran', cr: '3' } },
    { keywords: ['berserker', 'raider', 'reaver'], archetype: { monster: 'Berserker', cr: '2' } },
    { keywords: ['mage', 'wizard', 'sorcerer', 'witch', 'warlock'], archetype: { monster: 'Mage', cr: '6' } },
    { keywords: ['priest', 'high priest'], archetype: { monster: 'Priest', cr: '2' } },
    { keywords: ['acolyte', 'cleric', 'monk', 'initiate'], archetype: { monster: 'Acolyte', cr: '1/4' } },
    { keywords: ['cultist', 'fanatic', 'zealot'], archetype: { monster: 'Cultist', cr: '1/8' } },
    { keywords: ['spy', 'informant', 'agent'], archetype: { monster: 'Spy', cr: '1' } },
    { keywords: ['scout', 'hunter', 'ranger', 'tracker', 'poacher'], archetype: { monster: 'Scout', cr: '1/2' } },
    { keywords: ['thug', 'enforcer', 'bruiser', 'bouncer'], archetype: { monster: 'Thug', cr: '1/2' } },
    { keywords: ['bandit', 'brigand', 'robber', 'outlaw', 'smuggler'], archetype: { monster: 'Bandit', cr: '1/8' } },
    { keywords: ['guard', 'watchman', 'warden', 'sentry', 'militia'], archetype: { monster: 'Guard', cr: '1/8' } },
    { keywords: ['noble', 'lord', 'lady', 'baron', 'magistrate'], archetype: { monster: 'Noble', cr: '1/8' } },
];

/**
 * Pick the statblock that best fits a role description. An ordinary townsperson
 * — organizer, entertainer, farmer, keeper — resolves to Commoner.
 */
export function archetypeForRole(role: string): Archetype {
    const text = (role ?? '').trim().toLowerCase();
    if (!text) return COMMONER;
    for (const entry of ROLE_ARCHETYPES) {
        if (entry.keywords.some((k) => text.includes(k))) return entry.archetype;
    }
    return COMMONER;
}

/** Challenge Rating text ("1/8", "3") as a number, for comparison and scaling. */
export function crToNumber(cr: string): number {
    const text = (cr ?? '').trim();
    if (text.includes('/')) {
        const [n, d] = text.split('/');
        const num = Number(n);
        const den = Number(d);
        if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) return num / den;
        return 0;
    }
    const value = Number(text);
    return Number.isFinite(value) ? value : 0;
}

/**
 * De-escalation difficulty for a roster the game built itself. Scales off the
 * toughest enemy and stays inside the authored 5..25 band so a generated threat
 * and a model-authored one share one scale.
 */
export function deEscalationDcForRoster(enemies: SituationThreat['enemies']): number {
    const toughest = enemies.reduce((max, e) => Math.max(max, crToNumber(e.cr)), 0);
    return Math.max(5, Math.min(25, Math.round(10 + toughest * 2)));
}

/**
 * Build a fightable threat from the people in the scene.
 *
 * Identical archetypes merge into one stack, so three townsfolk become
 * `Commoner x3` rather than three separate single entries.
 *
 * @returns The threat, or `null` when nobody is present to fight.
 */
export function sceneRosterToThreat(
    participants: readonly SceneParticipant[],
    tension: string,
    battlefieldSource?: SituationThreat['battlefieldSource'],
): SituationThreat | null {
    const named = participants.filter((p) => (p?.name ?? '').trim().length > 0);
    if (named.length === 0) return null;

    const stacks = new Map<string, { name: string; quantity: number; cr: string; who: string[] }>();
    for (const person of named) {
        const archetype = archetypeForRole(person.role);
        const existing = stacks.get(archetype.monster);
        if (existing) {
            existing.quantity += 1;
            existing.who.push(person.name.trim());
        } else {
            stacks.set(archetype.monster, {
                name: archetype.monster,
                quantity: 1,
                cr: archetype.cr,
                who: [person.name.trim()],
            });
        }
    }

    const enemies = Array.from(stacks.values()).map((s) => ({
        name: s.name,
        quantity: s.quantity,
        cr: s.cr,
    }));

    return {
        hostile: true,
        enemies,
        deEscalationDC: deEscalationDcForRoster(enemies),
        tension: tension.trim() || 'Violence has broken out.',
        // Without this, combat opens on the "Battlefield source missing"
        // boundary instead of the ground the player is standing on. The caller
        // stamps it from live game state; it is never model-authored.
        ...(battlefieldSource ? { battlefieldSource } : {}),
    };
}
