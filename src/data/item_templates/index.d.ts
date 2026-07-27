/**
 * @file src/data/item_templates/index.ts
 * This file defines the schema objects that serve as templates for the Gemini API
 * when generating game items. These are not TypeScript interfaces, but rather
 * JavaScript objects that describe the expected structure for the AI's JSON output.
 */
export declare const BaseItemTemplate: {
    id: {
        type: string;
        description: string;
    };
    name: {
        type: string;
        description: string;
    };
    description: {
        type: string;
        description: string;
    };
    type: {
        type: string;
        enum: string[];
        description: string;
    };
    weight: {
        type: string;
        description: string;
    };
    cost: {
        type: string;
        description: string;
    };
    icon: {
        type: string;
        description: string;
    };
};
export declare const WeaponTemplate: {
    type: {
        enum: string[];
    };
    slot: {
        type: string;
        enum: string[];
        description: string;
    };
    damageDice: {
        type: string;
        description: string;
    };
    damageType: {
        type: string;
        enum: string[];
        description: string;
    };
    properties: {
        type: string;
        items: {
            type: string;
        };
        enum: string[];
        description: string;
    };
    isMartial: {
        type: string;
        description: string;
    };
    id: {
        type: string;
        description: string;
    };
    name: {
        type: string;
        description: string;
    };
    description: {
        type: string;
        description: string;
    };
    weight: {
        type: string;
        description: string;
    };
    cost: {
        type: string;
        description: string;
    };
    icon: {
        type: string;
        description: string;
    };
};
export declare const ArmorTemplate: {
    type: {
        enum: string[];
    };
    slot: {
        type: string;
        enum: string[];
        description: string;
    };
    armorCategory: {
        type: string;
        enum: string[];
        description: string;
    };
    baseArmorClass: {
        type: string;
        description: string;
        optional: boolean;
    };
    addsDexterityModifier: {
        type: string;
        description: string;
        optional: boolean;
    };
    maxDexterityBonus: {
        type: string;
        description: string;
        optional: boolean;
    };
    strengthRequirement: {
        type: string;
        description: string;
        optional: boolean;
    };
    stealthDisadvantage: {
        type: string;
        description: string;
        optional: boolean;
    };
    armorClassBonus: {
        type: string;
        description: string;
        optional: boolean;
    };
    id: {
        type: string;
        description: string;
    };
    name: {
        type: string;
        description: string;
    };
    description: {
        type: string;
        description: string;
    };
    weight: {
        type: string;
        description: string;
    };
    cost: {
        type: string;
        description: string;
    };
    icon: {
        type: string;
        description: string;
    };
};
export declare const AccessoryTemplate: {
    type: {
        enum: string[];
    };
    slot: {
        type: string;
        enum: string[];
        description: string;
    };
    requiresAttunement: {
        type: string;
        description: string;
        optional: boolean;
    };
    magicalBonus: {
        type: string;
        description: string;
        optional: boolean;
    };
    id: {
        type: string;
        description: string;
    };
    name: {
        type: string;
        description: string;
    };
    description: {
        type: string;
        description: string;
    };
    weight: {
        type: string;
        description: string;
    };
    cost: {
        type: string;
        description: string;
    };
    icon: {
        type: string;
        description: string;
    };
};
export declare const ClothingTemplate: {
    type: {
        enum: string[];
    };
    slot: {
        type: string;
        enum: string[];
        description: string;
    };
    socialBonus: {
        type: string;
        description: string;
        optional: boolean;
    };
    providesColdWeatherProtection: {
        type: string;
        description: string;
        optional: boolean;
    };
    id: {
        type: string;
        description: string;
    };
    name: {
        type: string;
        description: string;
    };
    description: {
        type: string;
        description: string;
    };
    weight: {
        type: string;
        description: string;
    };
    cost: {
        type: string;
        description: string;
    };
    icon: {
        type: string;
        description: string;
    };
};
export declare const PotionTemplate: {
    type: {
        enum: string[];
    };
    effectType: {
        type: string;
        enum: string[];
        description: string;
    };
    effectValue: {
        type: string;
        description: string;
    };
    potionDuration: {
        type: string;
        description: string;
    };
    id: {
        type: string;
        description: string;
    };
    name: {
        type: string;
        description: string;
    };
    description: {
        type: string;
        description: string;
    };
    weight: {
        type: string;
        description: string;
    };
    cost: {
        type: string;
        description: string;
    };
    icon: {
        type: string;
        description: string;
    };
};
export declare const FoodDrinkTemplate: {
    type: {
        enum: string[];
    };
    restoresStamina: {
        type: string;
        description: string;
    };
    buffGranted: {
        type: string;
        description: string;
        optional: boolean;
    };
    isAlcoholic: {
        type: string;
        description: string;
    };
    perishable: {
        type: string;
        description: string;
    };
    shelfLife: {
        type: string;
        description: string;
    };
    nutritionValue: {
        type: string;
        description: string;
    };
    id: {
        type: string;
        description: string;
    };
    name: {
        type: string;
        description: string;
    };
    description: {
        type: string;
        description: string;
    };
    weight: {
        type: string;
        description: string;
    };
    cost: {
        type: string;
        description: string;
    };
    icon: {
        type: string;
        description: string;
    };
};
export declare const PoisonToxinTemplate: {
    type: {
        enum: string[];
    };
    applicationMethod: {
        type: string;
        enum: string[];
        description: string;
    };
    saveDC: {
        type: string;
        description: string;
    };
    effectOnFail: {
        type: string;
        description: string;
    };
    id: {
        type: string;
        description: string;
    };
    name: {
        type: string;
        description: string;
    };
    description: {
        type: string;
        description: string;
    };
    weight: {
        type: string;
        description: string;
    };
    cost: {
        type: string;
        description: string;
    };
    icon: {
        type: string;
        description: string;
    };
};
export declare const ToolTemplate: {
    type: {
        enum: string[];
    };
    grantsProficiency: {
        type: string;
        description: string;
    };
    skillCheckBonus: {
        type: string;
        description: string;
        optional: boolean;
    };
    associatedSkill: {
        type: string;
        description: string;
        optional: boolean;
    };
    id: {
        type: string;
        description: string;
    };
    name: {
        type: string;
        description: string;
    };
    description: {
        type: string;
        description: string;
    };
    weight: {
        type: string;
        description: string;
    };
    cost: {
        type: string;
        description: string;
    };
    icon: {
        type: string;
        description: string;
    };
};
export declare const LightSourceTemplate: {
    type: {
        enum: string[];
    };
    lightRadiusBright: {
        type: string;
        description: string;
    };
    lightRadiusDim: {
        type: string;
        description: string;
    };
    durationSeconds: {
        type: string;
        description: string;
    };
    isMagicalLight: {
        type: string;
        description: string;
    };
    id: {
        type: string;
        description: string;
    };
    name: {
        type: string;
        description: string;
    };
    description: {
        type: string;
        description: string;
    };
    weight: {
        type: string;
        description: string;
    };
    cost: {
        type: string;
        description: string;
    };
    icon: {
        type: string;
        description: string;
    };
};
export declare const AmmunitionTemplate: {
    type: {
        enum: string[];
    };
    ammoType: {
        type: string;
        enum: string[];
        description: string;
    };
    quantity: {
        type: string;
        description: string;
    };
    ammoMagicalBonus: {
        type: string;
        description: string;
        optional: boolean;
    };
    id: {
        type: string;
        description: string;
    };
    name: {
        type: string;
        description: string;
    };
    description: {
        type: string;
        description: string;
    };
    weight: {
        type: string;
        description: string;
    };
    cost: {
        type: string;
        description: string;
    };
    icon: {
        type: string;
        description: string;
    };
};
export declare const TrapTemplate: {
    type: {
        enum: string[];
    };
    setupTime: {
        type: string;
        description: string;
    };
    trigger: {
        type: string;
        description: string;
    };
    trapEffect: {
        type: string;
        description: string;
    };
    id: {
        type: string;
        description: string;
    };
    name: {
        type: string;
        description: string;
    };
    description: {
        type: string;
        description: string;
    };
    weight: {
        type: string;
        description: string;
    };
    cost: {
        type: string;
        description: string;
    };
    icon: {
        type: string;
        description: string;
    };
};
export declare const BookTemplate: {
    type: {
        enum: string[];
    };
    contentId: {
        type: string;
        description: string;
        optional: boolean;
    };
    grantsSpellId: {
        type: string;
        description: string;
        optional: boolean;
    };
    timeToReadMinutes: {
        type: string;
        description: string;
        optional: boolean;
    };
    id: {
        type: string;
        description: string;
    };
    name: {
        type: string;
        description: string;
    };
    description: {
        type: string;
        description: string;
    };
    weight: {
        type: string;
        description: string;
    };
    cost: {
        type: string;
        description: string;
    };
    icon: {
        type: string;
        description: string;
    };
};
export declare const MapTemplate: {
    type: {
        enum: string[];
    };
    mapId: {
        type: string;
        description: string;
    };
    revealsArea: {
        type: string;
        description: string;
    };
    id: {
        type: string;
        description: string;
    };
    name: {
        type: string;
        description: string;
    };
    description: {
        type: string;
        description: string;
    };
    weight: {
        type: string;
        description: string;
    };
    cost: {
        type: string;
        description: string;
    };
    icon: {
        type: string;
        description: string;
    };
};
export declare const ScrollTemplate: {
    type: {
        enum: string[];
    };
    spellId: {
        type: string;
        description: string;
    };
    spellLevel: {
        type: string;
        description: string;
    };
    casterLevelRequirement: {
        type: string;
        description: string;
        optional: boolean;
    };
    id: {
        type: string;
        description: string;
    };
    name: {
        type: string;
        description: string;
    };
    description: {
        type: string;
        description: string;
    };
    weight: {
        type: string;
        description: string;
    };
    cost: {
        type: string;
        description: string;
    };
    icon: {
        type: string;
        description: string;
    };
};
export declare const SpellComponentTemplate: {
    type: {
        enum: string[];
    };
    costInGp: {
        type: string;
        description: string;
    };
    isConsumed: {
        type: string;
        description: string;
    };
    substitutable: {
        type: string;
        description: string;
    };
    id: {
        type: string;
        description: string;
    };
    name: {
        type: string;
        description: string;
    };
    description: {
        type: string;
        description: string;
    };
    weight: {
        type: string;
        description: string;
    };
    cost: {
        type: string;
        description: string;
    };
    icon: {
        type: string;
        description: string;
    };
};
export declare const CraftingMaterialTemplate: {
    type: {
        enum: string[];
    };
    materialType: {
        type: string;
        enum: string[];
        description: string;
    };
    rarity: {
        type: string;
        enum: string[];
        description: string;
    };
    id: {
        type: string;
        description: string;
    };
    name: {
        type: string;
        description: string;
    };
    description: {
        type: string;
        description: string;
    };
    weight: {
        type: string;
        description: string;
    };
    cost: {
        type: string;
        description: string;
    };
    icon: {
        type: string;
        description: string;
    };
};
