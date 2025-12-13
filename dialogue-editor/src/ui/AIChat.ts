/**
 * AI Chat panel for dialogue brainstorming and generation
 * Integrates with the graph editor to create dialogue flows from natural language
 */

import { NodeType, Position } from '../types/graph';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  dialogueData?: GeneratedDialogue;
}

export interface GeneratedDialogue {
  title: string;
  description?: string;
  characters: Array<{ name: string; color: string }>;
  nodes: Array<{
    type: NodeType;
    speaker?: string;
    text?: string;
    menuText?: string;
    condition?: string;
    instruction?: string;
    label?: string;
  }>;
  connections: Array<{ from: number; to: number; label?: string }>;
}

export type OnApplyDialogueCallback = (dialogue: GeneratedDialogue) => void;
export type OnSendMessageCallback = (message: string) => Promise<string>;

export class AIChat {
  private container: HTMLElement;
  private messages: ChatMessage[] = [];
  private onApplyDialogue: OnApplyDialogueCallback;
  private onSendMessage: OnSendMessageCallback;
  private isExpanded: boolean = true;
  private isLoading: boolean = false;

  constructor(
    containerId: string,
    onApplyDialogue: OnApplyDialogueCallback,
    onSendMessage: OnSendMessageCallback
  ) {
    const container = document.getElementById(containerId);
    if (!container) {
      // Create the container if it doesn't exist
      const newContainer = document.createElement('div');
      newContainer.id = containerId;
      newContainer.className = 'ai-chat-container';
      document.getElementById('main-container')?.appendChild(newContainer);
      this.container = newContainer;
    } else {
      this.container = container;
    }
    
    this.onApplyDialogue = onApplyDialogue;
    this.onSendMessage = onSendMessage;
    
    this.render();
    this.addSystemMessage();
  }

  private addSystemMessage(): void {
    this.messages.push({
      id: this.generateId(),
      role: 'system',
      content: `👋 **Welcome to AI Dialogue Assistant!**

I can help you create dialogue trees for your game. Just tell me:

• **Your game concept** - "I'm making an RPG with a grumpy blacksmith"
• **A scene idea** - "The player meets a mysterious stranger at a tavern"
• **Dialogue style** - "Write witty banter between two thieves"

I'll generate complete dialogue flows with branching choices, conditions, and character interactions that you can add directly to your project.

**Try it:** "Create a quest dialogue where an old wizard asks the player to find a lost artifact"`,
      timestamp: Date.now()
    });
    this.renderMessages();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="ai-chat-panel ${this.isExpanded ? 'expanded' : 'collapsed'}">
        <div class="ai-chat-header">
          <div class="ai-chat-title">
            <span class="ai-chat-icon">🤖</span>
            <span>AI Assistant</span>
          </div>
          <div class="ai-chat-header-actions">
            <button class="ai-chat-btn-icon" id="ai-chat-clear" title="Clear chat">🗑️</button>
            <button class="ai-chat-btn-icon" id="ai-chat-toggle" title="Toggle panel">
              ${this.isExpanded ? '◀' : '▶'}
            </button>
          </div>
        </div>
        
        <div class="ai-chat-messages" id="ai-chat-messages"></div>
        
        <div class="ai-chat-input-area">
          <textarea 
            id="ai-chat-input" 
            class="ai-chat-input" 
            placeholder="Describe your dialogue idea..."
            rows="3"
          ></textarea>
          <div class="ai-chat-input-actions">
            <button class="ai-chat-send-btn" id="ai-chat-send">
              <span>Send</span>
              <span class="ai-chat-send-icon">→</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.setupEventListeners();
    this.renderMessages();
  }

