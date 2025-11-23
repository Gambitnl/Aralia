
/**
 * @file src/data/item_templates/index.ts
 * This file defines the schema objects that serve as templates for the Gemini API
 * when generating game items. These are not TypeScript interfaces, but rather
 * JavaScript objects that describe the expected structure for the AI's JSON output.
 */

export const BaseItemTemplate = {
  id: { type: 'string', description: 'Unique kebab-case ID, generated from the name.' },
  name: { type: 'string', description: 'Display name of the item.' },
  description: { type: 'string', description: 'A flavorful, 2-3 sentence description that is interesting and evocative.' },
  type: { type: 'string', enum: [
    'weapon', 'armor', 'accessory', 'clothing', 
    'consumable', 'potion', 'food_drink', 'poison_toxin', 
    'tool', 'light_source', 'ammunition', 'trap', 
    'note', 'book', 'map', 'scroll', 
    'key', 'spell_component', 'crafting_material', 'treasure'
  ], description: 'The overall category of the item.' },
  weight: { type: 'number', description: 'Weight in pounds. Should be realistic for the item type.' },
  cost: { type: 'string', description: 'Cost in standard D&D currency (e.g., "50 GP", "2 SP", "10 CP").' },
  icon: { type: 'string', description: 'A single, appropriate emoji that best represents the item.' },
};

// --- Equipment Templates ---

export const WeaponTemplate = {
  ...BaseItemTemplate,
  type: { enum: ['weapon'] },
  slot: { type: 'string', enum: ['MainHand', 'OffHand'], description: 'Which hand can equip this weapon.' },
  damageDice: { type: 'string', description: 'Damage dice, e.g., "1d8", "2d6".' },
  damageType: { type: 'string', enum: ['Slashing', 'Piercing', 'Bludgeoning', 'Fire', 'Cold', 'Lightning', 'Acid', 'Poison', 'Force', 'Necrotic', 'Radiant', 'Psychic', 'Thunder'], description: 'The type of damage the weapon deals.' },
  properties: { type: 'array', items: { type: 'string' }, enum: ['Finesse', 'Light', 'Two-Handed', 'Versatile', 'Thrown', 'Ammunition', 'Reach'], description: 'An array of weapon properties.' },
  isMartial: { type: 'boolean', description: 'True if it is a martial weapon, false if it is a simple weapon.' }
};

export const ArmorTemplate = {
    ...BaseItemTemplate,
    type: { enum: ['armor'] },
    slot: { type: 'string', enum: ['Torso', 'Head', 'Feet', 'Wrists', 'OffHand'], description: 'Which slot this armor piece occupies.' },
    armorCategory: { type: 'string', enum: ['Light', 'Medium', 'Heavy', 'Shield'], description: 'The category of armor.'},
    baseArmorClass: { type: 'number', description: 'The base Armor Class provided by this armor. Does not apply to shields.', optional: true },
    addsDexterityModifier: { type: 'boolean', description: 'True if the wearer adds their Dexterity modifier to their AC.', optional: true },
    maxDexterityBonus: { type: 'number', description: 'The maximum Dexterity bonus to AC while wearing this armor (e.g., 2 for Medium armor). Use a large number like 99 for no limit.', optional: true },
    strengthRequirement: { type: 'number', description: 'The minimum Strength score required to wear this armor without penalty. 0 if none.', optional: true },
    stealthDisadvantage: { type: 'boolean', description: 'True if wearing this armor imposes disadvantage on Stealth checks.', optional: true },
    armorClassBonus: { type: 'number', description: 'A direct bonus to AC, primarily used for shields (+2).', optional: true },
};

export const AccessoryTemplate = {
    ...BaseItemTemplate,
    type: { enum: ['accessory'] },
    slot: { type: 'string', enum: ['Neck', 'Ring1', 'Ring2', 'Cloak'], description: 'Which slot this accessory occupies.' },
    requiresAttunement: { type: 'boolean', description: 'Does this accessory require attunement?', optional: true },
    magicalBonus: { type: 'string', description: 'A description of any magical bonus, e.g., "+1 to Wisdom".', optional: true },
};

export const ClothingTemplate = {
    ...BaseItemTemplate,
    type: { enum: ['clothing'] },
    slot: { type: 'string', enum: ['Torso', 'Head', 'Feet', 'Cloak'], description: 'Which slot this clothing occupies.' },
    socialBonus: { type: 'string', description: 'A description of any social bonus, e.g., "+1 to Persuasion".', optional: true },
    providesColdWeatherProtection: { type: 'boolean', description: 'Does this clothing provide protection from cold weather?', optional: true },
};


// --- Consumables & Applicables Templates ---

export const PotionTemplate = {
    ...BaseItemTemplate,
    type: { enum: ['potion'] },
    effectType: { type: 'string', enum: ['Heal', 'Buff', 'Resistance'], description: 'The general effect of the potion.' },
    effectValue: { type: 'string', description: 'The value of the effect, e.g., "2d4+2" for healing, or "fire_resistance".' },
    potionDuration: { type: 'string', description: 'How long the effect lasts, e.g., "1 hour".' },
};

