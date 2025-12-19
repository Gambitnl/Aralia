
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InfernalMechanics } from '../InfernalMechanics';
import { createMockGameState } from '../../../utils/factories';
import { ContractGenerationParams, InfernalContract } from '../../../types/infernal';

describe('InfernalMechanics', () => {
  let gameState = createMockGameState();

  beforeEach(() => {
    gameState = createMockGameState();
    gameState.activeContracts = []; // Ensure clean state
    vi.clearAllMocks();
  });

  describe('draftContract', () => {
    it('should generate a contract with correct parameters', () => {
      const params: ContractGenerationParams = {
        type: 'soul_pact',
        grantorId: 'devil_1',
        grantorName: 'Asmodeus',
        signeeId: 'player_1',
        signeeName: 'Hero',
        tier: 'archduke'
      };

      const contract = InfernalMechanics.draftContract(params);

      expect(contract.id).toBeDefined();
      expect(contract.type).toBe('soul_pact');
      expect(contract.grantorName).toBe('Asmodeus');
      expect(contract.status).toBe('draft');
      expect(contract.clauses.length).toBeGreaterThan(0);
      expect(contract.signatureBlood).toBe(false);
    });
  });

  describe('signContract', () => {
    it('should activate a drafted contract', () => {
      const params: ContractGenerationParams = {
        type: 'service_agreement',
        grantorId: 'devil_2',
        grantorName: 'Mephistopheles',
        signeeId: 'player_1',
        signeeName: 'Hero',
        tier: 'greater'
      };

      const contract = InfernalMechanics.draftContract(params);
      InfernalMechanics.signContract(contract, gameState);

      expect(contract.status).toBe('active');
      expect(contract.dateSigned).toBeDefined();
      expect(contract.signatureBlood).toBe(true);
      expect(gameState.activeContracts).toContain(contract);

      // Check for notification
      expect(gameState.notifications.length).toBeGreaterThan(0);
      expect(gameState.notifications[0].message).toContain('The deal is struck');
    });
  });

  describe('breachContract', () => {
    it('should mark contract as breached and notify', () => {
      const params: ContractGenerationParams = {
        type: 'soul_pact',
        grantorId: 'devil_1',
        grantorName: 'Baalzebul',
        signeeId: 'player_1',
        signeeName: 'Hero',
        tier: 'lesser'
      };

      const contract = InfernalMechanics.draftContract(params);
      InfernalMechanics.signContract(contract, gameState);

      InfernalMechanics.breachContract(contract, gameState, 'Found a loophole? No.');

      expect(contract.status).toBe('breached');
      expect(gameState.notifications.some(n => n.message.includes('CONTRACT BREACHED'))).toBe(true);
    });
  });
});
