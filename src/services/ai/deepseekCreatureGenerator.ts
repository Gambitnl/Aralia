/**
 * @file deepseekCreatureGenerator.ts — DeepSeek-V4-Flash Creature Genome Generator.
 *
 * Connects natural language creature descriptions ("a six-legged insectoid with sharp pincers",
 * "a four-legged lizard with a long whip tail") to the procedural creature engine.
 *
 * Uses the free HuggingFace endpoint for DeepSeek-V4-Flash to generate a structured
 * JSON `CreatureGenome`, then validates it with Zod. If the endpoint is offline or rate-limited,
 * provides a deterministic fallback procedural genome based on prompt hashing.
 */

import type { CreatureGenome } from '../../systems/entities3d/genome/creatureGenomeSchema';
import { validateGenome, creatureGenomeToJsonSchema } from '../../systems/entities3d/genome/creatureGenomeSchema';

const DEEPSEEK_ENDPOINT = 'https://q5dh1rfszfym23hj.us-east-2.aws.endpoints.huggingface.cloud/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-ai/DeepSeek-V4-Flash-0731';

/** Prompt template instructing DeepSeek how to construct a valid creature genome */
const SYSTEM_PROMPT = `You are a biological rig architect for a 3D procedural creature generator.
Your job is to convert a natural language creature description into a JSON CreatureGenome object.

BIOMECHANICS & STRUCTURAL RULES:
1. Knees bend BACKWARD relative to hips (flexion 0° to 130°, never hyperextend).
2. Elbows bend FORWARD relative to shoulders (flexion 0° to 145°).
3. Shoulders have ball_and_socket joints (coneAngle: 120, twistLimit: 90).
4. Hips have ball_and_socket joints (coneAngle: 90, twistLimit: 45).
5. Spine consists of recursive nodes or a spine config with 3-10 segments, each rotating <15°.
6. Limb pairs should set \`mirror: true\` on left-side nodes to auto-generate right-side counterparts.
7. All bone lengths and thickness dimensions are in FEET.

REQUIRED JSON OUTPUT FORMAT:
Output ONLY a raw, valid JSON object matching the CreatureGenome schema. No markdown code blocks, no explanation text before or after.

JSON SCHEMA REFERENCE:
${JSON.stringify(creatureGenomeToJsonSchema(), null, 2)}`;

/**
 * Generate a CreatureGenome from a natural language prompt using DeepSeek-V4-Flash.
 *
 * @param userPrompt - Description of the desired creature (e.g. "a mantis-like predator with razor arms")
 * @returns Promise resolving to a validated CreatureGenome
 */