export const FoodDrinkTemplate = {
    ...BaseItemTemplate,
    type: { enum: ['food_drink'] },
    restoresStamina: { type: 'boolean', description: 'Does this item restore stamina or remove exhaustion?' },
    buffGranted: { type: 'string', description: 'A minor, temporary buff granted, e.g., "Well-Fed".', optional: true },
    isAlcoholic: { type: 'boolean', description: 'Is the drink alcoholic?' },
    perishable: { type: 'boolean', description: 'True for most food.' },
    shelfLife: { type: 'string', description: 'Descriptive time until spoilage (e.g., "3 days", "1 week").' },
    nutritionValue: { type: 'number', description: '1-10 scale of how filling/nutritious it is.' }
};

export const PoisonToxinTemplate = {
    ...BaseItemTemplate,
    type: { enum: ['poison_toxin'] },
    applicationMethod: { type: 'string', enum: ['Injury', 'Ingested', 'Contact', 'Inhaled'], description: 'How the poison is applied.' },
    saveDC: { type: 'number', description: 'The DC for the saving throw against the poison.' },
    effectOnFail: { type: 'string', description: 'The condition or damage inflicted on a failed save.' },
};


// --- Tools & Utility Templates ---

export const ToolTemplate = {
    ...BaseItemTemplate,
    type: { enum: ['tool'] },
    grantsProficiency: { type: 'boolean', description: 'Does holding this tool grant proficiency in a task?' },
    skillCheckBonus: { type: 'string', description: 'A bonus to a specific skill check, e.g., "+2 to Investigation".', optional: true },
    associatedSkill: { type: 'string', description: 'The skill this tool is primarily used with.', optional: true },
};

export const LightSourceTemplate = {
    ...BaseItemTemplate,
    type: { enum: ['light_source'] },
    lightRadiusBright: { type: 'number', description: 'The radius of bright light in feet.' },
    lightRadiusDim: { type: 'number', description: 'The radius of dim light in feet beyond the bright light.' },
    durationSeconds: { type: 'number', description: 'How long the light source lasts in seconds. Use 0 for non-expiring sources.' },
    isMagicalLight: { type: 'boolean', description: 'Is the light source magical?' },
};

export const AmmunitionTemplate = {
    ...BaseItemTemplate,
    type: { enum: ['ammunition'] },
    ammoType: { type: 'string', enum: ['arrow', 'bolt', 'sling_bullet'], description: 'The type of ammunition.' },
    quantity: { type: 'number', description: 'How many pieces of ammunition this item represents.' },
    ammoMagicalBonus: { type: 'number', description: 'The magical bonus to attack and damage, e.g., 1 for +1 arrows.', optional: true },
};

export const TrapTemplate = {
    ...BaseItemTemplate,
    type: { enum: ['trap'] },
    setupTime: { type: 'string', description: 'Time required to set up the trap, e.g., "1 action", "1 minute".' },
    trigger: { type: 'string', description: 'The condition that triggers the trap, e.g., "pressure plate", "tripwire".' },
    trapEffect: { type: 'string', description: 'The effect of the trap, e.g., "1d4 piercing damage, speed halved".' },
};

// --- Information & Keys Templates ---

export const BookTemplate = {
    ...BaseItemTemplate,
    type: { enum: ['book'] },
    contentId: { type: 'string', description: 'An ID linking to the full text content of the book.', optional: true },
    grantsSpellId: { type: 'string', description: 'The ID of a spell the book might teach.', optional: true },
    timeToReadMinutes: { type: 'number', description: 'The time in minutes required to read the book for its benefits.', optional: true },
};

export const MapTemplate = {
    ...BaseItemTemplate,
    type: { enum: ['map'] },
    mapId: { type: 'string', description: 'The ID of the map area this item corresponds to.' },
    revealsArea: { type: 'string', description: 'A description of the area or coordinates this map reveals.' },
};

export const ScrollTemplate = {
    ...BaseItemTemplate,
    type: { enum: ['scroll'] },
    spellId: { type: 'string', description: 'The ID of the spell contained on the scroll.' },
    spellLevel: { type: 'number', description: 'The level of the spell on the scroll.' },
    casterLevelRequirement: { type: 'number', description: 'The minimum caster level required to use the scroll without a check.', optional: true },
};


// --- Crafting, Treasure & Quest Templates ---

export const SpellComponentTemplate = {
    ...BaseItemTemplate,
    type: { enum: ['spell_component'] },
    costInGp: { type: 'number', description: 'The cost in Gold Pieces if it has a specific value. 0 if no specific cost.' },
    isConsumed: { type: 'boolean', description: 'Is the component consumed when the spell is cast?' },
    substitutable: { type: 'boolean', description: 'Can this component be replaced by a component pouch or spellcasting focus? Typically true for components with no cost, false for those with a specific GP cost.' },
};

export const CraftingMaterialTemplate = {
    ...BaseItemTemplate,
    type: { enum: ['crafting_material'] },
    materialType: { type: 'string', enum: ['metal', 'wood', 'leather', 'monster_part', 'herb', 'gemstone'], description: 'The type of crafting material.' },
    rarity: { type: 'string', enum: ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary'], description: 'The rarity of the material.' },
};
