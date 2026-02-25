export type RunStatus = 'blocked' | 'completed' | 'failed';
export type RunManifest = {
    run_id: string;
    session_id: string;
    doc_id: string;
    source_doc: string;
    worker_model: string;
    status: RunStatus;
    review_result?: 'pending' | 'accepted' | 'rejected' | 'needs_clarification';
    roadmap_applied?: boolean;
    started_at: string;
    finished_at?: string;
    why_blocked?: string;
    questions?: string[];
    error_reason?: string;
    applied_at?: string;
};
export type Report = {
    run_id: string;
    doc_id: string;
    source_doc: string;
    summary?: string;
    feature_extractions: Array<{
        pillar?: string;
        feature: string;
        subfeatures: string[];
        evidence_refs?: EvidenceRef[];
    }>;
    completion_claims: Array<{
        target_type: 'feature' | 'subfeature' | 'component';
        target_name: string;
        state: 'done' | 'active' | 'planned' | 'unknown';
        rationale: string;
        evidence_refs?: EvidenceRef[];
    }>;
    stale_claims: Array<{
        claim_text: string;
        reason: string;
        proposed_replacement?: string;
        evidence_refs?: EvidenceRef[];
    }>;
    todo_proposals: Array<{
        title: string;
        parent_feature: string;
        parent_subfeature?: string;
        priority?: 'high' | 'medium' | 'low';
        reason: string;
        evidence_refs?: EvidenceRef[];
    }>;
    uncertainties: Array<{
        question: string;
        why_uncertain: string;
        blocking?: boolean;
    }>;
    confidence: 'low' | 'medium' | 'high';
};
export type MovePlan = {
    run_id: string;
    doc_id: string;
    source_doc: string;
    operation: 'move' | 'split';
    reason?: string;
    targets: Array<{
        new_path: string;
        feature_owner: string;
        sections?: string[];
        notes?: string;
    }>;
    provenance_map: Array<{
        source_doc: string;
        source_section?: string;
        target_path: string;
        target_section?: string;
    }>;
};
type EvidenceRef = {
    kind: 'doc' | 'code' | 'test' | 'other';
    path: string;
    line?: number;
    note?: string;
};
export type ValidatedPacket = {
    runDir: string;
    manifestPath: string;
    reportPath: string;
    patchPath: string;
    movePlanPath: string;
    manifest: RunManifest;
    report: Report | null;
    movePlan: MovePlan | null;
};
export declare function validateRunPacket(runDirInput: string): ValidatedPacket;
export {};
