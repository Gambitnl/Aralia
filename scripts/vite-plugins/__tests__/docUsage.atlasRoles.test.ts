import { describe, it, expect } from 'vitest';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { loadAtlasRoles } from '../docUsage/atlasRoles';

describe('loadAtlasRoles', () => {
  it('maps relativePath -> docRole from the export', () => {
    const f = path.join(os.tmpdir(), `atlas-${Date.now()}.json`);
    fs.writeFileSync(f, JSON.stringify({ documents: [
      { relativePath: 'docs/x/plan.md', docRole: 'plan' },
      { relativePath: 'README.md', docRole: 'reference' },
    ]}));
    const { roles, atlasMissing } = loadAtlasRoles(f);
    expect(atlasMissing).toBe(false);
    expect(roles.get('docs/x/plan.md')).toBe('plan');
    fs.rmSync(f);
  });
  it('flags atlasMissing when the export is absent (no path fallback)', () => {
    const { roles, atlasMissing } = loadAtlasRoles('/no/such/atlas.json');
    expect(atlasMissing).toBe(true);
    expect(roles.size).toBe(0);
  });
});
