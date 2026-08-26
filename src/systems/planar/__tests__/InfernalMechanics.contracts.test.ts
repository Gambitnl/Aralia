/**
 * PK-14 / agora-ea68 — boon application, breach detection and penalty resolution.
 *
 * The original InfernalMechanics.test.ts covers drafting, signing and the breach
 * notification. This file covers the mechanics those three steps now drive: what a
 * signed contract actually gives the party, which live conditions break a contract,
 * and what the Hells take when one does.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { InfernalMechanics } from '../InfernalMechanics';
import { createMockGameState, createMockPlayerCharacter } from '../../../utils/core';
import { ContractGenerationParams } from '../../../types/infernal';
import { CrimeType } from '../../../types/crime';
import { GameState } from '../../../types/index';
import { PlayerCharacter } from '../../../types/character';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function makeState(signee: PlayerCharacter): GameState {
  const state = createMockGameState();
  state.party = [signee];
  state.activeContracts = [];
  state.notoriety = { globalHeat: 0, localHeat: {}, knownCrimes: [], bounties: [] };
  return state;
}

function params(overrides: Partial<ContractGenerationParams> = {}): ContractGenerationParams {
  return {
    type: 'soul_pact',
    grantorId: 'devil_asmodeus',
    grantorName: 'Asmodeus',
    signeeId: 'signee_1',
    signeeName: 'Hero',
    tier: 'lesser',
    ...overrides
  };
}

describe('InfernalMechanics contract mechanics', () => {
  let signee: PlayerCharacter;
  let gameState: GameState;

  beforeEach(() => {
    signee = createMockPlayerCharacter({ id: 'signee_1', name: 'Hero', hp: 200, maxHp: 200 });
    gameState = makeState(signee);
  });

  describe('applyImmediateClauses', () => {
    it('raises the signee ability score named by a soul pact boon', () => {
      const before = signee.finalAbilityScores.Charisma;

      const contract = InfernalMechanics.draftContract(params({ type: 'soul_pact' }));
      InfernalMechanics.signContract(contract, gameState);

      expect(gameState.party[0].abilityScores.Charisma).toBe(before + 2);
      expect(gameState.party[0].finalAbilityScores.Charisma).toBe(before + 2);
    });

    it('pays the service advance into the party purse and scales it by tier', () => {
      const startingGold = gameState.gold;

      const contract = InfernalMechanics.draftContract(params({ type: 'service_agreement', tier: 'greater' }));
      InfernalMechanics.signContract(contract, gameState);

      // greater => multiplier 4 => 2000 gold.
      expect(gameState.gold).toBe(startingGold + 2000);
      expect(contract.servicesRequired).toBe(4);
      expect(contract.servicesRendered).toBe(0);
    });

    it('places the forbidden-knowledge codex in the party inventory', () => {
      const contract = InfernalMechanics.draftContract(params({ type: 'forbidden_knowledge' }));
      InfernalMechanics.signContract(contract, gameState);

      expect(gameState.inventory.map(item => item.name)).toContain('Codex of Hidden Truths');
    });

    it('leaves the party untouched when the signee is not present', () => {
      const startingGold = gameState.gold;
      const before = signee.finalAbilityScores.Charisma;

      const contract = InfernalMechanics.draftContract(params({ signeeId: 'someone_else' }));
      InfernalMechanics.signContract(contract, gameState);

      expect(gameState.party[0].finalAbilityScores.Charisma).toBe(before);
      expect(gameState.gold).toBe(startingGold);
    });
  });

  describe('detectBreach via checkBreach', () => {
    it('holds while every term is kept', () => {
      const contract = InfernalMechanics.draftContract(params({ type: 'soul_pact' }));
      InfernalMechanics.signContract(contract, gameState);

      InfernalMechanics.checkBreach(gameState);

      expect(contract.status).toBe('active');
    });

    it('breaches a soul pact once a Murder is on the record', () => {
      const contract = InfernalMechanics.draftContract(params({ type: 'soul_pact' }));
      InfernalMechanics.signContract(contract, gameState);

      gameState.notoriety.knownCrimes = [{
        id: 'crime_1',
        type: CrimeType.Murder,
        locationId: 'village-center',
        timestamp: gameState.gameTime.getTime(),
        severity: 90,
        witnessed: true
      }];

      InfernalMechanics.checkBreach(gameState);

      expect(contract.status).toBe('breached');
      expect(gameState.notifications.some(n => n.message.includes('innocent blood'))).toBe(true);
    });

    it('breaches forbidden knowledge when notoriety passes the agreed ceiling', () => {
      const contract = InfernalMechanics.draftContract(params({ type: 'forbidden_knowledge' }));
      InfernalMechanics.signContract(contract, gameState);

      gameState.notoriety.globalHeat = 76;
      InfernalMechanics.checkBreach(gameState);

      expect(contract.status).toBe('breached');
    });

    it('does not breach on notoriety exactly at the ceiling', () => {
      const contract = InfernalMechanics.draftContract(params({ type: 'forbidden_knowledge' }));
      InfernalMechanics.signContract(contract, gameState);

      gameState.notoriety.globalHeat = 75;
      InfernalMechanics.checkBreach(gameState);

      expect(contract.status).toBe('active');
    });

    it('breaches a service agreement whose quota is unmet at the deadline', () => {
      const contract = InfernalMechanics.draftContract(params({ type: 'service_agreement', tier: 'minor' }));
      InfernalMechanics.signContract(contract, gameState);

      gameState.gameTime = new Date(gameState.gameTime.getTime() + 31 * MS_PER_DAY);
      InfernalMechanics.checkBreach(gameState);

      expect(contract.status).toBe('breached');
    });

    it('holds a service agreement whose quota was met before the deadline', () => {
      const contract = InfernalMechanics.draftContract(params({ type: 'service_agreement', tier: 'minor' }));
      InfernalMechanics.signContract(contract, gameState);

      contract.servicesRendered = contract.servicesRequired ?? 0;
      gameState.gameTime = new Date(gameState.gameTime.getTime() + 31 * MS_PER_DAY);
      InfernalMechanics.checkBreach(gameState);

      expect(contract.status).toBe('active');
    });

    it('breaches a power exchange whose souls are undelivered at the deadline', () => {
      const contract = InfernalMechanics.draftContract(params({ type: 'power_exchange', tier: 'minor' }));
      InfernalMechanics.signContract(contract, gameState);

      gameState.gameTime = new Date(gameState.gameTime.getTime() + 91 * MS_PER_DAY);
      InfernalMechanics.checkBreach(gameState);

      expect(contract.status).toBe('breached');
    });
  });

  describe('penalty resolution', () => {
    it('forfeits the purse and wounds the signee on breach', () => {
      gameState.gold = 750;

      const contract = InfernalMechanics.draftContract(params({ type: 'soul_pact' }));
      InfernalMechanics.signContract(contract, gameState);
      InfernalMechanics.breachContract(contract, gameState, 'Terms broken.');

      expect(gameState.gold).toBe(0);
      expect(gameState.party[0].hp).toBeLessThan(200);
      expect(gameState.party[0].hp).toBeGreaterThanOrEqual(0);
    });

    it('rolls the same psychic damage for the same world seed and contract', () => {
      const contract = InfernalMechanics.draftContract(params({ type: 'soul_pact' }));
      InfernalMechanics.signContract(contract, gameState);
      InfernalMechanics.breachContract(contract, gameState, 'Terms broken.');
      const firstDamage = 200 - gameState.party[0].hp;

      const replaySignee = createMockPlayerCharacter({ id: 'signee_1', name: 'Hero', hp: 200, maxHp: 200 });
      const replayState = makeState(replaySignee);
      replayState.worldSeed = gameState.worldSeed;
      const replayContract = { ...contract, status: 'active' as const, clauses: contract.clauses };
      InfernalMechanics.breachContract(replayContract, replayState, 'Terms broken.');

      expect(200 - replayState.party[0].hp).toBe(firstDamage);
      expect(firstDamage).toBeGreaterThan(0);
    });

    it('never drives the signee below zero hit points', () => {
      signee.hp = 3;

      const contract = InfernalMechanics.draftContract(params({ type: 'soul_pact' }));
      InfernalMechanics.signContract(contract, gameState);
      InfernalMechanics.breachContract(contract, gameState, 'Terms broken.');

      expect(gameState.party[0].hp).toBe(0);
    });
  });
});
