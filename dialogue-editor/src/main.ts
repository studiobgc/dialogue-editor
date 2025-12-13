/**
 * Main entry point for the Dialogue Editor
 */

import { GraphModel } from './core/GraphModel';
import { GraphRenderer } from './renderer/GraphRenderer';
import { InteractionManager } from './editor/InteractionManager';
import { Toolbar } from './ui/Toolbar';
import { Palette } from './ui/Palette';
import { PropertiesPanel } from './ui/PropertiesPanel';
import { ContextMenu } from './ui/ContextMenu';
import { StatusBar } from './ui/StatusBar';
import { Node, NodeType, Position } from './types/graph';
import { NodeFactory } from './core/NodeFactory';

class DialogueEditor {
  private model: GraphModel;
  private renderer: GraphRenderer;
  private interaction: InteractionManager;
  private toolbar: Toolbar;
  private palette: Palette;
  private propertiesPanel: PropertiesPanel;
  private contextMenu: ContextMenu;
  private statusBar: StatusBar;
  private canvas: HTMLCanvasElement;

  constructor() {
    // Get canvas element
    this.canvas = document.getElementById('graph-canvas') as HTMLCanvasElement;
    if (!this.canvas) throw new Error('Canvas element not found');

    // Initialize core components
    this.model = new GraphModel();
    this.renderer = new GraphRenderer(this.canvas);
    
    // Initialize interaction manager with callbacks
    this.interaction = new InteractionManager(
      this.canvas,
      this.model,
      this.renderer,
      {
        onNodeSelected: this.onNodeSelected.bind(this),
        onNodeDoubleClick: this.onNodeDoubleClick.bind(this),
        onContextMenu: this.onContextMenu.bind(this),
        onNodeCreated: this.onNodeCreated.bind(this),
        onConnectionCreated: this.onConnectionCreated.bind(this)
      }
    );

    // Initialize UI components
    this.toolbar = new Toolbar('toolbar');
    this.palette = new Palette('palette', this.onPaletteDrop.bind(this));
    this.propertiesPanel = new PropertiesPanel('properties-panel', this.onPropertyChange.bind(this));
    this.contextMenu = new ContextMenu();
    this.statusBar = new StatusBar('status-bar');

    // Setup toolbar actions
    this.setupToolbar();

    // Setup window resize handler
    window.addEventListener('resize', this.onResize.bind(this));

    // Listen to model changes
    this.model.addListener(this.onModelChange.bind(this));

    // Initial render
    this.render();
    this.updateStatusBar();

    // Add some demo content
    this.createDemoContent();
  }

  private setupToolbar(): void {
    this.toolbar.addAction({
      id: 'new',
      label: 'New',
      onClick: () => this.newProject()
    });

    this.toolbar.addAction({
      id: 'save',
      label: 'Save',
      onClick: () => this.saveProject()
    });

    this.toolbar.addAction({
      id: 'load',
      label: 'Load',
      onClick: () => this.loadProject()
    });

    this.toolbar.addSeparator();

    this.toolbar.addAction({
      id: 'undo',
      label: 'Undo',
      onClick: () => {
        this.model.undo();
        this.render();
      }
    });

    this.toolbar.addAction({
      id: 'redo',
      label: 'Redo',
      onClick: () => {
        this.model.redo();
        this.render();
      }
    });

    this.toolbar.addSeparator();

    this.toolbar.addAction({
      id: 'validate',
      label: 'Validate',
      onClick: () => this.validateGraph()
    });

    this.toolbar.addAction({
      id: 'export',
      label: 'Export',
      onClick: () => this.exportProject()
    });

    this.toolbar.addSeparator();

    this.toolbar.addAction({
      id: 'fit',
      label: 'Fit View',
      onClick: () => this.fitView()
    });

    this.toolbar.addAction({
      id: 'reset-view',
      label: 'Reset View',
      onClick: () => {
        this.renderer.getViewport().reset();
        this.render();
      }
    });
  }

  private onNodeSelected(nodeIds: string[]): void {
    this.updateStatusBar();

    if (nodeIds.length === 1) {
      const node = this.model.getNode(nodeIds[0]);
      if (node) {
        this.propertiesPanel.showNode(node);
        this.propertiesPanel.setCharacters(this.model.getCharacters());
      }
    } else {
      this.propertiesPanel.clear();
    }
  }

  private onNodeDoubleClick(node: Node): void {
    // Focus on the text input for dialogue nodes
    if (node.nodeType === 'dialogue' || node.nodeType === 'dialogueFragment') {
      this.propertiesPanel.showNode(node);
      setTimeout(() => {
        const textInput = document.getElementById('prop-text') as HTMLTextAreaElement;
        if (textInput) {
          textInput.focus();
          textInput.select();
        }
      }, 50);
    }
  }

