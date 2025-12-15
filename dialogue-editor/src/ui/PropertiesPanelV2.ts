/**
 * Properties Panel V2 - Progressive Disclosure Design
 * 
 * Philosophy: Show what matters, hide what doesn't (until it does)
 * - Essential fields always visible
 * - Advanced options collapsed by default
 * - Context-aware hints
 * - Keyboard shortcuts inline
 */

import { Node, NodeType, Character } from '../types/graph';
import { NODE_CONFIGS } from '../core/NodeFactory';

export type PropertyChangeCallback = (nodeId: string, property: string, value: unknown) => void;

interface CollapsibleState {
  [key: string]: boolean;
}

const STORAGE_KEY = 'dialogue-editor-panel-state';

export class PropertiesPanelV2 {
  private container: HTMLElement;
  private currentNode: Node | null = null;
  private characters: Character[] = [];
  private onChange: PropertyChangeCallback;
  private collapsedSections: CollapsibleState = {};

  constructor(containerId: string, onChange: PropertyChangeCallback) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Properties panel container not found: ${containerId}`);
    this.container = container;
    this.onChange = onChange;
    this.loadState();
    this.renderEmpty();
  }

  private loadState(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.collapsedSections = JSON.parse(stored);
      }
    } catch (e) {
      this.collapsedSections = {};
    }
  }

  private saveState(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.collapsedSections));
    } catch (e) {
      // Ignore
    }
  }

  setCharacters(characters: Character[]): void {
    this.characters = characters;
    if (this.currentNode) {
      this.showNode(this.currentNode);
    }
  }

  showNode(node: Node): void {
    this.currentNode = node;
    const config = NODE_CONFIGS[node.nodeType];

    // Get speaker info for dialogue nodes
    let speakerName = '';
    let speakerColor = config.color;
    if ((node.nodeType === 'dialogue' || node.nodeType === 'dialogueFragment') && node.data.type === 'dialogue') {
      const data = node.data as { type: string; data: { speaker?: string } };
      const speaker = this.characters.find(c => c.id === data.data.speaker);
      if (speaker) {
        speakerName = speaker.displayName;
        speakerColor = speaker.color;
      }
    }

    this.container.innerHTML = `
      <div class="props-v2">
        ${this.renderHeader(node, config, speakerName, speakerColor)}
        ${this.renderMainContent(node)}
        ${this.renderAdvancedSection(node, config)}
      </div>
    `;

    this.setupEventListeners();
  }

  private renderHeader(node: Node, config: typeof NODE_CONFIGS[NodeType], speakerName: string, speakerColor: string): string {
    const isDialogue = node.nodeType === 'dialogue' || node.nodeType === 'dialogueFragment';
    
    return `
      <div class="props-header">
        <div class="props-header-badge" style="background: ${speakerColor}">
          ${isDialogue && speakerName ? speakerName.charAt(0).toUpperCase() : config.displayName.charAt(0)}
        </div>
        <div class="props-header-info">
          <div class="props-header-title">${isDialogue && speakerName ? speakerName : config.displayName}</div>
          <div class="props-header-subtitle">${isDialogue && speakerName ? config.displayName : ''}</div>
        </div>
        <div class="props-header-actions">
          <button class="props-icon-btn" id="btn-delete-node" title="Delete node (Del)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  private renderMainContent(node: Node): string {
    switch (node.nodeType) {
      case 'dialogue':
      case 'dialogueFragment':
        return this.renderDialogueMain(node);
      case 'condition':
        return this.renderConditionMain(node);
      case 'instruction':
        return this.renderInstructionMain(node);
      case 'branch':
        return this.renderBranchMain(node);
      case 'hub':
        return this.renderHubMain(node);
      case 'jump':
        return this.renderJumpMain(node);
      case 'flowFragment':
        return this.renderFlowFragmentMain(node);
      default:
        return '';
    }
  }

  private renderDialogueMain(node: Node): string {
    const data = node.data as { type: string; data: { speaker?: string; text: string; menuText?: string; stageDirections?: string } };
    const currentSpeaker = this.characters.find(c => c.id === data.data.speaker);

    return `
      <div class="props-section">
        <!-- Speaker Selector - Visual, not dropdown -->
        <div class="props-speaker-grid">
          ${this.characters.map(c => `
            <button class="props-speaker-chip ${c.id === data.data.speaker ? 'active' : ''}" 
                    data-speaker-id="${c.id}"
                    style="--speaker-color: ${c.color}">
              <span class="props-speaker-dot" style="background: ${c.color}"></span>
              <span class="props-speaker-name">${c.displayName}</span>
            </button>
          `).join('')}
          <button class="props-speaker-chip add-speaker" id="btn-add-speaker">
            <span class="props-speaker-plus">+</span>
            <span class="props-speaker-name">Add</span>
          </button>
        </div>

        <!-- Main Text - The star of the show -->
        <div class="props-field props-field-main">
          <textarea 
            class="props-textarea-main" 
            id="prop-text" 
            placeholder="What does ${currentSpeaker?.displayName || 'this character'} say?"
            rows="4"
          >${this.escapeHtml(data.data.text || '')}</textarea>
          <div class="props-textarea-hint">
            <span class="props-hint-shortcut">Enter</span> new line
            <span class="props-hint-shortcut">⌘Enter</span> create next node
          </div>
        </div>
      </div>
    `;
  }

  private renderConditionMain(node: Node): string {
    const data = node.data as { type: 'condition'; data: { script: { expression: string } } };

    return `
      <div class="props-section">
        <div class="props-field">
          <label class="props-label">
            <span>Condition</span>
            <span class="props-label-hint">JavaScript expression</span>
          </label>
          <div class="props-code-editor">
            <textarea 
              class="props-code-input" 
              id="prop-expression" 
              placeholder="e.g. player.health > 50"
              rows="3"
              spellcheck="false"
            >${this.escapeHtml(data.data.script.expression || '')}</textarea>
          </div>
        </div>
        
        <div class="props-condition-paths">
          <div class="props-condition-path true">
            <span class="props-path-dot"></span>
            <span>True → First output</span>
          </div>
          <div class="props-condition-path false">
            <span class="props-path-dot"></span>
            <span>False → Second output</span>
          </div>
        </div>
      </div>
    `;
  }

  private renderInstructionMain(node: Node): string {
    const data = node.data as { type: 'instruction'; data: { script: { expression: string } } };

    return `
      <div class="props-section">
        <div class="props-field">
          <label class="props-label">
            <span>Action Script</span>
            <span class="props-label-hint">Runs when reached</span>
          </label>
          <div class="props-code-editor">
            <textarea 
              class="props-code-input" 
              id="prop-expression" 
              placeholder="e.g. player.gold += 100"
              rows="4"
              spellcheck="false"
            >${this.escapeHtml(data.data.script.expression || '')}</textarea>
          </div>
        </div>
        
        <div class="props-examples">
          <div class="props-examples-title">Examples</div>
          <code class="props-example" data-insert="player.inventory.add('key')">Add item</code>
          <code class="props-example" data-insert="quest.complete('intro')">Complete quest</code>
          <code class="props-example" data-insert="npc.relationship += 10">Change relationship</code>
        </div>
      </div>
    `;
  }

  private renderBranchMain(node: Node): string {
    return `
      <div class="props-section">
        <div class="props-field">
          <label class="props-label">
            <span>Player Choices</span>
            <span class="props-label-hint">${node.outputPorts.length} options</span>
          </label>
          
          <div class="props-choices-list">
            ${node.outputPorts.map((port, i) => `
              <div class="props-choice-item" data-port-index="${i}">
                <span class="props-choice-number">${i + 1}</span>
                <input 
                  type="text" 
                  class="props-choice-input" 
                  value="${this.escapeHtml(port.label || `Choice ${i + 1}`)}"
                  placeholder="Choice text..."
                  data-port-index="${i}"
                >
                ${node.outputPorts.length > 2 ? `
                  <button class="props-choice-remove" data-remove-port="${i}" title="Remove choice">×</button>
                ` : ''}
              </div>
            `).join('')}
          </div>
          
          <button class="props-add-choice-btn" id="btn-add-output">
            <span>+</span> Add Choice
          </button>
        </div>
      </div>
    `;
  }

  private renderHubMain(node: Node): string {
    const data = node.data as { type: 'hub'; data: { displayName?: string } };

    return `
      <div class="props-section">
        <div class="props-hub-info">
          <div class="props-hub-icon">○</div>
          <div class="props-hub-text">
            <div class="props-hub-title">Merge Point</div>
            <div class="props-hub-desc">Multiple paths converge here and continue as one</div>
          </div>
        </div>
        
        <div class="props-field">
          <label class="props-label">Label (optional)</label>
          <input 
            type="text" 
            class="props-input" 
            id="prop-displayName" 
            value="${this.escapeHtml(data.data.displayName || '')}"
            placeholder="e.g. After greeting"
          >
        </div>
      </div>
    `;
  }

  private renderJumpMain(node: Node): string {
    const data = node.data as { type: 'jump'; data: { targetNodeId?: string; targetPinIndex?: number } };

    return `
      <div class="props-section">
        <div class="props-jump-info">
          <div class="props-jump-icon">↗</div>
          <div class="props-jump-text">
            <div class="props-jump-title">Jump to Another Location</div>
            <div class="props-jump-desc">Teleport the flow to a different node</div>
          </div>
        </div>
        
        <div class="props-field">
          <label class="props-label">Target Node ID</label>
          <input 
            type="text" 
            class="props-input props-input-mono" 
            id="prop-targetNodeId" 
            value="${this.escapeHtml(data.data.targetNodeId || '')}"
            placeholder="Paste node ID here"
          >
        </div>
      </div>
    `;
  }

  private renderFlowFragmentMain(node: Node): string {
    const data = node.data as { type: 'flowFragment'; data: { displayName: string; text?: string } };

    return `
      <div class="props-section">
        <div class="props-field">
          <label class="props-label">Scene Name</label>
          <input 
            type="text" 
            class="props-input props-input-title" 
            id="prop-displayName" 
            value="${this.escapeHtml(data.data.displayName || '')}"
            placeholder="e.g. Town Square - Morning"
          >
        </div>
        
        <div class="props-field">
          <label class="props-label">Description</label>
          <textarea 
            class="props-textarea" 
            id="prop-fragmentText" 
            placeholder="What happens in this scene?"
            rows="3"
          >${this.escapeHtml(data.data.text || '')}</textarea>
        </div>
      </div>
    `;
  }

  private renderAdvancedSection(node: Node, config: typeof NODE_CONFIGS[NodeType]): string {
    const isCollapsed = this.collapsedSections['advanced'] !== false; // Default collapsed
    const isDialogue = node.nodeType === 'dialogue' || node.nodeType === 'dialogueFragment';

    return `
      <div class="props-collapsible ${isCollapsed ? 'collapsed' : ''}" data-section="advanced">
        <button class="props-collapsible-header">
          <span class="props-collapsible-icon">▶</span>
          <span>Advanced</span>
        </button>
        <div class="props-collapsible-content">
          ${isDialogue ? this.renderDialogueAdvanced(node) : ''}
          
          <div class="props-field">
            <label class="props-label">Technical Name</label>
            <input 
              type="text" 
              class="props-input props-input-mono" 
              id="prop-technicalName" 
              value="${this.escapeHtml(node.technicalName)}"
            >
          </div>
          
          <div class="props-field">
            <label class="props-label">Node Color</label>
            <div class="props-color-row">
              <input 
                type="color" 
                class="props-color-input" 
                id="prop-color" 
                value="${node.color || config.color}"
              >
              <span class="props-color-value">${node.color || config.color}</span>
            </div>
          </div>
          
          <div class="props-field">
            <label class="props-label">Position</label>
            <div class="props-position-row">
              <div class="props-position-field">
                <span class="props-position-label">X</span>
                <input type="number" class="props-input" id="prop-posX" value="${Math.round(node.position.x)}">
              </div>
              <div class="props-position-field">
                <span class="props-position-label">Y</span>
                <input type="number" class="props-input" id="prop-posY" value="${Math.round(node.position.y)}">
              </div>
            </div>
          </div>
          
          <div class="props-field props-field-id">
            <label class="props-label">Node ID</label>
            <code class="props-id-value">${node.id}</code>
            <button class="props-copy-btn" data-copy="${node.id}" title="Copy ID">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderDialogueAdvanced(node: Node): string {
    const data = node.data as { type: string; data: { menuText?: string; stageDirections?: string; autoTransition?: boolean } };

    return `
      <div class="props-field">
        <label class="props-label">
          <span>Menu Text</span>
          <span class="props-label-hint">Shown in choice lists</span>
        </label>
        <input 
          type="text" 
          class="props-input" 
          id="prop-menuText" 
          value="${this.escapeHtml(data.data.menuText || '')}"
          placeholder="Short version for menus"
        >
      </div>
      
      <div class="props-field">
        <label class="props-label">
          <span>Stage Directions</span>
          <span class="props-label-hint">Acting notes</span>
        </label>
        <textarea 
          class="props-textarea" 
          id="prop-stageDirections" 
          placeholder="(nervously, looking away)"
          rows="2"
        >${this.escapeHtml(data.data.stageDirections || '')}</textarea>
      </div>
      
      <div class="props-field">
        <label class="props-checkbox-label">
          <input type="checkbox" class="props-checkbox" id="prop-autoTransition" ${data.data.autoTransition ? 'checked' : ''}>
          <span class="props-checkbox-text">Auto-advance (no player input needed)</span>
        </label>
      </div>
    `;
  }

  private setupEventListeners(): void {
    if (!this.currentNode) return;
    const node = this.currentNode;

    // Collapsible sections
    this.container.querySelectorAll('.props-collapsible-header').forEach(header => {
      header.addEventListener('click', () => {
        const section = header.closest('.props-collapsible');
        const sectionId = section?.getAttribute('data-section');
        if (section && sectionId) {
          const isCollapsed = section.classList.toggle('collapsed');
          this.collapsedSections[sectionId] = isCollapsed;
          this.saveState();
        }
      });
    });

    // Speaker selection
    this.container.querySelectorAll('.props-speaker-chip:not(.add-speaker)').forEach(chip => {
      chip.addEventListener('click', () => {
        const speakerId = (chip as HTMLElement).dataset.speakerId;
        this.updateDialogueData(node, { speaker: speakerId });
        // Update UI
        this.container.querySelectorAll('.props-speaker-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });

    // Add speaker button
    const addSpeakerBtn = document.getElementById('btn-add-speaker');
    addSpeakerBtn?.addEventListener('click', () => {
      const name = prompt('Character name:');
      if (name) {
        this.onChange(node.id, 'addCharacter', name);
      }
    });

    // Delete node
    const deleteBtn = document.getElementById('btn-delete-node');
    deleteBtn?.addEventListener('click', () => {
      this.onChange(node.id, 'deleteNode', null);
    });

    // Copy ID button
    this.container.querySelectorAll('.props-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = (btn as HTMLElement).dataset.copy;
        if (text) {
          navigator.clipboard.writeText(text);
          // Visual feedback
          btn.classList.add('copied');
          setTimeout(() => btn.classList.remove('copied'), 1000);
        }
      });
    });

    // Example code insertions
    this.container.querySelectorAll('.props-example').forEach(example => {
      example.addEventListener('click', () => {
        const code = (example as HTMLElement).dataset.insert;
        const textarea = document.getElementById('prop-expression') as HTMLTextAreaElement;
        if (code && textarea) {
          textarea.value = code;
          textarea.focus();
          this.updateScriptData(node);
        }
      });
    });

    // Set up specific listeners based on node type
    this.setupNodeSpecificListeners(node);
  }

  private setupNodeSpecificListeners(node: Node): void {
    // Technical name
    const techNameInput = document.getElementById('prop-technicalName') as HTMLInputElement;
    techNameInput?.addEventListener('change', () => {
      this.onChange(node.id, 'technicalName', techNameInput.value);
    });

    // Position
    const posXInput = document.getElementById('prop-posX') as HTMLInputElement;
    const posYInput = document.getElementById('prop-posY') as HTMLInputElement;
    if (posXInput && posYInput) {
      const updatePosition = () => {
        this.onChange(node.id, 'position', {
          x: parseFloat(posXInput.value) || 0,
          y: parseFloat(posYInput.value) || 0
        });
      };
      posXInput.addEventListener('change', updatePosition);
      posYInput.addEventListener('change', updatePosition);
    }

    // Color
    const colorInput = document.getElementById('prop-color') as HTMLInputElement;
    colorInput?.addEventListener('input', () => {
      this.onChange(node.id, 'color', colorInput.value);
      const valueSpan = this.container.querySelector('.props-color-value');
      if (valueSpan) valueSpan.textContent = colorInput.value;
    });

    // Node-type specific
    switch (node.nodeType) {
      case 'dialogue':
      case 'dialogueFragment':
        this.setupDialogueListeners(node);
        break;
      case 'condition':
      case 'instruction':
        this.setupScriptListeners(node);
        break;
      case 'branch':
        this.setupBranchListeners(node);
        break;
      case 'hub':
        this.setupHubListeners(node);
        break;
      case 'jump':
        this.setupJumpListeners(node);
        break;
      case 'flowFragment':
        this.setupFlowFragmentListeners(node);
        break;
    }
  }

  private setupDialogueListeners(node: Node): void {
    const textInput = document.getElementById('prop-text') as HTMLTextAreaElement;
    const menuTextInput = document.getElementById('prop-menuText') as HTMLInputElement;
    const stageDirectionsInput = document.getElementById('prop-stageDirections') as HTMLTextAreaElement;
    const autoTransitionInput = document.getElementById('prop-autoTransition') as HTMLInputElement;

    const updateData = () => this.updateDialogueData(node);

    textInput?.addEventListener('input', updateData);
    menuTextInput?.addEventListener('input', updateData);
    stageDirectionsInput?.addEventListener('input', updateData);
    autoTransitionInput?.addEventListener('change', updateData);

    // Keyboard shortcuts in text input
    textInput?.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        this.onChange(node.id, 'createNextNode', null);
      }
    });
  }

  private updateDialogueData(node: Node, override?: { speaker?: string }): void {
    const speakerChip = this.container.querySelector('.props-speaker-chip.active') as HTMLElement;
    const textInput = document.getElementById('prop-text') as HTMLTextAreaElement;
    const menuTextInput = document.getElementById('prop-menuText') as HTMLInputElement;
    const stageDirectionsInput = document.getElementById('prop-stageDirections') as HTMLTextAreaElement;
    const autoTransitionInput = document.getElementById('prop-autoTransition') as HTMLInputElement;

    this.onChange(node.id, 'data', {
      type: node.nodeType,
      data: {
        speaker: override?.speaker ?? speakerChip?.dataset.speakerId ?? undefined,
        text: textInput?.value || '',
        menuText: menuTextInput?.value || undefined,
        stageDirections: stageDirectionsInput?.value || undefined,
        autoTransition: autoTransitionInput?.checked || false
      }
    });
  }

  private setupScriptListeners(node: Node): void {
    const expressionInput = document.getElementById('prop-expression') as HTMLTextAreaElement;
    expressionInput?.addEventListener('input', () => this.updateScriptData(node));
  }

  private updateScriptData(node: Node): void {
    const expressionInput = document.getElementById('prop-expression') as HTMLTextAreaElement;
    this.onChange(node.id, 'data', {
      type: node.nodeType,
      data: {
        script: {
          expression: expressionInput?.value || '',
          isCondition: node.nodeType === 'condition'
        }
      }
    });
  }

  private setupBranchListeners(node: Node): void {
    const addBtn = document.getElementById('btn-add-output');
    addBtn?.addEventListener('click', () => {
      this.onChange(node.id, 'addOutputPort', null);
    });

    // Choice inputs
    this.container.querySelectorAll('.props-choice-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const index = parseInt(target.dataset.portIndex || '0');
        this.onChange(node.id, 'portLabel', { index, label: target.value });
      });
    });

    // Remove buttons
    this.container.querySelectorAll('.props-choice-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const index = parseInt(target.dataset.removePort || '0');
        this.onChange(node.id, 'removeOutputPort', index);
      });
    });
  }

  private setupHubListeners(node: Node): void {
    const displayNameInput = document.getElementById('prop-displayName') as HTMLInputElement;
    displayNameInput?.addEventListener('input', () => {
      this.onChange(node.id, 'data', {
        type: 'hub',
        data: { displayName: displayNameInput.value || undefined }
      });
    });
  }

  private setupJumpListeners(node: Node): void {
    const targetNodeIdInput = document.getElementById('prop-targetNodeId') as HTMLInputElement;
    targetNodeIdInput?.addEventListener('change', () => {
      this.onChange(node.id, 'data', {
        type: 'jump',
        data: {
          targetNodeId: targetNodeIdInput.value || undefined,
          targetPinIndex: 0
        }
      });
    });
  }

  private setupFlowFragmentListeners(node: Node): void {
    const displayNameInput = document.getElementById('prop-displayName') as HTMLInputElement;
    const textInput = document.getElementById('prop-fragmentText') as HTMLTextAreaElement;

    const updateData = () => {
      this.onChange(node.id, 'data', {
        type: 'flowFragment',
        data: {
          displayName: displayNameInput?.value || 'Flow Fragment',
          text: textInput?.value || undefined
        }
      });
    };

    displayNameInput?.addEventListener('input', updateData);
    textInput?.addEventListener('input', updateData);
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  renderEmpty(): void {
    this.currentNode = null;
    this.container.innerHTML = `
      <div class="props-empty">
        <div class="props-empty-visual">
          <div class="props-empty-circle"></div>
          <div class="props-empty-circle"></div>
          <div class="props-empty-circle"></div>
        </div>
        <div class="props-empty-title">Select a Node</div>
        <div class="props-empty-text">
          Click any node on the canvas to edit it here
        </div>
        <div class="props-empty-shortcuts">
          <div class="props-shortcut-row">
            <kbd>Cmd</kbd><kbd>/</kbd>
            <span>Command palette</span>
          </div>
          <div class="props-shortcut-row">
            <kbd>Del</kbd>
            <span>Delete selected</span>
          </div>
          <div class="props-shortcut-row">
            <kbd>Cmd</kbd><kbd>D</kbd>
            <span>Duplicate</span>
          </div>
        </div>
      </div>
    `;
  }

  clear(): void {
    this.renderEmpty();
  }

  focusMainInput(): void {
    const textInput = document.getElementById('prop-text') as HTMLTextAreaElement;
    if (textInput) {
      textInput.focus();
      textInput.select();
    }
  }
}
