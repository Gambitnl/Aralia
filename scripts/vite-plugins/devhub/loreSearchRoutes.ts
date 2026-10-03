/**
 * Ask-Aralia lore search routes.
 *
 * Proxies dev-hub questions to the "Ask Aralia" Vertex AI Search app
 * (engine aralia-lore-app, data store aralia-lore, location eu) so browser
 * pages never handle Google credentials. The data store indexes a rendered
 * corpus: docs/**, project memory, spell and glossary JSON rendered to
 * markdown (tools/loreSearch/prepare-corpus.mjs).
 *
 * Auth: mints an access token with the local gcloud CLI (Remy's login) and
 * caches it for 50 minutes. Queries bill to the GenAI App Builder credit
 * (search + LLM answer SKUs). No fallback: gcloud or API failures surface
 * verbatim as 502s.
 */
import { exec } from 'node:child_process';

interface DevHubRouteContext {
  req: any;
  res: any;
  json: (data: unknown, status?: number) => void;
  parsedUrl: URL;
  urlPath: string;
}

const PROJECT = 'crimson-ledger-503109';
const ANSWER_URL =
  `https://eu-discoveryengine.googleapis.com/v1/projects/${PROJECT}` +
  `/locations/eu/collections/default_collection/engines/aralia-lore-app` +
  `/servingConfigs/default_search:answer`;

const PREAMBLE =
  'You are the Aralia Archivist, the project\'s grumpy but reliable keeper of records. ' +
  'Answer questions about the Aralia RPG project using only the provided documents: ' +
  'game rules, spells, glossary entries, design docs, plans, and working notes. ' +
  'Be direct and plain, in US English. If the documents do not contain the answer, ' +
  'say so instead of guessing. A light touch of dusty-librarian character is welcome; ' +
  'accuracy comes first.';

let cachedToken: { token: string; mintedAt: number } | null = null;

function mintAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    exec('gcloud auth print-access-token', { windowsHide: true }, (err, stdout, stderr) => {
      if (err) reject(new Error(`gcloud auth print-access-token failed: ${stderr || err.message}`));
      else resolve(stdout.trim());
    });
  });
}

async function accessToken(): Promise<string> {
  const FIFTY_MINUTES = 50 * 60 * 1000;
  if (!cachedToken || Date.now() - cachedToken.mintedAt > FIFTY_MINUTES) {
    cachedToken = { token: await mintAccessToken(), mintedAt: Date.now() };
  }
  return cachedToken.token;
}

async function readBody(req: DevHubRouteContext['req']): Promise<Record<string, unknown>> {
  let acc = '';
  await new Promise<void>((resolve, reject) => {
    req.on('data', (chunk: Buffer | string) => {
      acc += chunk.toString();
    });
    req.on('end', () => resolve());
    req.on('error', (e: Error) => reject(e));
  });
  return JSON.parse(acc) as Record<string, unknown>;
}

interface AnswerReference {
  chunkInfo?: { documentMetadata?: { uri?: string; title?: string } };
  unstructuredDocumentInfo?: { uri?: string; title?: string };
}

/** gs://bucket/corpus/docs/foo.md.txt -> docs/foo.md (staging adds .txt for the importer) */
function displayPath(uri: string | undefined): string {
  if (!uri) return 'unknown source';
  return uri.replace(/^gs:\/\/[^/]+\/corpus\//, '').replace(/\.txt$/, '');
}

export async function handleLoreSearchRoutes(ctx: DevHubRouteContext): Promise<boolean> {
  if (ctx.urlPath !== '/api/lore-search/ask') return false;
  if (ctx.req.method !== 'POST') {
    ctx.json({ error: 'POST only' }, 405);
    return true;
  }

  try {
    const { question } = await readBody(ctx.req);
    if (typeof question !== 'string' || !question.trim()) {
      ctx.json({ error: 'body must be { "question": "..." }' }, 400);
      return true;
    }

    const token = await accessToken();
    const upstream = await fetch(ANSWER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Goog-User-Project': PROJECT,
      },
      body: JSON.stringify({
        query: { text: question.trim() },
        answerGenerationSpec: {
          includeCitations: true,
          ignoreAdversarialQuery: true,
          promptSpec: { preamble: PREAMBLE },
        },
      }),
    });

    const payload = (await upstream.json()) as any;
    if (!upstream.ok) {
      ctx.json({ error: `answer API ${upstream.status}: ${JSON.stringify(payload?.error ?? payload)}` }, 502);
      return true;
    }

    const answer = payload.answer ?? {};
    const references = ((answer.references ?? []) as AnswerReference[]).map((ref) => {
      const meta = ref.chunkInfo?.documentMetadata ?? ref.unstructuredDocumentInfo ?? {};
      return { title: meta.title || displayPath(meta.uri), path: displayPath(meta.uri) };
    });

    ctx.json({
      answer: answer.answerText ?? '',
      state: answer.state,
      references,
    });
  } catch (err) {
    ctx.json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
  return true;
}
