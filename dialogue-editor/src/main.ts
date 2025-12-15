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
import { WelcomeOverlay, Template } from './ui/WelcomeOverlay';
import { ProjectManager } from './ui/ProjectManager';
import { CommandPalette, createDefaultCommands } from './ui/CommandPalette';
import { Coachmarks } from './ui/Coachmarks';
import { InlineEditor } from './ui/InlineEditor';
import { FloatingToolbar } from './ui/FloatingToolbar';
import { Node, NodeType, Position } from './types/graph';
import { NodeFactory } from './core/NodeFactory';

class DialogueEditor {
  private model: GraphModel;
  private renderer: GraphRenderer;
  private interaction: InteractionManager;
  private toolbar: Toolbar;
  private _palette: Palette;
  private propertiesPanel: PropertiesPanel;
  private contextMenu: ContextMenu;
  private statusBar: StatusBar;
  private canvas: HTMLCanvasElement;
  private welcomeOverlay: WelcomeOverlay;
    private projectManager: ProjectManager;
  private commandPalette: CommandPalette;
  private coachmarks: Coachmarks;
  private inlineEditor: InlineEditor;
  private floatingToolbar: FloatingToolbar;
  private _isFirstLaunch: boolean = true;

  constructor() {
    // Get canvas element
    this.canvas = document.getElementById('graph-canvas') as HTMLCanvasElement;
    if (!this.canvas) throw new Error('Canvas element not found');

    // Initialize core components
    this.model = new GraphModel();
    this.renderer = new GraphRenderer(this.canvas);
    
    // Set up viewport animation callback for smooth animated transitions
    this.renderer.getViewport().setAnimationCallback(() => {
      this.renderer.requestRender();
      this.render();
    });
    
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
    this._palette = new Palette('palette', this.onPaletteDrop.bind(this));
    this.propertiesPanel = new PropertiesPanel('properties-panel', this.onPropertyChange.bind(this));
    this.contextMenu = new ContextMenu();
    this.statusBar = new StatusBar('status-bar');
    this.welcomeOverlay = new WelcomeOverlay(this.onTemplateSelected.bind(this));
    this.projectManager = new ProjectManager(this.onProjectChange.bind(this));

    // Initialize Command Palette (Cmd+/ to open)
    this.commandPalette = new CommandPalette();
    this.setupCommandPalette();

    // Initialize Coachmarks for progressive onboarding
    this.coachmarks = new Coachmarks();

    // Initialize Inline Editor for double-click editing
    this.inlineEditor = new InlineEditor({
      onTextChange: (nodeId, text) => this.onInlineTextChange(nodeId, text),
      onSpeakerChange: (nodeId, speakerId) => this.onInlineSpeakerChange(nodeId, speakerId),
      onCreateNext: (nodeId) => this.createNodeAfter(nodeId, 'dialogueFragment'),
      onCreateBranch: (nodeId) => this.createNodeAfter(nodeId, 'branch'),
      onClose: () => this.render()
    });

    // Initialize Floating Toolbar
    this.floatingToolbar = new FloatingToolbar({
      onEdit: (node) => this.showInlineEditor(node),
      onDuplicate: () => this.interaction.duplicateSelected(),
      onDelete: () => this.interaction.deleteSelected(),
      onAddAfter: (node) => this.createNodeAfter(node.id, 'dialogueFragment'),
      onChangeColor: (node) => this.showColorPicker(node)
    });

    // Setup toolbar actions
    this.setupToolbar();

    // Setup window resize handler
    window.addEventListener('resize', this.onResize.bind(this));

    // Listen to model changes
    this.model.addListener(this.onModelChange.bind(this));

    // Ensure canvas is properly sized after layout completes
    requestAnimationFrame(() => {
      this.renderer.resize();
      this.render();
    });
    this.updateStatusBar();

    // Check if first launch and show welcome
    this.checkFirstLaunch();

    // Disable coachmarks - they're not helpful until interaction is solid
    this.coachmarks.setEnabled(false);

    // Load current project if exists
    this.loadCurrentProject();
  }