  private onContextMenu(worldPos: Position, node: Node | null): void {
    const screenPos = this.renderer.getViewport().toScreenCoords(worldPos);
    const rect = this.canvas.getBoundingClientRect();

    if (node) {
      // Show node context menu
      const items = ContextMenu.createNodeContextMenuItems(
        () => this.interaction.duplicateSelected(),
        () => this.interaction.deleteSelected(),
        () => this.copySelected(),
        () => this.cutSelected()
      );
      this.contextMenu.show(rect.left + screenPos.x, rect.top + screenPos.y, items);
    } else {
      // Show canvas context menu (add nodes)
      const items = ContextMenu.createNodeMenuItems((nodeType) => {
        this.interaction.addNode(nodeType, worldPos);
      });
      this.contextMenu.show(rect.left + screenPos.x, rect.top + screenPos.y, items);
    }
  }

  private onNodeCreated(node: Node): void {
    this.updateStatusBar();
    this.statusBar.setMessage(`Created ${node.nodeType} node`, 2000);
  }

  private onConnectionCreated(): void {
    this.updateStatusBar();
    this.statusBar.setMessage('Connection created', 2000);
  }

  private onPaletteDrop(nodeType: NodeType, screenX: number, screenY: number): void {
    const worldPos = this.renderer.getViewport().toWorldCoords({ x: screenX, y: screenY });
    this.interaction.addNode(nodeType, worldPos);
  }

  private onPropertyChange(nodeId: string, property: string, value: unknown): void {
    const node = this.model.getNode(nodeId);
    if (!node) return;

    switch (property) {
      case 'technicalName':
        this.model.updateNodeData(nodeId, { technicalName: value as string });
        break;
      case 'position':
        this.model.updateNodePosition(nodeId, value as Position);
        break;
      case 'color':
        this.model.updateNodeData(nodeId, { color: value as string });
        break;
      case 'data':
        this.model.updateNodeData(nodeId, { data: value as Node['data'] });
        break;
      case 'addOutputPort':
        NodeFactory.addOutputPort(node);
        this.propertiesPanel.showNode(node);
        break;
      case 'removeOutputPort':
        const portIndex = value as number;
        if (node.outputPorts.length > 2) {
          // Remove connections from this port
          this.model.removePortConnections(nodeId, 'output', portIndex);
          // Remove the port
          node.outputPorts.splice(portIndex, 1);
          // Re-index remaining ports
          node.outputPorts.forEach((p, i) => { p.index = i; });
          this.propertiesPanel.showNode(node);
        }
        break;
      case 'portLabel':
        const { index, label } = value as { index: number; label: string };
        if (node.outputPorts[index]) {
          node.outputPorts[index].label = label;
        }
        break;
    }

    this.render();
  }

  private onModelChange(): void {
    this.updateStatusBar();
  }

  private onResize(): void {
    this.renderer.resize();
    this.render();
  }

  private render(): void {
    this.renderer.render(this.model);
    this.updateZoomDisplay();
  }

  private updateStatusBar(): void {
    const nodes = this.model.getNodes();
    const connections = this.model.getConnections();
    
    this.statusBar.updateNodeCount(nodes.length);
    this.statusBar.updateConnectionCount(connections.length);
    this.statusBar.updateSelection(this.interaction.getSelectedNodeIds().length);
  }

  private updateZoomDisplay(): void {
    this.statusBar.updateZoom(this.renderer.getViewport().getZoom());
  }

  // ==================== FILE OPERATIONS ====================

  private newProject(): void {
    if (confirm('Create new project? Unsaved changes will be lost.')) {
      this.model.newGraph('New Project');
      this.render();
      this.statusBar.setMessage('New project created', 2000);
    }
  }

