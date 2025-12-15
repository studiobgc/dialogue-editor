/**
 * Coachmarks - Contextual onboarding hints
 * Progressive disclosure: teach users as they work, not all at once
 * 
 * "The interface should teach you how to use it at every step"
 */

export interface CoachmarkStep {
  id: string;
  title: string;
  text: string;
  target?: string; // CSS selector or 'canvas' for canvas-relative positioning
  position: 'top' | 'bottom' | 'left' | 'right';
  offset?: { x: number; y: number };
  condition?: () => boolean; // Show only if this returns true
  showOnce?: boolean; // Only show once ever
  delay?: number; // Delay before showing (ms)
}

const COACHMARK_STEPS: CoachmarkStep[] = [
  {
    id: 'welcome-drag',
    title: '👋 Welcome!',
    text: 'Drag nodes from the left panel onto the canvas to start building your dialogue.',
    target: '#palette',
    position: 'right',
    showOnce: true,
    delay: 500
  },
  {
    id: 'first-node-created',
    title: '✨ Great start!',
    text: 'Now drag from the → on the right side of your node to create what happens next.',
    target: 'canvas',
    position: 'bottom',
    showOnce: true
  },
  {
    id: 'drag-to-create',
    title: '💡 Pro tip: Drag to Create',
    text: 'Drag from any output port into empty space to quickly create connected nodes. No more blank page anxiety!',
    target: 'canvas',
    position: 'bottom',
    showOnce: true
  },
  {
    id: 'first-branch',
    title: '🌳 Branching paths',
    text: 'Branch nodes let players make choices. Each output goes to a different path.',
    target: 'canvas',
    position: 'bottom',
    showOnce: true
  },
  {
    id: 'keyboard-shortcuts',
    title: '⌨️ Keyboard shortcuts',
    text: 'Press Cmd+/ to open the command palette for quick actions. Delete to remove selected nodes.',
    target: '#toolbar',
    position: 'bottom',
    showOnce: true,
    delay: 30000 // Show after 30 seconds of use
  },
  {
    id: 'properties-panel',
    title: '📝 Edit properties',
    text: 'Select a node to edit its text, speaker, and other properties in this panel.',
    target: '#properties-panel',
    position: 'left',
    showOnce: true
  }
];

const STORAGE_KEY = 'dialogue-editor-coachmarks-seen';

export class Coachmarks {
  private seenCoachmarks: Set<string> = new Set();
  private currentCoachmark: HTMLElement | null = null;
  private scheduledTimeouts: number[] = [];
  private isEnabled: boolean = true;
  private nodeCount: number = 0;
  private hasCreatedBranch: boolean = false;

  constructor() {
    this.loadSeenState();
  }

  private loadSeenState(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.seenCoachmarks = new Set(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to load coachmarks state:', e);
    }
  }

