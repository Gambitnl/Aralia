/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intrigue/SecretGenerator.ts
 * Generates procedural secrets for factions and NPCs.
 */

import { Secret } from '../../types/identity';
import { Faction } from '../../types/factions';
import { SeededRandom } from '../../utils/seededRandom';

type SecretTag = Secret['tags'][number];

const SECRET_TEMPLATES: Array<{ template: string; type: SecretTag; valueBase: number }> = [
    { template: "{subject} is secretly funding {target}.", type: 'political', valueBase: 5 },
    { template: "{subject} murdered {target}.", type: 'criminal', valueBase: 9 },
    { template: "{subject} is having an affair with {target}.", type: 'personal', valueBase: 4 },
    { template: "{subject} worships a forbidden deity.", type: 'supernatural', valueBase: 8 },
    { template: "{subject} is heavily in debt to {target}.", type: 'personal', valueBase: 3 },
    { template: "{subject} is actually a spy for {target}.", type: 'political', valueBase: 7 },
    { template: "{subject} possesses a stolen artifact.", type: 'criminal', valueBase: 6 },
    { template: "{subject} forged their credentials.", type: 'personal', valueBase: 5 },
    { template: "{subject} plans to betray {target}.", type: 'political', valueBase: 8 },
    { template: "{subject} is blackmailing {target}.", type: 'criminal', valueBase: 6 },
    { template: "{subject} has a bastard child with {target}.", type: 'personal', valueBase: 7 },
    { template: "{subject} is suffering from a magical curse.", type: 'magical', valueBase: 4 },
    { template: "{subject} is actually a doppelganger.", type: 'supernatural', valueBase: 10 },
    { template: "{subject} is funnelling house funds to {target}.", type: 'financial', valueBase: 6 }
];

// Fallback targets if no specific target is provided
const GENERIC_TARGETS = [
  "a rival house",
  "the Thieves Guild",
  "a commoner",
  "a foreign spy",
  "a dark cult"
];

export class SecretGenerator {
    private rng: SeededRandom;

    constructor(seed: number) {
        this.rng = new SeededRandom(seed);
    }

    /**
     * Generates a secret about a specific faction.
     * @param subjectFaction The faction the secret is about.
     * @param otherFactions List of other factions to be potential targets/beneficiaries.
     */
    generateFactionSecret(subjectFaction: Faction, otherFactions: Faction[]): Secret {
        const template = this.rng.pick(SECRET_TEMPLATES);

        let targetName = "Unknown Party";

        if (otherFactions.length > 0) {
            const target = this.rng.pick(otherFactions);
            targetName = target.name;
        } else {
            targetName = this.rng.pick(GENERIC_TARGETS);
        }

        const content = template.template
            .replace('{subject}', subjectFaction.name)
            .replace('{target}', targetName);

        // Value variation +/- 2
        const value = Math.max(1, Math.min(10, template.valueBase + Math.floor(this.rng.next() * 5) - 2));

        return {
            id: `secret_${this.rng.nextInt(100000, 999999)}`,
            subjectId: subjectFaction.id,
            content: content,
            verified: this.rng.next() > 0.3, // 70% chance to be verified initially, else rumor
            value: value,
            knownBy: [],
            tags: [template.type]
        };
    }

    /**
     * Generates a secret about a specific individual (e.g. noble member).
     */
    generateMemberSecret(subjectId: string, subjectName: string, potentialTargets: string[] = []): Secret {
        const template = this.rng.pick(SECRET_TEMPLATES);

        const targetPool = potentialTargets.length > 0 ? potentialTargets : GENERIC_TARGETS;
        const target = this.rng.pick(targetPool);

        const content = template.template
            .replace('{subject}', subjectName)
            .replace('{target}', target);

        const value = Math.max(1, Math.min(10, template.valueBase + Math.floor(this.rng.next() * 5) - 2));

        return {
            id: `secret_${this.rng.nextInt(100000, 999999)}`,
            subjectId: subjectId,
            content: content,
            verified: this.rng.next() > 0.3,
            value: value,
            knownBy: [],
            tags: [template.type]
        };
    }

    /**
     * Generates a random secret for a generic noble house context.
     */
    generateRandomSecret(factions: Faction[]): Secret | null {
        if (factions.length === 0) return null;
        const subject = this.rng.pick(factions);
        const others = factions.filter(f => f.id !== subject.id);
        return this.generateFactionSecret(subject, others);
    }
}
