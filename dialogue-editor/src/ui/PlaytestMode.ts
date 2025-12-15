/**
 * PlaytestMode - Immersive Text Adventure Experience
 * 
 * Inspired by Zeekerss's "Welcome to the Dark Place":
 * - Atmospheric, minimal visuals
 * - Text that draws you into rabbit holes
 * - You tell yourself the story
 * 
 * Juice effects:
 * - Typewriter text reveal
 * - Screen shake on drama
 * - Atmospheric color shifts
 * - Smooth transitions
 */

import { GraphModel } from '../core/GraphModel';
import { Node, Connection, Character } from '../types/graph';

interface PlaytestState {
  variables: Record<string, Record<string, boolean | number | string>>;
  visitedNodes: Set<string>;
  history: string[];
}

export class PlaytestMode {
  private model: GraphModel;
  private overlay: HTMLElement | null = null;
  private currentNodeId: string | null = null;
  private state: PlaytestState;
  private onNodeFocus?: (nodeId: string) => void;
  private typewriterTimeout: number | null = null;
  private isTyping = false;
  private debugVisible = false;

  constructor(model: GraphModel, onNodeFocus?: (nodeId: string) => void) {
    this.model = model;
    this.onNodeFocus = onNodeFocus;
    this.state = this.createInitialState();
  }

  private createInitialState(): PlaytestState {
    const graph = this.model.getGraph();
    return {
      variables: JSON.parse(JSON.stringify(graph.variables || {})),
      visitedNodes: new Set(),
      history: []
    };
  }

