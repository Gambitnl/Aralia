import { describe, it, expect } from 'vitest';
import { ActionValidator, ActionValidationRequest } from '../ActionValidator';
import { createMockCombatCharacter } from '../../../utils/core/factories';
import { BattleMapData, BattleMapTile } from '../../../types/combat';

// Helper to create a basic battle map for line-of-sight tests
function createTestBattleMap(width = 10, height = 10, blockers: { x: number; y: number }[] = []): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  const blockerSet = new Set(blockers.map(b => `${b.x}-${b.y}`));

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const key = `${x}-${y}`;
      tiles.set(key, {
        coordinates: { x, y },
        type: 'floor',
        walkable: !blockerSet.has(key),
        blocksLoS: blockerSet.has(key),
        coverType: 'none',
        airspace: {
          airAltitudeFeet: 0,
          groundAltitudeFeet: 0,
          ceilingAltitudeFeet: 30,
        },
      });
    }
  }

  return {
    id: 'test-map',
    name: 'Test Arena',
    width,
    height,
    tiles,
    decorations: [],
    zones: [],
    interactiveObjects: [],
  };
}

describe('ActionValidator', () => {
  describe('Condition Prerequisites', () => {
    it('allows healthy, unhindered characters to act', () => {
      const actor = createMockCombatCharacter({ currentHP: 20, maxHP: 20 });
      const result = ActionValidator.validateConditionPrerequisites(actor);
      expect(result.isValid).toBe(true);
    });

    it('rejects actions from characters with 0 HP (downed/unconscious)', () => {
      const actor = createMockCombatCharacter({ currentHP: 0, maxHP: 20 });
      const result = ActionValidator.validateConditionPrerequisites(actor);
      expect(result.isValid).toBe(false);
      expect(result.code).toBe('INCAPACITATED');
      expect(result.reason).toContain('incapacitated or unconscious with 0 HP');
    });

    it('rejects actions when character is stunned', () => {
      const actor = createMockCombatCharacter({
        currentHP: 15,
        conditions: ['stunned'],
      });
      const result = ActionValidator.validateConditionPrerequisites(actor);
      expect(result.isValid).toBe(false);
      expect(result.code).toBe('INCAPACITATED');
      expect(result.reason).toContain('stunned');
    });

    it('rejects actions when character is paralyzed via statusEffects', () => {
      const actor = createMockCombatCharacter({
        currentHP: 15,
        statusEffects: [{ id: 'paralyzed-1', name: 'Paralyzed', duration: 1 }],
      });
      const result = ActionValidator.validateConditionPrerequisites(actor);
      expect(result.isValid).toBe(false);
      expect(result.code).toBe('INCAPACITATED');
    });

    it('rejects verbal spellcasting when character is silenced', () => {
      const actor = createMockCombatCharacter({
        currentHP: 15,
        conditions: ['silenced'],
      });
      const result = ActionValidator.validateConditionPrerequisites(actor, {
        components: { verbal: true, somatic: false, material: false },
      });
      expect(result.isValid).toBe(false);
      expect(result.code).toBe('SILENCED_VERBAL');
      expect(result.reason).toContain('silenced');
    });

    it('permits non-verbal spellcasting when character is silenced', () => {
      const actor = createMockCombatCharacter({
        currentHP: 15,
        conditions: ['silenced'],
      });
      const result = ActionValidator.validateConditionPrerequisites(actor, {
        components: { verbal: false, somatic: true, material: false },
      });
      expect(result.isValid).toBe(true);
    });

    it('rejects actions requiring sight when character is blinded', () => {
      const actor = createMockCombatCharacter({
        currentHP: 15,
        conditions: ['blinded'],
      });
      const result = ActionValidator.validateConditionPrerequisites(actor, {
        requiresSight: true,
      });
      expect(result.isValid).toBe(false);
      expect(result.code).toBe('BLINDED_SIGHT_REQUIRED');
    });

    it('rejects movement when character is grappled or restrained', () => {
      const actor = createMockCombatCharacter({
        currentHP: 15,
        conditions: ['restrained'],
      });
      const result = ActionValidator.validateConditionPrerequisites(actor, {
        actionCost: { type: 'movement-only', movementCost: 15 },
      });
      expect(result.isValid).toBe(false);
      expect(result.code).toBe('CONDITION_BLOCKED');
      expect(result.reason).toContain('restrained');
    });
  });

  describe('Resource Cost Validation', () => {
    it('validates action economy availability', () => {
      const actor = createMockCombatCharacter();

      // Action available
      expect(ActionValidator.validateResourceCosts(actor, { type: 'action' }).isValid).toBe(true);

      // Action already used
      actor.actionEconomy.action.used = true;
      actor.actionEconomy.action.remaining = 0;
      const actionResult = ActionValidator.validateResourceCosts(actor, { type: 'action' });
      expect(actionResult.isValid).toBe(false);
      expect(actionResult.code).toBe('INSUFFICIENT_ACTION_RESOURCE');

      // Bonus Action
      expect(ActionValidator.validateResourceCosts(actor, { type: 'bonus' }).isValid).toBe(true);
      actor.actionEconomy.bonusAction.used = true;
      actor.actionEconomy.bonusAction.remaining = 0;
      expect(ActionValidator.validateResourceCosts(actor, { type: 'bonus' }).isValid).toBe(false);

      // Reaction
      expect(ActionValidator.validateResourceCosts(actor, { type: 'reaction' }).isValid).toBe(true);
      actor.actionEconomy.reaction.used = true;
      actor.actionEconomy.reaction.remaining = 0;
      expect(ActionValidator.validateResourceCosts(actor, { type: 'reaction' }).isValid).toBe(false);
    });

    it('validates movement points correctly', () => {
      const actor = createMockCombatCharacter();
      actor.actionEconomy.movement = { total: 30, used: 10 };

      // 15ft is affordable (20ft remaining)
      expect(ActionValidator.validateResourceCosts(actor, { type: 'movement-only', movementCost: 15 }).isValid).toBe(true);

      // 25ft exceeds available 20ft
      const failResult = ActionValidator.validateResourceCosts(actor, { type: 'movement-only', movementCost: 25 });
      expect(failResult.isValid).toBe(false);
      expect(failResult.code).toBe('INSUFFICIENT_MOVEMENT');
    });

    it('validates spell slots and allows Dev Playtest override', () => {
      const actor = createMockCombatCharacter({
        spellSlots: {
          level_1: { current: 1, max: 2 },
          level_2: { current: 0, max: 1 },
        },
      });

      // Level 1 slot is available
      expect(ActionValidator.validateResourceCosts(actor, { type: 'action', spellSlotLevel: 1 }).isValid).toBe(true);

      // Level 2 slot is empty
      const failResult = ActionValidator.validateResourceCosts(actor, { type: 'action', spellSlotLevel: 2 });
      expect(failResult.isValid).toBe(false);
      expect(failResult.code).toBe('INSUFFICIENT_SPELL_SLOTS');

      // Dev playtest unlimited slots bypasses requirement
      const devActor = {
        ...actor,
        devPlaytest: { unlimitedSpellSlots: true },
      };
      expect(ActionValidator.validateResourceCosts(devActor as any, { type: 'action', spellSlotLevel: 2 }).isValid).toBe(true);
    });

    it('validates Ki points for Monk abilities', () => {
      const actor = createMockCombatCharacter({
        limitedUses: {
          ki: { name: 'Ki', current: 2, max: 5, resetOn: 'short_rest' },
        },
      });

      // 2 Ki needed, 2 available
      expect(ActionValidator.validateResourceCosts(actor, { type: 'bonus', kiCost: 2 }).isValid).toBe(true);

      // 3 Ki needed, only 2 available
      const failResult = ActionValidator.validateResourceCosts(actor, { type: 'bonus', kiCost: 3 });
      expect(failResult.isValid).toBe(false);
      expect(failResult.code).toBe('INSUFFICIENT_KI');
    });

    it('validates Sorcery Points for Metamagic', () => {
      const actor = createMockCombatCharacter({
        limitedUses: {
          sorcery_points: { name: 'Sorcery Points', current: 3, max: 4, resetOn: 'long_rest' },
        },
      });

      // 2 SP needed, 3 available
      expect(ActionValidator.validateResourceCosts(actor, { type: 'bonus', sorceryPointsCost: 2 }).isValid).toBe(true);

      // 4 SP needed, 3 available
      const failResult = ActionValidator.validateResourceCosts(actor, { type: 'bonus', sorceryPointsCost: 4 });
      expect(failResult.isValid).toBe(false);
      expect(failResult.code).toBe('INSUFFICIENT_SORCERY_POINTS');
    });

    it('validates custom limited use pools', () => {
      const actor = createMockCombatCharacter({
        limitedUses: {
          action_surge: { name: 'Action Surge', current: 1, max: 1, resetOn: 'short_rest' },
        },
      });

      expect(ActionValidator.validateResourceCosts(actor, {
        type: 'free',
        customResourceId: 'action_surge',
        customResourceCost: 1,
      }).isValid).toBe(true);

      const failResult = ActionValidator.validateResourceCosts(actor, {
        type: 'free',
        customResourceId: 'action_surge',
        customResourceCost: 2,
      });
      expect(failResult.isValid).toBe(false);
      expect(failResult.code).toBe('INSUFFICIENT_LIMITED_USES');
    });
  });

  describe('Target Type Requirements', () => {
    it('validates self-targeting', () => {
      const actor = createMockCombatCharacter({ id: 'hero-1' });
      const targetAlly = createMockCombatCharacter({ id: 'hero-2', team: 'player' });

      expect(ActionValidator.validateTargetType(actor, { kind: 'self', id: 'hero-1' }, 'self').isValid).toBe(true);

      const failResult = ActionValidator.validateTargetType(actor, { kind: 'ally', id: 'hero-2', character: targetAlly }, 'self');
      expect(failResult.isValid).toBe(false);
      expect(failResult.code).toBe('INVALID_TARGET_TYPE');
    });

    it('validates enemy vs ally targeting', () => {
      const actor = createMockCombatCharacter({ id: 'hero-1', team: 'player' });
      const enemy = createMockCombatCharacter({ id: 'goblin-1', team: 'enemy', currentHP: 10 });
      const ally = createMockCombatCharacter({ id: 'hero-2', team: 'player', currentHP: 10 });

      // Hostile attack on enemy
      expect(ActionValidator.validateTargetType(actor, { kind: 'enemy', character: enemy, isEnemy: true }, 'enemy').isValid).toBe(true);

      // Hostile attack on ally
      const failAttack = ActionValidator.validateTargetType(actor, { kind: 'ally', character: ally, isEnemy: false }, 'enemy');
      expect(failAttack.isValid).toBe(false);
      expect(failAttack.code).toBe('INVALID_TARGET_TYPE');

      // Heal on ally
      expect(ActionValidator.validateTargetType(actor, { kind: 'ally', character: ally, isEnemy: false }, 'ally').isValid).toBe(true);

      // Heal on enemy
      const failHeal = ActionValidator.validateTargetType(actor, { kind: 'enemy', character: enemy, isEnemy: true }, 'ally');
      expect(failHeal.isValid).toBe(false);
      expect(failHeal.code).toBe('INVALID_TARGET_TYPE');
    });

    it('validates corpse targeting and rejects targeting dead creatures with living-only actions', () => {
      const actor = createMockCombatCharacter({ id: 'hero-1', team: 'player' });
      const deadEnemy = createMockCombatCharacter({ id: 'goblin-1', team: 'enemy', currentHP: 0 });

      // Corpse targeting spell (e.g. Speak with Dead)
      expect(ActionValidator.validateTargetType(actor, { kind: 'corpse', character: deadEnemy }, 'corpse').isValid).toBe(true);

      // Living creature spell targeting dead enemy
      const failResult = ActionValidator.validateTargetType(actor, { kind: 'enemy', character: deadEnemy }, 'enemy');
      expect(failResult.isValid).toBe(false);
      expect(failResult.code).toBe('INVALID_TARGET_STATE');
    });

    it('validates interactive map objects and ground point targeting', () => {
      const actor = createMockCombatCharacter({ id: 'hero-1' });

      expect(ActionValidator.validateTargetType(actor, { kind: 'object', object: { id: 'chest-1', name: 'Chest' } as any }, 'object').isValid).toBe(true);
      expect(ActionValidator.validateTargetType(actor, { kind: 'point', position: { x: 5, y: 5 } }, 'point').isValid).toBe(true);
    });
  });

  describe('Range and Line-of-Sight Validation', () => {
    it('validates self-range and touch-range distances', () => {
      const actor = createMockCombatCharacter({ position: { x: 2, y: 2 } });

      // Self range
      expect(ActionValidator.validateRange(actor, { x: 2, y: 2 }, 'self').isValid).toBe(true);
      expect(ActionValidator.validateRange(actor, { x: 2, y: 3 }, 'self').isValid).toBe(false);

      // Touch range (5ft / 1 tile)
      expect(ActionValidator.validateRange(actor, { x: 3, y: 2 }, 'touch').isValid).toBe(true); // 1 tile east
      expect(ActionValidator.validateRange(actor, { x: 3, y: 3 }, 'touch').isValid).toBe(true); // 1 tile diagonal
      const failTouch = ActionValidator.validateRange(actor, { x: 4, y: 2 }, 'touch'); // 2 tiles east = 10ft
      expect(failTouch.isValid).toBe(false);
      expect(failTouch.code).toBe('OUT_OF_RANGE');
    });

    it('validates ranged distance limits', () => {
      const actor = createMockCombatCharacter({ position: { x: 0, y: 0 } });

      // 30ft range = 6 tiles max
      expect(ActionValidator.validateRange(actor, { x: 6, y: 6 }, 30).isValid).toBe(true); // 6 tiles Chebyshev = 30ft
      const failRange = ActionValidator.validateRange(actor, { x: 7, y: 0 }, 30); // 7 tiles = 35ft
      expect(failRange.isValid).toBe(false);
      expect(failRange.code).toBe('OUT_OF_RANGE');
    });

    it('validates line-of-sight across open map vs through solid obstacles', () => {
      // Map with wall at (2,2)
      const mapData = createTestBattleMap(10, 10, [{ x: 2, y: 2 }]);

      // Clear line of sight from (0,0) to (5,0)
      const clearLoS = ActionValidator.validateLineOfSight({ x: 0, y: 0 }, { x: 5, y: 0 }, mapData);
      expect(clearLoS.isValid).toBe(true);

      // Blocked line of sight from (0,0) to (4,4) through wall at (2,2)
      const blockedLoS = ActionValidator.validateLineOfSight({ x: 0, y: 0 }, { x: 4, y: 4 }, mapData);
      expect(blockedLoS.isValid).toBe(false);
      expect(blockedLoS.code).toBe('NO_LINE_OF_SIGHT');
    });
  });

  describe('End-to-End Composite Validation', () => {
    it('validates a complete legal action request', () => {
      const actor = createMockCombatCharacter({
        position: { x: 1, y: 1 },
        spellSlots: { level_1: { current: 2, max: 4 } },
      });
      const enemy = createMockCombatCharacter({
        id: 'orc-1',
        team: 'enemy',
        currentHP: 15,
        position: { x: 3, y: 1 },
      });
      const mapData = createTestBattleMap();

      const request: ActionValidationRequest = {
        actor,
        actionName: 'Guiding Bolt',
        actionCost: { type: 'action', spellSlotLevel: 1 },
        target: { kind: 'enemy', character: enemy, isEnemy: true, position: { x: 3, y: 1 } },
        targetRequirement: 'enemy',
        range: 120,
        requiresLineOfSight: true,
        components: { verbal: true, somatic: true, material: false },
        mapData,
      };

      const result = ActionValidator.validate(request);
      expect(result.isValid).toBe(true);
    });

    it('rejects action request early when prerequisite condition fails', () => {
      const actor = createMockCombatCharacter({
        position: { x: 1, y: 1 },
        conditions: ['unconscious'],
      });
      const enemy = createMockCombatCharacter({
        id: 'orc-1',
        team: 'enemy',
        currentHP: 15,
        position: { x: 3, y: 1 },
      });

      const request: ActionValidationRequest = {
        actor,
        actionName: 'Attack',
        actionCost: { type: 'action' },
        target: { kind: 'enemy', character: enemy, isEnemy: true },
        targetRequirement: 'enemy',
      };

      const result = ActionValidator.validate(request);
      expect(result.isValid).toBe(false);
      expect(result.code).toBe('INCAPACITATED');
    });
  });
});
