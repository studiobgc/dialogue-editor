/**
 * Toast - Beautiful notification system for the dialogue editor
 * 
 * Used for:
 * - MCP/AI change notifications
 * - Auto-save confirmations
 * - Errors and warnings
 */

export type ToastType = 'ai' | 'save' | 'success' | 'warning' | 'error' | 'info';

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  icon?: string;
  action?: { label: string; onClick: () => void };
}

interface ActiveToast {
  element: HTMLElement;
  timeout: number;
}

export class Toast {
  private container: HTMLElement;
  private activeToasts: ActiveToast[] = [];

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
  }

  show(options: ToastOptions): void {
    const { 
      message, 
      type = 'info', 
      duration = 3000, 
      icon,
      action 
    } = options;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const defaultIcons: Record<ToastType, string> = {
      ai: '✨',
      save: '💾',
      success: '✓',
      warning: '⚠️',
      error: '✕',
      info: 'ℹ️'
    };

    toast.innerHTML = `
      <span class="toast-icon">${icon || defaultIcons[type]}</span>
      <span class="toast-message">${message}</span>
      ${action ? `<button class="toast-action">${action.label}</button>` : ''}
    `;

    if (action) {
      toast.querySelector('.toast-action')?.addEventListener('click', () => {
        action.onClick();
        this.dismiss(toast);
      });
    }

    this.container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('toast-visible');
    });

    // Auto dismiss
    const timeout = window.setTimeout(() => {
      this.dismiss(toast);
    }, duration);

    this.activeToasts.push({ element: toast, timeout });
  }

  private dismiss(toast: HTMLElement): void {
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-hide');
    
    setTimeout(() => {
      toast.remove();
      this.activeToasts = this.activeToasts.filter(t => t.element !== toast);
    }, 300);
  }

  // Convenience methods
  ai(message: string, duration = 2000): void {
    this.show({ message, type: 'ai', duration });
  }

  save(message: string = 'Saved', duration = 1500): void {
    this.show({ message, type: 'save', duration });
  }

  success(message: string): void {
    this.show({ message, type: 'success' });
  }

  warning(message: string): void {
    this.show({ message, type: 'warning', duration: 4000 });
  }

  error(message: string): void {
    this.show({ message, type: 'error', duration: 5000 });
  }
}

// Singleton instance
export const toast = new Toast();
