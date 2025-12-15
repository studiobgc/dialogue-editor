/**
 * Quick Create Menu - appears when dragging from a port into empty space
 * Inspired by Articy:Draft's "drag to create" feature
 * 
 * "Writers hate a blank page" - this ensures you're always extending from something
 */

import { NodeType, Character } from '../types/graph';

export interface QuickCreateOption {
  id: string;
  type: NodeType;
  label: string;
  icon: string;
  description?: string;
  preset?: {
    speakerId?: string;
    text?: string;
  };
  separator?: boolean;
}

export interface QuickCreateConfig {
  position: { x: number; y: number };
  sourceNodeId: string;
  sourcePortIndex: number;
  characters: Character[];
  lastSpeakerId?: string;
  onSelect: (option: QuickCreateOption) => void;
  onCancel: () => void;
}

export class QuickCreateMenu {
  private overlay: HTMLElement | null = null;
  private menu: HTMLElement | null = null;
  private config: QuickCreateConfig | null = null;
  private selectedIndex: number = 0;
  private options: QuickCreateOption[] = [];

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleClickOutside = this.handleClickOutside.bind(this);
  }

  show(config: QuickCreateConfig): void {
    this.config = config;
    this.options = this.buildOptions(config);
    this.selectedIndex = 0;
    this.render();
    
    // Add event listeners
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('mousedown', this.handleClickOutside);
  }

  hide(): void {
    if (this.overlay) {
      this.overlay.classList.add('fade-out');
      setTimeout(() => {
        this.overlay?.remove();
        this.overlay = null;
        this.menu = null;
      }, 150);
    }
    
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('mousedown', this.handleClickOutside);
    this.config = null;
  }

  private buildOptions(config: QuickCreateConfig): QuickCreateOption[] {
    const options: QuickCreateOption[] = [];

    // Section: Continue dialogue
    options.push({
      id: 'dialogue-continue',
      type: 'dialogueFragment',
      label: 'Continue dialogue',
      icon: '💬',
      description: 'Same speaker continues',
      preset: config.lastSpeakerId ? { speakerId: config.lastSpeakerId } : undefined
    });

    // Character-specific options
    if (config.characters.length > 0) {
      options.push({
        id: 'separator-1',
        type: 'dialogueFragment',
        label: '',
        icon: '',
        separator: true
      });

      for (const char of config.characters.slice(0, 5)) { // Limit to 5 characters
        options.push({
          id: `dialogue-${char.id}`,
          type: 'dialogueFragment',
          label: `${char.displayName} speaks`,
          icon: '💬',
          description: `Switch to ${char.displayName}`,
          preset: { speakerId: char.id }
        });
      }
    }

    // Section: Flow control
    options.push({
      id: 'separator-2',
      type: 'dialogueFragment',
      label: '',
      icon: '',
      separator: true
    });

    options.push({
      id: 'branch',
      type: 'branch',
      label: 'Player choice',
      icon: '◇',
      description: 'Branch into multiple options'
    });

    options.push({
      id: 'condition',
      type: 'condition',
      label: 'Condition',
      icon: '❓',
      description: 'Check a variable or state'
    });

    options.push({
      id: 'instruction',
      type: 'instruction',
      label: 'Action',
      icon: '⚡',
      description: 'Execute game logic'
    });

    // Section: Navigation
    options.push({
      id: 'separator-3',
      type: 'dialogueFragment',
      label: '',
      icon: '',
      separator: true
    });

    options.push({
      id: 'hub',
      type: 'hub',
      label: 'Hub',
      icon: '○',
      description: 'Merge multiple paths'
    });

    options.push({
      id: 'jump',
      type: 'jump',
      label: 'Jump',
      icon: '↗',
      description: 'Jump to another location'
    });

    return options;
  }

  private render(): void {
    if (!this.config) return;

    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'quick-create-overlay';

    // Create menu
    this.menu = document.createElement('div');
    this.menu.className = 'quick-create-menu';
    
    // Position menu at cursor
    const menuWidth = 260;
    const menuHeight = 400; // Approximate
    let x = this.config.position.x;
    let y = this.config.position.y;

    // Keep menu on screen
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 20;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 20;
    }

    this.menu.style.left = `${x}px`;
    this.menu.style.top = `${y}px`;

    // Build menu HTML
    this.menu.innerHTML = `
      <div class="quick-create-header">
        <span class="quick-create-title">What happens next?</span>
        <span class="quick-create-hint">↑↓ to navigate, Enter to select</span>
      </div>
      <div class="quick-create-options">
        ${this.options.map((opt, i) => this.renderOption(opt, i)).join('')}
      </div>
      <div class="quick-create-footer">
        <span class="quick-create-shortcut">Esc to cancel</span>
      </div>
    `;

    this.overlay.appendChild(this.menu);
    document.body.appendChild(this.overlay);

    // Setup option click handlers
    this.menu.querySelectorAll('.quick-create-option').forEach((el, i) => {
      el.addEventListener('click', () => {
        const option = this.options.filter(o => !o.separator)[i];
        if (option) this.selectOption(option);
      });
      el.addEventListener('mouseenter', () => {
        this.selectedIndex = i;
        this.updateSelection();
      });
    });

    // Animate in
    requestAnimationFrame(() => {
      this.overlay?.classList.add('visible');
    });
  }

  private renderOption(option: QuickCreateOption, index: number): string {
    if (option.separator) {
      return '<div class="quick-create-separator"></div>';
    }

    const isSelected = this.getSelectableIndex(index) === this.selectedIndex;
    
    return `
      <div class="quick-create-option ${isSelected ? 'selected' : ''}" data-index="${index}">
        <span class="quick-create-option-icon">${option.icon}</span>
        <div class="quick-create-option-content">
          <span class="quick-create-option-label">${option.label}</span>
          ${option.description ? `<span class="quick-create-option-desc">${option.description}</span>` : ''}
        </div>
      </div>
    `;
  }

  private getSelectableIndex(optionIndex: number): number {
    // Convert option index to selectable index (skip separators)
    let selectableIndex = 0;
    for (let i = 0; i < optionIndex; i++) {
      if (!this.options[i].separator) selectableIndex++;
    }
    return selectableIndex;
  }

  private getSelectableOptions(): QuickCreateOption[] {
    return this.options.filter(o => !o.separator);
  }

  private updateSelection(): void {
    if (!this.menu) return;

    const options = this.menu.querySelectorAll('.quick-create-option');
    options.forEach((el, i) => {
      el.classList.toggle('selected', i === this.selectedIndex);
    });
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const selectableOptions = this.getSelectableOptions();

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % selectableOptions.length;
        this.updateSelection();
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + selectableOptions.length) % selectableOptions.length;
        this.updateSelection();
        break;
      
      case 'Enter':
        e.preventDefault();
        const option = selectableOptions[this.selectedIndex];
        if (option) this.selectOption(option);
        break;
      
      case 'Escape':
        e.preventDefault();
        this.cancel();
        break;
      
      // Quick shortcuts
      case 'd':
      case 'D':
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          const dialogueOption = selectableOptions.find(o => o.id === 'dialogue-continue');
          if (dialogueOption) this.selectOption(dialogueOption);
        }
        break;
      
      case 'b':
      case 'B':
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          const branchOption = selectableOptions.find(o => o.id === 'branch');
          if (branchOption) this.selectOption(branchOption);
        }
        break;
      
      case 'c':
      case 'C':
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          const conditionOption = selectableOptions.find(o => o.id === 'condition');
          if (conditionOption) this.selectOption(conditionOption);
        }
        break;
    }
  }

  private handleClickOutside(e: MouseEvent): void {
    if (this.menu && !this.menu.contains(e.target as Node)) {
      this.cancel();
    }
  }

  private selectOption(option: QuickCreateOption): void {
    if (this.config?.onSelect) {
      this.config.onSelect(option);
    }
    this.hide();
  }

  private cancel(): void {
    if (this.config?.onCancel) {
      this.config.onCancel();
    }
    this.hide();
  }
}
