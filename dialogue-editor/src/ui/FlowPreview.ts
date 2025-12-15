/**
 * FlowPreview - Playtest dialogue flows directly in the editor
 * 
 * This is a critical feature for writers - they can:
 * - Walk through conversations like a player
 * - See variable changes in real-time
 * - Test all branches without leaving the editor
 * - Identify dead ends and logic errors
 */

import { GraphModel } from '../core/GraphModel';
import { Node, Connection, Character } from '../types/graph';

interface GameState {
  variables: Record<string, Record<string, boolean | number | string>>;
  visitedNodes: Set<string>;
  history: string[];
}

export class FlowPreview {
  private model: GraphModel;
  private overlay: HTMLElement | null = null;
  private currentNodeId: string | null = null;
  private gameState: GameState;
  private onNodeFocus?: (nodeId: string) => void;

  constructor(model: GraphModel, onNodeFocus?: (nodeId: string) => void) {
    this.model = model;
    this.onNodeFocus = onNodeFocus;
    this.gameState = this.createInitialState();
  }

  private createInitialState(): GameState {
    const graph = this.model.getGraph();
    return {
      variables: JSON.parse(JSON.stringify(graph.variables || {})),
      visitedNodes: new Set(),
      history: []
    };
  }

  show(startNodeId?: string): void {
    this.gameState = this.createInitialState();
    
    // Find start node - either specified, or first node with no inputs
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
    this.advance();
  }

  hide(): void {
    if (this.overlay) {
      this.overlay.classList.add('flow-preview-hide');
      setTimeout(() => {
        this.overlay?.remove();
        this.overlay = null;
      }, 300);
    }
  }

