import { describe, it, expect } from 'vitest';
import { ActionOutcomeLogger, ActionOutcomePayload } from '../ActionOutcomeLogger';

describe('ActionOutcomeLogger', () => {
  describe('Narrative Prose Generation', () => {
    it('generates rich attack narratives for various outcome qualities', () => {
      const basePayload: ActionOutcomePayload = {
        category: 'attack',
        actionName: 'Longsword Slash',
        quality: 'critical_success',
        actor: { id: 'fighter-1', name: 'Valeros' },
        target: { id: 'goblin-1', name: 'Goblin Scout' },
        details: { damage: 18, damageType: 'slashing' },
      };

      // Critical Success
      const critText = ActionOutcomeLogger.describeOutcome(basePayload);
      expect(critText).toContain('Valeros');
      expect(critText).toContain('Goblin Scout');
      expect(critText).toContain('critical blow');
      expect(critText).toContain('18 slashing damage');

      // Success
      const successText = ActionOutcomeLogger.describeOutcome({ ...basePayload, quality: 'success', details: { damage: 9, damageType: 'slashing' } });
      expect(successText).toContain('strikes Goblin Scout cleanly');
      expect(successText).toContain('9 slashing damage');

      // Partial Success / Glancing Hit
      const partialText = ActionOutcomeLogger.describeOutcome({ ...basePayload, quality: 'partial_success', details: { damage: 3, damageType: 'slashing' } });
      expect(partialText).toContain('grazes Goblin Scout');

      // Failure / Miss
      const missText = ActionOutcomeLogger.describeOutcome({ ...basePayload, quality: 'failure', details: undefined });
      expect(missText).toContain('misses as the target evades');

      // Fumble
      const fumbleText = ActionOutcomeLogger.describeOutcome({ ...basePayload, quality: 'fumble', details: undefined });
      expect(fumbleText).toContain('fumbles their attack');
    });

    it('generates spell casting narratives with status effects and damage', () => {
      const spellPayload: ActionOutcomePayload = {
        category: 'spell',
        actionName: 'Hold Person',
        quality: 'critical_success',
        actor: { id: 'cleric-1', name: 'Kyra' },
        target: { id: 'cultist-1', name: 'Cultist Leader' },
        details: { statusEffect: 'Paralyzed' },
      };

      const critSpell = ActionOutcomeLogger.describeOutcome(spellPayload);
      expect(critSpell).toContain('Arcane energies surge');
      expect(critSpell).toContain('Paralyzed');

      const resistedSpell = ActionOutcomeLogger.describeOutcome({ ...spellPayload, quality: 'failure' });
      expect(resistedSpell).toContain('completely resists or avoids');
    });

    it('generates healing prose for restorative actions', () => {
      const healPayload: ActionOutcomePayload = {
        category: 'heal',
        actionName: 'Cure Wounds',
        quality: 'success',
        actor: { id: 'cleric-1', name: 'Kyra' },
        target: { id: 'fighter-1', name: 'Valeros' },
        details: { healing: 12 },
      };

      const healText = ActionOutcomeLogger.describeOutcome(healPayload);
      expect(healText).toContain('restoring 12 HP to Valeros');

      // Self-heal
      const selfHealText = ActionOutcomeLogger.describeOutcome({
        ...healPayload,
        target: { id: 'cleric-1', name: 'Kyra' },
      });
      expect(selfHealText).toContain('restoring 12 HP to themselves');
    });

    it('generates skill check narratives with roll totals and DCs', () => {
      const checkPayload: ActionOutcomePayload = {
        category: 'skill_check',
        actionName: 'Stealth',
        quality: 'critical_success',
        actor: { id: 'rogue-1', name: 'Merisiel' },
        details: { roll: 25, targetDC: 15 },
      };

      const checkText = ActionOutcomeLogger.describeOutcome(checkPayload);
      expect(checkText).toContain('Merisiel achieves extraordinary success');
      expect(checkText).toContain('(Rolled 25 vs DC 15)');
    });

    it('respects custom narrative override when supplied', () => {
      const payload: ActionOutcomePayload = {
        category: 'social',
        actionName: 'Intimidation',
        quality: 'success',
        actor: { id: 'barbarian-1', name: 'Amiri' },
        customNarrative: 'Amiri slams her colossal blade into the oak table, immediately silencing the room.',
      };

      expect(ActionOutcomeLogger.describeOutcome(payload)).toBe(payload.customNarrative);
    });
  });

  describe('Combat Log Entry Integration', () => {
    it('creates damage combat log entry with structured metadata', () => {
      const payload: ActionOutcomePayload = {
        category: 'attack',
        actionName: 'Fire Bolt',
        quality: 'success',
        actor: { id: 'wizard-1', name: 'Ezren' },
        target: { id: 'skeleton-1', name: 'Skeleton Archer' },
        details: { damage: 8, damageType: 'fire' },
      };

      const entry = ActionOutcomeLogger.createCombatLogEntry(payload);
      expect(entry.type).toBe('damage');
      expect(entry.characterId).toBe('wizard-1');
      expect(entry.targetIds).toEqual(['skeleton-1']);
      expect(entry.data?.damage).toBe(8);
      expect(entry.data?.damageType).toBe('fire');
      expect(entry.data?.actionName).toBe('Fire Bolt');
      expect(entry.message).toContain('Ezren');
    });

    it('creates heal combat log entry for restorative effects', () => {
      const payload: ActionOutcomePayload = {
        category: 'heal',
        actionName: 'Healing Word',
        quality: 'success',
        actor: { id: 'bard-1', name: 'Lem' },
        target: { id: 'fighter-1', name: 'Valeros' },
        details: { healing: 7 },
      };

      const entry = ActionOutcomeLogger.createCombatLogEntry(payload);
      expect(entry.type).toBe('heal');
      expect(entry.characterId).toBe('bard-1');
      expect(entry.targetIds).toEqual(['fighter-1']);
      expect(entry.data?.healing).toBe(7);
    });

    it('creates status combat log entry for conditions', () => {
      const payload: ActionOutcomePayload = {
        category: 'spell',
        actionName: 'Blindness',
        quality: 'success',
        actor: { id: 'wizard-1', name: 'Ezren' },
        target: { id: 'orc-1', name: 'Orc Warrior' },
        details: { statusEffect: 'Blinded' },
      };

      const entry = ActionOutcomeLogger.createCombatLogEntry(payload);
      expect(entry.type).toBe('status');
      expect(entry.data?.statusEffect).toBe('Blinded');
    });
  });

  describe('Adventure Journal Integration', () => {
    it('creates journal event with proper category, world context, and narrative text', () => {
      const payload: ActionOutcomePayload = {
        category: 'skill_check',
        actionName: 'Athletics: Force Open Portcullis',
        quality: 'critical_success',
        actor: { id: 'barbarian-1', name: 'Amiri' },
        details: { roll: 24, targetDC: 20 },
      };

      const journalEvent = ActionOutcomeLogger.createJournalEvent(payload, {
        gameTime: '14th of Kythorn, 1492 DR',
        locationId: 'ruins-entrance',
        questId: 'quest-ancient-crypt',
        xpGained: 50,
      });

      expect(journalEvent.id).toContain('journal-event-');
      expect(journalEvent.type).toBe('skill_check');
      expect(journalEvent.gameTime).toBe('14th of Kythorn, 1492 DR');
      expect(journalEvent.locationId).toBe('ruins-entrance');
      expect(journalEvent.questId).toBe('quest-ancient-crypt');
      expect(journalEvent.xpGained).toBe(50);
      expect(journalEvent.title).toContain('CRITICAL SUCCESS');
      expect(journalEvent.description).toContain('Amiri achieves extraordinary success');
    });
  });

  describe('Composite Logger Helper', () => {
    it('produces narrative text, combat log, and journal event in one unified call', () => {
      const payload: ActionOutcomePayload = {
        category: 'attack',
        actionName: 'Smite',
        quality: 'critical_success',
        actor: { id: 'paladin-1', name: 'Seelah' },
        target: { id: 'demon-1', name: 'Dretch' },
        details: { damage: 32, damageType: 'radiant' },
      };

      const logged = ActionOutcomeLogger.logOutcome(payload, {
        gameTime: '10:30 AM',
        locationId: 'sunken-temple',
      });

      expect(logged.narrative).toBeDefined();
      expect(logged.combatLog).toBeDefined();
      expect(logged.combatLog.type).toBe('damage');
      expect(logged.journalEvent).toBeDefined();
      expect(logged.journalEvent.locationId).toBe('sunken-temple');
    });
  });
});