  private loadCurrentProject(): void {
    const project = this.projectManager.getCurrentProject();
    if (project && project.graphData) {
      try {
        const loaded = GraphModel.fromJSON(project.graphData);
        this.model.loadGraph(loaded.getGraph());
        this.toolbar.setTitle(project.metadata.name);
        this.render();
      } catch (e) {
        console.warn('Failed to load project:', e);
      }
    }
  }

  private onProjectChange(_projectId: string, graphData: string | null): void {
    if (graphData) {
      try {
        const loaded = GraphModel.fromJSON(graphData);
        this.model.loadGraph(loaded.getGraph());
      } catch (e) {
        console.warn('Failed to load project data:', e);
        this.model.newGraph('Untitled');
      }
    } else {
      this.model.newGraph('Untitled');
    }
    
    const project = this.projectManager.getCurrentProject();
    if (project) {
      this.toolbar.setTitle(project.metadata.name);
    }
    
    this.render();
    this.updateStatusBar();
  }

  private autoSaveProject(): void {
    const projectId = this.projectManager.getCurrentProjectId();
    if (projectId) {
      this.projectManager.saveCurrentProject(
        this.model.toJSON(),
        this.model.getNodes().length,
        this.model.getCharacters().length
      );
    }
  }

  private checkFirstLaunch(): void {
    const hasVisited = localStorage.getItem('dialogue-editor-visited');
    if (!hasVisited) {
      this._isFirstLaunch = true;
      this.welcomeOverlay.show();
    } else {
      this._isFirstLaunch = false;
    }
  }

  private onTemplateSelected(template: Template): void {
    localStorage.setItem('dialogue-editor-visited', 'true');
    
    // Clear existing content
    this.model.newGraph('My Dialogue');
    
    // Add default characters
    this.model.addCharacter('Player', '#4a90e2');
    this.model.addCharacter('NPC', '#e74c3c');
    
    if (template.id === 'blank') {
      this.render();
      return;
    }
    
    // Create nodes from template
    const createdNodes: Node[] = [];
    for (const nodeDef of template.nodes) {
      const node = this.model.addNode(nodeDef.type, { x: nodeDef.x, y: nodeDef.y });
      createdNodes.push(node);
      
      // Add extra output ports for branch/hub nodes
      if (nodeDef.type === 'branch' || nodeDef.type === 'hub') {
        // Templates may need more than 2 outputs
        const neededOutputs = template.connections.filter(c => c.from === template.nodes.indexOf(nodeDef)).length;
        while (node.outputPorts.length < neededOutputs) {
          NodeFactory.addOutputPort(node);
        }
      }
    }
    
    // Create connections
    for (const conn of template.connections) {
      if (createdNodes[conn.from] && createdNodes[conn.to]) {
        this.model.addConnection(
          createdNodes[conn.from].id,
          conn.fromPort,
          createdNodes[conn.to].id,
          conn.toPort
        );
      }
    }
    
    // Fit view and render
    this.render();
    setTimeout(() => this.fitView(), 100);
    
    this.statusBar.setMessage(`Created "${template.name}" template`, 3000);
  }

  private setupCommandPalette(): void {
    const commands = createDefaultCommands({
      onNewProject: () => this.newProject(),
      onSaveProject: () => this.saveProject(),
      onOpenProject: () => this.loadProject(),
      onExport: () => this.exportProject(),
      onUndo: () => { this.model.undo(); this.render(); },
      onRedo: () => { this.model.redo(); this.render(); },
      onDelete: () => this.interaction.deleteSelected(),
      onSelectAll: () => {
        const nodes = this.model.getNodes();
        nodes.forEach(n => this.interaction.getSelectedNodeIds().push(n.id));
        this.render();
      },
      onFitView: () => this.fitView(),
      onResetView: () => { this.renderer.getViewport().reset(); this.render(); },
      onAddDialogue: () => this.addNodeAtCenter('dialogueFragment'),
      onAddBranch: () => this.addNodeAtCenter('branch'),
      onAddCondition: () => this.addNodeAtCenter('condition'),
      onShowHelp: () => this.welcomeOverlay.show(),
      onShowProjects: () => this.projectManager.showProjectBrowser()
    });
    this.commandPalette.setCommands(commands);
  }

