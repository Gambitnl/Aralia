import { z } from 'zod';
export declare const ItemSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    description: z.ZodString;
    cost: z.ZodDefault<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
    weight: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    rarity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        common: "common";
        uncommon: "uncommon";
        rare: "rare";
        very_rare: "very_rare";
        legendary: "legendary";
    }>>>;
    type: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    effects: z.ZodOptional<z.ZodArray<z.ZodAny>>;
}, z.core.$strip>;
export declare const EconomyStateSchema: z.ZodObject<{
    scarcity: z.ZodDefault<z.ZodArray<z.ZodString>>;
    surplus: z.ZodDefault<z.ZodArray<z.ZodString>>;
    sentiment: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const InventoryResponseSchema: z.ZodObject<{
    inventory: z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        description: z.ZodString;
        cost: z.ZodDefault<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
        weight: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        rarity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            common: "common";
            uncommon: "uncommon";
            rare: "rare";
            very_rare: "very_rare";
            legendary: "legendary";
        }>>>;
        type: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        effects: z.ZodOptional<z.ZodArray<z.ZodAny>>;
    }, z.core.$strip>>;
    economy: z.ZodOptional<z.ZodObject<{
        scarcity: z.ZodDefault<z.ZodArray<z.ZodString>>;
        surplus: z.ZodDefault<z.ZodArray<z.ZodString>>;
        sentiment: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const MonsterSchema: z.ZodObject<{
    name: z.ZodString;
    quantity: z.ZodNumber;
    cr: z.ZodString;
    description: z.ZodString;
}, z.core.$strip>;
export declare const CustomActionSchema: z.ZodObject<{
    type: z.ZodOptional<z.ZodString>;
    label: z.ZodString;
    geminiPrompt: z.ZodOptional<z.ZodString>;
    check: z.ZodOptional<z.ZodString>;
    targetNpcId: z.ZodOptional<z.ZodString>;
    eventResidue: z.ZodOptional<z.ZodObject<{
        text: z.ZodString;
        discoveryDc: z.ZodNumber;
    }, z.core.$strip>>;
    isEgregious: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const GoalUpdatePayloadSchema: z.ZodObject<{
    npcId: z.ZodString;
    goalId: z.ZodString;
    newStatus: z.ZodEnum<{
        Unknown: "Unknown";
        Active: "Active";
        Completed: "Completed";
        Failed: "Failed";
    }>;
}, z.core.$strip>;
export declare const SocialOutcomeSchema: z.ZodObject<{
    outcomeText: z.ZodString;
    dispositionChange: z.ZodOptional<z.ZodNumber>;
    memoryFactText: z.ZodOptional<z.ZodString>;
    goalUpdate: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        npcId: z.ZodString;
        goalId: z.ZodString;
        newStatus: z.ZodEnum<{
            Unknown: "Unknown";
            Active: "Active";
            Completed: "Completed";
            Failed: "Failed";
        }>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
