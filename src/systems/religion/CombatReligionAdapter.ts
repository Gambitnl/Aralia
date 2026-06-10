// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 06:37:00
 * Dependents: components/Combat/CombatView.tsx, systems/religion/index.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { DEITIES } from '../../data/deities';
import { AppAction } from '../../state/actionTypes';
import { CombatLogEntry } from '../../types/combat';

type CombatTaxonomyValue = string | string[] | undefined | null;

// Combat logs arrive from several systems with inconsistent casing and labels.
// This normalizes each label into simple searchable words so deity-authored tags
// can match "uNdEaD", "undead creature", or similar mixed sources.
const tokenizeCombatValue = (value: string): string[] => value.toLowerCase().match(/[a-z0-9]+/g) ?? [];

const collectCombatTokens = (...values: CombatTaxonomyValue[]): Set<string> => {
    const tokens = new Set<string>();

    values.forEach(value => {
        if (Array.isArray(value)) {
            value.forEach(item => tokenizeCombatValue(item).forEach(token => tokens.add(token)));
            return;
        }

        if (typeof value === 'string') {
            tokenizeCombatValue(value).forEach(token => tokens.add(token));
        }
    });

    return tokens;
};

const buildCombatTriggerTaxonomy = (): Map<string, Set<string>> => {
    const taxonomy = new Map<string, Set<string>>();

    // Deity data owns doctrine intent. The adapter compiles those combat tags
    // once so runtime log processing can stay cheap and does not need to know
    // every individual deity or trigger by hand.
    DEITIES.forEach(deity => {
        [...deity.approves, ...deity.forbids].forEach(trigger => {
            if (!trigger.combatTags?.length) return;

            const tags = taxonomy.get(trigger.trigger) ?? new Set<string>();
            trigger.combatTags.forEach(tag => tokenizeCombatValue(tag).forEach(token => tags.add(token)));
            taxonomy.set(trigger.trigger, tags);
        });
    });

    return taxonomy;
};

const COMBAT_TRIGGER_TAXONOMY = buildCombatTriggerTaxonomy();

/**
 * Adapter to translate combat log events into religion triggers.
 * It keeps the legacy fixed triggers working, but now prefers deity-authored
 * combat taxonomy labels when they exist so new doctrine hooks can be added
 * without widening this file again.
 */
export class CombatReligionAdapter {
    /**
     * Analyzes a log entry and dispatches deity triggers if matches are found.
     */
    static processLogEntry(entry: CombatLogEntry, dispatch: React.Dispatch<AppAction>): void {
        const { type, data } = entry;
        if (!data) return;

        const emittedTriggers = new Set<string>();
        const emitTrigger = (trigger: string): void => {
            if (emittedTriggers.has(trigger)) return;
            emittedTriggers.add(trigger);

            dispatch({
                type: 'TRIGGER_DEITY_ACTION',
                payload: { trigger }
            });
        };

        const emitTaxonomyMatches = (eventTokens: Set<string>): void => {
            COMBAT_TRIGGER_TAXONOMY.forEach((triggerTokens, trigger) => {
                const hasMatch = [...triggerTokens].some(token => eventTokens.has(token));
                if (hasMatch) {
                    emitTrigger(trigger);
                }
            });
        };

        if (type === 'damage' && data.isDeath) {
            const deathTokens = collectCombatTokens(
                data.targetTags ?? [],
                data.damageType,
                data.statusEffectName
            );

            emitTaxonomyMatches(deathTokens);

            // Preserve the original core death heuristics so seeded content still
            // responds even when a deity does not yet carry explicit combat tags.
            if (deathTokens.has('undead')) {
                emitTrigger('DESTROY_UNDEAD');
            }

            if (deathTokens.has('elf')) {
                emitTrigger('KILL_ELF');
            }

            if (deathTokens.has('orc')) {
                emitTrigger('DEFEAT_ORC');
            }

            if (deathTokens.has('poison')) {
                emitTrigger('POISON_ENEMY');
            }
        }

        if (type === 'heal' && (data.healAmount || 0) >= 5) {
            emitTrigger('HEAL_ALLY');
        }

        if (type === 'action' && data.spellSchool) {
            const spellTokens = collectCombatTokens(
                data.spellSchool,
                data.spellName,
                data.source,
                data.abilityName,
                data.statusEffectName
            );

            emitTaxonomyMatches(spellTokens);

            if (spellTokens.has('necromancy')) {
                emitTrigger('USE_NECROMANCY');
                emitTrigger('CAST_NECROMANCY');
            }
        }
    }
}
