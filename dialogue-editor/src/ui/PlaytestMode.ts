/**
 * PlaytestMode - Illustrated Text Adventure
 * 
 * Split-view design:
 * - Left: Canvas-rendered scene illustrations
 * - Right: Clean typography with dialogue
 * 
 * Design principles:
 * - Utilitarian, not fancy
 * - Fast Canvas rendering
 * - Accessible colors
 * - Stable layout
 */

import { GraphModel } from '../core/GraphModel';
import { Node, Connection } from '../types/graph';
import { SceneRenderer } from './SceneRenderer';

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
  private currentLocation = 'THE APARTMENT';
  private sceneRenderer: SceneRenderer;

  constructor(model: GraphModel, onNodeFocus?: (nodeId: string) => void) {
    this.model = model;
    this.onNodeFocus = onNodeFocus;
    this.state = this.createInitialState();
    this.sceneRenderer = new SceneRenderer();
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
    
    requestAnimationFrame(() => {
      this.overlay?.classList.add('visible');
      setTimeout(() => this.advance(), 150);
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
      }, 200);
    }
    
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  private renderOverlay(): void {
    if (this.overlay) this.overlay.remove();

    this.overlay = document.createElement('div');
    this.overlay.className = 'playtest-overlay';
    this.overlay.setAttribute('data-mood', 'neutral');
    
    this.overlay.innerHTML = `
      <div class="playtest-illustration" id="pt-illustration">
        <div class="playtest-location" id="pt-location">${this.currentLocation}</div>
      </div>
      
      <div class="playtest-text-panel">
        <div class="playtest-scene" id="pt-scene"></div>
      </div>
      
      <div class="playtest-controls">
        <button class="playtest-control-btn" id="pt-restart" title="Restart">↺</button>
        <button class="playtest-control-btn" id="pt-back" title="Go back">←</button>
        <button class="playtest-control-btn close" id="pt-close" title="Exit (Esc)">×</button>
      </div>
      
      <div class="playtest-footer">
        <div>
          <button class="playtest-debug-toggle" id="pt-debug-toggle">variables</button>
          <div class="playtest-debug" id="pt-debug"></div>
        </div>
        <div class="playtest-node-ref" id="pt-node-ref"></div>
      </div>
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

    document.addEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.overlay) return;
    
    if (e.key === 'Escape') {
      this.hide();
    } else if (e.key === ' ' && !this.isTyping) {
      e.preventDefault();
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

    this.state.visitedNodes.add(this.currentNodeId);
    this.state.history.push(this.currentNodeId);
    this.onNodeFocus?.(this.currentNodeId);

    const nodeRef = this.overlay.querySelector('#pt-node-ref');
    if (nodeRef) nodeRef.textContent = node.id;

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
    const illustrationPanel = this.overlay?.querySelector('#pt-illustration');
    if (!scene || !illustrationPanel) return;

    const data = node.data as { type: string; data: { speaker?: string; text?: string; stageDirections?: string } };
    const characters = this.model.getCharacters();
    const speaker = characters.find(c => c.id === data.data.speaker);
    const speakerName = speaker?.displayName || 'NARRATOR';
    const speakerColor = speaker?.color || '#6a6560';
    const text = data.data.text || '';
    const stageDirections = data.data.stageDirections;

    // Update illustration based on scene content
    this.updateIllustration(text, data.data.speaker, stageDirections);
    
    // Set mood
    this.setMoodFromText(text);

    // Render scene with stable layout
    scene.innerHTML = `
      ${stageDirections ? `<div class="playtest-stage-directions">${this.formatStageDirections(stageDirections)}</div>` : ''}
      <div class="playtest-speaker">
        <span class="playtest-speaker-name" style="--speaker-color: ${speakerColor}">${speakerName}</span>
      </div>
      <div class="playtest-dialogue" id="pt-dialogue"></div>
      <div class="playtest-choices" id="pt-choices" style="opacity: 0;"></div>
    `;

    scene.classList.add('playtest-scene-enter');
    setTimeout(() => scene.classList.remove('playtest-scene-enter'), 150);

    // Fast typewriter (or instant for narration/brackets)
    if (text.startsWith('[') && text.endsWith(']')) {
      // Narration - show instantly
      const dialogueEl = this.overlay?.querySelector('#pt-dialogue');
      if (dialogueEl) {
        dialogueEl.innerHTML = this.formatText(text);
      }
      this.showDialogueChoices(node);
    } else {
      this.typeText(text, () => {
        this.showDialogueChoices(node);
      });
    }
  }

  private updateIllustration(text: string, speakerId?: string, stageDirections?: string): void {
    const illustrationPanel = this.overlay?.querySelector('#pt-illustration');
    if (!illustrationPanel) return;

    const combinedText = text + (stageDirections || '');
    const config = SceneRenderer.getSceneConfig(combinedText, speakerId);
    
    // Only update if location changed
    if (this.currentLocation !== config.location) {
      this.currentLocation = config.location;
      
      // Remove old canvas
      const existingCanvas = illustrationPanel.querySelector('canvas');
      if (existingCanvas) existingCanvas.remove();
      
      // Render new scene
      const canvas = this.sceneRenderer.render(config);
      canvas.classList.add('playtest-canvas');
      illustrationPanel.appendChild(canvas);
    }
  }

  private typeText(text: string, onComplete: () => void): void {
    const dialogueEl = this.overlay?.querySelector('#pt-dialogue');
    if (!dialogueEl) return;

    this.isTyping = true;
    
    let index = 0;
    const chars = text.split('');
    const baseSpeed = 18; // Faster base speed
    
    const type = () => {
      if (index < chars.length) {
        const char = chars[index];
        dialogueEl.innerHTML = this.formatText(text.substring(0, index + 1)) + '<span class="playtest-cursor"></span>';
        
        // Variable speed - shorter pauses
        let delay = baseSpeed;
        if (char === '.' || char === '!' || char === '?') delay = 150;
        else if (char === ',') delay = 80;
        else if (char === '—') delay = 100;
        else if (char === ':' || char === ';') delay = 100;
        
        index++;
        this.typewriterTimeout = window.setTimeout(type, delay);
      } else {
        dialogueEl.innerHTML = this.formatText(text);
        this.isTyping = false;
        onComplete();
      }
    };

    // Click to skip
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
      choicesEl.innerHTML = `
        <div class="playtest-end">
          <div class="playtest-end-symbol">· · ·</div>
          <div class="playtest-end-text">End</div>
        </div>
        <button class="playtest-continue" id="pt-restart-end">Begin again</button>
      `;
      choicesEl.style.opacity = '1';
      
      choicesEl.querySelector('#pt-restart-end')?.addEventListener('click', () => {
        this.state = this.createInitialState();
        this.show();
      });
    } else if (connections.length === 1) {
      choicesEl.innerHTML = `<button class="playtest-continue" id="pt-continue">Continue</button>`;
      choicesEl.style.opacity = '1';
      
      choicesEl.querySelector('#pt-continue')?.addEventListener('click', () => {
        this.transitionTo(connections[0].toNodeId);
      });
    } else {
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
      
      if (!conn.label && targetNode) {
        const data = targetNode.data as { type: string; data: { menuText?: string; text?: string } };
        if (data.data.menuText) {
          label = data.data.menuText;
        } else if (data.data.text) {
          // Truncate long text
          const fullText = data.data.text;
          label = fullText.length > 50 ? fullText.substring(0, 50) + '…' : fullText;
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
    choicesEl.style.opacity = '1';

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
    this.currentNodeId = nodeId;
    this.advance();
  }

  private evaluateCondition(node: Node): void {
    const data = node.data as { type: string; data: { expression?: string } };
    const connections = this.model.getConnections().filter(c => c.fromNodeId === node.id);
    
    let result = false;
    try {
      const expr = data.data.expression || 'true';
      // Simple variable evaluation
      const evalExpr = expr.replace(/(\w+)\.(\w+)/g, (_, ns, key) => {
        const val = this.state.variables[ns]?.[key];
        return typeof val === 'string' ? `"${val}"` : String(val ?? 0);
      });
      result = Boolean(eval(evalExpr));
    } catch {
      result = false;
    }

    const truePath = connections.find(c => c.fromPortIndex === 0);
    const falsePath = connections.find(c => c.fromPortIndex === 1);

    const nextNode = result ? truePath : falsePath;
    if (nextNode) {
      this.currentNodeId = nextNode.toNodeId;
      this.advance();
    } else if (connections.length > 0) {
      this.currentNodeId = connections[0].toNodeId;
      this.advance();
    } else {
      this.showEnd();
    }
  }

  private executeInstruction(node: Node): void {
    const data = node.data as { type: string; data: { expression?: string } };
    
    try {
      const expr = data.data.expression || '';
      // Parse simple assignments like "Game.tension = Game.tension + 1"
      const assignments = expr.split(';').map(s => s.trim()).filter(Boolean);
      
      for (const assignment of assignments) {
        const match = assignment.match(/(\w+)\.(\w+)\s*=\s*(.+)/);
        if (match) {
          const [, ns, key, valueExpr] = match;
          
          // Evaluate the right side
          const evalExpr = valueExpr.replace(/(\w+)\.(\w+)/g, (_, vns, vkey) => {
            const val = this.state.variables[vns]?.[vkey];
            return typeof val === 'string' ? `"${val}"` : String(val ?? 0);
          });
          
          const value = eval(evalExpr);
          
          if (!this.state.variables[ns]) {
            this.state.variables[ns] = {};
          }
          this.state.variables[ns][key] = value;
        }
      }
    } catch (e) {
      console.warn('Instruction evaluation failed:', e);
    }

    const connections = this.model.getConnections().filter(c => c.fromNodeId === node.id);
    if (connections.length > 0) {
      this.currentNodeId = connections[0].toNodeId;
      this.advance();
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
      this.state.history.pop();
      const previousId = this.state.history.pop();
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
        <div class="playtest-end-text">The evening continues elsewhere</div>
      </div>
      <div class="playtest-choices" style="opacity: 1;">
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

    debug.innerHTML = vars.length > 0 ? vars.join('') : '<span style="opacity: 0.5">No variables set</span>';
  }

  private formatText(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  private formatStageDirections(text: string): string {
    // Remove brackets if present
    return text.replace(/^\[|\]$/g, '');
  }

  private setMoodFromText(text: string): void {
    const lower = text.toLowerCase();
    let mood = 'neutral';

    if (lower.includes('tension') || lower.includes('crying') || lower.includes('crisis') || 
        lower.includes('angry') || lower.includes('cold') || lower.includes('sharp')) {
      mood = 'tense';
    } else if (lower.includes('strange') || lower.includes('radio') || lower.includes('door') ||
               lower.includes('mysterious') || lower.includes('signal')) {
      mood = 'mysterious';
    } else if (lower.includes('warm') || lower.includes('smile') || lower.includes('laugh') ||
               lower.includes('good') || lower.includes('nice')) {
      mood = 'warm';
    }

    this.overlay?.setAttribute('data-mood', mood);
  }

  destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    if (this.typewriterTimeout) {
      clearTimeout(this.typewriterTimeout);
    }
    this.overlay?.remove();
  }
}
