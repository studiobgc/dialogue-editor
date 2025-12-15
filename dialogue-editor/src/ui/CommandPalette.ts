/**
 * Command Palette - Figma-style quick action menu (Cmd+/)
 * 
 * Provides fast access to all actions without memorizing shortcuts
 */

export interface CommandItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  section?: string;
  action: () => void;
  keywords?: string[]; // Additional search terms
}

export interface CommandPaletteConfig {
  commands: CommandItem[];
}

export class CommandPalette {
  private overlay: HTMLElement | null = null;
  private input: HTMLInputElement | null = null;
  private commands: CommandItem[] = [];
  private filteredCommands: CommandItem[] = [];
  private selectedIndex: number = 0;
  private isVisible: boolean = false;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleGlobalKeyDown = this.handleGlobalKeyDown.bind(this);
    
    // Listen for Cmd+/ or Cmd+K to open
    document.addEventListener('keydown', this.handleGlobalKeyDown);
  }

  /**
   * Set the available commands
   */
  setCommands(commands: CommandItem[]): void {
    this.commands = commands;
    this.filteredCommands = [...commands];
  }

  /**
   * Handle global keyboard shortcut to open palette
   */
  private handleGlobalKeyDown(e: KeyboardEvent): void {
    // Cmd+/ or Cmd+K opens the palette
    if ((e.metaKey || e.ctrlKey) && (e.key === '/' || e.key === 'k')) {
      e.preventDefault();
      this.toggle();
    }
  }

  /**
   * Toggle the command palette
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Show the command palette
   */
  show(): void {
    if (this.isVisible) return;
    this.isVisible = true;
    this.selectedIndex = 0;
    this.filteredCommands = [...this.commands];
    this.render();
    
    // Focus input after render
    requestAnimationFrame(() => {
      this.input?.focus();
    });
  }

  /**
   * Hide the command palette
   */
  hide(): void {
    if (!this.isVisible) return;
    this.isVisible = false;
    
    if (this.overlay) {
      this.overlay.classList.remove('visible');
      setTimeout(() => {
        this.overlay?.remove();
        this.overlay = null;
        this.input = null;
      }, 150);
    }
  }

  /**
   * Render the command palette
   */
  private render(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'command-palette-overlay';
    this.overlay.innerHTML = `
      <div class="command-palette">
        <div class="command-palette-input-wrapper">
          <input 
            type="text" 
            class="command-palette-input" 
            placeholder="Type a command or search..."
            autocomplete="off"
            spellcheck="false"
          />
        </div>
        <div class="command-palette-results" id="command-results">
          ${this.renderResults()}
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    // Get input reference
    this.input = this.overlay.querySelector('.command-palette-input') as HTMLInputElement;

    // Setup event listeners
    this.input?.addEventListener('input', () => this.handleInput());
    this.input?.addEventListener('keydown', this.handleKeyDown);
    
    // Click outside to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });

    // Setup result click handlers
    this.setupResultClickHandlers();

    // Animate in
    requestAnimationFrame(() => {
      this.overlay?.classList.add('visible');
    });
  }

  /**
   * Render the results list
   */
  private renderResults(): string {
    if (this.filteredCommands.length === 0) {
      return `
        <div class="command-palette-empty">
          <div class="command-palette-empty-icon">🔍</div>
          <div>No commands found</div>
        </div>
      `;
    }

    // Group by section
    const sections = new Map<string, CommandItem[]>();
    for (const cmd of this.filteredCommands) {
      const section = cmd.section || 'Actions';
      if (!sections.has(section)) {
        sections.set(section, []);
      }
      sections.get(section)!.push(cmd);
    }

    let html = '';
    let globalIndex = 0;

    for (const [sectionName, items] of sections) {
      html += `
        <div class="command-palette-section">
          <div class="command-palette-section-title">${sectionName}</div>
          ${items.map(item => {
            const isSelected = globalIndex === this.selectedIndex;
            const itemHtml = `
              <div class="command-palette-item ${isSelected ? 'selected' : ''}" data-index="${globalIndex}">
                ${item.icon ? `<span class="command-palette-item-icon">${item.icon}</span>` : ''}
                <span class="command-palette-item-label">${item.label}</span>
                ${item.shortcut ? `<span class="command-palette-item-shortcut">${item.shortcut}</span>` : ''}
              </div>
            `;
            globalIndex++;
            return itemHtml;
          }).join('')}
        </div>
      `;
    }

    return html;
  }

  /**
   * Setup click handlers for results
   */
  private setupResultClickHandlers(): void {
    const results = this.overlay?.querySelector('#command-results');
    if (!results) return;

    results.querySelectorAll('.command-palette-item').forEach(el => {
      el.addEventListener('click', () => {
        const index = parseInt((el as HTMLElement).dataset.index || '0');
        this.executeCommand(index);
      });
      el.addEventListener('mouseenter', () => {
        const index = parseInt((el as HTMLElement).dataset.index || '0');
        this.selectedIndex = index;
        this.updateSelection();
      });
    });
  }

  /**
   * Handle input changes
   */
  private handleInput(): void {
    const query = this.input?.value.toLowerCase() || '';
    
    if (!query) {
      this.filteredCommands = [...this.commands];
    } else {
      this.filteredCommands = this.commands.filter(cmd => {
        const labelMatch = cmd.label.toLowerCase().includes(query);
        const keywordMatch = cmd.keywords?.some(k => k.toLowerCase().includes(query));
        return labelMatch || keywordMatch;
      });
    }

    this.selectedIndex = 0;
    this.updateResults();
  }

  /**
   * Handle keyboard navigation
   */
  private handleKeyDown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % this.filteredCommands.length;
        this.updateSelection();
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + this.filteredCommands.length) % this.filteredCommands.length;
        this.updateSelection();
        break;
      
      case 'Enter':
        e.preventDefault();
        this.executeCommand(this.selectedIndex);
        break;
      
      case 'Escape':
        e.preventDefault();
        this.hide();
        break;
    }
  }

  /**
   * Update the results display
   */
  private updateResults(): void {
    const results = this.overlay?.querySelector('#command-results');
    if (results) {
      results.innerHTML = this.renderResults();
      this.setupResultClickHandlers();
    }
  }

  /**
   * Update selection highlight
   */
  private updateSelection(): void {
    const items = this.overlay?.querySelectorAll('.command-palette-item');
    items?.forEach((el, i) => {
      el.classList.toggle('selected', i === this.selectedIndex);
    });

    // Scroll selected item into view
    const selected = this.overlay?.querySelector('.command-palette-item.selected');
    selected?.scrollIntoView({ block: 'nearest' });
  }

  /**
   * Execute a command
   */
  private executeCommand(index: number): void {
    const cmd = this.filteredCommands[index];
    if (cmd) {
      this.hide();
      // Execute after hide animation
      setTimeout(() => {
        cmd.action();
      }, 50);
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    document.removeEventListener('keydown', this.handleGlobalKeyDown);
    this.hide();
  }
}

/**
 * Create default commands for the dialogue editor
 */
export function createDefaultCommands(callbacks: {
  onNewProject: () => void;
  onSaveProject: () => void;
  onOpenProject: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onSelectAll: () => void;
  onFitView: () => void;
  onResetView: () => void;
  onAddDialogue: () => void;
  onAddBranch: () => void;
  onAddCondition: () => void;
  onShowHelp: () => void;
  onShowProjects: () => void;
}): CommandItem[] {
  return [
    // File operations
    {
      id: 'new-project',
      label: 'New Project',
      icon: '📄',
      shortcut: '⌘N',
      section: 'File',
      action: callbacks.onNewProject,
      keywords: ['create', 'new', 'project']
    },
    {
      id: 'save-project',
      label: 'Save Project',
      icon: '💾',
      shortcut: '⌘S',
      section: 'File',
      action: callbacks.onSaveProject,
      keywords: ['save', 'export']
    },
    {
      id: 'open-project',
      label: 'Open Project',
      icon: '📂',
      shortcut: '⌘O',
      section: 'File',
      action: callbacks.onOpenProject,
      keywords: ['open', 'load', 'import']
    },
    {
      id: 'projects',
      label: 'Browse Projects',
      icon: '📁',
      section: 'File',
      action: callbacks.onShowProjects,
      keywords: ['projects', 'browse', 'list']
    },
    {
      id: 'export',
      label: 'Export for Engine',
      icon: '📤',
      section: 'File',
      action: callbacks.onExport,
      keywords: ['export', 'unreal', 'unity', 'json']
    },

    // Edit operations
    {
      id: 'undo',
      label: 'Undo',
      icon: '↩️',
      shortcut: '⌘Z',
      section: 'Edit',
      action: callbacks.onUndo,
      keywords: ['undo', 'back']
    },
    {
      id: 'redo',
      label: 'Redo',
      icon: '↪️',
      shortcut: '⌘⇧Z',
      section: 'Edit',
      action: callbacks.onRedo,
      keywords: ['redo', 'forward']
    },
    {
      id: 'delete',
      label: 'Delete Selected',
      icon: '🗑️',
      shortcut: 'Del',
      section: 'Edit',
      action: callbacks.onDelete,
      keywords: ['delete', 'remove']
    },
    {
      id: 'select-all',
      label: 'Select All',
      icon: '☑️',
      shortcut: '⌘A',
      section: 'Edit',
      action: callbacks.onSelectAll,
      keywords: ['select', 'all']
    },

    // Add nodes
    {
      id: 'add-dialogue',
      label: 'Add Dialogue Node',
      icon: '💬',
      section: 'Add Node',
      action: callbacks.onAddDialogue,
      keywords: ['dialogue', 'speech', 'text', 'add']
    },
    {
      id: 'add-branch',
      label: 'Add Branch Node',
      icon: '◇',
      section: 'Add Node',
      action: callbacks.onAddBranch,
      keywords: ['branch', 'choice', 'decision', 'add']
    },
    {
      id: 'add-condition',
      label: 'Add Condition Node',
      icon: '❓',
      section: 'Add Node',
      action: callbacks.onAddCondition,
      keywords: ['condition', 'if', 'check', 'add']
    },

    // View
    {
      id: 'fit-view',
      label: 'Fit to Content',
      icon: '⊡',
      section: 'View',
      action: callbacks.onFitView,
      keywords: ['fit', 'zoom', 'center']
    },
    {
      id: 'reset-view',
      label: 'Reset View',
      icon: '⟲',
      section: 'View',
      action: callbacks.onResetView,
      keywords: ['reset', 'home']
    },

    // Help
    {
      id: 'help',
      label: 'Show Welcome / Help',
      icon: '❓',
      section: 'Help',
      action: callbacks.onShowHelp,
      keywords: ['help', 'welcome', 'tutorial', 'guide']
    }
  ];
}
