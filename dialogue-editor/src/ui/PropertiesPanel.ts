/**
 * Properties panel for editing selected node properties
 */

import { Node, NodeType, Character } from '../types/graph';
import { NODE_CONFIGS } from '../core/NodeFactory';

export type PropertyChangeCallback = (nodeId: string, property: string, value: unknown) => void;

export class PropertiesPanel {
  private container: HTMLElement;
  private currentNode: Node | null = null;
  private characters: Character[] = [];
  private onChange: PropertyChangeCallback;

  constructor(containerId: string, onChange: PropertyChangeCallback) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Properties panel container not found: ${containerId}`);
    this.container = container;
    this.onChange = onChange;
    this.renderEmpty();
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

    this.container.innerHTML = `
      <div class="properties-header">
        <div class="properties-header-icon" style="background-color: ${node.color || config.color}"></div>
        <div>
          <div class="properties-header-title">${config.displayName}</div>
          <div class="properties-header-id">${node.id.substring(0, 16)}...</div>
        </div>
      </div>

      <div class="property-group">
        <div class="property-group-title">General</div>
        <div class="property-row">
          <label class="property-label">Technical Name</label>
          <input type="text" class="property-input" id="prop-technicalName" value="${node.technicalName}">
        </div>
      </div>

      ${this.renderNodeTypeProperties(node)}

      <div class="property-group">
        <div class="property-group-title">Position</div>
        <div class="property-row" style="display: flex; gap: 8px;">
          <div style="flex: 1;">
            <label class="property-label">X</label>
            <input type="number" class="property-input" id="prop-posX" value="${Math.round(node.position.x)}">
          </div>
          <div style="flex: 1;">
            <label class="property-label">Y</label>
            <input type="number" class="property-input" id="prop-posY" value="${Math.round(node.position.y)}">
          </div>
        </div>
      </div>

