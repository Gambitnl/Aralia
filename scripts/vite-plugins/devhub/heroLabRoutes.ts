import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { DevHubRouteContext } from './routeContext';

/**
 * This file handles dev-only API routes for generating 3D creature hero models.
 *
 * In the Aralia game editor, creators can generate high-quality 3D hero assets
 * from 2D reference images using the remote Microsoft TRELLIS.2 generator.
 * This route module manages the lifecycle of these generation jobs: queuing them,
 * writing intermediate artifacts to a scratch directory, running the optimization
 * script locally, and finally promoting them to the public assets directory.
 *
 * Called by: devHubApiManager.ts (as a Dev Hub API sub-route)
 * Depends on: tools/creatureHero/convert.py (remotely generates GLB from image),
 *            tools/creatureHero/optimize.mjs (optimizes and reduces GLB polygon count)
 */

// ============================================================================
// Types & Interfaces
// ============================================================================
// Here we define the types used to model the parameters, states, and configuration
// for our generation jobs.
// ============================================================================

/** Parameters describing how the 3D model should be generated and styled. */
export interface HeroJobParams {
  /** Display name of the creature reference. */
  referenceName?: string;
  /** Art style instructions for the 3D generator. */
  artDirection?: string;
  /** Specific features that must be kept intact during generation. */
  preserve?: string;
  /** Specific features to avoid generating. */
  avoid?: string;
  /** Seed or variations for alternative generations. */
  variation?: number;
  /** Level of detail desired, mapping to preset server-side configurations. */
  detailPreset: 'preview' | 'standard' | 'hero';
}

/** The parameters expected in the POST request to start a new job. */
export interface CreateJobPayload extends HeroJobParams {
  /** The unique ID of the target creature plan being styled as a hero. */
  entryId: string;
  /** The base64 data URL of the reference image. */
  referenceDataUrl: string;
}

/** Representation of a 3D asset generation job and its current state. */
export interface HeroJob {
  /** Unique job ID. */
  jobId: string;
  /** Browser-facing alias kept stable across create, poll, and retry responses. */
  id: string;
  /** The associated creature plan ID. */
  entryId: string;
  /** Current progress state in the pipeline. */
  status:
    | 'queued'
    | 'preparing'
    | 'generating'
    | 'extracting'
    | 'optimizing'
    | 'validating'
    | 'ready'
    | 'failed'
    | 'promoted';
  /** Numeric progress indicator from 0.0 to 1.0. */
  progress: number;
  /** The sanitized error message if the job failed. */
  error: string | null;
  /** ISO timestamp when the job was first queued. */
  createdAt: string;
  /** ISO timestamp of the last status update. */
  updatedAt: string;
  /** Current named stage; kept separately so the UI does not infer progress. */
  stage: HeroJob['status'];
  /** The client parameters requested for the job. */
  params: HeroJobParams;
}

/** Dependencies that can be injected, especially useful for unit testing. */
export interface HeroLabDeps {
  /** An optional mock or custom runner to replace the default process spawner. */
  runner?: (job: HeroJob, env: Record<string, string>) => Promise<void>;
  /** Path override for the temporary jobs directory. */
  jobsDir?: string;
  /** Path override for the final promoted hero assets directory. */
  publicHeroDir?: string;
}

// ============================================================================
// Configuration & Constants
// ============================================================================
// Technical parameters are kept server-side to avoid leaking implementation details
// (like Hugging Face Space coordinates) to client-side payloads.
// ============================================================================

/** Limit the uploaded payload to prevent server memory exhaustion. */
const MAX_REQUEST_SIZE = 15 * 1024 * 1024; // 15 Megabytes limit

/** Decoded images stay below the browser's matching 10 MB input limit. */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

// ============================================================================
// Helper Functions
// ============================================================================
// Functions to read incoming requests, spawn background commands, and manage
// the storage of jobs on disk.
// ============================================================================

/**
 * Reads the request body from a readable stream, enforcing a size limit to
 * prevent excessive memory usage.
 */
async function readBody(req: DevHubRouteContext['req']): Promise<Record<string, any>> {
  let acc = '';
  return new Promise((resolve, reject) => {
    // Listen for incoming chunks of request data.
    req.on('data', (chunk: Buffer | string) => {
      acc += chunk;
      // Terminate the connection immediately if the body size limit is exceeded.
      if (acc.length > MAX_REQUEST_SIZE) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });

    // Complete reading and parse as JSON when the stream ends.
    req.on('end', () => {
      try {
        if (!acc.trim()) {
          resolve({});
        } else {
          resolve(JSON.parse(acc));
        }
      } catch (e) {
        reject(e);
      }
    });

    req.on('error', (e: Error) => reject(e));
  });
}

