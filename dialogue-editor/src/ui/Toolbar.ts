/**
 * Toolbar UI component
 */

export interface ToolbarAction {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
}

export class Toolbar {
  private container: HTMLElement;
  private actions: Map<string, ToolbarAction> = new Map();
  private elements: Map<string, HTMLElement> = new Map();

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Toolbar container not found: ${containerId}`);
    this.container = container;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <span class="toolbar-title">Dialogue Editor</span>
      <div class="toolbar-actions" id="toolbar-actions"></div>
    `;
  }

  addAction(action: ToolbarAction): void {
    this.actions.set(action.id, action);
    this.renderAction(action);
  }

  addSeparator(): void {
    const actionsContainer = document.getElementById('toolbar-actions');
    if (!actionsContainer) return;

    const separator = document.createElement('div');
    separator.className = 'toolbar-separator';
    actionsContainer.appendChild(separator);
  }

  private renderAction(action: ToolbarAction): void {
    const actionsContainer = document.getElementById('toolbar-actions');
    if (!actionsContainer) return;

    const button = document.createElement('button');
    button.className = 'toolbar-button';
    button.id = `toolbar-${action.id}`;
    button.disabled = action.disabled || false;
    
    // Add tooltip with shortcut
    if (action.shortcut) {
      button.setAttribute('data-tooltip', `${action.label} (${action.shortcut})`);
    } else {
      button.setAttribute('data-tooltip', action.label);
    }
    
    let content = '';
    if (action.icon) {
      content += `<span class="toolbar-icon">${action.icon}</span>`;
    }
    content += `<span class="toolbar-label">${action.label}</span>`;
    
    button.innerHTML = content;
    button.addEventListener('click', action.onClick);
    
    actionsContainer.appendChild(button);
    this.elements.set(action.id, button);
  }

  updateAction(id: string, updates: Partial<ToolbarAction>): void {
    const action = this.actions.get(id);
    const element = this.elements.get(id);
    
    if (action && element) {
      Object.assign(action, updates);
      
      if (updates.disabled !== undefined) {
        (element as HTMLButtonElement).disabled = updates.disabled;
      }
      if (updates.label !== undefined) {
        const labelEl = element.querySelector('.toolbar-label');
        if (labelEl) labelEl.textContent = updates.label;
      }
    }
  }

  setTitle(title: string): void {
    const titleEl = this.container.querySelector('.toolbar-title');
    if (titleEl) titleEl.textContent = title;
  }
}
