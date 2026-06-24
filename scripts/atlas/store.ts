import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

import type {
    AtlasConfig,
    AtlasExport,
    DocRole,
    DocumentClassification,
    DiscoveredDocument,
    PlanStatus,
    ReviewedState,
    StoredDocument,
    StoredPlan,
} from './types';

/**
 * SQLite storage for Aralia Atlas.
 *
 * The database is the durable Knowledge Tree record: documents, branches,
 * attachments, plan health, and reconciliation runs. Reports and JSON exports
 * are generated from this source so the UI and agents can read friendly files
 * without treating them as the primary state.
 *
 * Called by: reconcile.ts, CLI commands, and tests
 * Depends on: Node's built-in SQLite runtime
 */

// ============================================================================
// SQLite Runtime Types And Row Conversion Helpers
// ============================================================================
// This section describes only the SQLite methods Atlas uses. The runtime module
// is loaded dynamically below, so this local interface keeps the rest of the file
// typed without depending on static `node:sqlite` imports.
// ============================================================================

interface SQLiteStatement {
    run(...values: unknown[]): { lastInsertRowid: number | bigint };
    get(...values: unknown[]): unknown;
    all(...values: unknown[]): unknown[];
}

interface SQLiteDatabase {
    exec(sql: string): void;
    prepare(sql: string): SQLiteStatement;
    close(): void;
}

function asStoredDocument(row: Record<string, unknown>): StoredDocument {
    return {
        id: Number(row.id),
        repoName: String(row.repo_name),
        relativePath: String(row.relative_path),
        absolutePath: String(row.absolute_path),
        title: String(row.title),
        docRole: String(row.doc_role) as DocRole,
        contentHash: String(row.content_hash),
        firstSeenAt: String(row.first_seen_at),
        lastSeenAt: String(row.last_seen_at),
        lastChangedAt: String(row.last_changed_at),
        araliaFacingState: String(row.aralia_facing_state) as StoredDocument['araliaFacingState'],
    };
}

function asStoredPlan(row: Record<string, unknown>): StoredPlan {
    return {
        documentId: Number(row.document_id),
        relativePath: String(row.relative_path),
        title: String(row.title),
        planStatus: String(row.plan_status) as PlanStatus,
        staleState: String(row.stale_state) as StoredPlan['staleState'],
        supersededBy: row.superseded_by === null ? null : String(row.superseded_by),
        completionEvidence: row.completion_evidence === null ? null : String(row.completion_evidence),
        lastReviewedAt: row.last_reviewed_at === null ? null : String(row.last_reviewed_at),
    };
}

// ============================================================================
// Store Wrapper
// ============================================================================
// This class owns schema setup and all writes. Reconciliation code can stay
// focused on Atlas behavior rather than SQL statements.
// ============================================================================

export class AtlasStore {
    private readonly db: SQLiteDatabase;

