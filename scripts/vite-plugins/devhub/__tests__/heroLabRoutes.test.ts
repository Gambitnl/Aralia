import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Readable } from 'stream';
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import {
  handleHeroLabRoutes,
  runJobAsync,
  type HeroJob,
  type HeroLabDeps,
} from '../heroLabRoutes';

/**
 * This file contains unit tests for the Hero Lab API route module.
 *
 * Every test runs inside a temporary directory to isolate file creation from
 * the rest of the workspace. We inject mock parameters and custom async job
 * runners to verify API responses, file storage lifecycle, validation, promotion,
 * retry states, and credential security.
 *
 * Calls: handleHeroLabRoutes, runJobAsync
 */

// ============================================================================
// Test Setup & Mock Helpers
// ============================================================================
// Helper structures and temporary directories used to isolate the file system
// during tests.
// ============================================================================

let jobsDir: string;
let publicHeroDir: string;
let originalHfToken: string | undefined;

beforeEach(() => {
  // Create separate temporary folders for the job scratch workspace and public assets.
  jobsDir = mkdtempSync(path.join(tmpdir(), 'hero-lab-jobs-'));
  publicHeroDir = mkdtempSync(path.join(tmpdir(), 'hero-lab-public-'));
  // Save original token value to restore after test run.
  originalHfToken = process.env.HF_TOKEN;
});

afterEach(() => {
  // Clean up directories.
  rmSync(jobsDir, { recursive: true, force: true });
  rmSync(publicHeroDir, { recursive: true, force: true });
  // Restore original token state.
  if (originalHfToken === undefined) {
    delete process.env.HF_TOKEN;
  } else {
    process.env.HF_TOKEN = originalHfToken;
  }
});

interface Captured {
  data: any;
  status: number;
  headers: Record<string, string | number>;
  bodyBuffer: Buffer | null;
}

/**
 * Mocks the route context object passed to our API handlers.
 * Captures JSON responses and binary file streams for assertions.
 */
function makeCtx(method: string, urlPath: string, body?: unknown): { ctx: Parameters<typeof handleHeroLabRoutes>[0]; out: Captured } {
  const out: Captured = { data: undefined, status: 200, headers: {}, bodyBuffer: null };
  const req = body === undefined ? Readable.from([]) : Readable.from([JSON.stringify(body)]);
  (req as any).method = method;

  const res = {
    writeHead: (status: number, headers: Record<string, string | number>) => {
      out.status = status;
      out.headers = headers;
    },
    end: (content: Buffer | string) => {
      out.bodyBuffer = typeof content === 'string' ? Buffer.from(content) : content;
    },
  };

  return {
    ctx: {
      req,
      res,
      json: (data: unknown, status = 200) => {
        out.data = data;
        out.status = status;
      },
      parsedUrl: new URL(`http://localhost${urlPath}`),
      urlPath,
    },
    out,
  };
}

// A standard valid Base64 PNG image used for mocking.
const validPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// ============================================================================
// Route Handler Tests
// ============================================================================
// Tests verifying path matching, request parameter validation, and routing behavior.
// ============================================================================

describe('Hero Lab route handler basic routing and validation', () => {
  it('should ignore unrelated URL paths', async () => {
    const { ctx } = makeCtx('GET', '/devhub/api/creature-plans');
    const handled = await handleHeroLabRoutes(ctx, { jobsDir, publicHeroDir });
    expect(handled).toBe(false);
  });

  it('should reject jobs with invalid or missing entryId', async () => {
    const { ctx, out } = makeCtx('POST', '/devhub/api/hero-lab/jobs', {
      entryId: '../invalid-path',
      referenceDataUrl: validPngBase64,
      detailPreset: 'standard',
    });
    const handled = await handleHeroLabRoutes(ctx, { jobsDir, publicHeroDir });
    expect(handled).toBe(true);
    expect(out.status).toBe(400);
    expect(out.data.error).toContain('entryId');
  });

  it('should reject jobs with missing or invalid referenceDataUrl', async () => {
    const { ctx, out } = makeCtx('POST', '/devhub/api/hero-lab/jobs', {
      entryId: 'dragon',
      referenceDataUrl: 'invalid-url-format',
      detailPreset: 'standard',
    });
    const handled = await handleHeroLabRoutes(ctx, { jobsDir, publicHeroDir });
    expect(handled).toBe(true);
    expect(out.status).toBe(400);
    expect(out.data.error).toContain('referenceDataUrl');
  });

  it('should reject jobs with invalid detailPreset', async () => {
    const { ctx, out } = makeCtx('POST', '/devhub/api/hero-lab/jobs', {
      entryId: 'dragon',
      referenceDataUrl: validPngBase64,
      detailPreset: 'ultra-premium',
    });
    const handled = await handleHeroLabRoutes(ctx, { jobsDir, publicHeroDir });
    expect(handled).toBe(true);
    expect(out.status).toBe(400);
    expect(out.data.error).toContain('detailPreset');
  });
});