      <div class="property-group">
        <div class="property-group-title">Color</div>
        <div class="property-row">
          <input type="color" class="property-input" id="prop-color" value="${node.color || config.color}" style="height: 36px; padding: 4px;">
        </div>
      </div>
    `;

    this.setupEventListeners();
  }

  private renderNodeTypeProperties(node: Node): string {
    switch (node.nodeType) {
      case 'dialogue':
      case 'dialogueFragment':
        return this.renderDialogueProperties(node);
      case 'condition':
        return this.renderConditionProperties(node);
      case 'instruction':
        return this.renderInstructionProperties(node);
      case 'jump':
        return this.renderJumpProperties(node);
      case 'flowFragment':
        return this.renderFlowFragmentProperties(node);
      case 'hub':
        return this.renderHubProperties(node);
      case 'branch':
        return this.renderBranchProperties(node);
      default:
        return '';
    }
  }

  private renderDialogueProperties(node: Node): string {
    const data = node.data as { type: string; data: { speaker?: string; text: string; menuText?: string; stageDirections?: string; autoTransition: boolean } };
    
    const speakerOptions = this.characters.map(c => 
      `<option value="${c.id}" ${data.data.speaker === c.id ? 'selected' : ''}>${c.displayName}</option>`
    ).join('');

    return `
      <div class="property-group">
        <div class="property-group-title">Dialogue</div>
        <div class="property-row">
          <label class="property-label">Speaker</label>
          <select class="property-input property-select" id="prop-speaker">
            <option value="">-- Select Speaker --</option>
            ${speakerOptions}
          </select>
        </div>
        <div class="property-row">
          <label class="property-label">Text</label>
          <textarea class="property-input property-textarea" id="prop-text" rows="4">${data.data.text || ''}</textarea>
        </div>
        <div class="property-row">
          <label class="property-label">Menu Text (optional)</label>
          <input type="text" class="property-input" id="prop-menuText" value="${data.data.menuText || ''}" placeholder="Text shown in choice menus">
        </div>
        <div class="property-row">
          <label class="property-label">Stage Directions</label>
          <textarea class="property-input property-textarea" id="prop-stageDirections" rows="2" placeholder="Acting notes, emotions, etc.">${data.data.stageDirections || ''}</textarea>
        </div>
        <div class="property-row">
          <div class="property-checkbox-row">
            <input type="checkbox" class="property-checkbox" id="prop-autoTransition" ${data.data.autoTransition ? 'checked' : ''}>
            <label for="prop-autoTransition">Auto Transition</label>
          </div>
        </div>
      </div>
    `;
  }

  private renderConditionProperties(node: Node): string {
    const data = node.data as { type: 'condition'; data: { script: { expression: string } } };
    
    return `
      <div class="property-group">
        <div class="property-group-title">Condition</div>
        <div class="property-row">
          <label class="property-label">Expression</label>
          <textarea class="property-input property-textarea" id="prop-expression" rows="3" placeholder="e.g. player.health > 50">${data.data.script.expression || ''}</textarea>
        </div>
        <div class="property-row">
          <small style="color: var(--text-secondary);">
            True path = first output, False path = second output
          </small>
        </div>
      </div>
    `;
  }

  private renderInstructionProperties(node: Node): string {
    const data = node.data as { type: 'instruction'; data: { script: { expression: string } } };
    
    return `
      <div class="property-group">
        <div class="property-group-title">Instruction</div>
        <div class="property-row">
          <label class="property-label">Script</label>
          <textarea class="property-input property-textarea" id="prop-expression" rows="4" placeholder="e.g. player.gold += 100">${data.data.script.expression || ''}</textarea>
        </div>
      </div>
    `;
  }

  private renderJumpProperties(node: Node): string {
    const data = node.data as { type: 'jump'; data: { targetNodeId?: string; targetPinIndex?: number } };
    
    return `
      <div class="property-group">
        <div class="property-group-title">Jump Target</div>
        <div class="property-row">
          <label class="property-label">Target Node ID</label>
          <input type="text" class="property-input" id="prop-targetNodeId" value="${data.data.targetNodeId || ''}" placeholder="Node ID to jump to">
        </div>
        <div class="property-row">
          <label class="property-label">Target Pin Index</label>
          <input type="number" class="property-input" id="prop-targetPinIndex" value="${data.data.targetPinIndex || 0}" min="0">
        </div>
      </div>
    `;
  }

  private renderFlowFragmentProperties(node: Node): string {
    const data = node.data as { type: 'flowFragment'; data: { displayName: string; text?: string } };
    
    return `
      <div class="property-group">
        <div class="property-group-title">Flow Fragment</div>
        <div class="property-row">
          <label class="property-label">Display Name</label>
          <input type="text" class="property-input" id="prop-displayName" value="${data.data.displayName || ''}">
        </div>
        <div class="property-row">
          <label class="property-label">Description</label>
          <textarea class="property-input property-textarea" id="prop-fragmentText" rows="3">${data.data.text || ''}</textarea>
        </div>
      </div>
    `;
  }

  private renderHubProperties(node: Node): string {
    const data = node.data as { type: 'hub'; data: { displayName?: string } };
    
    return `
      <div class="property-group">
        <div class="property-group-title">Hub</div>
        <div class="property-row">
          <label class="property-label">Display Name</label>
          <input type="text" class="property-input" id="prop-displayName" value="${data.data.displayName || ''}" placeholder="Optional label">
        </div>
      </div>
    `;
  }

  private renderBranchProperties(node: Node): string {
    return `
      <div class="property-group">
        <div class="property-group-title">Branch</div>
        <div class="property-row">
          <label class="property-label">Output Ports</label>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span>${node.outputPorts.length} outputs</span>
            <button class="toolbar-button" id="btn-add-output" style="padding: 4px 8px;">+ Add</button>
          </div>
        </div>
        ${node.outputPorts.map((port, i) => `
          <div class="property-row" style="display: flex; gap: 8px; align-items: center;">
            <input type="text" class="property-input" value="${port.label || `Output ${i + 1}`}" data-port-index="${i}" style="flex: 1;">
            ${node.outputPorts.length > 2 ? `<button class="toolbar-button" data-remove-port="${i}" style="padding: 4px 8px;">×</button>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  private setupEventListeners(): void {
    if (!this.currentNode) return;

    const node = this.currentNode;

    // Helper to add Enter key support to inputs
    const addEnterKeySupport = (input: HTMLInputElement | HTMLTextAreaElement, callback: () => void) => {
      input.addEventListener('keydown', (evt) => {
        const e = evt as KeyboardEvent;
        if (e.key === 'Enter' && !e.shiftKey) {
          // For textareas, only trigger on Cmd/Ctrl+Enter
          if (input instanceof HTMLTextAreaElement && !(e.metaKey || e.ctrlKey)) {
            return;
          }
          e.preventDefault();
          callback();
          input.blur();
        }
      });
    };

    // Technical name
    const techNameInput = document.getElementById('prop-technicalName') as HTMLInputElement;
    if (techNameInput) {
      const updateTechName = () => this.onChange(node.id, 'technicalName', techNameInput.value);
      techNameInput.addEventListener('change', updateTechName);
      addEnterKeySupport(techNameInput, updateTechName);
    }

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
      addEnterKeySupport(posXInput, updatePosition);
      addEnterKeySupport(posYInput, updatePosition);
    }

    // Color
    const colorInput = document.getElementById('prop-color') as HTMLInputElement;
    if (colorInput) {
      colorInput.addEventListener('change', () => {
        this.onChange(node.id, 'color', colorInput.value);
      });
    }

    // Node type specific properties
    this.setupNodeTypeListeners(node);
  }

  private setupNodeTypeListeners(node: Node): void {
    switch (node.nodeType) {
      case 'dialogue':
      case 'dialogueFragment':
        this.setupDialogueListeners(node);
        break;
      case 'condition':
      case 'instruction':
        this.setupScriptListeners(node);
        break;
      case 'jump':
        this.setupJumpListeners(node);
        break;
      case 'flowFragment':
        this.setupFlowFragmentListeners(node);
        break;
      case 'hub':
        this.setupHubListeners(node);
        break;
      case 'branch':
        this.setupBranchListeners(node);
        break;
    }
  }

  private setupDialogueListeners(node: Node): void {
    const speakerSelect = document.getElementById('prop-speaker') as HTMLSelectElement;
    const textInput = document.getElementById('prop-text') as HTMLTextAreaElement;
    const menuTextInput = document.getElementById('prop-menuText') as HTMLInputElement;
    const stageDirectionsInput = document.getElementById('prop-stageDirections') as HTMLTextAreaElement;
    const autoTransitionInput = document.getElementById('prop-autoTransition') as HTMLInputElement;

    const updateData = () => {
      this.onChange(node.id, 'data', {
        type: node.nodeType,
        data: {
          speaker: speakerSelect?.value || undefined,
          text: textInput?.value || '',
          menuText: menuTextInput?.value || undefined,
          stageDirections: stageDirectionsInput?.value || undefined,
          autoTransition: autoTransitionInput?.checked || false
        }
      });
    };

    speakerSelect?.addEventListener('change', updateData);
    textInput?.addEventListener('input', updateData);
    menuTextInput?.addEventListener('input', updateData);
    stageDirectionsInput?.addEventListener('input', updateData);
    autoTransitionInput?.addEventListener('change', updateData);
  }

  private setupScriptListeners(node: Node): void {
    const expressionInput = document.getElementById('prop-expression') as HTMLTextAreaElement;
    if (expressionInput) {
      expressionInput.addEventListener('input', () => {
        this.onChange(node.id, 'data', {
          type: node.nodeType,
          data: {
            script: {
              expression: expressionInput.value,
              isCondition: node.nodeType === 'condition'
            }
          }
        });
      });
    }
  }

  private setupJumpListeners(node: Node): void {
    const targetNodeIdInput = document.getElementById('prop-targetNodeId') as HTMLInputElement;
    const targetPinIndexInput = document.getElementById('prop-targetPinIndex') as HTMLInputElement;

    const updateData = () => {
      this.onChange(node.id, 'data', {
        type: 'jump',
        data: {
          targetNodeId: targetNodeIdInput?.value || undefined,
          targetPinIndex: parseInt(targetPinIndexInput?.value) || 0
        }
      });
    };

    targetNodeIdInput?.addEventListener('change', updateData);
    targetPinIndexInput?.addEventListener('change', updateData);
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

  private setupHubListeners(node: Node): void {
    const displayNameInput = document.getElementById('prop-displayName') as HTMLInputElement;
    if (displayNameInput) {
      displayNameInput.addEventListener('input', () => {
        this.onChange(node.id, 'data', {
          type: 'hub',
          data: {
            displayName: displayNameInput.value || undefined
          }
        });
      });
    }
  }

  private setupBranchListeners(node: Node): void {
    const addBtn = document.getElementById('btn-add-output');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.onChange(node.id, 'addOutputPort', null);
      });
    }

    // Port label inputs
    const portInputs = this.container.querySelectorAll('[data-port-index]');
    portInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const index = parseInt(target.dataset.portIndex || '0');
        this.onChange(node.id, 'portLabel', { index, label: target.value });
      });
    });

    // Remove port buttons
    const removeButtons = this.container.querySelectorAll('[data-remove-port]');
    removeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const index = parseInt(target.dataset.removePort || '0');
        this.onChange(node.id, 'removeOutputPort', index);
      });
    });
  }

  renderEmpty(): void {
    this.currentNode = null;
    this.container.innerHTML = `
      <div class="properties-empty">
        <div class="properties-empty-icon">🎯</div>
        <div class="properties-empty-title">No Node Selected</div>
        <div class="properties-empty-hint">
          Click on a node in the canvas to edit its properties here.
          <br><br>
          <strong>Quick tips:</strong><br>
          • Double-click dialogue nodes to edit text<br>
          • Drag from ports to create connections<br>
          • Use the palette on the left to add nodes
        </div>
      </div>
    `;
  }

  clear(): void {
    this.renderEmpty();
  }
}
