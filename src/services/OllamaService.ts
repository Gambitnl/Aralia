import { BanterDefinition } from '../types/companions';

interface OllamaModel {
    name: string;
}

interface OllamaResponse {
    response: string;
}

export interface BanterContext {
    locationName: string;
    weather?: string;
    timeOfDay?: string; // e.g., "Morning", "Night"
    recentEvents?: string[]; // Summaries of last 3 discovery log entries
    currentTask?: string; // Active quest title
    conversationHistory?: string[]; // Last few lines of dialogue
}

export class OllamaService {
    private static cachedModel: string | null = null;
    // Proxy path defined in vite.config.ts mapped to http://localhost:11434/api
    private static API_BASE = '/api/ollama';

    /**
     * Attempts to extract and parse JSON from a potentially messy string.
     */
    private static parseJsonRobustly(text: string): any {
        if (!text) return null;
        
        // 1. Try direct parse
        try {
            return JSON.parse(text.trim());
        } catch (e) {
            // Continue to fallback
        }

        // 2. Try to find JSON block in markdown
        const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (mdMatch && mdMatch[1]) {
            try {
                return JSON.parse(mdMatch[1].trim());
            } catch (e) {
                // Continue
            }
        }

        // 3. Try to find anything between { and }
        const braceMatch = text.match(/(\{[\s\S]*\})/);
        if (braceMatch && braceMatch[1]) {
            try {
                // If it ends with extra chars like " }", try cleaning it
                let potentialJson = braceMatch[1].trim();
                return JSON.parse(potentialJson);
            } catch (e) {
                // Try one more aggressive cleanup: find the LAST }
                const lastIndex = text.lastIndexOf('}');
                const firstIndex = text.indexOf('{');
                if (firstIndex !== -1 && lastIndex > firstIndex) {
                    try {
                        return JSON.parse(text.substring(firstIndex, lastIndex + 1));
                    } catch (e2) {
                        // Fail
                    }
                }
            }
        }

        return null;
    }

    /**
     * Checks if the Ollama service is reachable.
     */
    static async isAvailable(): Promise<boolean> {
        try {
            if (typeof window === 'undefined') return false; // Server-side check
            const res = await fetch(`${this.API_BASE}/tags`);
            return res.ok;
        } catch (e) {
            // Quietly fail if not available
            return false;
        }
    }

    /**
     * Finds a suitable model, preferring faster/smaller ones for banter.
     */
    static async getModel(): Promise<string | null> {
        if (this.cachedModel) return this.cachedModel;
        try {
            const res = await fetch(`${this.API_BASE}/tags`);
            if (!res.ok) return null;

            const data = await res.json() as { models: OllamaModel[] };
            // Prefer larger models for quality, smaller for speed
            const preferred = ['gpt-oss:20b', 'llama3.1', 'llama3', 'mistral', 'gemma3:1b', 'gemma:2b', 'phi'];

            for (const p of preferred) {
                const found = data.models.find(m => m.name.includes(p));
                if (found) {
                    this.cachedModel = found.name;
                    return found.name;
                }
            }

            // Fallback to first available if none of the preferred match
            if (data.models.length > 0) {
                this.cachedModel = data.models[0].name;
                return this.cachedModel;
            }

            return null;
        } catch {
            return null;
        }
    }