// ============================================================================
// Job Creation and Artifact Staging Lifecycle
// ============================================================================
// Tests confirming job directory initialization, image decoding, and metadata writing.
// ============================================================================

describe('Hero Lab job staging and file system integration', () => {
  it('should initialize folders, write reference image, and queue job', async () => {
    const runner = vi.fn(async () => {});
    const { ctx, out } = makeCtx('POST', '/devhub/api/hero-lab/jobs', {
      entryId: 'orc-warrior',
      referenceDataUrl: validPngBase64,
      detailPreset: 'hero',
    });

    const handled = await handleHeroLabRoutes(ctx, { jobsDir, publicHeroDir, runner });
    expect(handled).toBe(true);
    expect(out.status).toBe(200);

    const job = out.data as HeroJob;
    expect(job.status).toBe('queued');
    expect(job.entryId).toBe('orc-warrior');
    expect(job.id).toBe(job.jobId);
    expect((job as HeroJob & { referenceUrl: string }).referenceUrl).toContain('/artifacts/reference');

    const jobFolder = path.join(jobsDir, job.jobId);
    expect(readdirSync(jobFolder)).toContain('reference.png');
    expect(readdirSync(jobFolder)).toContain('hero.json');

    const savedJobData = JSON.parse(readFileSync(path.join(jobFolder, 'hero.json'), 'utf8')) as HeroJob;
    expect(savedJobData.jobId).toBe(job.jobId);
    expect(savedJobData.params.detailPreset).toBe('hero');
  });

  it('should allow retrieving queued job status via GET', async () => {
    const runner = vi.fn(async () => {});
    const createRes = makeCtx('POST', '/devhub/api/hero-lab/jobs', {
      entryId: 'orc-warrior',
      referenceDataUrl: validPngBase64,
      detailPreset: 'standard',
    });
    await handleHeroLabRoutes(createRes.ctx, { jobsDir, publicHeroDir, runner });

    const jobId = (createRes.out.data as HeroJob).jobId;
    const statusRes = makeCtx('GET', `/devhub/api/hero-lab/jobs/${jobId}`);
    const handled = await handleHeroLabRoutes(statusRes.ctx, { jobsDir, publicHeroDir });

    expect(handled).toBe(true);
    expect(statusRes.out.status).toBe(200);
    expect(statusRes.out.data.jobId).toBe(jobId);
    expect(statusRes.out.data.id).toBe(jobId);
  });
});

// ============================================================================
// Pipeline Phase Execution and Artifact Serving
// ============================================================================
// Tests tracing transitions through pipeline stages and fetching produced assets.
// ============================================================================