  private addNodeAtCenter(nodeType: NodeType): void {
    const canvas = document.getElementById('canvas-container');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const centerScreen = { x: rect.width / 2, y: rect.height / 2 };
    const worldPos = this.renderer.getViewport().toWorldCoords(centerScreen);
    this.interaction.addNode(nodeType, worldPos);
  }

  private setupToolbar(): void {
    this.toolbar.addAction({
      id: 'projects',
      icon: '📁',
      label: 'Projects',
      onClick: () => this.projectManager.showProjectBrowser()
    });

    this.toolbar.addSeparator();

    this.toolbar.addAction({
      id: 'new',
      icon: '📄',
      label: 'New',
      shortcut: '⌘N',
      onClick: () => this.newProject()
    });

    this.toolbar.addAction({
      id: 'save',
      icon: '💾',
      label: 'Save',
      shortcut: '⌘S',
      onClick: () => this.saveProject()
    });

    this.toolbar.addAction({
      id: 'load',
      icon: '📂',
      label: 'Open',
      shortcut: '⌘O',
      onClick: () => this.loadProject()
    });

    this.toolbar.addSeparator();

    this.toolbar.addAction({
      id: 'undo',
      icon: '↩️',
      label: 'Undo',
      shortcut: '⌘Z',
      onClick: () => {
        this.model.undo();
        this.render();
      }
    });

    this.toolbar.addAction({
      id: 'redo',
      icon: '↪️',
      label: 'Redo',
      shortcut: '⌘⇧Z',
      onClick: () => {
        this.model.redo();
        this.render();
      }
    });

    this.toolbar.addSeparator();

    this.toolbar.addAction({
      id: 'validate',
      icon: '✓',
      label: 'Validate',
      onClick: () => this.validateGraph()
    });

    this.toolbar.addAction({
      id: 'export',
      icon: '📤',
      label: 'Export',
      onClick: () => this.exportProject()
    });

    this.toolbar.addSeparator();

    this.toolbar.addAction({
      id: 'fit',
      icon: '⊡',
      label: 'Fit',
      onClick: () => this.fitView()
    });

    this.toolbar.addAction({
      id: 'reset-view',
      icon: '⟲',
      label: 'Reset',
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
        // Trigger coachmark for properties panel
        this.coachmarks.trigger('node-selected');

        // Show floating toolbar near selected node
        const screenPos = this.renderer.getViewport().toScreenCoords(node.position);
        const canvasRect = this.canvas.getBoundingClientRect();
        this.floatingToolbar.show(node, {
          x: canvasRect.left + screenPos.x + (node.size?.width || 200) / 2,
          y: canvasRect.top + screenPos.y
        });
      }
    } else {
      this.propertiesPanel.clear();
      this.floatingToolbar.hide();
    }
  }

