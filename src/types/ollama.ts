/**
 * ARCHITECTURAL CONTEXT:
 * This file defines the 'AI Integration Schema' for the Ollama service. 
 * It models how context is passed to the LLM and how structured JSON 
 * responses are mapped back into game data.
 *
 * Recent updates focus on 'Rich Context Inoculation'. The `BanterContext` 
 * interface has been significantly expanded to include real-time player 
 * state (equipment, class, level) and NPC psychological markers 
 * (extraversion, neuroticism). This allows the AI to generate dialogue 
 * that is hyper-aware of the current game state, moving beyond generic 
 * fantasy banter to true situational awareness.
 * 
 * @file src/types/ollama.ts
 */

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration options for Ollama service.
 * Can be customized per-user or for game balancing.
 */
export interface OllamaConfig {
    /** Base URL for the Ollama API proxy */
    apiBase: string;
    /** Default timeout for requests in milliseconds */
    timeoutMs: number;
    /** Number of retry attempts for failed requests */
    retryAttempts: number;
    /** Preferred model names in order of priority. Used as the global fallback chain
     * when no task-specific profile match is found in installed models. */
    preferredModels: string[];
}

export const DEFAULT_OLLAMA_CONFIG: OllamaConfig = {
    apiBase: '/api/ollama',
    timeoutMs: 90000,
    retryAttempts: 0,
    // Order reflects the router fallback chain. Spec-recommended models come first;
    // legacy entries follow so existing setups continue to work until the user pulls
    // the new ones. See docs/ai/local-llm-model-routing.md.
    preferredModels: [
        'granite4.1:8b-q4_K_M',
        'qwen3:8b-q4_K_M',
        'granite4.1:3b-q6_K',
        'phi4-mini:3.8b-q4_K_M',
        'adi0adi/ollama_stheno-8b_v3.1_q6k',
        'mistral:instruct',
        'leeplenty/ellaria',
        'phi4-mini:3.8b',
        'llama3.1:instruct',
        'llama3:instruct',
        'gemma3:1b',
        'gemma:2b',
        'phi'
    ]
};

// ============================================================================
// Model Parameters & Task Routing
// ============================================================================

/**
 * Sampling and runtime parameters for a single Ollama request.
 * All fields optional — defaults are filled in by the client when omitted.
 * See docs/ai/local-llm-model-routing.md for guidance per task category.
 */
export interface ModelParams {
    temperature?: number;
    /** Nucleus sampling cutoff (0..1). */
    topP?: number;
    /** Repetition penalty (Ollama: `repeat_penalty`). Values > 1 discourage repetition. */
    repeatPenalty?: number;
    /** Context window size. Default 4096; do not raise above what your VRAM allows. */
    numCtx?: number;
    /** Maximum tokens to generate (Ollama: `num_predict`). */
    numPredict?: number;
    /** Ollama `keep_alive`: how long the model stays resident after a request.
     * Accepts a duration string (e.g. "10m"), or 0 to unload immediately. */
    keepAlive?: string | number;
}

/**
 * Format option for Ollama's `format` field. `'json'` enables loose JSON mode.
 * Passing an object enables structured-output mode (Ollama grounds the response
 * against this JSON schema). Omit for freeform text.
 */
export type ResponseFormat = 'json' | Record<string, unknown>;

/**
 * Canonical task taxonomy mapped to model routing decisions.
 * Order roughly matches the routing table in docs/ai/local-llm-model-routing.md.
 */
export type TaskType =
    // Dialogue / prose
    | 'companion_banter'
    | 'companion_banter_escalation'
    | 'conversation_continuation'
    | 'npc_dialogue'
    | 'gossip'
    | 'emotional_reaction'
    | 'location_description'
    | 'wilderness_description'
    | 'encounter_description'
    | 'action_outcome'
    | 'dynamic_event'
    // Structured / judgment
    | 'oracle_response'
    | 'social_check_outcome'
    | 'situation_analysis'
    | 'custom_action_suggestions'
    | 'guide_response'
    // Utility / chores
    | 'conversation_summary'
    | 'fact_extraction'
    | 'name_generation'
    | 'tile_inspection'
    | 'harvest_loot';

/**
 * A profile describing how to handle a specific task: which models to try, what
 * sampling parameters to use, and whether to request structured outputs.
 */