describe('Hero Lab async pipeline running and artifact retrieval', () => {
  it('should transition through states and validate generated files', async () => {
    // A mock runner that writes candidate model files to simulate python/node execution.
    const runner = async (job: HeroJob) => {
      const dir = path.join(jobsDir, job.jobId);
      writeFileSync(path.join(dir, 'master.glb'), 'master-mesh-content');
      writeFileSync(path.join(dir, 'hero.glb'), 'optimized-mesh-content');
    };

    const createRes = makeCtx('POST', '/devhub/api/hero-lab/jobs', {
      entryId: 'goblin',
      referenceDataUrl: validPngBase64,
      detailPreset: 'preview',
    });
    await handleHeroLabRoutes(createRes.ctx, { jobsDir, publicHeroDir, runner });

    const jobId = (createRes.out.data as HeroJob).jobId;

    // Run the pipeline and await completion.
    const deps: Required<HeroLabDeps> = { runner, jobsDir, publicHeroDir };
    await runJobAsync(jobsDir, jobId, deps);

    // Verify final state.
    const finalJob = JSON.parse(readFileSync(path.join(jobsDir, jobId, 'hero.json'), 'utf8')) as HeroJob;
    expect(finalJob.status).toBe('ready');
    expect(finalJob.progress).toBe(1.0);
    expect(finalJob.error).toBeNull();

    // Verify artifact fetching endpoints.
    const refArtifact = makeCtx('GET', `/devhub/api/hero-lab/jobs/${jobId}/artifacts/reference`);
    await handleHeroLabRoutes(refArtifact.ctx, deps);
    expect(refArtifact.out.status).toBe(200);
    expect(refArtifact.out.headers['Content-Type']).toBe('image/png');

    const heroArtifact = makeCtx('GET', `/devhub/api/hero-lab/jobs/${jobId}/artifacts/hero`);
    await handleHeroLabRoutes(heroArtifact.ctx, deps);
    expect(heroArtifact.out.status).toBe(200);
    expect(heroArtifact.out.headers['Content-Type']).toBe('model/gltf-binary');
    expect(heroArtifact.out.bodyBuffer?.toString()).toBe('optimized-mesh-content');
  });

  it('should report failure state if any artifact is missing after validation', async () => {
    // Mock runner does nothing, which means master.glb and hero.glb will not be created.
    const runner = async () => {};
    const createRes = makeCtx('POST', '/devhub/api/hero-lab/jobs', {
      entryId: 'goblin',
      referenceDataUrl: validPngBase64,
      detailPreset: 'preview',
    });
    await handleHeroLabRoutes(createRes.ctx, { jobsDir, publicHeroDir, runner });

    const jobId = (createRes.out.data as HeroJob).jobId;
    const deps: Required<HeroLabDeps> = { runner, jobsDir, publicHeroDir };
    await runJobAsync(jobsDir, jobId, deps);

    const finalJob = JSON.parse(readFileSync(path.join(jobsDir, jobId, 'hero.json'), 'utf8')) as HeroJob;
    expect(finalJob.status).toBe('failed');
    expect(finalJob.error).toContain('Validation failed');
  });
});

// ============================================================================
// Job Retrying Capability
// ============================================================================
// Tests asserting that failed jobs create new immutable attempts.
// ============================================================================

describe('Hero Lab job retrying', () => {
  it('should allow retrying a failed job', async () => {
    const runner = vi.fn(async () => {});
    const createRes = makeCtx('POST', '/devhub/api/hero-lab/jobs', {
      entryId: 'cyclops',
      referenceDataUrl: validPngBase64,
      detailPreset: 'standard',
    });
    await handleHeroLabRoutes(createRes.ctx, { jobsDir, publicHeroDir, runner });

    const jobId = (createRes.out.data as HeroJob).jobId;

    // Simulate failure.
    const jobFolder = path.join(jobsDir, jobId);
    const jobData = JSON.parse(readFileSync(path.join(jobFolder, 'hero.json'), 'utf8')) as HeroJob;
    jobData.status = 'failed';
    jobData.error = 'GPU disconnected';
    writeFileSync(path.join(jobFolder, 'hero.json'), JSON.stringify(jobData, null, 2));

    // Call the retry API.
    const retryRes = makeCtx('POST', `/devhub/api/hero-lab/jobs/${jobId}/retry`);
    const handled = await handleHeroLabRoutes(retryRes.ctx, { jobsDir, publicHeroDir, runner });

    expect(handled).toBe(true);
    expect(retryRes.out.status).toBe(200);
    expect(retryRes.out.data.status).toBe('queued');
    expect(retryRes.out.data.error).toBeNull();
    expect(retryRes.out.data.jobId).not.toBe(jobId);
    const preservedFailure = JSON.parse(readFileSync(path.join(jobFolder, 'hero.json'), 'utf8')) as HeroJob;
    expect(preservedFailure.status).toBe('failed');
    expect(preservedFailure.error).toBe('GPU disconnected');
  });

  it('should reject retrying jobs that are not in failed status', async () => {
    // Use a runner that does not resolve or fail, keeping the job in active status.
    const runner = () => new Promise<void>(() => {});
    const createRes = makeCtx('POST', '/devhub/api/hero-lab/jobs', {
      entryId: 'cyclops',
      referenceDataUrl: validPngBase64,
      detailPreset: 'standard',
    });
    await handleHeroLabRoutes(createRes.ctx, { jobsDir, publicHeroDir, runner });

    const jobId = (createRes.out.data as HeroJob).jobId;

    const retryRes = makeCtx('POST', `/devhub/api/hero-lab/jobs/${jobId}/retry`);
    await handleHeroLabRoutes(retryRes.ctx, { jobsDir, publicHeroDir, runner });

    expect(retryRes.out.status).toBe(400);
    expect(retryRes.out.data.error).toContain('failed');
  });
});