  show(startNodeId?: string): void {
    this.state = this.createInitialState();
    
    // Find start node
    if (startNodeId) {
      this.currentNodeId = startNodeId;
    } else {
      const nodes = this.model.getNodes();
      const connections = this.model.getConnections();
      const hasInput = new Set(connections.map(c => c.toNodeId));
      const startNode = nodes.find(n => !hasInput.has(n.id));
      this.currentNodeId = startNode?.id || nodes[0]?.id || null;
    }

    this.renderOverlay();
    
    // Fade in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.overlay?.classList.add('visible');
        // Start after fade in
        setTimeout(() => this.advance(), 400);
      });
    });
  }

  hide(): void {
    if (this.typewriterTimeout) {
      clearTimeout(this.typewriterTimeout);
      this.typewriterTimeout = null;
    }
    
    if (this.overlay) {
      this.overlay.classList.remove('visible');
      this.overlay.classList.add('hiding');
      setTimeout(() => {
        this.overlay?.remove();
        this.overlay = null;
      }, 800);
    }
  }

  private renderOverlay(): void {
    if (this.overlay) this.overlay.remove();

    this.overlay = document.createElement('div');
    this.overlay.className = 'playtest-overlay';
    this.overlay.setAttribute('data-mood', 'neutral');
    
    this.overlay.innerHTML = `
      <div class="playtest-controls">
        <button class="playtest-control-btn" id="pt-restart" title="Restart">↺</button>
        <button class="playtest-control-btn" id="pt-back" title="Go back">←</button>
        <button class="playtest-control-btn close" id="pt-close" title="Exit">×</button>
      </div>
      
      <div class="playtest-content">
        <div class="playtest-scene" id="pt-scene"></div>
      </div>
      
      <button class="playtest-debug-toggle" id="pt-debug-toggle">vars</button>
      <div class="playtest-debug" id="pt-debug"></div>
      <div class="playtest-node-ref" id="pt-node-ref"></div>
      
      <div class="playtest-ambient-glow" id="pt-glow"></div>
    `;

    document.body.appendChild(this.overlay);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.overlay?.querySelector('#pt-close')?.addEventListener('click', () => this.hide());
    this.overlay?.querySelector('#pt-restart')?.addEventListener('click', () => {
      this.state = this.createInitialState();
      this.show();
    });
    this.overlay?.querySelector('#pt-back')?.addEventListener('click', () => this.goBack());
    this.overlay?.querySelector('#pt-debug-toggle')?.addEventListener('click', () => {
      this.debugVisible = !this.debugVisible;
      this.overlay?.querySelector('#pt-debug')?.classList.toggle('visible', this.debugVisible);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.overlay) return;
    
    if (e.key === 'Escape') {
      this.hide();
    } else if (e.key === ' ' && !this.isTyping) {
      // Space to continue (if there's a continue button)
      const continueBtn = this.overlay.querySelector('.playtest-continue') as HTMLButtonElement;
      continueBtn?.click();
    }
  };

  private advance(): void {
    if (!this.currentNodeId || !this.overlay) return;

    const node = this.model.getNode(this.currentNodeId);
    if (!node) {
      this.showEnd();
      return;
    }

    // Mark visited
    this.state.visitedNodes.add(this.currentNodeId);
    this.state.history.push(this.currentNodeId);

    // Focus in editor
    this.onNodeFocus?.(this.currentNodeId);

    // Update node reference
    const nodeRef = this.overlay.querySelector('#pt-node-ref');
    if (nodeRef) nodeRef.textContent = node.id.substring(0, 8);

    // Handle by type
    switch (node.nodeType) {
      case 'dialogue':
      case 'dialogueFragment':
        this.showDialogue(node);
        break;
      case 'hub':
      case 'branch':
        this.showHub(node);
        break;
      case 'condition':
        this.evaluateCondition(node);
        break;
      case 'instruction':
        this.executeInstruction(node);
        break;
      case 'jump':
        this.handleJump(node);
        break;
      default:
        this.showDialogue(node);
    }

    this.updateDebugPanel();
  }

  private showDialogue(node: Node): void {
    const scene = this.overlay?.querySelector('#pt-scene');
    if (!scene) return;

    const data = node.data as { type: string; data: { speaker?: string; text?: string; stageDirections?: string } };
    const characters = this.model.getCharacters();
    const speaker = characters.find(c => c.id === data.data.speaker);
    const speakerName = speaker?.displayName || 'Narrator';
    const speakerColor = speaker?.color || '#888';
    const text = data.data.text || '';
    const stageDirections = data.data.stageDirections;

    // Set mood based on content
    this.setMoodFromText(text);

    // Build scene HTML
    scene.innerHTML = `
      ${stageDirections ? `<div class="playtest-stage-directions">${stageDirections}</div>` : ''}
      <div class="playtest-speaker">
        <span class="playtest-speaker-name" style="--speaker-color: ${speakerColor}">${speakerName}</span>
      </div>
      <div class="playtest-dialogue" id="pt-dialogue"></div>
      <div class="playtest-choices" id="pt-choices" style="display: none;"></div>
    `;

    // Typewriter effect
    this.typeText(text, () => {
      this.showDialogueChoices(node);
    });
  }

  private typeText(text: string, onComplete: () => void): void {
    const dialogueEl = this.overlay?.querySelector('#pt-dialogue');
    if (!dialogueEl) return;

    this.isTyping = true;
    dialogueEl.classList.add('typing');
    
    let index = 0;
    const chars = text.split('');
    const baseSpeed = 30; // ms per character
    
    const type = () => {
      if (index < chars.length) {
        const char = chars[index];
        dialogueEl.innerHTML = this.formatText(text.substring(0, index + 1)) + '<span class="playtest-cursor"></span>';
        
        // Variable speed - pause on punctuation
        let delay = baseSpeed;
        if (char === '.' || char === '!' || char === '?') delay = 300;
        else if (char === ',') delay = 150;
        else if (char === ':' || char === ';') delay = 200;
        
        index++;
        this.typewriterTimeout = window.setTimeout(type, delay);
      } else {
        // Done typing
        dialogueEl.innerHTML = this.formatText(text);
        this.isTyping = false;
        onComplete();
      }
    };

    // Allow skipping by clicking
    const skipHandler = () => {
      if (this.isTyping && this.typewriterTimeout) {
        clearTimeout(this.typewriterTimeout);
        dialogueEl.innerHTML = this.formatText(text);
        this.isTyping = false;
        onComplete();
      }
      dialogueEl.removeEventListener('click', skipHandler);
    };
    dialogueEl.addEventListener('click', skipHandler);

    type();
  }

  private showDialogueChoices(node: Node): void {
    const choicesEl = this.overlay?.querySelector('#pt-choices') as HTMLElement;
    if (!choicesEl) return;

    const connections = this.model.getConnections().filter(c => c.fromNodeId === node.id);

    if (connections.length === 0) {
      // End of conversation
      choicesEl.innerHTML = `
        <div class="playtest-end">
          <div class="playtest-end-symbol">· · ·</div>
          <div class="playtest-end-text">End of conversation</div>
        </div>
        <button class="playtest-continue" id="pt-restart-end">Begin again</button>
      `;
      choicesEl.style.display = 'flex';
      
      choicesEl.querySelector('#pt-restart-end')?.addEventListener('click', () => {
        this.state = this.createInitialState();
        this.show();
      });
    } else if (connections.length === 1) {
      // Single path - show continue
      choicesEl.innerHTML = `<button class="playtest-continue" id="pt-continue">Continue</button>`;
      choicesEl.style.display = 'flex';
      
      choicesEl.querySelector('#pt-continue')?.addEventListener('click', () => {
        this.transitionTo(connections[0].toNodeId);
      });
    } else {
      // Multiple choices
      this.renderChoices(connections);
    }
  }

  private showHub(node: Node): void {
    const scene = this.overlay?.querySelector('#pt-scene');
    if (!scene) return;

    scene.innerHTML = `
      <div class="playtest-stage-directions">What do you do?</div>
      <div class="playtest-choices" id="pt-choices"></div>
    `;

    const connections = this.model.getConnections().filter(c => c.fromNodeId === node.id);
    this.renderChoices(connections);
  }

  private renderChoices(connections: Connection[]): void {
    const choicesEl = this.overlay?.querySelector('#pt-choices') as HTMLElement;
    if (!choicesEl) return;

    const choicesHtml = connections.map((conn, i) => {
      const targetNode = this.model.getNode(conn.toNodeId);
      let label = conn.label || `Option ${i + 1}`;
      
      // Try to get better label
      if (!conn.label && targetNode) {
        const data = targetNode.data as { type: string; data: { menuText?: string; text?: string } };
        if (data.data.menuText) {
          label = data.data.menuText;
        } else if (data.data.text) {
          label = data.data.text.substring(0, 60) + (data.data.text.length > 60 ? '...' : '');
        }
      }

      const visited = this.state.visitedNodes.has(conn.toNodeId);
      
      return `
        <button class="playtest-choice ${visited ? 'visited' : ''}" data-target="${conn.toNodeId}">
          ${label}
        </button>
      `;
    }).join('');

    choicesEl.innerHTML = choicesHtml;
    choicesEl.style.display = 'flex';

    // Add click handlers
    choicesEl.querySelectorAll('.playtest-choice').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = (e.currentTarget as HTMLElement).dataset.target;
        if (target) {
          this.transitionTo(target);
        }
      });
    });
  }

  private transitionTo(nodeId: string): void {
    const scene = this.overlay?.querySelector('#pt-scene');
    if (scene) {
      scene.classList.add('playtest-scene-transition');
      setTimeout(() => {
        this.currentNodeId = nodeId;
        this.advance();
        scene.classList.remove('playtest-scene-transition');
      }, 300);
    } else {
      this.currentNodeId = nodeId;
      this.advance();
    }
  }

  private evaluateCondition(node: Node): void {
    const data = node.data as { type: string; data: { expression?: string } };
    const connections = this.model.getConnections().filter(c => c.fromNodeId === node.id);
    
    // Simple evaluation - in real implementation, parse the expression
    let result = false;
    try {
      const expr = data.data.expression || 'true';
      // Very basic - just check if variable exists and is truthy
      // This should be replaced with proper expression parsing
      result = Boolean(expr);
    } catch {
      result = false;
    }

    // Find true/false paths
    const truePath = connections.find(c => c.fromPortIndex === 0);
    const falsePath = connections.find(c => c.fromPortIndex === 1);

    const nextNode = result ? truePath : falsePath;
    if (nextNode) {
      this.currentNodeId = nextNode.toNodeId;
      this.advance();
    } else {
      this.showEnd();
    }
  }

  private executeInstruction(node: Node): void {
    // Flash effect for instruction execution
    this.shake();

    const connections = this.model.getConnections().filter(c => c.fromNodeId === node.id);
    if (connections.length > 0) {
      setTimeout(() => {
        this.currentNodeId = connections[0].toNodeId;
        this.advance();
      }, 200);
    } else {
      this.showEnd();
    }
  }

  private handleJump(node: Node): void {
    const data = node.data as { type: string; data: { targetNodeId?: string } };
    const targetId = data.data.targetNodeId;

    if (targetId) {
      this.currentNodeId = targetId;
      this.advance();
    } else {
      this.showEnd();
    }
  }

  private goBack(): void {
    if (this.state.history.length > 1) {
      this.state.history.pop(); // Remove current
      const previousId = this.state.history.pop(); // Get previous (will be re-added)
      if (previousId) {
        this.currentNodeId = previousId;
        this.advance();
      }
    }
  }

  private showEnd(): void {
    const scene = this.overlay?.querySelector('#pt-scene');
    if (!scene) return;

    scene.innerHTML = `
      <div class="playtest-end">
        <div class="playtest-end-symbol">⁂</div>
        <div class="playtest-end-text">The conversation has ended</div>
      </div>
      <div class="playtest-choices">
        <button class="playtest-continue" id="pt-restart-end">Begin again</button>
      </div>
    `;

    scene.querySelector('#pt-restart-end')?.addEventListener('click', () => {
      this.state = this.createInitialState();
      this.show();
    });
  }

  private updateDebugPanel(): void {
    const debug = this.overlay?.querySelector('#pt-debug');
    if (!debug) return;

    const vars: string[] = [];
    Object.entries(this.state.variables).forEach(([ns, values]) => {
      Object.entries(values).forEach(([key, value]) => {
        vars.push(`
          <div class="playtest-var">
            <span class="playtest-var-name">${ns}.${key}</span>
            <span class="playtest-var-value">${value}</span>
          </div>
        `);
      });
    });

    debug.innerHTML = vars.length > 0 ? vars.join('') : '<span style="color: #444">No variables</span>';
  }

  private formatText(text: string): string {
    // Convert *text* to emphasis, **text** to strong
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  private setMoodFromText(text: string): void {
    const lower = text.toLowerCase();
    let mood = 'neutral';

    // Detect mood from keywords
    if (lower.includes('dark') || lower.includes('shadow') || lower.includes('fear') || lower.includes('death')) {
      mood = 'tense';
    } else if (lower.includes('strange') || lower.includes('dream') || lower.includes('mysterious')) {
      mood = 'mysterious';
    } else if (lower.includes('warm') || lower.includes('light') || lower.includes('smile') || lower.includes('laugh')) {
      mood = 'warm';
    }

    this.overlay?.setAttribute('data-mood', mood);
  }

  private shake(): void {
    this.overlay?.classList.add('playtest-shake');
    setTimeout(() => {
      this.overlay?.classList.remove('playtest-shake');
    }, 150);
  }

  destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    if (this.typewriterTimeout) {
      clearTimeout(this.typewriterTimeout);
    }
    this.overlay?.remove();
  }
}
