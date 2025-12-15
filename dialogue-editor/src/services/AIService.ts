/**
 * AI Service for dialogue generation
 * Supports Anthropic Claude API
 */

export interface AIConfig {
  provider: 'anthropic' | 'openai' | 'mock';
  apiKey: string;
  model?: string;
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const DIALOGUE_SYSTEM_PROMPT = `You are an expert game dialogue writer and narrative designer. You help create branching dialogue trees for video games.

When the user describes a dialogue scenario, you should:
1. Write natural, engaging dialogue that fits the game's tone
2. Create meaningful player choices with different outcomes
3. Include character personality and emotion
4. Consider game mechanics (quests, items, reputation, etc.)

IMPORTANT: When you generate dialogue, you MUST include a JSON code block with this exact structure:

\`\`\`json
{
  "title": "Dialogue Title",
  "characters": [
    { "name": "Character Name", "color": "#hexcolor" }
  ],
  "nodes": [
    { "type": "dialogue", "speaker": "Character Name", "text": "What they say" },
    { "type": "dialogueFragment", "speaker": "Player", "text": "Player response", "menuText": "[Choice] Short version" },
    { "type": "branch", "label": "Choice Point" },
    { "type": "condition", "condition": "hasItem('key')" },
    { "type": "instruction", "instruction": "giveQuest('questId')" }
  ],
  "connections": [
    { "from": 0, "to": 1 },
    { "from": 1, "to": 2, "label": "Choice Label" }
  ]
}
\`\`\`

Node types available:
- "dialogue" - NPC speaks (first node in a conversation)
- "dialogueFragment" - Continuation or player choice
- "branch" - Multiple choice point
- "hub" - Return point for menus
- "condition" - Check game state
- "instruction" - Execute game action

Always provide the JSON so the user can apply it directly to their dialogue graph.`;

export class AIService {
  private config: AIConfig;
  private conversationHistory: AIMessage[] = [];

  constructor(config?: Partial<AIConfig>) {
    this.config = {
      provider: config?.provider || 'mock',
      apiKey: config?.apiKey || '',
      model: config?.model || 'claude-sonnet-4-20250514'
    };
    
    // Try to load API key from localStorage
    const savedKey = localStorage.getItem('dialogue-editor-api-key');
    if (savedKey) {
      this.config.apiKey = savedKey;
      this.config.provider = 'anthropic';
    }
  }

  setApiKey(key: string): void {
    this.config.apiKey = key;
    this.config.provider = 'anthropic';
    localStorage.setItem('dialogue-editor-api-key', key);
  }

  getApiKey(): string {
    return this.config.apiKey;
  }

  hasApiKey(): boolean {
    return this.config.apiKey.length > 0;
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  async sendMessage(userMessage: string): Promise<string> {
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    let response: string;

    if (this.config.provider === 'anthropic' && this.config.apiKey) {
      response = await this.callAnthropic(userMessage);
    } else {
      response = this.getMockResponse(userMessage);
    }

    this.conversationHistory.push({
      role: 'assistant',
      content: response
    });

    return response;
  }

  private async callAnthropic(_userMessage: string): Promise<string> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 4096,
          system: DIALOGUE_SYSTEM_PROMPT,
          messages: this.conversationHistory.map(m => ({
            role: m.role === 'system' ? 'user' : m.role,
            content: m.content
          }))
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
      }