    /**
     * Generates a dynamic banter definition using the local LLM.
     */
    static async generateBanter(
        participants: {
            id: string;
            name: string;
            race: string;
            class: string;
            sex: string;
            age: number | string;
            physicalDescription: string;
            personality: string;
        }[],
        contextData: BanterContext
    ): Promise<{ data: BanterDefinition | null, metadata?: { prompt: string; response: string, model: string } }> {
        const model = await this.getModel();
        if (!model) return { data: null };

        let contextDescription = `Walking through ${contextData.locationName}.`;
        if (contextData.weather) contextDescription += ` weather: ${contextData.weather}.`;
        if (contextData.timeOfDay) contextDescription += ` Time: ${contextData.timeOfDay}.`;
        if (contextData.currentTask) contextDescription += ` Current Goal: ${contextData.currentTask}.`;
        if (contextData.recentEvents && contextData.recentEvents.length > 0) {
            contextDescription += `\nRecent Events:\n- ${contextData.recentEvents.join('\n- ')}`;
        }

        // Inject conversation history if available
        let historySection = "";
        if (contextData.conversationHistory && contextData.conversationHistory.length > 0) {
            historySection = `\nPrevious Conversation (continue the topic/vibe, but don't just repeat):\n${contextData.conversationHistory.join('\n')}\n`;
        }

        const systemPrompt = `You are a creative writer for a fantasy RPG.
Generate a short, witty banter dialogue between the following companions in the player's party:
${participants.map(p => `- ${p.name} (${p.sex} ${p.race} ${p.class}, Age: ${p.age}): ${p.physicalDescription}.\n  Personality: ${p.personality}`).join('\n')}

Context: ${contextDescription}
${historySection}

Requirements:
1. Output MUST be valid JSON only.
2. Structure: { 
    "lines": [{ "speakerId": "id", "text": "dialogue", "delay": 3000, "emotion": "neutral" }],
    "memory": { "text": "Short summary of this interaction", "tags": ["topic1", "topic2"] } 
   }
3. Length: 2-5 lines.
4. If there are 3+ participants, try to involve at least 3 of them if it makes sense, or focus on a subset. Use the exact Speaker IDs provided.
5. Make it sound natural and character-appropriate. Lean heavily into their specific races, ages, and backgrounds.
6. Allowed emotions: "happy", "sad", "angry", "surprised", "neutral"
7. The 'memory' field is optional but desirable for significant interactions.`;

        try {
            const requestBody = {
                model: model,
                prompt: systemPrompt,
                format: 'json',
                stream: false,
                options: {
                    temperature: 0.8,
                    num_predict: 512
                }
            };

            const res = await fetch(`${this.API_BASE}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!res.ok) {
                console.warn(`Ollama generate failed: ${res.statusText}`);
                return { data: null };
            }

            const data = await res.json() as OllamaResponse;
            const metadata = { prompt: systemPrompt, response: data.response, model };

            const parsed = this.parseJsonRobustly(data.response);
            if (!parsed || !parsed.lines || !Array.isArray(parsed.lines)) return { data: null, metadata };

            return {
                data: {
                    id: `ai_generated_${Date.now()}`,
                    participants: participants.map(p => p.id),
                    lines: parsed.lines,
                    generatedMemory: parsed.memory
                },
                metadata
            };
        } catch (e) {
            console.warn('Failed to generate AI banter:', e);
            return { data: null };
        }
    }

    /**
     * Generates a single banter line for turn-by-turn conversation.
     * Each call builds on the conversation history.
     */
    static async generateBanterLine(
        participants: {
            id: string;
            name: string;
            race: string;
            class: string;
            sex: string;
            age: number | string;
            physicalDescription: string;
            personality: string;
        }[],
        conversationHistory: { speakerId: string; speakerName: string; text: string }[],
        contextData: BanterContext,
        turnNumber: number
    ): Promise<{
        data: { speakerId: string; text: string; emotion: string; isConcluding: boolean } | null,
        metadata?: { prompt: string; response: string, model: string }
    }> {
        const model = await this.getModel();
        if (!model) return { data: null };

        let contextDescription = `Location: ${contextData.locationName}.`;
        if (contextData.weather) contextDescription += ` Weather: ${contextData.weather}.`;
        if (contextData.timeOfDay) contextDescription += ` Time: ${contextData.timeOfDay}.`;
        if (contextData.currentTask) contextDescription += ` Current Goal: ${contextData.currentTask}.`;

        // Format conversation history
        const historyText = conversationHistory.length > 0
            ? `\nConversation so far:\n${conversationHistory.map(h => `${h.speakerName}: "${h.text}"`).join('\n')}\n`
            : '';

        // Determine who should speak next (alternate between participants, avoid repeating last speaker)
        const lastSpeaker = conversationHistory[conversationHistory.length - 1]?.speakerId;
        const availableSpeakers = participants.filter(p => p.id !== lastSpeaker);
        const nextSpeaker = availableSpeakers.length > 0
            ? availableSpeakers[Math.floor(Math.random() * availableSpeakers.length)]
            : participants[0];

        // Random topic starters for variety
        const topicStarters = [
            'a recent fight or danger',
            'their personal history or backstory',
            'teasing another party member',
            'complaining about something',
            'a funny observation',
            'a past heist or adventure',
            'food or drink preferences',
            'questioning the party\'s current plan',
            'their views on magic or religion',
            'a rumor they heard in a tavern',
            'their opinion on a party member\'s habits',
            'something shiny they want to steal',
        ];
        const suggestedTopic = topicStarters[Math.floor(Math.random() * topicStarters.length)];

        // Build the other party members for reference
        const otherMembers = participants.filter(p => p.id !== nextSpeaker.id)
            .map(p => `${p.name} (${p.race} ${p.class})`).join(', ');

        const prompt = `[Character Data]
Name: ${nextSpeaker.name}
Role: ${nextSpeaker.sex} ${nextSpeaker.race} ${nextSpeaker.class}
Personality: ${nextSpeaker.personality}
Travelers: ${otherMembers}

[Context]
Location: ${contextData.locationName}
Weather: ${contextData.weather || 'Clear'}
Time: ${contextData.timeOfDay}
${historyText}

[Task]
${conversationHistory.length === 0 ? `Start a new conversation about ${suggestedTopic}.` : 'Continue the conversation. Respond to the last speaker.'}

[Requirements]
- Stay in character. Use your traits and quirks.
- 1-2 sentences max.
- Be specific (places, people, items).
- NEVER mention weather or light.
- isConcluding: ${turnNumber >= 4 ? 'true' : 'false'}

[Output Format]
Output ONLY a JSON object:
{"speakerId": "${nextSpeaker.id}", "text": "speech", "emotion": "neutral", "isConcluding": false}

JSON:`;

        try {
            const res = await fetch(`${this.API_BASE}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    prompt,
                    format: 'json',
                    stream: false,
                    options: { temperature: 0.7, num_predict: 256 }
                })
            });

            if (!res.ok) return { data: null };

            const data = await res.json() as OllamaResponse;
            const metadata = { prompt, response: data.response, model };

            const parsed = this.parseJsonRobustly(data.response);
            if (!parsed) return { data: null, metadata };

            // Support both single-line and legacy multi-line JSON formats
            const extractedText = parsed.text
                || parsed.line
                || (Array.isArray((parsed as any).lines) ? (parsed as any).lines[0]?.text : undefined);
            const extractedSpeakerId = parsed.speakerId
                || parsed.speaker
                || (Array.isArray((parsed as any).lines) ? (parsed as any).lines[0]?.speakerId : undefined)
                || nextSpeaker.id;
            const extractedEmotion = parsed.emotion
                || (Array.isArray((parsed as any).lines) ? (parsed as any).lines[0]?.emotion : undefined)
                || 'neutral';
            const extractedIsConcluding = parsed.isConcluding === true
                || (Array.isArray((parsed as any).lines) ? (parsed as any).lines[0]?.isConcluding === true : false)
                || turnNumber >= 5;

            if (!extractedText) return { data: null, metadata };

            return {
                data: {
                    speakerId: extractedSpeakerId,
                    text: extractedText,
                    emotion: extractedEmotion,
                    isConcluding: extractedIsConcluding
                },
                metadata
            };
        } catch (e) {
            console.warn('Failed to generate banter line:', e);
            return { data: null };
        }
    }

    /**
     * Continues an ongoing interactive conversation.
     * Returns a single response from the speaking companion.
     */
    static async continueConversation(
        participants: { id: string; name: string; personality: string }[],
        history: { speakerId: string; text: string }[],
        contextData: BanterContext
    ): Promise<{ data: { speakerId: string; text: string; emotion?: string } | null, metadata?: { prompt: string; response: string, model: string } }> {
        const model = await this.getModel();
        if (!model) return { data: null };

        // Build context
        let contextDescription = `Location: ${contextData.locationName}.`;
        if (contextData.weather) contextDescription += ` Weather: ${contextData.weather}.`;
        if (contextData.timeOfDay) contextDescription += ` Time: ${contextData.timeOfDay}.`;
        if (contextData.currentTask) contextDescription += ` Current Goal: ${contextData.currentTask}.`;

        // Format conversation history
        const historyText = history.map(m => {
            const speakerName = m.speakerId === 'player' ? 'Player' : participants.find(p => p.id === m.speakerId)?.name || m.speakerId;
            return `${speakerName}: "${m.text}"`;
        }).join('\n');

        // Determine who should respond (the companion that didn't speak last, or first companion if player just spoke)
        const lastSpeaker = history[history.length - 1]?.speakerId;
        const respondingCompanion = lastSpeaker === 'player'
            ? participants[0]
            : participants.find(p => p.id !== lastSpeaker) || participants[0];

        const prompt = `[Character Data]
Name: ${respondingCompanion.name}
Personality: ${respondingCompanion.personality}

[Context]
Location: ${contextData.locationName}
Weather: ${contextData.weather || 'Clear'}
Time: ${contextData.timeOfDay}
${historyText}

[Task]
Respond to the last message as ${respondingCompanion.name}.

[Requirements]
- 1-2 sentences max.
- Stay in character.

[Output Format]
Output ONLY JSON: {"text": "your response", "emotion": "neutral"}

JSON:`;

        try {
            const res = await fetch(`${this.API_BASE}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    prompt,
                    stream: false,
                    options: { temperature: 0.7, num_predict: 256 }
                })
            });

            if (!res.ok) return { data: null };

            const data = await res.json() as OllamaResponse;
            const metadata = { prompt, response: data.response, model };

            const parsed = this.parseJsonRobustly(data.response);
            if (!parsed || !parsed.text) return { data: null, metadata };

            return {
                data: {
                    speakerId: respondingCompanion.id,
                    text: parsed.text,
                    emotion: parsed.emotion || 'neutral'
                },
                metadata
            };
        } catch (e) {
            console.warn('Failed to continue conversation:', e);
            return { data: null };
        }
    }

    /**
     * Called AFTER a conversation ends.
     * Summarizes the entire exchange into a memory for all participants.
     */
    static async summarizeConversation(
        participants: { id: string; name: string; personality: string }[],
        history: { speakerId: string; text: string }[],
        contextData: BanterContext
    ): Promise<{ data: { text: string; tags: string[]; approvalChange: number } | null, metadata?: { prompt: string; response: string, model: string } }> {
        const model = await this.getModel();
        if (!model) return { data: null };

        // Format history for summarization
        const historyText = history.map(m => {
            const speakerName = m.speakerId === 'player' ? 'Player' : participants.find(p => p.id === m.speakerId)?.name || m.speakerId;
            return `${speakerName}: "${m.text}"`;
        }).join('\n');

        const companionNames = participants.map(p => p.name).join(' and ');

        const prompt = `You are a memory analyst for a fantasy RPG.

The following conversation just occurred between the player and their companions (${companionNames}) at ${contextData.locationName}:

${historyText}

Analyze this conversation and provide:
1. A brief memory summary (1-2 sentences) capturing the key topic or emotion
2. Relevant tags
3. How the player's behavior affected their standing with the companions

Output ONLY valid JSON:
{
  "text": "summary of the conversation",
  "tags": ["tag1", "tag2"],
  "approvalChange": 0
}

approvalChange rules:
- Range: -3 to +3 (integer only)
- +1 to +3: Player was kind, respectful, helpful, funny, or showed genuine interest
- 0: Neutral, casual conversation
- -1 to -3: Player was rude, dismissive, insulting, or disrespectful
Tags: "personal", "quest", "humor", "conflict", "location", "past", "future", "bonding", "tension"`;

        try {
            const res = await fetch(`${this.API_BASE}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    prompt,
                    format: 'json',
                    stream: false,
                    options: { temperature: 0.5, num_predict: 256 }
                })
            });

            if (!res.ok) return { data: null };

            const data = await res.json() as OllamaResponse;
            const metadata = { prompt, response: data.response, model };

            let jsonStr = data.response;
            if (jsonStr.includes('```json')) {
                jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '');
            }

            const parsed = JSON.parse(jsonStr);
            if (!parsed.text) return { data: null, metadata };

            // Clamp approvalChange to valid range
            const rawApproval = typeof parsed.approvalChange === 'number' ? parsed.approvalChange : 0;
            const approvalChange = Math.max(-3, Math.min(3, Math.round(rawApproval)));

            return {
                data: {
                    text: parsed.text,
                    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
                    approvalChange
                },
                metadata
            };
        } catch (e) {
            console.warn('Failed to summarize conversation:', e);
            return { data: null };
        }
    }

    /**
     * Generates a short, contextual reaction for a companion based on an event.
     * This is used for dynamic in-game reactions (e.g., looting, crimes, combat).
     */
    static async generateReaction(
        companion: {
            id: string;
            name: string;
            race: string;
            class: string;
            sex: string;
            personality: string; // Values, quirks, etc.
        },
        event: {
            type: string; // 'loot', 'crime_committed', 'combat_hit', etc.
            description: string; // "Player looted a Gold Necklace worth 250gp"
            tags: string[]; // ['gold', 'jewelry', 'valuable']
        },
        contextData: BanterContext
    ): Promise<{ data: { text: string; approvalChange: number } | null, metadata?: { prompt: string; response: string, model: string } }> {
        const model = await this.getModel();
        if (!model) return { data: null };

        let contextDescription = `Location: ${contextData.locationName}.`;
        if (contextData.weather) contextDescription += ` Weather: ${contextData.weather}.`;
        if (contextData.timeOfDay) contextDescription += ` Time: ${contextData.timeOfDay}.`;
        if (contextData.currentTask) contextDescription += ` Current Goal: ${contextData.currentTask}.`;

        const prompt = `[Character Data]
Name: ${companion.name}
Role: ${companion.sex} ${companion.race} ${companion.class}
Personality: ${companion.personality}

[Context]
Location: ${contextData.locationName}
Weather: ${contextData.weather || 'Clear'}
Time: ${contextData.timeOfDay}

[Event]
${event.description}

[Task]
React to this event in character.

[Requirements]
- VERY SHORT (1 sentence max).
- Determine approval change (-3 to +3).

[Output Format]
Output ONLY JSON: {"text": "your reaction", "approvalChange": 0}

JSON:`;

        try {
            const res = await fetch(`${this.API_BASE}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    prompt,
                    stream: false,
                    options: { temperature: 0.7, num_predict: 150 }
                })
            });

            if (!res.ok) return { data: null };

            const data = await res.json() as OllamaResponse;
            const metadata = { prompt, response: data.response, model };

            const parsed = this.parseJsonRobustly(data.response);
            if (!parsed || !parsed.text) return { data: null, metadata };

            const rawApproval = typeof parsed.approvalChange === 'number' ? parsed.approvalChange : 0;
            const approvalChange = Math.max(-3, Math.min(3, Math.round(rawApproval)));

            return {
                data: {
                    text: parsed.text,
                    approvalChange
                },
                metadata
            };
        } catch (e) {
            // TODO(2026-01-03 pass 4 Codex-CLI): relax error handling once Ollama service contract is formalized.
            console.warn('Failed to generate reaction:', e);
            return { data: null };
        }
    }
}
