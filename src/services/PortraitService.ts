
/**
 * @file PortraitService.ts
 * Service for handling AI character portrait generation.
 *
 * NOTE:
 * The recommended path is to call the local dev API (`/api/portraits/generate`), which
 * can be backed by Stitch (MCP) and returns a URL to a locally served image.
 */

import { safeJSONParse } from '../utils/securityUtils';

export interface PortraitRequest {
  name: string;
  description: string;
  race: string;
  className: string;
}

export interface PortraitGenerateRequest {
  description: string;
  race: string;
  className: string;
}

export async function generatePortraitUrl(request: PortraitGenerateRequest): Promise<string> {
  const response = await fetch('/api/portraits/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    // ignore - handled below
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('AI Portrait generation is a local-only feature and is not available on the live web version. Please run the game locally to use this functionality.');
    }
    const message = typeof payload?.error === 'string' && payload.error.trim()
      ? payload.error.trim()
      : `Portrait generation failed (${response.status}).`;
    throw new Error(message);
  }

  if (!payload || typeof payload.url !== 'string' || !payload.url.trim()) {
    throw new Error('Portrait generation returned no URL.');
  }

  return payload.url.trim();
}

/**
 * @deprecated Prefer {@link generatePortraitUrl} (Stitch-backed dev API).
 * Sends a portrait request to the Agent Uplink local chat server (localhost:8000).
 */
export async function requestPortrait(request: PortraitRequest): Promise<void> {
  const payload = {
    name: request.name,
    description: request.description,
    race: request.race,
    class: request.className,
  };
  // Build JSON with JSON.stringify to avoid broken payloads when inputs contain quotes/newlines.
  const message = `#Human #portrait_request ${JSON.stringify(payload)}`;

  try {
    const response = await fetch('http://localhost:8000/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    if (!response.ok) {
      throw new Error(`Agent Uplink responded with ${response.status}`);
    }
  } catch (error) {
    console.error('Failed to send portrait request to agent:', error);
    throw new Error('Agent Uplink not responding. Ensure local_chat.py is running.');
  }
}

/**
 * Polls for a portrait URL from the agent.
 * The agent will reply with a message containing the generated image URL.
 */
// TODO(agent-uplink): This polling path is kept for backwards-compatibility. Prefer generatePortraitUrl().
export async function pollForPortrait(characterName: string): Promise<string | null> {
  try {
    const response = await fetch('http://localhost:8000/api/messages');
    if (!response.ok) {
      throw new Error(`Agent Uplink responded with ${response.status}`);
    }
    const messages = await response.json();
    if (!Array.isArray(messages)) return null;

    // Find the latest reply from the agent for this character's portrait
    // The agent should reply with something like "#Gemini #portrait_ready { "name": "...", "url": "..." }"
    const reply = [...messages].reverse().find((msg: any) =>
      msg?.agent === 'Gemini' &&
      typeof msg?.message === 'string' &&
      msg.message.includes('#portrait_ready') &&
      msg.message.includes(characterName)
    );

    if (reply) {
      const jsonMatch = reply.message.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const data = safeJSONParse<{ url: string }>(jsonMatch[0]);
        return data ? data.url : null;
      }
    }
  } catch (error) {
    console.error('Error polling for portrait:', error);
  }
  return null;
}