// ============================================================================
// Public Asset Promotion & Replacement Guard
// ============================================================================
// Tests confirming copy-on-promote logic and two-step overwrite confirm guards.
// ============================================================================

describe('Hero Lab public promotion and replacement protections', () => {
  it('should promote files successfully and reject silent replacement without confirmReplace', async () => {
    const runner = vi.fn(async () => {});
    const createRes = makeCtx('POST', '/devhub/api/hero-lab/jobs', {
      entryId: 'medusa',
      referenceDataUrl: validPngBase64,
      detailPreset: 'standard',
    });
    await handleHeroLabRoutes(createRes.ctx, { jobsDir, publicHeroDir, runner });

    const jobId = (createRes.out.data as HeroJob).jobId;
    const jobFolder = path.join(jobsDir, jobId);

    // Simulate successful execution artifacts on disk.
    writeFileSync(path.join(jobFolder, 'master.glb'), 'master-data');
    writeFileSync(path.join(jobFolder, 'hero.glb'), 'hero-data');

    const jobData = JSON.parse(readFileSync(path.join(jobFolder, 'hero.json'), 'utf8')) as HeroJob;
    jobData.status = 'ready';
    writeFileSync(path.join(jobFolder, 'hero.json'), JSON.stringify(jobData, null, 2));

    // Promote for the first time (should succeed without conflict since folder is empty).
    const promote1 = makeCtx('POST', `/devhub/api/hero-lab/jobs/${jobId}/promote`, { confirmReplace: false });
    await handleHeroLabRoutes(promote1.ctx, { jobsDir, publicHeroDir, runner });
    expect(promote1.out.status).toBe(200);

    const publicMedusaDir = path.join(publicHeroDir, 'medusa');
    expect(readdirSync(publicMedusaDir)).toContain('hero.glb');
    expect(readdirSync(publicMedusaDir)).toContain('reference.png');

    // Attempt second promotion with confirmReplace: false. Should return 409 conflict.
    const promote2 = makeCtx('POST', `/devhub/api/hero-lab/jobs/${jobId}/promote`, { confirmReplace: false });
    // Keep status as ready for second attempt simulation.
    jobData.status = 'ready';
    writeFileSync(path.join(jobFolder, 'hero.json'), JSON.stringify(jobData, null, 2));

    await handleHeroLabRoutes(promote2.ctx, { jobsDir, publicHeroDir, runner });
    expect(promote2.out.status).toBe(409);
    expect(promote2.out.data.error).toContain('Confirm replace');

    // Attempt third promotion with confirmReplace: true. Should succeed.
    const promote3 = makeCtx('POST', `/devhub/api/hero-lab/jobs/${jobId}/promote`, { confirmReplace: true });
    jobData.status = 'ready';
    writeFileSync(path.join(jobFolder, 'hero.json'), JSON.stringify(jobData, null, 2));

    await handleHeroLabRoutes(promote3.ctx, { jobsDir, publicHeroDir, runner });
    expect(promote3.out.status).toBe(200);
  });

  it('should preserve the live bundle when a candidate artifact is not a regular file', async () => {
    const runner = vi.fn(async () => {});
    const createRes = makeCtx('POST', '/devhub/api/hero-lab/jobs', {
      entryId: 'directory-mimic',
      referenceDataUrl: validPngBase64,
      detailPreset: 'standard',
    });
    await handleHeroLabRoutes(createRes.ctx, { jobsDir, publicHeroDir, runner });

    const jobId = (createRes.out.data as HeroJob).jobId;
    const jobFolder = path.join(jobsDir, jobId);

    // Make the candidate appear complete to the old existence-only check. The
    // hero.glb path is deliberately a directory, so it is not a promotable model.
    writeFileSync(path.join(jobFolder, 'master.glb'), 'candidate-master');
    mkdirSync(path.join(jobFolder, 'hero.glb'));
    const jobData = JSON.parse(readFileSync(path.join(jobFolder, 'hero.json'), 'utf8')) as HeroJob;
    jobData.status = 'ready';
    jobData.stage = 'ready';
    writeFileSync(path.join(jobFolder, 'hero.json'), JSON.stringify(jobData, null, 2));

    // Seed all four public artifacts with distinct content. A rejected promotion
    // must leave every byte in this existing playable bundle unchanged.
    const publicTargetDir = path.join(publicHeroDir, 'directory-mimic');
    mkdirSync(publicTargetDir);
    const oldArtifacts: Record<string, string> = {
      'reference.png': 'old-reference',
      'master.glb': 'old-master',
      'hero.glb': 'old-hero',
      'hero.json': 'old-metadata',
    };
    for (const [file, content] of Object.entries(oldArtifacts)) {
      writeFileSync(path.join(publicTargetDir, file), content);
    }

    const promote = makeCtx(
      'POST',
      `/devhub/api/hero-lab/jobs/${jobId}/promote`,
      { confirmReplace: true },
    );
    await handleHeroLabRoutes(promote.ctx, { jobsDir, publicHeroDir, runner });

    expect(promote.out.status).not.toBe(200);
    for (const [file, content] of Object.entries(oldArtifacts)) {
      expect(readFileSync(path.join(publicTargetDir, file), 'utf8')).toBe(content);
    }
    const persistedJob = JSON.parse(
      readFileSync(path.join(jobFolder, 'hero.json'), 'utf8'),
    ) as HeroJob;
    expect(persistedJob.status).toBe('ready');
    expect(persistedJob.stage).toBe('ready');
  });
});