  private setupEventListeners(): void {
    const toggleBtn = document.getElementById('ai-chat-toggle');
    const clearBtn = document.getElementById('ai-chat-clear');
    const sendBtn = document.getElementById('ai-chat-send');
    const input = document.getElementById('ai-chat-input') as HTMLTextAreaElement;

    toggleBtn?.addEventListener('click', () => {
      this.isExpanded = !this.isExpanded;
      this.render();
    });

    clearBtn?.addEventListener('click', () => {
      this.messages = [];
      this.addSystemMessage();
    });

    sendBtn?.addEventListener('click', () => this.sendMessage());

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.sendMessage();
      }
    });
  }

  private async sendMessage(): Promise<void> {
    const input = document.getElementById('ai-chat-input') as HTMLTextAreaElement;
    const message = input?.value.trim();
    
    if (!message || this.isLoading) return;

    // Add user message
    this.messages.push({
      id: this.generateId(),
      role: 'user',
      content: message,
      timestamp: Date.now()
    });

    input.value = '';
    this.isLoading = true;
    this.renderMessages();
    this.scrollToBottom();

    try {
      // Get AI response
      const response = await this.onSendMessage(message);
      
      // Parse for dialogue data
      const dialogueData = this.parseDialogueFromResponse(response);
      
      this.messages.push({
        id: this.generateId(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
        dialogueData
      });
    } catch (error) {
      this.messages.push({
        id: this.generateId(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error}. Please try again.`,
        timestamp: Date.now()
      });
    }

    this.isLoading = false;
    this.renderMessages();
    this.scrollToBottom();
  }

  private renderMessages(): void {
    const container = document.getElementById('ai-chat-messages');
    if (!container) return;

    container.innerHTML = this.messages.map(msg => this.renderMessage(msg)).join('');
    
    // Add loading indicator if needed
    if (this.isLoading) {
      container.innerHTML += `
        <div class="ai-chat-message assistant">
          <div class="ai-chat-message-content">
            <div class="ai-chat-loading">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      `;
    }

    // Setup apply buttons
    container.querySelectorAll('.ai-chat-apply-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const msgId = (e.target as HTMLElement).dataset.messageId;
        const msg = this.messages.find(m => m.id === msgId);
        if (msg?.dialogueData) {
          this.onApplyDialogue(msg.dialogueData);
        }
      });
    });
  }

  private renderMessage(msg: ChatMessage): string {
    const roleClass = msg.role;
    const isSystem = msg.role === 'system';
    
    let content = this.formatMarkdown(msg.content);
    
    // Add apply button if dialogue data exists
    let applyButton = '';
    if (msg.dialogueData) {
      applyButton = `
        <button class="ai-chat-apply-btn" data-message-id="${msg.id}">
          ✨ Apply to Canvas
        </button>
      `;
    }

    return `
      <div class="ai-chat-message ${roleClass} ${isSystem ? 'system' : ''}">
        <div class="ai-chat-message-content">
          ${content}
          ${applyButton}
        </div>
      </div>
    `;
  }

  private formatMarkdown(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>')
      .replace(/• /g, '&bull; ');
  }

  private parseDialogueFromResponse(response: string): GeneratedDialogue | undefined {
    // Look for JSON block in the response
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        if (data.nodes && Array.isArray(data.nodes)) {
          return data as GeneratedDialogue;
        }
      } catch (e) {
        console.warn('Failed to parse dialogue JSON:', e);
      }
    }

    // Try to parse structured dialogue format
    return this.parseStructuredDialogue(response);
  }

  private parseStructuredDialogue(response: string): GeneratedDialogue | undefined {
    // Look for dialogue patterns like:
    // [Character]: "Text"
    // -> Choice 1
    // -> Choice 2
    
    const lines = response.split('\n');
    const nodes: GeneratedDialogue['nodes'] = [];
    const connections: GeneratedDialogue['connections'] = [];
    const characters = new Map<string, string>();
    
    let currentNodeIndex = -1;
    let inChoices = false;
    let choiceStartIndex = -1;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Match dialogue: [Character]: "Text" or Character: "Text"
      const dialogueMatch = trimmed.match(/^\[?(\w+)\]?:\s*[""](.+)[""]$/);
      if (dialogueMatch) {
        const [, speaker, text] = dialogueMatch;
        
        if (!characters.has(speaker)) {
          characters.set(speaker, this.getCharacterColor(characters.size));
        }
        
        if (inChoices && choiceStartIndex >= 0) {
          // Connect previous choices to this node
          for (let i = choiceStartIndex; i <= currentNodeIndex; i++) {
            connections.push({ from: i, to: nodes.length });
          }
          inChoices = false;
        } else if (currentNodeIndex >= 0) {
          connections.push({ from: currentNodeIndex, to: nodes.length });
        }
        
        nodes.push({
          type: 'dialogueFragment',
          speaker,
          text
        });
        currentNodeIndex = nodes.length - 1;
        continue;
      }
      
      // Match choice: -> "Choice text" or - Choice text
      const choiceMatch = trimmed.match(/^(?:->|[-•])\s*[""]?(.+?)[""]?$/);
      if (choiceMatch && currentNodeIndex >= 0) {
        if (!inChoices) {
          // Add a branch node
          connections.push({ from: currentNodeIndex, to: nodes.length });
          nodes.push({ type: 'branch', label: 'Player Choice' });
          currentNodeIndex = nodes.length - 1;
          choiceStartIndex = nodes.length;
          inChoices = true;
        }
        
        // Add choice as dialogue fragment
        connections.push({ from: currentNodeIndex, to: nodes.length, label: choiceMatch[1] });
        nodes.push({
          type: 'dialogueFragment',
          speaker: 'Player',
          text: choiceMatch[1],
          menuText: choiceMatch[1]
        });
      }
      
      // Match condition: [if condition]
      const conditionMatch = trimmed.match(/^\[if\s+(.+)\]$/i);
      if (conditionMatch) {
        if (currentNodeIndex >= 0) {
          connections.push({ from: currentNodeIndex, to: nodes.length });
        }
        nodes.push({
          type: 'condition',
          condition: conditionMatch[1]
        });
        currentNodeIndex = nodes.length - 1;
      }
    }

    if (nodes.length === 0) return undefined;

    return {
      title: 'Generated Dialogue',
      characters: Array.from(characters.entries()).map(([name, color]) => ({ name, color })),
      nodes,
      connections
    };
  }

  private getCharacterColor(index: number): string {
    const colors = ['#4a90e2', '#e74c3c', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c'];
    return colors[index % colors.length];
  }

  private scrollToBottom(): void {
    const container = document.getElementById('ai-chat-messages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  toggle(): void {
    this.isExpanded = !this.isExpanded;
    this.render();
  }

  isOpen(): boolean {
    return this.isExpanded;
  }
}
