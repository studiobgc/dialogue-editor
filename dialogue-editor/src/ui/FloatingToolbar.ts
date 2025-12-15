/**
 * Floating Toolbar - Appears near selected nodes (Figma-style)
 * 
 * Context-aware quick actions that follow your selection
 */

import { Node, Position } from '../types/graph';

export interface FloatingToolbarCallbacks {
  onEdit: (node: Node) => void;
  onDuplicate: (node: Node) => void;
  onDelete: (node: Node) => void;
  onAddAfter: (node: Node) => void;
  onChangeColor: (node: Node) => void;
}

export class FloatingToolbar {
  private element: HTMLElement | null = null;
  private currentNode: Node | null = null;
  private callbacks: FloatingToolbarCallbacks;
  private hideTimeout: number | null = null;

  constructor(callbacks: FloatingToolbarCallbacks) {
    this.callbacks = callbacks;
    this.createElement();
  }

  private createElement(): void {
    this.element = document.createElement('div');
    this.element.className = 'floating-toolbar';
    this.element.innerHTML = `
      <button class="floating-toolbar-btn primary" data-action="edit" title="Edit (Enter)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="floating-toolbar-btn" data-action="add" title="Add node after (⌘→)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
      </button>
      <div class="floating-toolbar-separator"></div>
      <button class="floating-toolbar-btn" data-action="duplicate" title="Duplicate (⌘D)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
      </button>
      <button class="floating-toolbar-btn" data-action="color" title="Change color">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="4" fill="currentColor"/>
        </svg>
      </button>
      <button class="floating-toolbar-btn danger" data-action="delete" title="Delete (Del)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
        </svg>
      </button>
    `;

    document.body.appendChild(this.element);
    this.setupListeners();
  }

  private setupListeners(): void {
    if (!this.element) return;

    this.element.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = (btn as HTMLElement).dataset.action;
        if (!this.currentNode) return;

        switch (action) {
          case 'edit':
            this.callbacks.onEdit(this.currentNode);
            break;
          case 'add':
            this.callbacks.onAddAfter(this.currentNode);
            break;
          case 'duplicate':
            this.callbacks.onDuplicate(this.currentNode);
            break;
          case 'color':
            this.callbacks.onChangeColor(this.currentNode);
            break;
          case 'delete':
            this.callbacks.onDelete(this.currentNode);
            this.hide();
            break;
        }
      });
    });

    // Keep visible while hovering
    this.element.addEventListener('mouseenter', () => {
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
        this.hideTimeout = null;
      }
    });

    this.element.addEventListener('mouseleave', () => {
      this.scheduleHide();
    });
  }

  show(node: Node, screenPosition: Position): void {
    if (!this.element) return;

    this.currentNode = node;

    // Cancel any pending hide
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    // Position above the node
    const toolbarWidth = 200;
    let x = screenPosition.x - toolbarWidth / 2;
    let y = screenPosition.y - 50;

    // Keep on screen
    x = Math.max(10, Math.min(x, window.innerWidth - toolbarWidth - 10));
    y = Math.max(10, y);

    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;

    this.element.classList.add('visible');
  }

  hide(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    this.element?.classList.remove('visible');
    this.currentNode = null;
  }

  scheduleHide(delay: number = 300): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }
    this.hideTimeout = window.setTimeout(() => {
      this.hide();
    }, delay);
  }

  isVisible(): boolean {
    return this.element?.classList.contains('visible') || false;
  }

  destroy(): void {
    this.element?.remove();
    this.element = null;
  }
}
