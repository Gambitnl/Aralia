#!/usr/bin/env tsx
/**
 * Image generation driver with Stitch primary + image-gen fallback.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
// TODO(next-agent): Preserve behavior; replace this ts-expect-error once tsx supports extensionless local TS imports.
// @ts-expect-error -- tsx resolves local TS entrypoints at runtime; keep explicit extension for CLI use.
import {
  generateImage as browserGenerateImage,
  downloadImage as browserDownloadImage,
  cleanup as browserCleanup
} from './image-gen-mcp.ts';

type Provider = 'stitch' | 'image-gen';

interface ImageGenResult {
  success: boolean;
  message: string;
  provider: Provider;
  imageUrl?: string;
  imageData?: string;
  mimeType?: string;
  raw?: string;
}

interface DownloadResult {
  success: boolean;
  path: string;
  message: string;
}

const execAsync = promisify(exec);

const MCP_CLI = path.resolve(process.cwd(), 'node_modules/.bin/mcp-cli');
const MCP_CONFIG = path.resolve(process.cwd(), '.mcp.json');

const PRIMARY_PROVIDER = (process.env.IMAGE_GEN_PRIMARY || 'stitch').toLowerCase();
const FALLBACK_PROVIDER = (process.env.IMAGE_GEN_FALLBACK || 'image-gen').toLowerCase();
const STITCH_TOOL_OVERRIDE = (process.env.STITCH_IMAGE_TOOL || '').trim();
const STITCH_EXTRA_ARGS = (process.env.STITCH_IMAGE_ARGS || '').trim();

let lastResult: ImageGenResult | null = null;
let usedImageGen = false;

function normalizeProvider(value: string): Provider {
  return value === 'image-gen' ? 'image-gen' : 'stitch';
}

function parseJsonInput(value: string): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
  return {};
}

function extractJsonFromOutput(output: string): unknown | null {
  const trimmed = output.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const objectMatch = trimmed.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        return null;
      }
    }
    const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function parseToolsFromOutput(output: string): string[] {
  const tools: string[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const match = line.match(/(?:^|\s)([a-z_]+)\s*-/i);
    if (match) {
      tools.push(match[1]);
    }
  }

  return tools;
}

async function listTools(serverName: string): Promise<string[]> {
  const cmd = `"${MCP_CLI}" --config "${MCP_CONFIG}" ${serverName} -d`;
  const { stdout } = await execAsync(cmd, { shell: true, timeout: 30000 });
  return parseToolsFromOutput(stdout);
}

async function resolveStitchImageTool(): Promise<string | null> {
  if (STITCH_TOOL_OVERRIDE) return STITCH_TOOL_OVERRIDE;
  if (!fs.existsSync(MCP_CONFIG)) return null;

  const tools = await listTools('stitch');
  if (!tools.length) return null;

  const imageCandidates = tools.filter((tool) => /image|img|asset|render/i.test(tool));
  const preferred = imageCandidates.find((tool) => /generate|create|render/i.test(tool));

  return preferred || imageCandidates[0] || tools[0] || null;
}

async function callMcpTool(server: string, tool: string, args: Record<string, unknown>): Promise<string> {
  const cmd = `"${MCP_CLI}" --config "${MCP_CONFIG}" ${server}/${tool} '${JSON.stringify(args)}'`;
  const { stdout, stderr } = await execAsync(cmd, { shell: true, timeout: 180000 });

  if (stderr && !stderr.toLowerCase().includes('debug')) {
    console.warn(`[image-gen] ${server}/${tool} stderr: ${stderr.trim()}`);
  }

  return stdout.trim();
}

function extractUrlFromText(text: string): string | undefined {
  const urlMatch = text.match(/https?:\/\/\S+/);
  if (urlMatch) {
    return urlMatch[0].replace(/[\s'")]+$/, '');
  }
  return undefined;
}

function extractImagePayload(data: unknown): Pick<ImageGenResult, 'imageUrl' | 'imageData' | 'mimeType'> | null {
  if (!data || typeof data !== 'object') return null;

  const anyData = data as any;
  const candidates = [anyData, anyData.result, anyData.data, anyData.output];

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (typeof candidate.imageUrl === 'string') return { imageUrl: candidate.imageUrl };
    if (typeof candidate.image_url === 'string') return { imageUrl: candidate.image_url };
    if (typeof candidate.url === 'string') return { imageUrl: candidate.url };
    if (typeof candidate.imageData === 'string') return { imageData: candidate.imageData };
    if (typeof candidate.image_base64 === 'string') return { imageData: candidate.image_base64 };

    const content = candidate.content;
    if (Array.isArray(content)) {
      for (const item of content) {
        if (!item) continue;
        if (item.type === 'image' && typeof item.data === 'string') {
          return { imageData: item.data, mimeType: item.mimeType || 'image/png' };
        }
        if (item.type === 'resource' && typeof item.url === 'string') {
          return { imageUrl: item.url };
        }
        if (item.type === 'text' && typeof item.text === 'string') {
          const textUrl = extractUrlFromText(item.text);
          if (textUrl) return { imageUrl: textUrl };
        }
      }
    }

    if (typeof content === 'string') {
      const textUrl = extractUrlFromText(content);
      if (textUrl) return { imageUrl: textUrl };
    }
  }

  return null;
}

async function saveImageFromResult(result: ImageGenResult, outputPath: string): Promise<DownloadResult> {
  if (result.imageData) {
    const dataUrlMatch = result.imageData.match(/^data:(.+);base64,(.+)$/);
    const base64 = dataUrlMatch ? dataUrlMatch[2] : result.imageData;
    fs.writeFileSync(outputPath, Buffer.from(base64, 'base64'));
    return { success: true, path: outputPath, message: `Image saved to ${outputPath}` };
  }

  if (result.imageUrl) {
    const response = await fetch(result.imageUrl);
    if (!response.ok) {
      return { success: false, path: '', message: `Failed to download image: ${response.statusText}` };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
    return { success: true, path: outputPath, message: `Image saved to ${outputPath}` };
  }

  return { success: false, path: '', message: 'No image payload to save.' };
}

async function generateWithStitch(prompt: string): Promise<ImageGenResult> {
  if (!fs.existsSync(MCP_CONFIG)) {
    return {
      success: false,
      message: 'Missing .mcp.json; Stitch MCP server is not configured.',
      provider: 'stitch'
    };
  }

  const tool = await resolveStitchImageTool();
  if (!tool) {
    return {
      success: false,
      message: 'No Stitch image tool found. Set STITCH_IMAGE_TOOL or run npm run mcp inspect stitch.',
      provider: 'stitch'
    };
  }

  const extraArgs = parseJsonInput(STITCH_EXTRA_ARGS);
  const args = { prompt, ...extraArgs };

  try {
    const raw = await callMcpTool('stitch', tool, args);
    const parsed = extractJsonFromOutput(raw);
    const payload = extractImagePayload(parsed);

    if (!payload) {
      return {
        success: false,
        message: `Stitch returned no image payload. Set STITCH_IMAGE_TOOL/STITCH_IMAGE_ARGS to match the tool schema.`,
        provider: 'stitch',
        raw
      };
    }

    return {
      success: true,
      message: `Image generated via Stitch (${tool}).`,
      provider: 'stitch',
      ...payload,
      raw
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, message, provider: 'stitch' };
  }
}

async function generateWithImageGen(prompt: string): Promise<ImageGenResult> {
  usedImageGen = true;
  const result = await browserGenerateImage(prompt, 'gemini');
  return {
    success: result.success,
    message: result.message,
    provider: 'image-gen'
  };
}

export async function generateImage(prompt: string): Promise<ImageGenResult> {
  const primary = normalizeProvider(PRIMARY_PROVIDER);
  const fallback = normalizeProvider(FALLBACK_PROVIDER);

  const attempts: Provider[] = primary === fallback ? [primary] : [primary, fallback];
  let lastError: ImageGenResult | null = null;

  for (const provider of attempts) {
    const result = provider === 'stitch'
      ? await generateWithStitch(prompt)
      : await generateWithImageGen(prompt);

    lastResult = result;

    if (result.success) {
      return result;
    }

    lastError = result;
  }

  return lastError || {
    success: false,
    message: 'Image generation failed.',
    provider: primary
  };
}

export async function downloadImage(outputPath: string): Promise<DownloadResult> {
  if (!lastResult) {
    return { success: false, path: '', message: 'No generated image to download.' };
  }

  if (lastResult.provider === 'stitch') {
    return saveImageFromResult(lastResult, outputPath);
  }

  return browserDownloadImage(outputPath);
}

export async function cleanup(): Promise<void> {
  if (usedImageGen) {
    await browserCleanup();
  }
}

export function getLastProvider(): Provider | null {
  return lastResult?.provider ?? null;
}