  private renderOverlay(): void {
    if (this.overlay) this.overlay.remove();

    this.overlay = document.createElement('div');
    this.overlay.className = 'flow-preview-overlay';
    this.overlay.innerHTML = `
      <div class="flow-preview-container">
        <div class="flow-preview-header">
          <h2>🎭 Flow Preview</h2>
          <div class="flow-preview-controls">
            <button class="flow-preview-btn" id="flow-restart" title="Restart">⟲</button>
            <button class="flow-preview-btn" id="flow-back" title="Go Back">←</button>
            <button class="flow-preview-btn flow-preview-close" id="flow-close">×</button>
          </div>
        </div>
        
        <div class="flow-preview-variables" id="flow-variables"></div>
        
        <div class="flow-preview-dialogue" id="flow-dialogue"></div>
        
        <div class="flow-preview-choices" id="flow-choices"></div>
        
        <div class="flow-preview-footer">
          <span class="flow-preview-node-id" id="flow-node-id"></span>
          <span class="flow-preview-history" id="flow-history"></span>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    // Event listeners
    this.overlay.querySelector('#flow-close')?.addEventListener('click', () => this.hide());
    this.overlay.querySelector('#flow-restart')?.addEventListener('click', () => {
      this.gameState = this.createInitialState();
      this.show();
    });
    this.overlay.querySelector('#flow-back')?.addEventListener('click', () => this.goBack());

    // Show with animation
    requestAnimationFrame(() => {
      this.overlay?.classList.add('flow-preview-visible');
    });
  }

  private advance(): void {
    if (!this.currentNodeId || !this.overlay) return;

    const node = this.model.getNode(this.currentNodeId);
    if (!node) {
      this.showEnd('Node not found');
      return;
    }

    // Mark as visited
    this.gameState.visitedNodes.add(this.currentNodeId);
    this.gameState.history.push(this.currentNodeId);

    // Focus the node in the main editor
    this.onNodeFocus?.(this.currentNodeId);

    // Handle different node types
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

    this.updateVariablesPanel();
    this.updateFooter();
  }

  private showDialogue(node: Node): void {
    const dialogueEl = this.overlay?.querySelector('#flow-dialogue');
    const choicesEl = this.overlay?.querySelector('#flow-choices');
    if (!dialogueEl || !choicesEl) return;

    const data = node.data as { type: string; data: { speaker?: string; text?: string; stageDirections?: string } };
    const speakerId = data.data.speaker;
    const text = data.data.text || '[No dialogue]';
    const stageDirections = data.data.stageDirections;

    // Get character info
    const characters = this.model.getCharacters();
    const speaker = characters.find(c => c.id === speakerId);
    const speakerName = speaker?.displayName || speakerId || 'Narrator';
    const speakerColor = speaker?.color || '#888';

    dialogueEl.innerHTML = `
      ${stageDirections ? `<div class="flow-stage-directions">${stageDirections}</div>` : ''}
      <div class="flow-speaker" style="color: ${speakerColor}">${speakerName}</div>
      <div class="flow-text">${this.formatText(text)}</div>
    `;

    // Get outgoing connections
    const connections = this.model.getConnections().filter(c => c.fromNodeId === node.id);
    
    if (connections.length === 0) {
      choicesEl.innerHTML = `
        <div class="flow-end-message">🔚 End of conversation</div>
        <button class="flow-choice-btn flow-restart-btn" id="flow-restart-end">Start Over</button>
      `;
      choicesEl.querySelector('#flow-restart-end')?.addEventListener('click', () => {
        this.gameState = this.createInitialState();
        this.show();
      });
    } else if (connections.length === 1) {
      choicesEl.innerHTML = `
        <button class="flow-choice-btn flow-continue-btn" id="flow-continue">Continue →</button>
      `;
      choicesEl.querySelector('#flow-continue')?.addEventListener('click', () => {
        this.currentNodeId = connections[0].toNodeId;
        this.advance();
      });
    } else {
      // Multiple outputs - show as choices (shouldn't happen for dialogue, but handle it)
      this.renderChoices(connections);
    }
  }

  private showHub(node: Node): void {
    const dialogueEl = this.overlay?.querySelector('#flow-dialogue');
    if (!dialogueEl) return;

    dialogueEl.innerHTML = `
      <div class="flow-hub-prompt">What do you do?</div>
    `;

    const connections = this.model.getConnections().filter(c => c.fromNodeId === node.id);
    this.renderChoices(connections);
  }

  private renderChoices(connections: Connection[]): void {
    const choicesEl = this.overlay?.querySelector('#flow-choices');
    if (!choicesEl) return;

    const choicesHtml = connections.map((conn, i) => {
      const targetNode = this.model.getNode(conn.toNodeId);
      let label = conn.label || `Option ${i + 1}`;
      
      // Try to get a better label from the target node
      if (!conn.label && targetNode) {
        if (targetNode.data.type === 'dialogue' || targetNode.data.type === 'dialogueFragment') {
          const data = targetNode.data as { data: { menuText?: string; text?: string } };
          label = data.data.menuText || data.data.text?.substring(0, 50) + '...' || label;
        }
      }

      const visited = this.gameState.visitedNodes.has(conn.toNodeId);
      return `
        <button class="flow-choice-btn ${visited ? 'flow-choice-visited' : ''}" data-target="${conn.toNodeId}">
          ${label}
          ${visited ? '<span class="flow-visited-badge">✓</span>' : ''}
        </button>
      `;
    }).join('');

    choicesEl.innerHTML = choicesHtml;

    // Add click handlers
    choicesEl.querySelectorAll('.flow-choice-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = (e.currentTarget as HTMLElement).dataset.target;
        if (target) {
          this.currentNodeId = target;
          this.advance();
        }
      });
    });
  }

  private evaluateCondition(node: Node): void {
    const data = node.data as { type: 'condition'; data: { script: { expression: string } } };
    const expression = data.data.script?.expression || 'true';
    
    const result = this.evalExpression(expression);
    const connections = this.model.getConnections().filter(c => c.fromNodeId === node.id);
    
    // Convention: first output = true, second = false
    const targetConn = result ? connections[0] : connections[1];
    
    if (targetConn) {
      this.currentNodeId = targetConn.toNodeId;
      this.advance();
    } else {
      this.showEnd(`Condition "${expression}" = ${result}, but no matching branch`);
    }
  }

  private executeInstruction(node: Node): void {
    const data = node.data as { type: 'instruction'; data: { script: { expression: string } } };
    const expression = data.data.script?.expression || '';
    
    this.execInstruction(expression);
    
    const connections = this.model.getConnections().filter(c => c.fromNodeId === node.id);
    if (connections.length > 0) {
      this.currentNodeId = connections[0].toNodeId;
      this.advance();
    } else {
      this.showEnd('Instruction executed, no next node');
    }
  }

  private handleJump(node: Node): void {
    const data = node.data as { type: 'jump'; data: { targetNodeId?: string } };
    const targetId = data.data.targetNodeId;
    
    if (targetId) {
      this.currentNodeId = targetId;
      this.advance();
    } else {
      this.showEnd('Jump has no target');
    }
  }

  private evalExpression(expr: string): boolean {
    try {
      // Replace variable references with actual values
      // e.g., "Game.tension >= 2" -> "0 >= 2"
      const resolved = expr.replace(/(\w+)\.(\w+)/g, (_, ns, key) => {
        const val = this.gameState.variables[ns]?.[key];
        if (typeof val === 'string') return `"${val}"`;
        return String(val ?? 0);
      });
      
      // Safe eval using Function constructor
      return Boolean(new Function(`return ${resolved}`)());
    } catch (e) {
      console.warn('Failed to evaluate:', expr, e);
      return false;
    }
  }

  private execInstruction(expr: string): void {
    try {
      // Parse simple assignments: "Game.tension = Game.tension + 1"
      const match = expr.match(/(\w+)\.(\w+)\s*=\s*(.+)/);
      if (match) {
        const [, ns, key, valueExpr] = match;
        
        // Evaluate the right side
        const resolved = valueExpr.replace(/(\w+)\.(\w+)/g, (_, vns, vkey) => {
          const val = this.gameState.variables[vns]?.[vkey];
          if (typeof val === 'string') return `"${val}"`;
          return String(val ?? 0);
        });
        
        const value = new Function(`return ${resolved}`)();
        
        if (!this.gameState.variables[ns]) {
          this.gameState.variables[ns] = {};
        }
        this.gameState.variables[ns][key] = value;
      }
    } catch (e) {
      console.warn('Failed to execute:', expr, e);
    }
  }

  private formatText(text: string): string {
    // Convert BBCode-style formatting
    return text
      .replace(/\[b\](.*?)\[\/b\]/g, '<strong>$1</strong>')
      .replace(/\[i\](.*?)\[\/i\]/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  private showEnd(message: string): void {
    const dialogueEl = this.overlay?.querySelector('#flow-dialogue');
    const choicesEl = this.overlay?.querySelector('#flow-choices');
    if (!dialogueEl || !choicesEl) return;

    dialogueEl.innerHTML = `<div class="flow-end-message">🔚 ${message}</div>`;
    choicesEl.innerHTML = `
      <button class="flow-choice-btn flow-restart-btn" id="flow-restart-end">Start Over</button>
    `;
    choicesEl.querySelector('#flow-restart-end')?.addEventListener('click', () => {
      this.gameState = this.createInitialState();
      this.show();
    });
  }

  private goBack(): void {
    if (this.gameState.history.length > 1) {
      this.gameState.history.pop(); // Remove current
      this.currentNodeId = this.gameState.history.pop() || null; // Go to previous
      if (this.currentNodeId) {
        this.advance();
      }
    }
  }

  private updateVariablesPanel(): void {
    const panel = this.overlay?.querySelector('#flow-variables');
    if (!panel) return;

    const vars: string[] = [];
    for (const [ns, values] of Object.entries(this.gameState.variables)) {
      for (const [key, value] of Object.entries(values)) {
        vars.push(`<span class="flow-var"><span class="flow-var-name">${ns}.${key}</span> = <span class="flow-var-value">${value}</span></span>`);
      }
    }

    panel.innerHTML = vars.length > 0 ? vars.join('') : '<span class="flow-var-empty">No variables</span>';
  }

  private updateFooter(): void {
    const nodeIdEl = this.overlay?.querySelector('#flow-node-id');
    const historyEl = this.overlay?.querySelector('#flow-history');
    
    if (nodeIdEl) {
      nodeIdEl.textContent = `Node: ${this.currentNodeId}`;
    }
    if (historyEl) {
      historyEl.textContent = `Steps: ${this.gameState.history.length}`;
    }
  }
}
