/**
 * Inline Editor - Edit dialogue directly on the canvas
 * 
 * Double-click a node to edit in place. No context switching.
 * Keyboard flow: Enter creates next, Tab branches, Esc closes
 */

import { Node, Character, Position } from '../types/graph';

export interface InlineEditorCallbacks {
  onTextChange: (nodeId: string, text: string) => void;
  onSpeakerChange: (nodeId: string, speakerId: string) => void;
  onCreateNext: (nodeId: string) => void;
  onCreateBranch: (nodeId: string) => void;
  onClose: () => void;
}

export class InlineEditor {
  private overlay: HTMLElement | null = null;
  private editor: HTMLElement | null = null;
  private currentNode: Node | null = null;
  private characters: Character[] = [];
  private callbacks: InlineEditorCallbacks;
  private textarea: HTMLTextAreaElement | null = null;
  private isProcessingAction = false; // Prevent rapid-fire actions

  constructor(callbacks: InlineEditorCallbacks) {
    this.callbacks = callbacks;
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleClickOutside = this.handleClickOutside.bind(this);
  }

  setCharacters(characters: Character[]): void {
    this.characters = characters;
  }

  show(node: Node, screenPosition: Position, canvasRect: DOMRect): void {
    if (node.nodeType !== 'dialogue' && node.nodeType !== 'dialogueFragment') {
      return; // Only for dialogue nodes
    }

    // CRITICAL: Always hide existing editor first to prevent duplicates
    this.hide();

    this.isProcessingAction = false; // Reset for new editor
    this.currentNode = node;
    this.render(screenPosition, canvasRect);

    document.addEventListener('keydown', this.handleKeyDown, true);
    document.addEventListener('mousedown', this.handleClickOutside);
  }

  hide(): void {
    if (this.overlay) {
      // Instant removal for snappy feel (no animation delay)
      this.overlay.remove();
      this.overlay = null;
      this.editor = null;
      this.textarea = null;
    }

    document.removeEventListener('keydown', this.handleKeyDown, true);
    document.removeEventListener('mousedown', this.handleClickOutside);
    this.currentNode = null;
  }

  isVisible(): boolean {
    return this.overlay !== null;
  }

  private render(screenPosition: Position, canvasRect: DOMRect): void {
    if (!this.currentNode) return;

    const data = this.currentNode.data as { type: string; data: { speaker?: string; text: string } };
    const speaker = this.characters.find(c => c.id === data.data.speaker);

    // Create overlay (transparent, just for catching clicks)
    this.overlay = document.createElement('div');
    this.overlay.className = 'inline-editor-overlay';

    // Create editor
    this.editor = document.createElement('div');
    this.editor.className = 'inline-editor-v2';

    // Position it to the RIGHT of the node so user can see updates
    const editorWidth = 320;
    const nodeWidth = this.currentNode.size?.width || 200;
    
    // Default: position to the right of the node
    let x = screenPosition.x + canvasRect.left + nodeWidth / 2 + 20;
    let y = screenPosition.y + canvasRect.top - 60;

    // If not enough room on right, position to the left
    if (x + editorWidth > window.innerWidth - 20) {
      x = screenPosition.x + canvasRect.left - nodeWidth / 2 - editorWidth - 20;
    }

    // Keep on screen
    x = Math.max(20, Math.min(x, window.innerWidth - editorWidth - 20));
    y = Math.max(60, Math.min(y, window.innerHeight - 280));

    this.editor.style.left = `${x}px`;
    this.editor.style.top = `${y}px`;

    this.editor.innerHTML = `
      <div class="inline-editor-speaker-bar">
        ${this.characters.map(c => `
          <button 
            class="inline-speaker-btn ${c.id === data.data.speaker ? 'active' : ''}" 
            data-speaker-id="${c.id}"
            style="--color: ${c.color}"
          >
            <span class="inline-speaker-dot" style="background: ${c.color}"></span>
            ${c.displayName}
          </button>
        `).join('')}
      </div>
      <div class="inline-editor-text-area">
        <textarea 
          class="inline-editor-textarea" 
          placeholder="What does ${speaker?.displayName || 'this character'} say?"
          autofocus
        >${data.data.text || ''}</textarea>
      </div>
      <div class="inline-editor-hints">
        <div class="inline-hint">
          <kbd>⌘↵</kbd>
          <span>Create next</span>
        </div>
        <div class="inline-hint">
          <kbd>Tab</kbd>
          <span>Branch</span>
        </div>
        <div class="inline-hint">
          <kbd>Esc</kbd>
          <span>Close</span>
        </div>
      </div>
    `;

    this.overlay.appendChild(this.editor);
    document.body.appendChild(this.overlay);

    // Get textarea reference
    this.textarea = this.editor.querySelector('.inline-editor-textarea');

    // Focus and select text
    requestAnimationFrame(() => {
      if (this.textarea) {
        this.textarea.focus();
        this.textarea.select();
      }
    });

    // Setup event listeners
    this.setupListeners();

    // Animate in
    requestAnimationFrame(() => {
      this.overlay?.classList.add('visible');
    });
  }

  private setupListeners(): void {
    if (!this.editor || !this.currentNode) return;

    // Speaker buttons
    this.editor.querySelectorAll('.inline-speaker-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const speakerId = (btn as HTMLElement).dataset.speakerId;
        if (speakerId && this.currentNode) {
          this.callbacks.onSpeakerChange(this.currentNode.id, speakerId);
          // Update UI
          this.editor?.querySelectorAll('.inline-speaker-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
      });
    });

    // Text input
    this.textarea?.addEventListener('input', () => {
      if (this.currentNode && this.textarea) {
        this.callbacks.onTextChange(this.currentNode.id, this.textarea.value);
      }
    });

    // Auto-resize textarea
    this.textarea?.addEventListener('input', () => {
      if (this.textarea) {
        this.textarea.style.height = 'auto';
        this.textarea.style.height = `${Math.min(this.textarea.scrollHeight, 300)}px`;
      }
    });
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.currentNode) return;

    // Cmd+Enter: Create next node
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      
      // Prevent rapid-fire duplicate actions
      if (this.isProcessingAction) return;
      this.isProcessingAction = true;
      
      const nodeId = this.currentNode.id;
      this.hide();
      this.callbacks.onCreateNext(nodeId);
      return;
    }

    // Tab: Create branch
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      
      // Prevent rapid-fire duplicate actions
      if (this.isProcessingAction) return;
      this.isProcessingAction = true;
      
      const nodeId = this.currentNode.id;
      this.hide();
      this.callbacks.onCreateBranch(nodeId);
      return;
    }

    // Escape: Close
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.hide();
      this.callbacks.onClose();
      return;
    }
  }

  private handleClickOutside(e: MouseEvent): void {
    if (this.editor && !this.editor.contains(e.target as HTMLElement)) {
      this.hide();
      this.callbacks.onClose();
    }
  }
}