  private async saveProject(): Promise<void> {
    try {
      const json = this.model.toJSON();
      
      // In Tauri, we'd use the file dialog
      // For now, download as file
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.model.getGraph().technicalName}.dialogue.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      this.statusBar.setMessage('Project saved', 2000);
    } catch (error) {
      console.error('Save error:', error);
      this.statusBar.setMessage('Save failed', 3000);
    }
  }

  private loadProject(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.dialogue.json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const model = GraphModel.fromJSON(text);
        this.model.loadGraph(model.getGraph());
        this.render();
        this.statusBar.setMessage('Project loaded', 2000);
      } catch (error) {
        console.error('Load error:', error);
        this.statusBar.setMessage('Load failed - invalid file', 3000);
      }
    };

    input.click();
  }

  private validateGraph(): void {
    const report = this.model.validate();
    
    if (report.isValid && report.warnings.length === 0) {
      this.statusBar.setMessage('✓ Graph is valid', 3000);
      alert('Graph validation passed!\n\nNo errors or warnings found.');
    } else {
      const messages: string[] = [];
      
      if (report.errors.length > 0) {
        messages.push('ERRORS:');
        report.errors.forEach(e => messages.push(`  • ${e.message}`));
      }
      
      if (report.warnings.length > 0) {
        messages.push('\nWARNINGS:');
        report.warnings.forEach(w => messages.push(`  • ${w.message}`));
      }
      
      alert('Graph Validation Results:\n\n' + messages.join('\n'));
      this.statusBar.setMessage(`${report.errors.length} errors, ${report.warnings.length} warnings`, 5000);
    }
  }

  private exportProject(): void {
    const graph = this.model.getGraph();
    
    // Export in Articy-compatible format
    const exportData = {
      formatVersion: '1.0',
      project: {
        name: graph.name,
        technicalName: graph.technicalName,
        guid: graph.id
      },
      globalVariables: graph.variables,
      characters: graph.characters,
      packages: [{
        name: 'Main',
        isDefaultPackage: true,
        objects: graph.nodes.map(node => ({
          id: node.id,
          technicalName: node.technicalName,
          type: this.mapNodeTypeToArticy(node.nodeType),
          position: node.position,
          properties: node.data,
          inputPins: node.inputPorts,
          outputPins: node.outputPorts
        })),
        connections: graph.connections
      }]
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${graph.technicalName}.articyue.json`;
    a.click();
    URL.revokeObjectURL(url);

    this.statusBar.setMessage('Exported for Unreal', 2000);
  }

  private mapNodeTypeToArticy(nodeType: NodeType): string {
    const mapping: Record<NodeType, string> = {
      dialogue: 'Dialogue',
      dialogueFragment: 'DialogueFragment',
      flowFragment: 'FlowFragment',
      branch: 'Hub',
      condition: 'Condition',
      instruction: 'Instruction',
      hub: 'Hub',
      jump: 'Jump'
    };
    return mapping[nodeType] || 'FlowFragment';
  }

  private fitView(): void {
    const nodes = this.model.getNodes();
    if (nodes.length === 0) {
      this.renderer.getViewport().reset();
      this.render();
      return;
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const node of nodes) {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + node.size.width);
      maxY = Math.max(maxY, node.position.y + node.size.height);
    }

    this.renderer.getViewport().fitBounds(minX, minY, maxX, maxY, 100);
    this.render();
  }

  // ==================== CLIPBOARD ====================

  private clipboard: Node[] = [];

  private copySelected(): void {
    const selectedIds = this.interaction.getSelectedNodeIds();
    this.clipboard = selectedIds
      .map(id => this.model.getNode(id))
      .filter((n): n is Node => n !== undefined)
      .map(n => JSON.parse(JSON.stringify(n)));
    
    this.statusBar.setMessage(`Copied ${this.clipboard.length} node(s)`, 2000);
  }

  private cutSelected(): void {
    this.copySelected();
    this.interaction.deleteSelected();
    this.render();
  }

  // ==================== DEMO CONTENT ====================

  private createDemoContent(): void {
    // Add some demo characters
    this.model.addCharacter('Player', '#4a90e2');
    this.model.addCharacter('NPC Guard', '#e74c3c');
    this.model.addCharacter('Narrator', '#9b59b6');

    // Create a simple dialogue tree
    const startNode = this.model.addNode('dialogue', { x: 100, y: 100 });
    if (startNode.data.type === 'dialogue') {
      startNode.data.data.speaker = this.model.getCharacters()[1].id;
      startNode.data.data.text = 'Halt! Who goes there?';
    }

    const branchNode = this.model.addNode('branch', { x: 450, y: 100 });
    NodeFactory.addOutputPort(branchNode, 'Friendly');
    branchNode.outputPorts[0].label = 'Aggressive';
    branchNode.outputPorts[1].label = 'Friendly';

    const response1 = this.model.addNode('dialogueFragment', { x: 750, y: 0 });
    if (response1.data.type === 'dialogueFragment') {
      response1.data.data.speaker = this.model.getCharacters()[0].id;
      response1.data.data.text = 'None of your business!';
      response1.data.data.menuText = '[Aggressive] None of your business!';
    }

    const response2 = this.model.addNode('dialogueFragment', { x: 750, y: 180 });
    if (response2.data.type === 'dialogueFragment') {
      response2.data.data.speaker = this.model.getCharacters()[0].id;
      response2.data.data.text = "Just a traveler passing through.";
      response2.data.data.menuText = '[Friendly] Just a traveler...';
    }

    // Add connections
    this.model.addConnection(startNode.id, 0, branchNode.id, 0);
    this.model.addConnection(branchNode.id, 0, response1.id, 0);
    this.model.addConnection(branchNode.id, 1, response2.id, 0);

    // Fit the view to show all content
    setTimeout(() => this.fitView(), 100);
  }
}

// Initialize the editor when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new DialogueEditor();
});
