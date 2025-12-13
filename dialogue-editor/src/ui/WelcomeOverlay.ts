/**
 * Welcome overlay for first-time users
 * Provides onboarding and quick-start templates
 */

import { NodeType } from '../types/graph';

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  nodes: Array<{
    type: NodeType;
    x: number;
    y: number;
    data?: Record<string, unknown>;
  }>;
  connections: Array<{
    from: number;
    fromPort: number;
    to: number;
    toPort: number;
  }>;
}

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: 'Blank Canvas',
    description: 'Start from scratch with an empty canvas',
    icon: '📄',
    nodes: [],
    connections: []
  },
  {
    id: 'simple-conversation',
    name: 'Simple Conversation',
    description: 'NPC speaks, player responds with 2 choices',
    icon: '💬',
    nodes: [
      { type: 'dialogue', x: 100, y: 150 },
      { type: 'branch', x: 400, y: 150 },
      { type: 'dialogueFragment', x: 650, y: 50 },
      { type: 'dialogueFragment', x: 650, y: 250 }
    ],
    connections: [
      { from: 0, fromPort: 0, to: 1, toPort: 0 },
      { from: 1, fromPort: 0, to: 2, toPort: 0 },
      { from: 1, fromPort: 1, to: 3, toPort: 0 }
    ]
  },
  {
    id: 'branching-dialogue',
    name: 'Branching Dialogue',
    description: 'Multi-level conversation with conditions',
    icon: '🌳',
    nodes: [
      { type: 'dialogue', x: 100, y: 200 },
      { type: 'condition', x: 400, y: 200 },
      { type: 'dialogueFragment', x: 650, y: 100 },
      { type: 'dialogueFragment', x: 650, y: 300 },
      { type: 'hub', x: 900, y: 200 }
    ],
    connections: [
      { from: 0, fromPort: 0, to: 1, toPort: 0 },
      { from: 1, fromPort: 0, to: 2, toPort: 0 },
      { from: 1, fromPort: 1, to: 3, toPort: 0 },
      { from: 2, fromPort: 0, to: 4, toPort: 0 },
      { from: 3, fromPort: 0, to: 4, toPort: 0 }
    ]
  },
  {
    id: 'quest-dialogue',
    name: 'Quest Giver',
    description: 'NPC offers quest with accept/decline flow',
    icon: '⚔️',
    nodes: [
      { type: 'dialogue', x: 100, y: 200 },
      { type: 'branch', x: 400, y: 200 },
      { type: 'dialogueFragment', x: 650, y: 80 },
      { type: 'dialogueFragment', x: 650, y: 320 },
      { type: 'instruction', x: 900, y: 80 }
    ],
    connections: [
      { from: 0, fromPort: 0, to: 1, toPort: 0 },
      { from: 1, fromPort: 0, to: 2, toPort: 0 },
      { from: 1, fromPort: 1, to: 3, toPort: 0 },
      { from: 2, fromPort: 0, to: 4, toPort: 0 }
    ]
  },
  {
    id: 'shop-dialogue',
    name: 'Shop Keeper',
    description: 'Buy/sell/exit menu with conditions',
    icon: '🏪',
    nodes: [
      { type: 'dialogue', x: 100, y: 200 },
      { type: 'hub', x: 350, y: 200 },
      { type: 'dialogueFragment', x: 550, y: 50 },
      { type: 'dialogueFragment', x: 550, y: 200 },
      { type: 'dialogueFragment', x: 550, y: 350 },
      { type: 'jump', x: 800, y: 125 }
    ],
    connections: [
      { from: 0, fromPort: 0, to: 1, toPort: 0 },
      { from: 1, fromPort: 0, to: 2, toPort: 0 },
      { from: 1, fromPort: 1, to: 3, toPort: 0 },
      { from: 1, fromPort: 2, to: 4, toPort: 0 },
      { from: 2, fromPort: 0, to: 5, toPort: 0 },
      { from: 3, fromPort: 0, to: 5, toPort: 0 }
    ]
  }
];

export type WelcomeCallback = (template: Template) => void;

export class WelcomeOverlay {
  private overlay: HTMLElement | null = null;
  private onSelectTemplate: WelcomeCallback;
  private isVisible: boolean = false;

  constructor(onSelectTemplate: WelcomeCallback) {
    this.onSelectTemplate = onSelectTemplate;
  }

  show(): void {
    if (this.isVisible) return;
    this.isVisible = true;
    this.render();
  }

  hide(): void {
    if (!this.isVisible) return;
    this.isVisible = false;
    
    if (this.overlay) {
      this.overlay.classList.add('fade-out');
      setTimeout(() => {
        this.overlay?.remove();
        this.overlay = null;
      }, 300);
    }
  }

  private render(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'welcome-overlay';
    this.overlay.innerHTML = `
      <div class="welcome-modal">
        <div class="welcome-header">
          <h1>Welcome to Dialogue Editor</h1>
          <p>Create branching dialogues for your game. Choose a template to get started:</p>
        </div>

        <div class="template-grid">
          ${TEMPLATES.map(template => `
            <div class="template-card" data-template-id="${template.id}">
              <div class="template-icon">${template.icon}</div>
              <div class="template-info">
                <h3>${template.name}</h3>
                <p>${template.description}</p>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="welcome-footer">
          <div class="quick-tips">
            <h4>Quick Tips</h4>
            <ul>
              <li><kbd>Drag</kbd> nodes from the left palette onto the canvas</li>
              <li><kbd>Click + Drag</kbd> from a port to create connections</li>
              <li><kbd>Middle Mouse</kbd> or <kbd>Space + Drag</kbd> to pan</li>
              <li><kbd>Scroll</kbd> to zoom in/out</li>
              <li><kbd>Delete</kbd> to remove selected nodes</li>
            </ul>
          </div>
          <button class="welcome-skip-btn">Skip & Start Empty</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    // Setup event listeners
    const cards = this.overlay.querySelectorAll('.template-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const templateId = (card as HTMLElement).dataset.templateId;
        const template = TEMPLATES.find(t => t.id === templateId);
        if (template) {
          this.onSelectTemplate(template);
          this.hide();
        }
      });
    });

    const skipBtn = this.overlay.querySelector('.welcome-skip-btn');
    skipBtn?.addEventListener('click', () => {
      this.onSelectTemplate(TEMPLATES[0]); // Blank template
      this.hide();
    });

    // Animate in
    requestAnimationFrame(() => {
      this.overlay?.classList.add('visible');
    });
  }
}