  private onNodeDoubleClick(node: Node): void {
    // Show inline editor for dialogue nodes (Figma-style double-click to edit)
    if (node.nodeType === 'dialogue' || node.nodeType === 'dialogueFragment') {
      this.showInlineEditor(node);
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
    
    // Trigger coachmarks for node creation
    this.coachmarks.trigger('node-created');
    if (node.nodeType === 'branch') {
      this.coachmarks.trigger('branch-created');
    }

    // Update inline editor characters list
    this.inlineEditor.setCharacters(this.model.getCharacters());
    
    // Auto-open inline editor for dialogue nodes (better UX)
    if (node.nodeType === 'dialogue' || node.nodeType === 'dialogueFragment') {
      // Small delay to ensure node is rendered first
      requestAnimationFrame(() => {
        this.showInlineEditor(node);
      });
    }
    
    // Auto-save project
    this.autoSaveProject();
  }

  // ==================== INLINE EDITOR & FLOATING TOOLBAR ====================

  private showInlineEditor(node: Node): void {
    if (node.nodeType !== 'dialogue' && node.nodeType !== 'dialogueFragment') {
      return;
    }

    const screenPos = this.renderer.getViewport().toScreenCoords(node.position);
    const canvasRect = this.canvas.getBoundingClientRect();
    
    // Center on node
    const centerX = screenPos.x + (node.size?.width || 200) / 2;
    const centerY = screenPos.y + (node.size?.height || 100) / 2;

    this.inlineEditor.setCharacters(this.model.getCharacters());
    this.inlineEditor.show(node, { x: centerX, y: centerY }, canvasRect);
    this.floatingToolbar.hide();
  }

  private onInlineTextChange(nodeId: string, text: string): void {
    const node = this.model.getNode(nodeId);
    if (!node) return;

    if (node.nodeType === 'dialogue' || node.nodeType === 'dialogueFragment') {
      const data = node.data as { type: 'dialogue' | 'dialogueFragment'; data: { speaker?: string; text: string; menuText?: string; stageDirections?: string; autoTransition: boolean } };
      this.model.updateNodeData(nodeId, {
        data: {
          type: node.nodeType as 'dialogue' | 'dialogueFragment',
          data: { ...data.data, text }
        }
      });
      this.render();
    }
  }

  private onInlineSpeakerChange(nodeId: string, speakerId: string): void {
    const node = this.model.getNode(nodeId);
    if (!node) return;

    if (node.nodeType === 'dialogue' || node.nodeType === 'dialogueFragment') {
      const data = node.data as { type: 'dialogue' | 'dialogueFragment'; data: { speaker?: string; text: string; autoTransition: boolean } };
      this.model.updateNodeData(nodeId, {
        data: {
          type: node.nodeType as 'dialogue' | 'dialogueFragment',
          data: { ...data.data, speaker: speakerId }
        }
      });
      this.render();
    }
  }

  private createNodeAfter(sourceNodeId: string, nodeType: NodeType): void {
    const sourceNode = this.model.getNode(sourceNodeId);
    if (!sourceNode) return;

    // Position new node to the right of source
    const newPos = {
      x: sourceNode.position.x + (sourceNode.size?.width || 200) + 100,
      y: sourceNode.position.y
    };

    const newNode = this.model.addNode(nodeType, newPos);

    // Connect source to new node
    this.model.addConnection(sourceNodeId, 0, newNode.id, 0);

    // Select new node
    this.interaction.addNode(nodeType, newPos);

    // If dialogue, inherit speaker from source
    if ((nodeType === 'dialogue' || nodeType === 'dialogueFragment') && 
        (sourceNode.nodeType === 'dialogue' || sourceNode.nodeType === 'dialogueFragment')) {
      const sourceData = sourceNode.data as { type: string; data: { speaker?: string } };
      if (sourceData.data.speaker) {
        this.model.updateNodeData(newNode.id, {
          data: {
            type: nodeType as 'dialogue' | 'dialogueFragment',
            data: { speaker: sourceData.data.speaker, text: '', autoTransition: false }
          }
        });
      }
    }

    this.render();
    
    // Show inline editor on new node
    setTimeout(() => {
      const createdNode = this.model.getNode(newNode.id);
      if (createdNode) {
        this.showInlineEditor(createdNode);
      }
    }, 50);
  }

  private showColorPicker(node: Node): void {
    const color = prompt('Enter hex color (e.g. #3b82f6):', node.color || '#3b82f6');
    if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
      this.model.updateNodeData(node.id, { color });
      this.render();
    }
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

  private _createDemoContent(): void {
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
