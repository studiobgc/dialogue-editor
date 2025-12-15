/**
 * Context menu component
 */

import { NodeType } from '../types/graph';

export interface ContextMenuItem {
  id: string;
  label: string;
  shortcut?: string;
  icon?: string;
  disabled?: boolean;
  separator?: boolean;
  submenu?: ContextMenuItem[];
  onClick?: () => void;
}

export class ContextMenu {
  private element: HTMLElement | null = null;
  private onClose: (() => void) | null = null;

  constructor() {
    this.setupGlobalListener();
  }

  private setupGlobalListener(): void {
    document.addEventListener('click', (e) => {
      if (this.element && !this.element.contains(e.target as Node)) {
        this.hide();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.element) {
        this.hide();
      }
    });
  }

  show(screenX: number, screenY: number, items: ContextMenuItem[], onClose?: () => void): void {
    this.hide();
    this.onClose = onClose || null;

    this.element = document.createElement('div');
    this.element.className = 'context-menu';
    this.element.innerHTML = this.renderItems(items);
    
    document.body.appendChild(this.element);

    // Position the menu
    const rect = this.element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = screenX;
    let y = screenY;

    // Adjust if menu would go off screen
    if (x + rect.width > viewportWidth) {
      x = viewportWidth - rect.width - 8;
    }
    if (y + rect.height > viewportHeight) {
      y = viewportHeight - rect.height - 8;
    }

    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;

    // Setup click handlers
    this.setupItemListeners(items);
  }

  private renderItems(items: ContextMenuItem[]): string {
    return items.map(item => {
      if (item.separator) {
        return '<div class="context-menu-separator"></div>';
      }

      const disabledClass = item.disabled ? 'disabled' : '';
      
      return `
        <div class="context-menu-item ${disabledClass}" data-item-id="${item.id}">
          ${item.icon ? `<span class="context-menu-icon">${item.icon}</span>` : ''}
          <span>${item.label}</span>
          ${item.shortcut ? `<span class="context-menu-shortcut">${item.shortcut}</span>` : ''}
          ${item.submenu ? '<span class="context-menu-arrow">▶</span>' : ''}
        </div>
      `;
    }).join('');
  }

  private setupItemListeners(items: ContextMenuItem[]): void {
    if (!this.element) return;

    items.forEach(item => {
      if (item.separator || item.disabled) return;

      const el = this.element?.querySelector(`[data-item-id="${item.id}"]`);
      if (el && item.onClick) {
        el.addEventListener('click', () => {
          item.onClick!();
          this.hide();
        });
      }
    });
  }

  hide(): void {
    if (this.element) {
      this.element.remove();
      this.element = null;
      if (this.onClose) {
        this.onClose();
        this.onClose = null;
      }
    }
  }

  /**
   * Create standard node creation menu items
   */
  static createNodeMenuItems(onCreateNode: (nodeType: NodeType) => void): ContextMenuItem[] {
    return [
      {
        id: 'add-dialogue',
        label: 'Add Dialogue',
        icon: '💬',
        onClick: () => onCreateNode('dialogue')
      },
      {
        id: 'add-fragment',
        label: 'Add Fragment',
        icon: '💭',
        onClick: () => onCreateNode('dialogueFragment')
      },
      { id: 'sep1', label: '', separator: true },
      {
        id: 'add-branch',
        label: 'Add Branch',
        icon: '⑂',
        onClick: () => onCreateNode('branch')
      },
      {
        id: 'add-condition',
        label: 'Add Condition',
        icon: '?',
        onClick: () => onCreateNode('condition')
      },
      {
        id: 'add-instruction',
        label: 'Add Instruction',
        icon: '⚡',
        onClick: () => onCreateNode('instruction')
      },
      { id: 'sep2', label: '', separator: true },
      {
        id: 'add-hub',
        label: 'Add Hub',
        icon: '◉',
        onClick: () => onCreateNode('hub')
      },
      {
        id: 'add-jump',
        label: 'Add Jump',
        icon: '↗',
        onClick: () => onCreateNode('jump')
      },
      {
        id: 'add-flow',
        label: 'Add Flow Fragment',
        icon: '▣',
        onClick: () => onCreateNode('flowFragment')
      }
    ];
  }

  /**
   * Create node context menu items (when right-clicking on a node)
   */
  static createNodeContextMenuItems(
    onDuplicate: () => void,
    onDelete: () => void,
    onCopy: () => void,
    onCut: () => void
  ): ContextMenuItem[] {
    return [
      {
        id: 'duplicate',
        label: 'Duplicate',
        shortcut: '⌘D',
        onClick: onDuplicate
      },
      { id: 'sep1', label: '', separator: true },
      {
        id: 'copy',
        label: 'Copy',
        shortcut: '⌘C',
        onClick: onCopy
      },
      {
        id: 'cut',
        label: 'Cut',
        shortcut: '⌘X',
        onClick: onCut
      },
      { id: 'sep2', label: '', separator: true },
      {
        id: 'delete',
        label: 'Delete',
        shortcut: '⌫',
        onClick: onDelete
      }
    ];
  }
}