      const data = await response.json();
      return data.content[0].text;
    } catch (error) {
      console.error('Anthropic API error:', error);
      throw error;
    }
  }

  private getMockResponse(userMessage: string): string {
    const lowerMsg = userMessage.toLowerCase();
    
    if (lowerMsg.includes('quest') || lowerMsg.includes('mission')) {
      return this.getQuestTemplate();
    }
    if (lowerMsg.includes('shop') || lowerMsg.includes('merchant')) {
      return this.getShopTemplate();
    }
    if (lowerMsg.includes('conversation') || lowerMsg.includes('talk') || lowerMsg.includes('meet')) {
      return this.getConversationTemplate();
    }
    
    return `⚠️ **No API Key Configured**

To get real AI-powered dialogue generation, you need to add your Anthropic API key.

**Click the ⚙️ button** in the chat header to configure your API key.

For now, try these keywords for pre-built templates:
- "quest" - Quest giver dialogue
- "shop" - Merchant dialogue  
- "conversation" - Character meeting

Once configured, I can write custom dialogue based on your exact descriptions!`;
  }

  private getQuestTemplate(): string {
    return `Here's a quest dialogue template:

\`\`\`json
{
  "title": "Quest Dialogue",
  "characters": [
    { "name": "Quest Giver", "color": "#e74c3c" },
    { "name": "Player", "color": "#4a90e2" }
  ],
  "nodes": [
    { "type": "dialogue", "speaker": "Quest Giver", "text": "Adventurer! I have a task that requires someone of your skills." },
    { "type": "dialogueFragment", "speaker": "Quest Giver", "text": "There's an ancient artifact in the ruins to the north. Many have tried to retrieve it. None have returned." },
    { "type": "branch", "label": "Player Response" },
    { "type": "dialogueFragment", "speaker": "Player", "text": "What's in it for me?", "menuText": "[Negotiate] What's the reward?" },
    { "type": "dialogueFragment", "speaker": "Player", "text": "I'll do it.", "menuText": "[Accept] I'll help" },
    { "type": "dialogueFragment", "speaker": "Player", "text": "Not interested.", "menuText": "[Decline] No thanks" },
    { "type": "dialogueFragment", "speaker": "Quest Giver", "text": "500 gold pieces. And perhaps something more valuable..." },
    { "type": "dialogueFragment", "speaker": "Quest Giver", "text": "Excellent! Head north through the forest." },
    { "type": "dialogueFragment", "speaker": "Quest Giver", "text": "A pity. If you change your mind, you know where to find me." },
    { "type": "instruction", "instruction": "StartQuest('ancient_artifact')" }
  ],
  "connections": [
    { "from": 0, "to": 1 },
    { "from": 1, "to": 2 },
    { "from": 2, "to": 3, "label": "Negotiate" },
    { "from": 2, "to": 4, "label": "Accept" },
    { "from": 2, "to": 5, "label": "Decline" },
    { "from": 3, "to": 6 },
    { "from": 4, "to": 7 },
    { "from": 5, "to": 8 },
    { "from": 6, "to": 4 },
    { "from": 7, "to": 9 }
  ]
}
\`\`\`

Click **Apply to Canvas** to add this to your project!`;
  }

  private getShopTemplate(): string {
    return `Here's a shop dialogue template:

\`\`\`json
{
  "title": "Shop Dialogue",
  "characters": [
    { "name": "Merchant", "color": "#f39c12" },
    { "name": "Player", "color": "#4a90e2" }
  ],
  "nodes": [
    { "type": "dialogue", "speaker": "Merchant", "text": "Welcome! The finest goods in all the land!" },
    { "type": "hub", "label": "Shop Menu" },
    { "type": "dialogueFragment", "speaker": "Player", "text": "Show me your wares.", "menuText": "[Buy] Browse items" },
    { "type": "dialogueFragment", "speaker": "Player", "text": "I have things to sell.", "menuText": "[Sell] Sell items" },
    { "type": "dialogueFragment", "speaker": "Player", "text": "Goodbye.", "menuText": "[Leave] Exit" },
    { "type": "instruction", "instruction": "OpenShop('buy')" },
    { "type": "instruction", "instruction": "OpenShop('sell')" },
    { "type": "dialogueFragment", "speaker": "Merchant", "text": "Come back anytime!" }
  ],
  "connections": [
    { "from": 0, "to": 1 },
    { "from": 1, "to": 2, "label": "Buy" },
    { "from": 1, "to": 3, "label": "Sell" },
    { "from": 1, "to": 4, "label": "Leave" },
    { "from": 2, "to": 5 },
    { "from": 3, "to": 6 },
    { "from": 4, "to": 7 },
    { "from": 5, "to": 1 },
    { "from": 6, "to": 1 }
  ]
}
\`\`\`

Click **Apply to Canvas** to add this to your project!`;
  }

  private getConversationTemplate(): string {
    return `Here's a conversation template:

\`\`\`json
{
  "title": "Stranger Conversation",
  "characters": [
    { "name": "Stranger", "color": "#9b59b6" },
    { "name": "Player", "color": "#4a90e2" }
  ],
  "nodes": [
    { "type": "dialogue", "speaker": "Stranger", "text": "You're not from around here, are you?" },
    { "type": "branch", "label": "Response" },
    { "type": "dialogueFragment", "speaker": "Player", "text": "What gave it away?", "menuText": "[Curious] What gave it away?" },
    { "type": "dialogueFragment", "speaker": "Player", "text": "Mind your business.", "menuText": "[Hostile] Back off" },
    { "type": "dialogueFragment", "speaker": "Stranger", "text": "The way you look at everything like it's the first time. Don't worry, your secret's safe." },
    { "type": "dialogueFragment", "speaker": "Stranger", "text": "Easy there. Just making conversation." },
    { "type": "dialogueFragment", "speaker": "Stranger", "text": "Name's Morgan. If you need help, just ask." }
  ],
  "connections": [
    { "from": 0, "to": 1 },
    { "from": 1, "to": 2, "label": "Curious" },
    { "from": 1, "to": 3, "label": "Hostile" },
    { "from": 2, "to": 4 },
    { "from": 3, "to": 5 },
    { "from": 4, "to": 6 },
    { "from": 5, "to": 6 }
  ]
}
\`\`\`

Click **Apply to Canvas** to add this to your project!`;
  }
}
