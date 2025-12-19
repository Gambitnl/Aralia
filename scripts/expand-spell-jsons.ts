import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

/**
 * @file expand-spell-jsons.ts
 * 
 * PURPOSE:
 * This script is responsible for the "Backfill" phase of the Spell Data Standardization.
 * It ensures that all 469+ spell JSON files in the codebase contain every possible
 * variable defined in the schema, even if those variables are empty.
 * 
 * WHY:
 * 1. Predictability: Data consumers (Combat Engine, AI Arbitrator, UI) can rely on keys existing.
 * 2. Strict Validation: Allows us to remove `.optional()` from the Zod schema.
 * 3. AI Readiness: Ensures placeholders for AI prompts exist in every spell.
 * 
 * USAGE:
 * npx tsx scripts/expand-spell-jsons.ts [--write]
 */

const SHOULD_WRITE = process.argv.includes('--write');

const SPELL_DATA_DIR = 'public/data/spells/**/*.json';

/**
 * NESTED TEMPLATES
 */

const TARGET_CONDITION_FILTER_TEMPLATE = {
    creatureTypes: [],
    excludeCreatureTypes: [],
    sizes: [],
    alignments: [],
    hasCondition: [],
    isNativeToPlane: false
};

const EFFECT_TRIGGER_TEMPLATE = {
    type: "immediate",
    frequency: "every_time",
    consumption: "unlimited",
    attackFilter: {
        weaponType: "any",
        attackType: "any"
    },
    movementType: "any",
    sustainCost: {
        actionType: "action",
        optional: false
    }
};

const SAVE_MODIFIER_TEMPLATE = {
    type: "advantage",
    value: 0,
    appliesTo: TARGET_CONDITION_FILTER_TEMPLATE,
    reason: "",
    advantageOnDamage: false,
    sizeAdvantage: [],
    sizeDisadvantage: []
};

const EFFECT_CONDITION_TEMPLATE = {
    type: "always",
    saveType: "Strength",
    saveEffect: "none",
    targetFilter: TARGET_CONDITION_FILTER_TEMPLATE,
    requiresStatus: [],
    saveModifiers: []
};

const SCALING_FORMULA_TEMPLATE = {
    type: "slot_level",
    bonusPerLevel: "",
    customFormula: ""
};

/**
 * MASTER TEMPLATE
 * Represents the "Perfect" Spell JSON structure.
 */
const MASTER_TEMPLATE = {
    id: "",
    name: "",
    aliases: [],
    level: 0,
    school: "Abjuration",
    source: "PHB 2014",
    legacy: false,
    classes: [],
    ritual: false,
    rarity: "common",
    attackType: "",
    castingTime: {
        value: 1,
        unit: "action",
        combatCost: {
            type: "action",
            condition: ""
        },
        explorationCost: {
            value: 0,
            unit: "minute"
        }
    },
    range: {
        type: "ranged",
        distance: 0
    },
    components: {
        verbal: false,
        somatic: false,
        material: false,
        materialDescription: "",
        materialCost: 0,
        isConsumed: false
    },
    duration: {
        type: "instantaneous",
        value: 0,
        unit: "round",
        concentration: false
    },
    targeting: {
        type: "single",
        range: 0,
        maxTargets: 1,
        validTargets: [],
        lineOfSight: true,
        areaOfEffect: {
            shape: "Sphere",
            size: 0,
            height: 0
        },
        filter: TARGET_CONDITION_FILTER_TEMPLATE
    },
    effects: [],
    arbitrationType: "mechanical",
    aiContext: {
        prompt: "",
        playerInputRequired: false
    },
    description: "",
    higherLevels: "",
    tags: []
};

function deepMerge(target: any, template: any): any {
    if (target === null || target === undefined) return template;
    if (typeof template !== 'object' || Array.isArray(template)) return target;

    const result = { ...target };

    for (const key in template) {
        const templateValue = template[key];
        const targetValue = target[key];

        if (Array.isArray(templateValue)) {
            result[key] = Array.isArray(targetValue) ? targetValue : (targetValue !== undefined ? [targetValue] : templateValue);
        } else if (templateValue !== null && typeof templateValue === 'object') {
            result[key] = deepMerge(targetValue || {}, templateValue);
        } else {
            result[key] = targetValue !== undefined ? targetValue : templateValue;
        }
    }

    return result;
}

