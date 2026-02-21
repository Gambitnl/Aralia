import fs from 'fs';
import path from 'path';
import type { ProcessingDocument } from './generation-types';

const PROCESSING_MANIFEST_FILE = '.agent/roadmap-local/processing_manifest.json';

const isGameDoc = (sourcePath: string) => {
  const normalized = sourcePath.replace(/\\/g, '/').toLowerCase();
  return normalized.startsWith('docs/tasks/')
    && !normalized.includes('/roadmap/')
    && !normalized.includes('/documentation-cleanup/');
};

export function loadProcessingDocs() {
  const manifestPath = path.resolve(process.cwd(), PROCESSING_MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) return [] as ProcessingDocument[];

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as {
    documents?: ProcessingDocument[];
  };

  return (manifest.documents ?? [])
    .filter((doc) => Boolean(doc.sourcePath) && isGameDoc(doc.sourcePath))
    .sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
}