export interface TaskProfile {
    taskType: TaskType;
    /** Preferred models for this task, in priority order. Router walks this list
     * against installed models, then falls back to OllamaConfig.preferredModels. */
    preferredModels: string[];
    /** Default sampling parameters for this category. Callers may override per-request. */
    params: Required<Pick<ModelParams, 'temperature' | 'topP' | 'repeatPenalty' | 'numCtx' | 'numPredict'>>;
    /** Optional response format hint. */
    format?: ResponseFormat;
    /** Optional keep_alive policy (defaults to undefined = Ollama default). */
    keepAlive?: string | number;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Model information from Ollama tags endpoint.
 */
export interface OllamaModel {
    name: string;
}

/**
 * Response from Ollama generate endpoint.
 */
export interface OllamaGenerateResponse {
    response: string;
}

/**
 * Response from Ollama chat endpoint.
 */
export interface OllamaChatResponse {
    message?: {
        role: string;
        content: string;
    };
    done: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Typed error variants for Ollama operations.
 */
export type OllamaError =
    | { type: 'NETWORK_ERROR'; message: string }
    | { type: 'TIMEOUT'; message: string }
    | { type: 'PARSE_ERROR'; message: string; rawResponse: string }
    | { type: 'UNKNOWN'; message: string };

// ============================================================================
// Result Types
// ============================================================================

/**
 * Metadata about an Ollama request/response cycle.
 */
export interface OllamaMetadata {
    prompt: string;
    response?: string;
    model: string;
    id?: string;
}

/**
 * Result wrapper for Ollama operations with success/failure discrimination.
 */
export type OllamaResult<T> =
    | { success: true; data: T; metadata: OllamaMetadata }
    | { success: false; error: OllamaError; metadata?: OllamaMetadata };

// ============================================================================
// Context Types
// ============================================================================

/**
 * Contextual information for AI-generated content.
 */
export interface BanterContext {
    locationName: string;
    weather?: string;
    timeOfDay?: string;
    recentEvents?: string[];
    currentTask?: string;
    conversationHistory?: string[];
    // WHAT CHANGED: Added player-state and NPC-personality fields.
    // WHY IT CHANGED: To enable 'Situational Awareness' in banter. 
    // By passing the player's level, class, and equipped gear, we allow 
    // the LLM to make specific comments (e.g., 'That's a fine suit of 
    // Plate for a level 5 Fighter'). The NPC personality traits 
    // drive the 'Escalation/Ignore' logic in the conversation service layer.
    // Player-directed banter additions:
    /** When true the NPC should address the player directly, not other NPCs. */
    isPlayerDirected?: boolean;
    /** Player's name — used in the prompt so the NPC can address them by name. */
    playerName?: string;
    /** 0-100 extraversion score of the speaking NPC — drives persistence when ignored. */
    npcExtraversion?: number;
    /** 0-100 neuroticism score of the speaking NPC — drives emotional intensity of escalation. */
    npcNeuroticism?: number;
    /**
     * Items the player currently has equipped, so NPCs can reference real gear.
     * Built from `party[0].equippedItems` — only non-null slots are included.
     */
    playerEquippedItems?: Array<{ name: string; slot: string; category?: string }>;
    /** Player's class name (e.g. "Rogue", "Fighter"). */
    playerClass?: string;
    /** Player's current level. */
    playerLevel?: number;
}

// ============================================================================
// Participant Types
// ============================================================================

/**
 * Basic participant info for conversations.
 */
export interface ConversationParticipant {
    id: string;
    name: string;
    personality: string;
}

/**
 * Full participant info for banter generation.
 */
export interface BanterParticipant {
    id: string;
    name: string;
    race: string;
    class: string;
    sex: string;
    age: number | string;
    physicalDescription: string;
    personality: string;
    memories?: string[];
}

/**
 * Companion info for reaction generation.
 */
export interface ReactionCompanion {
    id: string;
    name: string;
    race: string;
    class: string;
    sex: string;
    personality: string;
}

/**
 * Event that triggers a companion reaction.
 */
export interface ReactionEvent {
    type: string;
    description: string;
    tags: string[];
}

// ============================================================================
// Response Data Types
// ============================================================================

/**
 * A single line of banter dialogue.
 */
export interface BanterLineData {
    speakerId: string;
    text: string;
    emotion: string;
    isConcluding: boolean;
}

/**
 * Conversation continuation response.
 */
export interface ConversationResponse {
    speakerId: string;
    text: string;
    emotion?: string;
}

/**
 * Conversation summary for memory creation.
 */
export interface ConversationSummary {
    text: string;
    tags: string[];
    approvalChange: number;
}

/**
 * Companion reaction to an event.
 */
export interface ReactionResponse {
    text: string;
    approvalChange: number;
}
