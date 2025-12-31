// TODO(lint-intent): 'CharacterStats' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { CharacterStats as _CharacterStats } from './combat';

export type ContractType = 'soul_pact' | 'service_agreement' | 'power_exchange' | 'forbidden_knowledge';

export type ContractStatus = 'draft' | 'active' | 'fulfilled' | 'breached' | 'void' | 'collected';

export interface ContractClause {
  id: string;
  description: string;
  type: 'boon' | 'obligation' | 'penalty';
  mechanics?: string; // Description of the mechanical effect for UI/Tooltips
  triggerCondition?: string; // e.g. "daily", "on_death", "on_kill"
}

export interface InfernalContract {
  id: string;
  title: string;
  description: string;
  type: ContractType;
  grantorId: string; // The Devil's ID
  grantorName: string;
  signeeId: string; // The Player's ID
  signeeName: string;
  dateSigned?: number; // Game time
  status: ContractStatus;

  clauses: ContractClause[];

  // Specific tracking for contract progress
  soulsCollected?: number;
  soulsRequired?: number;
  servicesRendered?: number;
  servicesRequired?: number;

  // Hidden terms that might be revealed later
  finePrint?: ContractClause[];

  signatureBlood?: boolean; // Flavor: was it signed in blood?
}

export interface ContractGenerationParams {
  type: ContractType;
  grantorId: string;
  grantorName: string;
  signeeId: string;
  signeeName: string;
  tier: 'minor' | 'lesser' | 'greater' | 'archduke';
}