// ============================================================================
// Secure Credentials and Secret Omission
// ============================================================================
// Tests proving the Hugging Face token value is never written to log files
// or error metadata.
// ============================================================================

describe('Hero Lab token security and secret omission', () => {
  it('should omit and sanitize HF_TOKEN values from error metadata', async () => {
    // Set a mock environment token.
    process.env.HF_TOKEN = 'secret-huggingface-token-1234';

    // Mock runner that throws an error containing the environment token.
    const runner = async () => {
      throw new Error('Hugging Face authentication failed using key secret-huggingface-token-1234. Space unreachable.');
    };

    const createRes = makeCtx('POST', '/devhub/api/hero-lab/jobs', {
      entryId: 'secret-agent',
      referenceDataUrl: validPngBase64,
      detailPreset: 'standard',
    });
    await handleHeroLabRoutes(createRes.ctx, { jobsDir, publicHeroDir, runner });

    const jobId = (createRes.out.data as HeroJob).jobId;
    const deps: Required<HeroLabDeps> = { runner, jobsDir, publicHeroDir };
    await runJobAsync(jobsDir, jobId, deps);

    const finalJob = JSON.parse(readFileSync(path.join(jobsDir, jobId, 'hero.json'), 'utf8')) as HeroJob;
    expect(finalJob.status).toBe('failed');
    // The exact token value must have been replaced with the placeholder.
    expect(finalJob.error).not.toContain('secret-huggingface-token-1234');
    expect(finalJob.error).toContain('***SECRET***');
  });

  it('should keep the default credential runner inside canonical Hero Lab scratch storage', async () => {
    // The default route never needs a token in the dev-server environment.
    delete process.env.HF_TOKEN;

    const createRes = makeCtx('POST', '/devhub/api/hero-lab/jobs', {
      entryId: 'no-token-creature',
      referenceDataUrl: validPngBase64,
      detailPreset: 'standard',
    });
    // Use no runner override to run the default spawner runner logic.
    await handleHeroLabRoutes(createRes.ctx, { jobsDir, publicHeroDir });

    const jobId = (createRes.out.data as HeroJob).jobId;
    // A test temp directory is intentionally outside the canonical ignored
    // scratch root, so the child launcher must reject it before reading WinCred.
    const deps: Required<HeroLabDeps> = { runner: null as any, jobsDir, publicHeroDir };
    await runJobAsync(jobsDir, jobId, deps);

    const finalJob = JSON.parse(readFileSync(path.join(jobsDir, jobId, 'hero.json'), 'utf8')) as HeroJob;
    expect(finalJob.status).toBe('failed');
    expect(finalJob.error).toContain('base directory must remain under');
    expect(finalJob.error).not.toContain('HF_TOKEN');
  });
});