function expandEffect(effect: any): any {
    let expanded = deepMerge(effect, {
        trigger: EFFECT_TRIGGER_TEMPLATE,
        condition: EFFECT_CONDITION_TEMPLATE,
        scaling: SCALING_FORMULA_TEMPLATE,
        description: ""
    });

    if (expanded.condition.targetFilter) {
        expanded.condition.targetFilter = deepMerge(expanded.condition.targetFilter, TARGET_CONDITION_FILTER_TEMPLATE);
    }
    if (Array.isArray(expanded.condition.saveModifiers)) {
        expanded.condition.saveModifiers = expanded.condition.saveModifiers.map((m: any) => deepMerge(m, SAVE_MODIFIER_TEMPLATE));
    }

    if (expanded.type === "DAMAGE") {
        expanded = deepMerge(expanded, { damage: { dice: "", type: "" } });
    } else if (expanded.type === "HEALING") {
        expanded = deepMerge(expanded, { healing: { dice: "", isTemporaryHp: false } });
    } else if (expanded.type === "STATUS_CONDITION") {
        expanded = deepMerge(expanded, {
            statusCondition: {
                name: "",
                duration: { type: "rounds", value: 0 },
                level: 0,
                escapeCheck: { dc: 0, actionCost: "action" },
                repeatSave: { timing: "turn_end", saveType: "Wisdom", successEnds: true, useOriginalDC: true }
            }
        });
    } else if (expanded.type === "MOVEMENT") {
        expanded = deepMerge(expanded, {
            movementType: "push",
            distance: 0,
            speedChange: { stat: "speed", value: 0, unit: "feet" },
            duration: { type: "rounds", value: 0 },
            forcedMovement: { usesReaction: false, direction: "away_from_caster", maxDistance: "" }
        });
    } else if (expanded.type === "TERRAIN") {
        expanded = deepMerge(expanded, {
            terrainType: "difficult",
            areaOfEffect: { shape: "Sphere", size: 0, height: 0 },
            duration: { type: "rounds", value: 0 },
            damage: { dice: "", type: "" },
            wallProperties: { hp: 0, ac: 0 },
            dispersedByStrongWind: false,
            manipulation: { type: "cosmetic", volume: { shape: "Cube", size: 0, depth: 0 }, duration: { type: "rounds", value: 0 }, depositDistance: 0 }
        });
    } else if (expanded.type === "UTILITY") {
        expanded = deepMerge(expanded, {
            utilityType: "other",
            description: "",
            grantedActions: [],
            attackAugments: [],
            controlOptions: [],
            taunt: { disadvantageAgainstOthers: false, leashRangeFeet: 0, breakConditions: [] },
            savePenalty: { dice: "", flat: 0, applies: "next_save", duration: { type: "rounds", value: 0 } },
            light: { brightRadius: 0, dimRadius: 0, attachedTo: "caster", color: "" }
        });
    } else if (expanded.type === "DEFENSIVE") {
        expanded = deepMerge(expanded, {
            defenseType: "ac_bonus",
            value: 0,
            baseACFormula: "",
            acMinimum: 0,
            damageType: [],
            savingThrow: [],
            duration: { type: "rounds", value: 0 },
            attackerFilter: TARGET_CONDITION_FILTER_TEMPLATE,
            reactionTrigger: { event: "when_hit", includesSpells: [] },
            restrictions: { noArmor: false, noShield: false, targetSelf: false }
        });
    }

    return expanded;
}

function processSpell(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const spellData = JSON.parse(content);

    let expandedData = deepMerge(spellData, MASTER_TEMPLATE);

    if (expandedData.arbitrationType === "") {
        expandedData.arbitrationType = "mechanical";
    }

    if (Array.isArray(expandedData.effects)) {
        expandedData.effects = expandedData.effects.map(expandEffect);
    }

    // Re-order keys to match MASTER_TEMPLATE for consistency
    const orderedData: any = {};
    Object.keys(MASTER_TEMPLATE).forEach(key => {
        orderedData[key] = expandedData[key];
    });

    const output = JSON.stringify(orderedData, null, 2);

    if (content !== output) {
        if (SHOULD_WRITE) {
            fs.writeFileSync(filePath, output, 'utf-8');
            console.log(`[EXPANDED] ${filePath}`);
        } else {
            console.log(`[MISSING KEYS] ${filePath}`);
        }
        return true;
    }
    return false;
}

function main() {
    const files = globSync(SPELL_DATA_DIR);
    console.log(`Found ${files.length} spell files.`);

    let count = 0;
    files.forEach(file => {
        if (processSpell(file)) {
            count++;
        }
    });

    console.log(`\nSummary:`);
    console.log(`Total files: ${files.length}`);
    console.log(`Files needing expansion: ${count}`);
    if (!SHOULD_WRITE && count > 0) {
        console.log(`\nRun with --write to apply changes.`);
    }
}

main();
