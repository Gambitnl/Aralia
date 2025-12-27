
/**
 * @file PortraitService.ts
 * Service for handling AI character portrait generation.
 * In this agentic environment, it communicates with the local chat server
 * to request image generation from the agent.
 */

export interface PortraitRequest {
    name: string;
    description: string;
    race: string;
    className: string;
}

export async function requestPortrait(request: PortraitRequest): Promise<void> {
    const message = `#Human #portrait_request { "name": "${request.name}", "description": "${request.description}", "race": "${request.race}", "class": "${request.className}" }`;
    
    try {
        await fetch('http://localhost:8000/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
    } catch (error) {
        console.error('Failed to send portrait request to agent:', error);
        throw new Error('Agent Uplink not responding. Ensure local_chat.py is running.');
    }
}

/**
 * Polls for a portrait URL from the agent.
 * The agent will reply with a message containing the generated image URL.
 */
export async function pollForPortrait(characterName: string): Promise<string | null> {
    try {
        const response = await fetch('http://localhost:8000/api/messages');
        const messages = await response.json();
        
        // Find the latest reply from the agent for this character's portrait
        // The agent should reply with something like "#Gemini #portrait_ready { "name": "...", "url": "..." }"
        const reply = [...messages].reverse().find(msg => 
            msg.agent === 'Gemini' && 
            msg.message.includes('#portrait_ready') && 
            msg.message.includes(characterName)
        );

        if (reply) {
            const jsonMatch = reply.message.match(/\{.*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                return data.url;
            }
        }
    } catch (error) {
        console.error('Error polling for portrait:', error);
    }
    return null;
}
