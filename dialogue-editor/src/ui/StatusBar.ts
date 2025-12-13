/**
 * Status bar component
 */

export class StatusBar {
  private container: HTMLElement;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Status bar container not found: ${containerId}`);
    this.container = container;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <span class="status-item" id="status-nodes">Nodes: 0</span>
      <span class="status-item" id="status-connections">Connections: 0</span>
      <span class="status-item" id="status-zoom">Zoom: 100%</span>
      <span class="status-item" id="status-selection"></span>
      <span style="flex: 1;"></span>
      <span class="status-item" id="status-message"></span>
    `;
  }

  updateNodeCount(count: number): void {
    const el = document.getElementById('status-nodes');
    if (el) el.textContent = `Nodes: ${count}`;
  }

  updateConnectionCount(count: number): void {
    const el = document.getElementById('status-connections');
    if (el) el.textContent = `Connections: ${count}`;
  }

  updateZoom(zoom: number): void {
    const el = document.getElementById('status-zoom');
    if (el) el.textContent = `Zoom: ${Math.round(zoom * 100)}%`;
  }

  updateSelection(count: number): void {
    const el = document.getElementById('status-selection');
    if (el) {
      el.textContent = count > 0 ? `${count} selected` : '';
    }
  }

  setMessage(message: string, timeout?: number): void {
    const el = document.getElementById('status-message');
    if (el) {
      el.textContent = message;
      if (timeout) {
        setTimeout(() => {
          if (el.textContent === message) {
            el.textContent = '';
          }
        }, timeout);
      }
    }
  }

  clearMessage(): void {
    const el = document.getElementById('status-message');
    if (el) el.textContent = '';
  }
}