/**
 * Returns the path to the directory hosting a specific job's files.
 */
function getJobDir(jobsDir: string, jobId: string): string {
  return path.join(jobsDir, jobId);
}

/**
 * Returns the path to the serialized JSON file representing a job's metadata.
 */
function getJobJsonPath(jobsDir: string, jobId: string): string {
  return path.join(getJobDir(jobsDir, jobId), 'hero.json');
}

/**
 * Reads a job record from the job's folder, returning null if missing or malformed.
 */
function readJob(jobsDir: string, jobId: string): HeroJob | null {
  const p = getJobJsonPath(jobsDir, jobId);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as HeroJob;
  } catch {
    return null;
  }
}

/**
 * Writes the job record metadata to the job folder on disk.
 */
function writeJob(jobsDir: string, job: HeroJob): void {
  const dir = getJobDir(jobsDir, job.jobId);
  fs.mkdirSync(dir, { recursive: true });
  const p = getJobJsonPath(jobsDir, job.jobId);
  fs.writeFileSync(p, JSON.stringify(job, null, 2) + '\n', 'utf8');
}

/**
 * Builds the safe browser snapshot without exposing local paths, commands, or
 * environment data. Artifact URLs remain inside the validated job-id route.
 */
function publicJob(job: HeroJob, jobsDir: string, publicHeroDir: string) {
  const artifactBase = `/devhub/api/hero-lab/jobs/${job.jobId}/artifacts`;
  const jobDir = getJobDir(jobsDir, job.jobId);
  const targetDir = path.join(publicHeroDir, job.entryId);
  const existingHero = fs.existsSync(path.join(targetDir, 'hero.glb'));
  return {
    ...job,
    id: job.jobId,
    state: job.status,
    stage: job.stage,
    message: job.status === 'failed' ? 'Hero generation needs attention.' : `Hero Lab is ${job.status}.`,
    inputs: job.params,
    referenceUrl: fs.existsSync(path.join(jobDir, 'reference.png')) ? `${artifactBase}/reference` : undefined,
    masterGlbUrl: fs.existsSync(path.join(jobDir, 'master.glb')) ? `${artifactBase}/master` : undefined,
    heroGlbUrl: fs.existsSync(path.join(jobDir, 'hero.glb')) ? `${artifactBase}/hero` : undefined,
    heroJsonUrl: fs.existsSync(path.join(jobDir, 'hero.json')) ? `${artifactBase}/metadata` : undefined,
    canPromote: job.status === 'ready',
    existingHero,
  };
}

/**
 * Spawns a child process and waits for it to complete.
 * Gathers error logs from standard error to bubble up on failure.
 */