  private saveSeenState(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.seenCoachmarks]));
    } catch (e) {
      console.warn('Failed to save coachmarks state:', e);
    }
  }

  /**
   * Enable/disable coachmarks
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.dismiss();
    }
  }

  /**
   * Reset all seen coachmarks (for testing or user preference)
   */
  reset(): void {
    this.seenCoachmarks.clear();
    this.saveSeenState();
  }

  /**
   * Trigger a specific coachmark by event
   */
  trigger(event: 'app-loaded' | 'node-created' | 'connection-created' | 'branch-created' | 'node-selected'): void {
    if (!this.isEnabled) return;

    switch (event) {
      case 'app-loaded':
        this.scheduleCoachmark('welcome-drag');
        this.scheduleCoachmark('keyboard-shortcuts');
        break;
      
      case 'node-created':
        this.nodeCount++;
        if (this.nodeCount === 1) {
          this.scheduleCoachmark('first-node-created', 800);
        }
        if (this.nodeCount === 3) {
          this.scheduleCoachmark('drag-to-create', 1000);
        }
        break;
      
      case 'branch-created':
        if (!this.hasCreatedBranch) {
          this.hasCreatedBranch = true;
          this.scheduleCoachmark('first-branch', 500);
        }
        break;
      
      case 'node-selected':
        if (this.nodeCount >= 1) {
          this.scheduleCoachmark('properties-panel', 300);
        }
        break;
    }
  }

  /**
   * Schedule a coachmark to show
   */
  private scheduleCoachmark(id: string, delay?: number): void {
    const step = COACHMARK_STEPS.find(s => s.id === id);
    if (!step) return;

    // Check if already seen
    if (step.showOnce && this.seenCoachmarks.has(id)) return;

    // Check condition
    if (step.condition && !step.condition()) return;

    const actualDelay = delay ?? step.delay ?? 0;

    if (actualDelay > 0) {
      const timeout = window.setTimeout(() => {
        this.show(step);
      }, actualDelay);
      this.scheduledTimeouts.push(timeout);
    } else {
      this.show(step);
    }
  }

  /**
   * Show a coachmark
   */
  private show(step: CoachmarkStep): void {
    // Dismiss any existing coachmark
    this.dismiss();

    // Mark as seen
    if (step.showOnce) {
      this.seenCoachmarks.add(step.id);
      this.saveSeenState();
    }

    // Create coachmark element
    this.currentCoachmark = document.createElement('div');
    this.currentCoachmark.className = `coachmark arrow-${this.getArrowDirection(step.position)}`;
    this.currentCoachmark.innerHTML = `
      <div class="coachmark-content">
        <div class="coachmark-title">${step.title}</div>
        <div class="coachmark-text">${step.text}</div>
        <div class="coachmark-actions">
          <button class="coachmark-dismiss">Got it</button>
        </div>
      </div>
    `;

    // Position the coachmark
    this.positionCoachmark(step);

    // Add to DOM
    document.body.appendChild(this.currentCoachmark);

    // Setup dismiss handler
    this.currentCoachmark.querySelector('.coachmark-dismiss')?.addEventListener('click', () => {
      this.dismiss();
    });

    // Auto-dismiss after 10 seconds
    const autoDismiss = window.setTimeout(() => {
      this.dismiss();
    }, 10000);
    this.scheduledTimeouts.push(autoDismiss);
  }

  /**
   * Position the coachmark relative to its target
   */
  private positionCoachmark(step: CoachmarkStep): void {
    if (!this.currentCoachmark) return;

    let targetRect: DOMRect | null = null;

    if (step.target === 'canvas') {
      const canvas = document.getElementById('canvas-container');
      if (canvas) {
        targetRect = canvas.getBoundingClientRect();
        // Center in canvas
        targetRect = new DOMRect(
          targetRect.left + targetRect.width / 2 - 140,
          targetRect.top + targetRect.height / 2,
          280,
          0
        );
      }
    } else if (step.target) {
      const el = document.querySelector(step.target);
      if (el) {
        targetRect = el.getBoundingClientRect();
      }
    }

    if (!targetRect) {
      // Fallback to center of screen
      this.currentCoachmark.style.left = '50%';
      this.currentCoachmark.style.top = '50%';
      this.currentCoachmark.style.transform = 'translate(-50%, -50%)';
      return;
    }

    const offset = step.offset || { x: 0, y: 0 };

    switch (step.position) {
      case 'top':
        this.currentCoachmark.style.left = `${targetRect.left + targetRect.width / 2 + offset.x}px`;
        this.currentCoachmark.style.top = `${targetRect.top - 20 + offset.y}px`;
        this.currentCoachmark.style.transform = 'translate(-50%, -100%)';
        break;
      case 'bottom':
        this.currentCoachmark.style.left = `${targetRect.left + targetRect.width / 2 + offset.x}px`;
        this.currentCoachmark.style.top = `${targetRect.bottom + 20 + offset.y}px`;
        this.currentCoachmark.style.transform = 'translate(-50%, 0)';
        break;
      case 'left':
        this.currentCoachmark.style.left = `${targetRect.left - 20 + offset.x}px`;
        this.currentCoachmark.style.top = `${targetRect.top + targetRect.height / 2 + offset.y}px`;
        this.currentCoachmark.style.transform = 'translate(-100%, -50%)';
        break;
      case 'right':
        this.currentCoachmark.style.left = `${targetRect.right + 20 + offset.x}px`;
        this.currentCoachmark.style.top = `${targetRect.top + targetRect.height / 2 + offset.y}px`;
        this.currentCoachmark.style.transform = 'translate(0, -50%)';
        break;
    }
  }

  private getArrowDirection(position: string): string {
    switch (position) {
      case 'top': return 'bottom';
      case 'bottom': return 'top';
      case 'left': return 'right';
      case 'right': return 'left';
      default: return 'top';
    }
  }

  /**
   * Dismiss the current coachmark
   */
  dismiss(): void {
    if (this.currentCoachmark) {
      this.currentCoachmark.remove();
      this.currentCoachmark = null;
    }

    // Clear scheduled timeouts
    this.scheduledTimeouts.forEach(t => clearTimeout(t));
    this.scheduledTimeouts = [];
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.dismiss();
  }
}
