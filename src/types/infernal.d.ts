export type ContractType = 'soul_pact' | 'service_agreement' | 'power_exchange' | 'forbidden_knowledge';
export type ContractStatus = 'draft' | 'active' | 'fulfilled' | 'breached' | 'void' | 'collected';
export interface ContractClause {
    id: string;
    description: string;
    type: 'boon' | 'obligation' | 'penalty';
    mechanics?: string;
    triggerCondition?: string;
}
export interface InfernalContract {
    id: string;
    title: string;
    description: string;
    type: ContractType;
    grantorId: string;
    grantorName: string;
    signeeId: string;
    signeeName: string;
    dateSigned?: number;
    status: ContractStatus;
    clauses: ContractClause[];
    soulsCollected?: number;
    soulsRequired?: number;
    servicesRendered?: number;
    servicesRequired?: number;
    finePrint?: ContractClause[];
    signatureBlood?: boolean;
}
export interface ContractGenerationParams {
    type: ContractType;
    grantorId: string;
    grantorName: string;
    signeeId: string;
    signeeName: string;
    tier: 'minor' | 'lesser' | 'greater' | 'archduke';
}