    constructor(private readonly config: AtlasConfig) {
        fs.mkdirSync(config.atlasRoot, { recursive: true });
        // Load SQLite at runtime because the repo's Vitest/Vite transform can
        // import ordinary Node built-ins but rejects a static `node:sqlite`
        // dependency during bundling. The CLI still uses Node's built-in SQLite.
        const require = createRequire(import.meta.url);
        const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (filename: string) => SQLiteDatabase };
        this.db = new DatabaseSync(path.join(config.atlasRoot, 'atlas.sqlite'));
        this.initialize();
    }

    private initialize(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS branches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                parent_id INTEGER,
                branch_type TEXT NOT NULL,
                source TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                repo_name TEXT NOT NULL,
                relative_path TEXT NOT NULL UNIQUE,
                absolute_path TEXT NOT NULL,
                title TEXT NOT NULL,
                doc_role TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                first_seen_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL,
                last_changed_at TEXT NOT NULL,
                aralia_facing_state TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS attachments (
                document_id INTEGER NOT NULL,
                branch_id INTEGER NOT NULL,
                relationship_type TEXT NOT NULL,
                confidence REAL NOT NULL,
                reason TEXT NOT NULL,
                classifier TEXT NOT NULL,
                reviewed_state TEXT NOT NULL,
                PRIMARY KEY (document_id, branch_id, relationship_type)
            );

            CREATE TABLE IF NOT EXISTS plans (
                document_id INTEGER PRIMARY KEY,
                plan_status TEXT NOT NULL,
                stale_state TEXT NOT NULL,
                superseded_by TEXT,
                completion_evidence TEXT,
                last_reviewed_at TEXT
            );

            CREATE TABLE IF NOT EXISTS runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at TEXT NOT NULL,
                finished_at TEXT,
                trigger TEXT NOT NULL,
                model TEXT NOT NULL,
                summary TEXT NOT NULL
            );
        `);
    }

    beginBulkWrite(): void {
        this.db.exec('BEGIN IMMEDIATE TRANSACTION;');
    }

    commitBulkWrite(): void {
        this.db.exec('COMMIT;');
    }

    rollbackBulkWrite(): void {
        this.db.exec('ROLLBACK;');
    }

    startRun(trigger: string): number {
        const statement = this.db.prepare('INSERT INTO runs (started_at, trigger, model, summary) VALUES (?, ?, ?, ?)');
        const result = statement.run(this.config.now, trigger, 'deterministic-v1', 'Atlas reconciliation started.');
        return Number(result.lastInsertRowid);
    }

    finishRun(runId: number, summary: string): void {
        this.db.prepare('UPDATE runs SET finished_at = ?, summary = ? WHERE id = ?').run(new Date().toISOString(), summary, runId);
    }

    upsertBranch(name: string, branchType = 'knowledge_branch', source = 'deterministic-v1'): number {
        this.db.prepare('INSERT OR IGNORE INTO branches (name, parent_id, branch_type, source) VALUES (?, NULL, ?, ?)').run(name, branchType, source);
        const row = this.db.prepare('SELECT id FROM branches WHERE name = ?').get(name) as Record<string, unknown>;
        return Number(row.id);
    }

    upsertDocument(document: DiscoveredDocument, classification: DocumentClassification): number {
        const existing = this.getDocumentByRelativePath(document.relativePath);
        if (!existing) {
            const result = this.db.prepare(`
                INSERT INTO documents
                    (repo_name, relative_path, absolute_path, title, doc_role, content_hash, first_seen_at, last_seen_at, last_changed_at, aralia_facing_state)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                this.config.repoName,
                document.relativePath,
                document.absolutePath,
                document.title,
                classification.docRole,
                document.contentHash,
                this.config.now,
                this.config.now,
                document.lastChangedAt,
                'aralia_facing',
            );
            return Number(result.lastInsertRowid);
        }

        this.db.prepare(`
            UPDATE documents
            SET absolute_path = ?, title = ?, doc_role = ?, content_hash = ?, last_seen_at = ?, last_changed_at = ?, aralia_facing_state = ?
            WHERE id = ?
        `).run(
            document.absolutePath,
            document.title,
            classification.docRole,
            document.contentHash,
            this.config.now,
            document.lastChangedAt,
            'aralia_facing',
            existing.id,
        );
        return existing.id;
    }

    upsertAttachment(documentId: number, branchId: number, relationshipType: 'primary' | 'secondary', classification: DocumentClassification): void {
        this.db.prepare(`
            INSERT INTO attachments
                (document_id, branch_id, relationship_type, confidence, reason, classifier, reviewed_state)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(document_id, branch_id, relationship_type)
            DO UPDATE SET confidence = excluded.confidence, reason = excluded.reason, classifier = excluded.classifier, reviewed_state = excluded.reviewed_state
        `).run(
            documentId,
            branchId,
            relationshipType,
            classification.confidence,
            classification.reason,
            'deterministic-v1',
            classification.reviewedState,
        );
    }

    upsertPlan(documentId: number, planStatus: PlanStatus): void {
        const staleState = planStatus === 'stale_review_needed' ? 'stale_review_needed' : 'current';
        this.db.prepare(`
            INSERT INTO plans (document_id, plan_status, stale_state, superseded_by, completion_evidence, last_reviewed_at)
            VALUES (?, ?, ?, NULL, NULL, NULL)
            ON CONFLICT(document_id)
            DO UPDATE SET plan_status = excluded.plan_status, stale_state = excluded.stale_state
        `).run(documentId, planStatus, staleState);
    }

    getDocumentByRelativePath(relativePath: string): StoredDocument | null {
        const row = this.db.prepare('SELECT * FROM documents WHERE relative_path = ?').get(relativePath) as Record<string, unknown> | undefined;
        return row ? asStoredDocument(row) : null;
    }

    exportState(): AtlasExport {
        const documents = (this.db.prepare('SELECT * FROM documents ORDER BY relative_path').all() as Record<string, unknown>[]).map(asStoredDocument);
        const branches = (this.db.prepare('SELECT * FROM branches ORDER BY name').all() as Record<string, unknown>[]).map((row) => ({
            id: Number(row.id),
            name: String(row.name),
            parentId: row.parent_id === null ? null : Number(row.parent_id),
            branchType: String(row.branch_type),
            source: String(row.source),
        }));
        const attachments = (this.db.prepare('SELECT * FROM attachments ORDER BY document_id, relationship_type').all() as Record<string, unknown>[]).map((row) => ({
            documentId: Number(row.document_id),
            branchId: Number(row.branch_id),
            relationshipType: String(row.relationship_type),
            confidence: Number(row.confidence),
            reason: String(row.reason),
            reviewedState: String(row.reviewed_state) as ReviewedState,
        }));
        const plans = (this.db.prepare(`
            SELECT plans.*, documents.relative_path, documents.title
            FROM plans
            JOIN documents ON documents.id = plans.document_id
            ORDER BY documents.relative_path
        `).all() as Record<string, unknown>[]).map(asStoredPlan);

        return {
            generatedAt: new Date().toISOString(),
            documents,
            branches,
            attachments,
            plans,
        };
    }

    close(): void {
        this.db.close();
    }
}

export function createAtlasStore(config: AtlasConfig): AtlasStore {
    return new AtlasStore(config);
}