export async function generateCreatureGenomeWithDeepSeek(userPrompt: string): Promise<{
  genome: CreatureGenome;
  source: 'deepseek' | 'fallback';
  rawResponse?: string;
  error?: string;
}> {
  try {
    const response = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Generate a CreatureGenome for: ${userPrompt}` },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn('[DeepSeekCreatureGenerator] API error:', response.status, errText);
      return {
        genome: createFallbackGenome(userPrompt),
        source: 'fallback',
        error: `HTTP ${response.status}: ${errText.slice(0, 200)}`,
      };
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content?.trim();

    if (!rawContent) {
      return {
        genome: createFallbackGenome(userPrompt),
        source: 'fallback',
        error: 'Empty response from DeepSeek',
      };
    }

    // Strip markdown code fences if DeepSeek included them despite system prompt
    let cleanJson = rawContent;
    const fenceMatch = cleanJson.match(/```(?:json)?\n([\s\S]*?)```/);
    if (fenceMatch) {
      cleanJson = fenceMatch[1].trim();
    }

    const parsedData = JSON.parse(cleanJson);
    const validation = validateGenome(parsedData);

    if (validation.success) {
      return {
        genome: validation.data,
        source: 'deepseek',
        rawResponse: rawContent,
      };
    } else {
      console.warn('[DeepSeekCreatureGenerator] Validation errors:', validation.errors);
      return {
        genome: createFallbackGenome(userPrompt),
        source: 'fallback',
        error: `Validation failed: ${validation.errors.join('; ')}`,
        rawResponse: rawContent,
      };
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn('[DeepSeekCreatureGenerator] Request failed:', errMsg);
    return {
      genome: createFallbackGenome(userPrompt),
      source: 'fallback',
      error: errMsg,
    };
  }
}

/**
 * Deterministic fallback genome generator used when offline or on API errors.
 * Constructs a quadruped lizard/beast genome based on prompt keywords.
 */

export function createFallbackGenome(prompt: string): CreatureGenome {
  const isHex = /insect|bug|spider|hex|six/i.test(prompt);
  const isSerpent = /snake|worm|serpent|slither/i.test(prompt);
  const isBird = /bird|avian|wing|fly/i.test(prompt);

  const archetype = isHex
    ? 'hexapod'
    : isSerpent
      ? 'serpentine'
      : isBird
        ? 'avian'
        : 'quadruped';

  return {
    schemaVersion: '1.0',
    archetype,
    symmetryType: 'bilateral',
    scaleMultiplier: 1.0,
    mass: 120,
    skin: {
      primaryColor: '#3a5f36',
      secondaryColor: '#8b9a62',
      pattern: isHex ? 'chitinous' : isSerpent ? 'scaly' : 'striped',
      thicknessProfile: 0.5,
    },
    spine: {
      segmentCount: 6,
      curvature: 0,
      segmentLength: 0.5,
      maxSegmentRotation: 10,
    },
    locomotion: {
      gaitType: isHex ? 'tripod' : isSerpent ? 'serpentine' : 'walk',
      strideLength: 1.2,
      stepFrequency: 1.5,
      legGroups: [
        { name: 'front_legs', boneIds: ['leg_front_L'], phaseOffset: 0, amplitudeScale: 1 },
        { name: 'hind_legs', boneIds: ['leg_hind_L'], phaseOffset: 0.5, amplitudeScale: 1 },
      ],
    },
    rootBone: {
      id: 'root',
      name: 'root',
      length: 1.2,
      thickness: 0.8,
      restRotation: [0, 0, 0],
      joint: null,
      mirror: false,
      children: [
        {
          id: 'pelvis',
          name: 'pelvis',
          length: 0.8,
          thickness: 0.6,
          restRotation: [0, 0, 0],
          joint: { type: 'ball_and_socket', coneAngle: 30, twistLimit: 15, stiffness: 0.5 },
          mirror: false,
          children: [
            {
              id: 'leg_hind',
              name: 'leg_hind',
              length: 1.0,
              thickness: 0.35,
              restRotation: [-20, 0, 0],
              joint: { type: 'ball_and_socket', coneAngle: 90, twistLimit: 45, stiffness: 0.6 },
              mirror: true,
              children: [
                {
                  id: 'shin_hind',
                  name: 'shin_hind',
                  length: 1.1,
                  thickness: 0.25,
                  restRotation: [40, 0, 0],
                  joint: { type: 'hinge', axis: 'backward', minAngle: 0, maxAngle: 130, stiffness: 0.5 },
                  mirror: false,
                  children: [
                    {
                      id: 'foot_hind',
                      name: 'foot_hind',
                      length: 0.3,
                      thickness: 0.2,
                      restRotation: [-20, 0, 0],
                      joint: { type: 'saddle', pitchRange: 45, yawRange: 20, stiffness: 0.7 },
                      mirror: false,
                      children: [],
                    },
                  ],
                },
              ],
            },
            {
              id: 'spine_1',
              name: 'spine_1',
              length: 0.7,
              thickness: 0.5,
              restRotation: [0, 0, 0],
              joint: { type: 'pivot', twistRange: 15, stiffness: 0.5 },
              mirror: false,
              children: [
                {
                  id: 'chest',
                  name: 'chest',
                  length: 0.9,
                  thickness: 0.7,
                  restRotation: [0, 0, 0],
                  joint: { type: 'ball_and_socket', coneAngle: 20, twistLimit: 15, stiffness: 0.5 },
                  mirror: false,
                  children: [
                    {
                      id: 'leg_front',
                      name: 'leg_front',
                      length: 0.9,
                      thickness: 0.3,
                      restRotation: [20, 0, 0],
                      joint: { type: 'ball_and_socket', coneAngle: 120, twistLimit: 90, stiffness: 0.6 },
                      mirror: true,
                      children: [
                        {
                          id: 'shin_front',
                          name: 'shin_front',
                          length: 1.0,
                          thickness: 0.22,
                          restRotation: [-35, 0, 0],
                          joint: { type: 'hinge', axis: 'forward', minAngle: 0, maxAngle: 145, stiffness: 0.5 },
                          mirror: false,
                          children: [
                            {
                              id: 'foot_front',
                              name: 'foot_front',
                              length: 0.3,
                              thickness: 0.18,
                              restRotation: [15, 0, 0],
                              joint: { type: 'saddle', pitchRange: 45, yawRange: 20, stiffness: 0.7 },
                              mirror: false,
                              children: [],
                            },
                          ],
                        },
                      ],
                    },
                    {
                      id: 'neck',
                      name: 'neck',
                      length: 0.6,
                      thickness: 0.35,
                      restRotation: [10, 0, 0],
                      joint: { type: 'pivot', twistRange: 30, stiffness: 0.5 },
                      mirror: false,
                      children: [
                        {
                          id: 'head',
                          name: 'head',
                          length: 0.5,
                          thickness: 0.4,
                          restRotation: [-10, 0, 0],
                          joint: { type: 'ball_and_socket', coneAngle: 45, twistLimit: 60, stiffness: 0.6 },
                          mirror: false,
                          children: [],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: 'tail_1',
              name: 'tail_1',
              length: 0.6,
              thickness: 0.3,
              restRotation: [-10, 0, 0],
              joint: { type: 'pivot', twistRange: 20, stiffness: 0.4 },
              mirror: false,
              children: [
                {
                  id: 'tail_2',
                  name: 'tail_2',
                  length: 0.6,
                  thickness: 0.2,
                  restRotation: [-10, 0, 0],
                  joint: { type: 'pivot', twistRange: 25, stiffness: 0.4 },
                  mirror: false,
                  children: [
                    {
                      id: 'tail_tip',
                      name: 'tail_tip',
                      length: 0.5,
                      thickness: 0.1,
                      restRotation: [-5, 0, 0],
                      joint: { type: 'pivot', twistRange: 30, stiffness: 0.4 },
                      mirror: false,
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  };
}
