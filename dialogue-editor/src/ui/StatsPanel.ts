/**
 * StatsPanel - Real-time statistics dashboard for dialogue graphs
 * 
 * Pro features:
 * - Word count per character
 * - Estimated playtime
 * - Branch depth analysis
 * - Dead-end detection
 * - Orphaned node detection
 */

import { GraphModel } from '../core/GraphModel';
import { Node, Connection } from '../types/graph';

export interface GraphStats {
  totalNodes: number;
  totalConnections: number;
  totalWords: number;
  estimatedMinutes: number;
  charactersWordCount: Record<string, { name: string; words: number; lines: number }>;
  maxBranchDepth: number;
  deadEnds: string[];
  orphanedNodes: string[];
  hubCount: number;
  conditionCount: number;
}

export class StatsPanel {
  private model: GraphModel;
  private panel: HTMLElement | null = null;
  private isVisible: boolean = false;

  constructor(model: GraphModel) {
    this.model = model;
  }

  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  show(): void {
    this.isVisible = true;
    this.render();
  }

  hide(): void {
    this.isVisible = false;
    if (this.panel) {
      this.panel.classList.add('stats-panel-hide');
      setTimeout(() => {
        this.panel?.remove();
        this.panel = null;
      }, 200);
    }
  }

  private render(): void {
    if (this.panel) this.panel.remove();

    const stats = this.calculateStats();

    this.panel = document.createElement('div');
    this.panel.className = 'stats-panel';
    this.panel.innerHTML = `
      <div class="stats-header">
        <h3>📊 Statistics</h3>
        <button class="stats-close" id="stats-close">×</button>
      </div>
      
      <div class="stats-section">
        <h4>Overview</h4>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-value">${stats.totalNodes}</span>
            <span class="stat-label">Nodes</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${stats.totalWords.toLocaleString()}</span>
            <span class="stat-label">Words</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${stats.estimatedMinutes}</span>
            <span class="stat-label">Est. Minutes</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${stats.maxBranchDepth}</span>
            <span class="stat-label">Max Depth</span>
          </div>
        </div>
      </div>

      <div class="stats-section">
        <h4>By Character</h4>
        <div class="stats-characters">
          ${Object.values(stats.charactersWordCount)
            .sort((a, b) => b.words - a.words)
            .map(c => `
              <div class="stat-character">
                <span class="stat-char-name">${c.name}</span>
                <span class="stat-char-stats">${c.lines} lines, ${c.words} words</span>
              </div>
            `).join('') || '<div class="stat-empty">No dialogue yet</div>'}
        </div>
      </div>

      <div class="stats-section">
        <h4>Structure</h4>
        <div class="stats-structure">
          <div class="stat-row">
            <span>Choice Points (Hubs)</span>
            <span class="stat-badge">${stats.hubCount}</span>
          </div>
          <div class="stat-row">
            <span>Conditions</span>
            <span class="stat-badge">${stats.conditionCount}</span>
          </div>
          <div class="stat-row ${stats.deadEnds.length > 0 ? 'stat-warning' : ''}">
            <span>Dead Ends</span>
            <span class="stat-badge">${stats.deadEnds.length}</span>
          </div>
          <div class="stat-row ${stats.orphanedNodes.length > 0 ? 'stat-warning' : ''}">
            <span>Orphaned Nodes</span>
            <span class="stat-badge">${stats.orphanedNodes.length}</span>
          </div>
        </div>
      </div>

      ${stats.deadEnds.length > 0 ? `
        <div class="stats-section stats-issues">
          <h4>⚠️ Dead Ends</h4>
          <div class="stats-issue-list">
            ${stats.deadEnds.slice(0, 5).map(id => `<code>${id}</code>`).join(', ')}
            ${stats.deadEnds.length > 5 ? `<span class="stat-more">+${stats.deadEnds.length - 5} more</span>` : ''}
          </div>
        </div>
      ` : ''}
    `;

    document.body.appendChild(this.panel);

    this.panel.querySelector('#stats-close')?.addEventListener('click', () => this.hide());

    requestAnimationFrame(() => {
      this.panel?.classList.add('stats-panel-visible');
    });
  }

  calculateStats(): GraphStats {
    const nodes = this.model.getNodes();
    const connections = this.model.getConnections();
    const characters = this.model.getCharacters();

    // Build character lookup
    const charMap = new Map(characters.map(c => [c.id, c]));
    const charactersWordCount: Record<string, { name: string; words: number; lines: number }> = {};

    let totalWords = 0;
    let hubCount = 0;
    let conditionCount = 0;

    // Analyze nodes
    for (const node of nodes) {
      if (node.nodeType === 'hub' || node.nodeType === 'branch') {
        hubCount++;
      }
      if (node.nodeType === 'condition') {
        conditionCount++;
      }

      // Count words per character
      if (node.nodeType === 'dialogue' || node.nodeType === 'dialogueFragment') {
        const data = node.data as { data: { speaker?: string; text?: string } };
        const text = data.data.text || '';
        const words = text.split(/\s+/).filter(w => w.length > 0).length;
        const speakerId = data.data.speaker || 'unknown';
        
        totalWords += words;

        if (!charactersWordCount[speakerId]) {
          const char = charMap.get(speakerId);
          charactersWordCount[speakerId] = {
            name: char?.displayName || speakerId,
            words: 0,
            lines: 0
          };
        }
        charactersWordCount[speakerId].words += words;
        charactersWordCount[speakerId].lines += 1;
      }
    }

    // Find dead ends (nodes with no outgoing connections that aren't end nodes)
    const hasOutgoing = new Set(connections.map(c => c.fromNodeId));
    const deadEnds = nodes
      .filter(n => !hasOutgoing.has(n.id) && n.nodeType !== 'jump')
      .map(n => n.id);

    // Find orphaned nodes (no incoming connections and not start nodes)
    const hasIncoming = new Set(connections.map(c => c.toNodeId));
    const orphanedNodes = nodes
      .filter(n => !hasIncoming.has(n.id))
      .slice(1) // Skip first node (likely start)
      .map(n => n.id);

    // Calculate max branch depth
    const maxBranchDepth = this.calculateMaxDepth(nodes, connections);

    // Estimate playtime: ~150 words per minute for voiced dialogue
    const estimatedMinutes = Math.ceil(totalWords / 150);

    return {
      totalNodes: nodes.length,
      totalConnections: connections.length,
      totalWords,
      estimatedMinutes,
      charactersWordCount,
      maxBranchDepth,
      deadEnds,
      orphanedNodes,
      hubCount,
      conditionCount
    };
  }

  private calculateMaxDepth(nodes: Node[], connections: Connection[]): number {
    if (nodes.length === 0) return 0;

    // Build adjacency list
    const adj = new Map<string, string[]>();
    for (const conn of connections) {
      if (!adj.has(conn.fromNodeId)) adj.set(conn.fromNodeId, []);
      adj.get(conn.fromNodeId)!.push(conn.toNodeId);
    }

    // Find start nodes (no incoming)
    const hasIncoming = new Set(connections.map(c => c.toNodeId));
    const startNodes = nodes.filter(n => !hasIncoming.has(n.id));

    // BFS to find max depth
    let maxDepth = 0;
    const visited = new Set<string>();

    for (const start of startNodes) {
      const queue: [string, number][] = [[start.id, 0]];
      
      while (queue.length > 0) {
        const [nodeId, depth] = queue.shift()!;
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);
        
        maxDepth = Math.max(maxDepth, depth);
        
        const neighbors = adj.get(nodeId) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            queue.push([neighbor, depth + 1]);
          }
        }
      }
    }

    return maxDepth;
  }
}