function runProcess(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  onOutput?: (output: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      shell: process.platform === 'win32',
      windowsHide: true,
    });
    let stderr = '';

    child.stdout?.on('data', (data) => {
      onOutput?.(data.toString());
    });

    // Collect any errors printed by the sub-program.
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    // Handle normal process termination.
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Hero pipeline exited with code ${code}. ${stderr.slice(-1500)}`));
      } else {
        resolve();
      }
    });

    // Handle failures where the command cannot start.
    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Runs the generation and optimization scripts asynchronously for a given job.
 * Updates the state metadata file at each step of the pipeline.
 */
export async function runJobAsync(
  jobsDir: string,
  jobId: string,
  deps: Required<HeroLabDeps>
): Promise<void> {
  // Helper function to transition the job to a new progress state.
  const updateState = (status: HeroJob['status'], progress: number, error: string | null = null) => {
    const current = readJob(jobsDir, jobId);
    if (!current) return;
    current.status = status;
    current.stage = status;
    current.progress = progress;
    current.error = error;
    current.updatedAt = new Date().toISOString();
    writeJob(jobsDir, current);
  };

  try {
    updateState('preparing', 0.1);

    // If an external runner is injected (usually for testing), run it.
    if (deps.runner) {
      const current = readJob(jobsDir, jobId);
      if (!current) throw new Error('Job not found');
      await deps.runner(current, process.env as Record<string, string>);
    } else {
      const current = readJob(jobsDir, jobId);
      if (!current) throw new Error('Job not found');

      // The launcher reads the Hugging Face token from Windows Credential
      // Manager inside its child process and clears it before exit. The dev
      // server therefore never receives, stores, logs, or forwards the secret.
      const launcher = path.resolve(process.cwd(), 'tools/creatureHero/run-hero-job.ps1');
      await runProcess(
        'powershell',
        [
          '-NoLogo',
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          launcher,
          '-EntryId',
          jobId,
          '-BaseDir',
          jobsDir,
        ],
        process.env,
        (output) => {
          // Only the explicit machine-readable marker can change public job
          // state. Other child output remains diagnostic and is never echoed
          // through the browser API.
          for (const marker of output.matchAll(/HERO_LAB_STAGE:(preparing|generating|extracting|optimizing|validating|ready)/g)) {
            const stage = marker[1] as HeroJob['status'];
            const progressByStage: Partial<Record<HeroJob['status'], number>> = {
              preparing: 0.1,
              generating: 0.25,
              extracting: 0.55,
              optimizing: 0.75,
              validating: 0.9,
              ready: 1,
            };
            updateState(stage, progressByStage[stage] ?? 0);
          }
        },
      );
    }

    // Step 3: Validate generated artifacts on disk.
    updateState('validating', 0.9);
    const jobDir = getJobDir(jobsDir, jobId);
    const hasReference = fs.existsSync(path.join(jobDir, 'reference.png'));
    const hasMaster = fs.existsSync(path.join(jobDir, 'master.glb'));
    const hasHero = fs.existsSync(path.join(jobDir, 'hero.glb'));
    const hasJson = fs.existsSync(path.join(jobDir, 'hero.json'));

    if (!hasReference || !hasMaster || !hasHero || !hasJson) {
      throw new Error('Validation failed: Some generated artifacts are missing on disk.');
    }

    // Pipeline completed successfully!
    updateState('ready', 1.0);
  } catch (err: any) {
    // Sanitize the error message to remove any chance of leaking process tokens.
    let errMsg = err instanceof Error ? err.message : String(err);
    if (process.env.HF_TOKEN) {
      errMsg = errMsg.split(process.env.HF_TOKEN).join('***SECRET***');
    }
    updateState('failed', 1.0, errMsg);
  }
}

// ============================================================================
// Core Route Handler
// ============================================================================
// Exposes the main handler invoked by the Dev Hub API manager for matching paths.
// ============================================================================

/**
 * Dev-only API route handler for the Hero Lab generator workspace.
 * Resolves routes, validates request payloads, manages jobs, and returns JSON.
 */
export async function handleHeroLabRoutes(
  ctx: DevHubRouteContext,
  deps?: HeroLabDeps
): Promise<boolean> {
  const { urlPath, json, req } = ctx;
  const method = req.method;

  // Setup default storage paths and runner options.
  const resolvedDeps: Required<HeroLabDeps> = {
    runner: deps?.runner || (null as any),
    jobsDir: deps?.jobsDir || path.resolve(process.cwd(), '.agent/scratch/hero-lab/jobs'),
    publicHeroDir: deps?.publicHeroDir || path.resolve(process.cwd(), 'public/creatures3d/hero'),
  };

  // --------------------------------------------------------------------------
  // Endpoint: POST /devhub/api/hero-lab/jobs
  // Queues a new generation job with a 2D image and detail parameters.
  // --------------------------------------------------------------------------
  if (method === 'POST' && urlPath === '/devhub/api/hero-lab/jobs') {
    try {
      const body = await readBody(req);
      const {
        entryId,
        referenceDataUrl,
        referenceName,
        artDirection,
        preserve,
        avoid,
        variation,
        detailPreset,
      } = body;

      // Ensure the entry ID is a clean identifier, rejecting path traversal attempts.
      if (typeof entryId !== 'string' || !entryId.trim() || !/^[a-zA-Z0-9_-]+$/.test(entryId)) {
        json({ error: 'Invalid or missing entryId. Must be alphanumeric with dashes or underscores.' }, 400);
        return true;
      }

      // Check for image presence.
      if (typeof referenceDataUrl !== 'string' || !referenceDataUrl.trim()) {
        json({ error: 'Missing referenceDataUrl.' }, 400);
        return true;
      }

      // Enforce correct image data formatting.
      const dataUrlRegex = /^data:image\/(png|jpeg|jpg);base64,(.+)$/;
      if (!dataUrlRegex.test(referenceDataUrl)) {
        json({ error: 'Invalid referenceDataUrl format. Only PNG and JPEG data URLs are supported.' }, 400);
        return true;
      }

      // Enforce valid preset names.
      if (typeof detailPreset !== 'string' || !['preview', 'standard', 'hero'].includes(detailPreset)) {
        json({ error: 'Invalid detailPreset. Must be preview, standard, or hero.' }, 400);
        return true;
      }

      // Generate a new job ID and construct its staging directory.
      const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const jobDir = getJobDir(resolvedDeps.jobsDir, jobId);

      // Save the decoded reference image to the job workspace.
      const matches = referenceDataUrl.match(dataUrlRegex)!;
      const imageBuffer = Buffer.from(matches[2], 'base64');
      if (imageBuffer.length === 0 || imageBuffer.length > MAX_IMAGE_SIZE) {
        json({ error: 'Reference image must be 10 MB or smaller.' }, 400);
        return true;
      }
      const isPng = imageBuffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      const isJpeg = imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8 && imageBuffer[2] === 0xff;
      if ((matches[1] === 'png' && !isPng) || (matches[1] !== 'png' && !isJpeg)) {
        json({ error: 'Reference bytes do not match the declared PNG or JPEG type.' }, 400);
        return true;
      }
      fs.mkdirSync(jobDir, { recursive: true });
      fs.writeFileSync(path.join(jobDir, 'reference.png'), imageBuffer);

      // Construct and serialize the job record.
      const params: HeroJobParams = {
        referenceName: typeof referenceName === 'string' ? referenceName : undefined,
        artDirection: typeof artDirection === 'string' ? artDirection : undefined,
        preserve: typeof preserve === 'string' ? preserve : undefined,
        avoid: typeof avoid === 'string' ? avoid : undefined,
        variation: typeof variation === 'number' && Number.isFinite(variation) ? variation : undefined,
        detailPreset: detailPreset as HeroJobParams['detailPreset'],
      };

      const job: HeroJob = {
        jobId,
        id: jobId,
        entryId,
        status: 'queued',
        stage: 'queued',
        progress: 0.0,
        error: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        params,
      };

      writeJob(resolvedDeps.jobsDir, job);

      // Start the pipeline execution asynchronously.
      runJobAsync(resolvedDeps.jobsDir, jobId, resolvedDeps).catch(() => {});

      json(publicJob(job, resolvedDeps.jobsDir, resolvedDeps.publicHeroDir));
    } catch (e: any) {
      json({ error: e.message || String(e) }, 500);
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // Endpoint: POST /devhub/api/hero-lab/jobs/:id/retry
  // Retries a failed generation job, resetting progress status.
  // --------------------------------------------------------------------------
  const retryMatch = urlPath.match(/^\/devhub\/api\/hero-lab\/jobs\/([^/]+)\/retry$/);
  if (method === 'POST' && retryMatch) {
    const jobId = retryMatch[1];
    // Reject path traversal via job ID.
    if (!/^[a-zA-Z0-9_-]+$/.test(jobId)) {
      json({ error: 'Invalid jobId' }, 400);
      return true;
    }

    const job = readJob(resolvedDeps.jobsDir, jobId);
    if (!job) {
      json({ error: 'Job not found' }, 404);
      return true;
    }

    // Do not permit retrying successful or active jobs.
    if (job.status !== 'failed') {
      json({ error: 'Only failed jobs can be retried' }, 400);
      return true;
    }

    // Retry creates a new immutable attempt. The failed folder stays available
    // for diagnosis and the new job receives only the reviewed reference and
    // input metadata, never partial GLBs from the prior run.
    const retryId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const retryDir = getJobDir(resolvedDeps.jobsDir, retryId);
    fs.mkdirSync(retryDir, { recursive: true });
    fs.copyFileSync(
      path.join(getJobDir(resolvedDeps.jobsDir, jobId), 'reference.png'),
      path.join(retryDir, 'reference.png'),
    );
    const retriedJob: HeroJob = {
      ...job,
      jobId: retryId,
      id: retryId,
      status: 'queued',
      stage: 'queued',
      progress: 0,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeJob(resolvedDeps.jobsDir, retriedJob);
    runJobAsync(resolvedDeps.jobsDir, retryId, resolvedDeps).catch(() => {});

    json(publicJob(retriedJob, resolvedDeps.jobsDir, resolvedDeps.publicHeroDir));
    return true;
  }

  // --------------------------------------------------------------------------
  // Endpoint: POST /devhub/api/hero-lab/jobs/:id/promote
  // Promotes a ready hero asset to the public game repository.
  // Uses a two-step replacement guard to prevent silent overwriting.
  // --------------------------------------------------------------------------
  const promoteMatch = urlPath.match(/^\/devhub\/api\/hero-lab\/jobs\/([^/]+)\/promote$/);
  if (method === 'POST' && promoteMatch) {
    const jobId = promoteMatch[1];
    // Reject path traversal via job ID.
    if (!/^[a-zA-Z0-9_-]+$/.test(jobId)) {
      json({ error: 'Invalid jobId' }, 400);
      return true;
    }

    try {
      const body = await readBody(req);
      const confirmReplace = !!body.confirmReplace;

      const job = readJob(resolvedDeps.jobsDir, jobId);
      if (!job) {
        json({ error: 'Job not found' }, 404);
        return true;
      }

      // Verify the pipeline completed successfully before allowing promotion.
      if (job.status !== 'ready') {
        json({ error: 'Only ready jobs can be promoted' }, 400);
        return true;
      }

      const jobDir = getJobDir(resolvedDeps.jobsDir, jobId);
      const filesToCopy = ['reference.png', 'master.glb', 'hero.glb', 'hero.json'];
      // Every promoted artifact must be a real file. A directory or other file-system
      // object with the expected name cannot be copied into a playable public bundle.
      const hasInvalidArtifact = filesToCopy.some((file) => {
        try {
          return !fs.lstatSync(path.join(jobDir, file)).isFile();
        } catch {
          return true;
        }
      });
      if (hasInvalidArtifact) {
        json({ error: 'Candidate artifacts are incomplete and cannot be promoted.' }, 409);
        return true;
      }

      // Check if a model already exists in the public directory.
      const targetDir = path.join(resolvedDeps.publicHeroDir, job.entryId);
      if (fs.existsSync(targetDir)) {
        const files = fs.readdirSync(targetDir);
        // If files are present, demand the explicit confirmReplace flag.
        if (files.length > 0 && !confirmReplace) {
          json({ error: 'An asset for this creature already exists. Confirm replace to overwrite.' }, 409);
          return true;
        }
      }

      // Build the whole replacement beside the live creature directory first. Keeping
      // both directories on the same volume lets the final renames avoid partial copies.
      fs.mkdirSync(resolvedDeps.publicHeroDir, { recursive: true });
      const stagingWorkspace = fs.mkdtempSync(
        path.join(resolvedDeps.publicHeroDir, `.hero-lab-promote-${job.entryId}-`),
      );
      const stagedCandidateDir = path.join(stagingWorkspace, 'candidate');
      const previousTargetDir = path.join(stagingWorkspace, 'previous');
      const readyJobSnapshot = { ...job };
      let previousTargetWasMoved = false;
      let replacementWasInstalled = false;
      let promotionWasCommitted = false;

      try {
        // Copying into this private workspace cannot expose a half-new public bundle.
        // Any copy failure is cleaned up while the existing target remains untouched.
        fs.mkdirSync(stagedCandidateDir);
        for (const file of filesToCopy) {
          fs.copyFileSync(path.join(jobDir, file), path.join(stagedCandidateDir, file));
        }

        // Preserve the old directory inside the workspace until both the replacement
        // and the promoted job record are durable. Nothing old is deleted up front.
        if (fs.existsSync(targetDir)) {
          fs.renameSync(targetDir, previousTargetDir);
          previousTargetWasMoved = true;
        }

        try {
          fs.renameSync(stagedCandidateDir, targetDir);
          replacementWasInstalled = true;
        } catch (swapError) {
          // A failed second rename leaves the backup intact. Restore it immediately so
          // callers continue seeing exactly the bundle that was live before promotion.
          if (previousTargetWasMoved) {
            fs.renameSync(previousTargetDir, targetDir);
            previousTargetWasMoved = false;
          }
          throw swapError;
        }

        // Mark the scratch job promoted only after the replacement directory is live.
        // If this write fails, the catch block below rolls the public directory back.
        job.status = 'promoted';
        job.stage = 'promoted';
        job.progress = 1.0;
        job.updatedAt = new Date().toISOString();
        writeJob(resolvedDeps.jobsDir, job);
        promotionWasCommitted = true;

        // The old bundle is removed only after both public assets and job metadata agree.
        // A cleanup failure does not reverse a promotion that is already fully committed;
        // leaving the hidden workspace behind preserves the old bundle for manual recovery.
        try {
          fs.rmSync(stagingWorkspace, { recursive: true, force: true });
        } catch {
          // The playable target and promoted job record already agree, so this is debris
          // rather than a partial promotion and must not turn the successful request into 500.
        }
      } catch (promotionError) {
        if (!promotionWasCommitted && replacementWasInstalled) {
          // Move the failed replacement back out of public view before restoring the
          // previous directory. Same-volume renames make each individual move atomic;
          // an external file-system failure during rollback remains recoverable here.
          fs.renameSync(targetDir, stagedCandidateDir);
          replacementWasInstalled = false;
        }
        if (!promotionWasCommitted && previousTargetWasMoved) {
          fs.renameSync(previousTargetDir, targetDir);
          previousTargetWasMoved = false;
        }

        // A metadata write can fail after changing the in-memory object. Put the scratch
        // record back to its ready state so the candidate remains available for retry.
        if (!promotionWasCommitted) {
          Object.assign(job, readyJobSnapshot);
          writeJob(resolvedDeps.jobsDir, job);
        }

        // Keep no staging debris after a failed copy or a safely restored swap.
        // If rollback itself cannot complete, retaining the workspace preserves recovery data.
        if (!replacementWasInstalled && !previousTargetWasMoved) {
          fs.rmSync(stagingWorkspace, { recursive: true, force: true });
        }
        throw promotionError;
      }

      json(publicJob(job, resolvedDeps.jobsDir, resolvedDeps.publicHeroDir));
    } catch (e: any) {
      json({ error: e.message || String(e) }, 500);
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // Endpoint: GET /devhub/api/hero-lab/jobs/:id/artifacts/:artifactType
  // Serves individual files created by the generation process.
  // --------------------------------------------------------------------------
  const artifactsMatch = urlPath.match(/^\/devhub\/api\/hero-lab\/jobs\/([^/]+)\/artifacts\/(reference|master|hero|metadata)$/);
  if (method === 'GET' && artifactsMatch) {
    const jobId = artifactsMatch[1];
    const artifactType = artifactsMatch[2];

    // Reject path traversal via job ID.
    if (!/^[a-zA-Z0-9_-]+$/.test(jobId)) {
      json({ error: 'Invalid jobId' }, 400);
      return true;
    }

    const jobDir = getJobDir(resolvedDeps.jobsDir, jobId);
    if (!fs.existsSync(jobDir)) {
      json({ error: 'Job not found' }, 404);
      return true;
    }

    // Map artifact requests to their actual file paths and MIME types.
    let filePath = '';
    let contentType = '';
    if (artifactType === 'reference') {
      filePath = path.join(jobDir, 'reference.png');
      contentType = 'image/png';
    } else if (artifactType === 'master') {
      filePath = path.join(jobDir, 'master.glb');
      contentType = 'model/gltf-binary';
    } else if (artifactType === 'hero') {
      filePath = path.join(jobDir, 'hero.glb');
      contentType = 'model/gltf-binary';
    } else if (artifactType === 'metadata') {
      filePath = path.join(jobDir, 'hero.json');
      contentType = 'application/json';
    }

    // Return 404 if the requested artifact hasn't been created yet.
    if (!filePath || !fs.existsSync(filePath)) {
      json({ error: 'Artifact not found' }, 404);
      return true;
    }

    // Read the file and stream it back directly.
    try {
      const content = fs.readFileSync(filePath);
      if (typeof ctx.res.writeHead === 'function') {
        ctx.res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': content.length,
        });
        ctx.res.end(content);
      } else {
        // Fallback response for testing and simulated environments.
        json(content, 200);
      }
    } catch (e: any) {
      json({ error: e.message || String(e) }, 500);
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // Endpoint: GET /devhub/api/hero-lab/jobs/:id
  // Retrieves the current progress and status of a single job.
  // --------------------------------------------------------------------------
  const jobDetailMatch = urlPath.match(/^\/devhub\/api\/hero-lab\/jobs\/([^/]+)$/);
  if (method === 'GET' && jobDetailMatch) {
    const jobId = jobDetailMatch[1];
    // Reject path traversal via job ID.
    if (!/^[a-zA-Z0-9_-]+$/.test(jobId)) {
      json({ error: 'Invalid jobId' }, 400);
      return true;
    }

    const job = readJob(resolvedDeps.jobsDir, jobId);
    if (!job) {
      json({ error: 'Job not found' }, 404);
      return true;
    }

    json(publicJob(job, resolvedDeps.jobsDir, resolvedDeps.publicHeroDir));
    return true;
  }

  // Path did not match any of the Hero Lab API endpoints.
  return false;
}
