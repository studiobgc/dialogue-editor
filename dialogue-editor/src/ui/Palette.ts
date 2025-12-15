/**
 * Node palette UI component for dragging new nodes onto the canvas
 */

import { NodeType } from '../types/graph';
import { NODE_CONFIGS } from '../core/NodeFactory';

export interface PaletteSection {
  title: string;
  items: PaletteItem[];
}

export interface PaletteItem {
  nodeType: NodeType;
  label: string;
  color: string;
  description?: string;
}

export type PaletteDropCallback = (nodeType: NodeType, x: number, y: number) => void;

export class Palette {
  private container: HTMLElement;
  private onDrop: PaletteDropCallback;
  private draggedItem: NodeType | null = null;

  constructor(containerId: string, onDrop: PaletteDropCallback) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Palette container not found: ${containerId}`);
    this.container = container;
    this.onDrop = onDrop;
    this.render();
    this.setupDragListeners();
  }

  private render(): void {
    const sections: PaletteSection[] = [
      {
        title: 'Flow',
        items: [
          { nodeType: 'dialogue', label: 'Dialogue', color: NODE_CONFIGS.dialogue.color },
          { nodeType: 'dialogueFragment', label: 'Fragment', color: NODE_CONFIGS.dialogueFragment.color },
          { nodeType: 'flowFragment', label: 'Flow Fragment', color: NODE_CONFIGS.flowFragment.color },
        ]
      },
      {
        title: 'Logic',
        items: [
          { nodeType: 'branch', label: 'Branch', color: NODE_CONFIGS.branch.color },
          { nodeType: 'condition', label: 'Condition', color: NODE_CONFIGS.condition.color },
          { nodeType: 'instruction', label: 'Instruction', color: NODE_CONFIGS.instruction.color },
        ]
      },
      {
        title: 'Navigation',
        items: [
          { nodeType: 'hub', label: 'Hub', color: NODE_CONFIGS.hub.color },
          { nodeType: 'jump', label: 'Jump', color: NODE_CONFIGS.jump.color },
        ]
      }
    ];

    this.container.innerHTML = sections.map(section => `
      <div class="palette-section">
        <div class="palette-section-title">${section.title}</div>
        ${section.items.map(item => `
          <div class="palette-item" data-node-type="${item.nodeType}" draggable="true">
            <div class="palette-item-icon ${item.nodeType}" style="background-color: ${item.color}"></div>
            <span>${item.label}</span>
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  private setupDragListeners(): void {
    const items = this.container.querySelectorAll('.palette-item');
    const graphCanvas = document.getElementById('graph-canvas');
    
    items.forEach(item => {
      const paletteItem = item as HTMLElement;
      
      // Click to add at center of canvas
      paletteItem.addEventListener('click', () => {
        const nodeType = paletteItem.dataset.nodeType as NodeType;
        if (graphCanvas) {
          const rect = graphCanvas.getBoundingClientRect();
          // Add at center of visible canvas
          this.onDrop(nodeType, rect.width / 2, rect.height / 2);
        }
      });
      
      paletteItem.addEventListener('dragstart', (e) => {
        // Use currentTarget (the element with the listener) not target (could be child)
        const nodeType = paletteItem.dataset.nodeType as NodeType;
        this.draggedItem = nodeType;
        
        // Set drag data
        if (e instanceof DragEvent && e.dataTransfer) {
          e.dataTransfer.setData('text/plain', nodeType);
          e.dataTransfer.effectAllowed = 'copy';
        }
        
        paletteItem.classList.add('dragging');
      });

      paletteItem.addEventListener('dragend', () => {
        paletteItem.classList.remove('dragging');
        this.draggedItem = null;
      });
    });

    // Setup drop target (canvas and canvas-container)
    const canvas = document.getElementById('graph-canvas');
    const canvasContainer = document.getElementById('canvas-container');
    
    const setupDropTarget = (element: HTMLElement) => {
      element.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e instanceof DragEvent && e.dataTransfer) {
          e.dataTransfer.dropEffect = 'copy';
        }
      });

      element.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      element.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.draggedItem && e instanceof DragEvent) {
          // Use canvas rect for coordinate calculation
          const targetRect = canvas?.getBoundingClientRect() || element.getBoundingClientRect();
          const x = e.clientX - targetRect.left;
          const y = e.clientY - targetRect.top;
          this.onDrop(this.draggedItem, x, y);
          this.draggedItem = null;
        }
      });
    };

    if (canvas) {
      setupDropTarget(canvas);
    }
    if (canvasContainer) {
      setupDropTarget(canvasContainer);
    }
  }

  /**
   * Filter palette items by search term
   */
  filter(searchTerm: string): void {
    const items = this.container.querySelectorAll('.palette-item');
    const term = searchTerm.toLowerCase();

    items.forEach(item => {
      const label = item.textContent?.toLowerCase() || '';
      const matches = label.includes(term);
      (item as HTMLElement).style.display = matches ? 'flex' : 'none';
    });

    // Show/hide sections based on whether they have visible items
    const sections = this.container.querySelectorAll('.palette-section');
    sections.forEach(section => {
      const visibleItems = section.querySelectorAll('.palette-item[style="display: flex"]');
      (section as HTMLElement).style.display = visibleItems.length > 0 ? 'block' : 'none';
    });
  }

  /**
   * Reset filter
   */
  resetFilter(): void {
    const items = this.container.querySelectorAll('.palette-item');
    items.forEach(item => {
      (item as HTMLElement).style.display = 'flex';
    });

    const sections = this.container.querySelectorAll('.palette-section');
    sections.forEach(section => {
      (section as HTMLElement).style.display = 'block';
    });
  }
}
