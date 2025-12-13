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
import { AIChat, GeneratedDialogue } from './ui/AIChat';
import { ProjectManager } from './ui/ProjectManager';
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
  private welcomeOverlay: WelcomeOverlay;
  private aiChat: AIChat;
  private projectManager: ProjectManager;
  private isFirstLaunch: boolean = true;

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
    this.welcomeOverlay = new WelcomeOverlay(this.onTemplateSelected.bind(this));
    this.aiChat = new AIChat(
      'ai-chat',
      this.onApplyDialogue.bind(this),
      this.onAIMessage.bind(this)
    );
    this.projectManager = new ProjectManager(this.onProjectChange.bind(this));

    // Setup toolbar actions
    this.setupToolbar();

    // Setup window resize handler
    window.addEventListener('resize', this.onResize.bind(this));

    // Listen to model changes
    this.model.addListener(this.onModelChange.bind(this));

    // Initial render
    this.render();
    this.updateStatusBar();

    // Check if first launch and show welcome
    this.checkFirstLaunch();

    // Add help button
    this.addHelpButton();

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

  private onProjectChange(projectId: string, graphData: string | null): void {
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
    this.hideCanvasHint();
  }

  private async onAIMessage(message: string): Promise<string> {
    // This is where you'd integrate with an actual AI API
    // For now, we'll simulate a response with dialogue generation
    return this.generateDialogueResponse(message);
  }

  private generateDialogueResponse(userMessage: string): string {
    // Parse user intent and generate appropriate dialogue
    const lowerMsg = userMessage.toLowerCase();
    
    // Detect if user wants a quest dialogue
    if (lowerMsg.includes('quest') || lowerMsg.includes('mission')) {
      return this.generateQuestDialogue(userMessage);
    }
    
    // Detect if user wants a shop/merchant dialogue
    if (lowerMsg.includes('shop') || lowerMsg.includes('merchant') || lowerMsg.includes('buy') || lowerMsg.includes('sell')) {
      return this.generateShopDialogue(userMessage);
    }
    
    // Detect if user wants a conversation
    if (lowerMsg.includes('conversation') || lowerMsg.includes('talk') || lowerMsg.includes('meet')) {
      return this.generateConversationDialogue(userMessage);
    }
    
    // Default: generate a simple branching dialogue
    return this.generateSimpleDialogue(userMessage);
  }

  private generateQuestDialogue(context: string): string {
    const dialogue: GeneratedDialogue = {
      title: 'Quest Dialogue',
      description: 'Generated from: ' + context.substring(0, 50),
      characters: [
        { name: 'Quest Giver', color: '#e74c3c' },
        { name: 'Player', color: '#4a90e2' }
      ],
      nodes: [
        { type: 'dialogue', speaker: 'Quest Giver', text: 'Ah, adventurer! I have a task that requires someone of your... particular skills.' },
        { type: 'dialogueFragment', speaker: 'Quest Giver', text: 'There\'s an ancient artifact hidden in the ruins to the north. Many have tried to retrieve it. None have returned.' },
        { type: 'branch', label: 'Player Response' },
        { type: 'dialogueFragment', speaker: 'Player', text: 'Sounds dangerous. What\'s in it for me?', menuText: '[Negotiate] What\'s in it for me?' },
        { type: 'dialogueFragment', speaker: 'Player', text: 'I\'ll do it. Point me in the right direction.', menuText: '[Accept] I\'ll do it.' },
        { type: 'dialogueFragment', speaker: 'Player', text: 'Sorry, I\'m not interested in suicide missions.', menuText: '[Decline] Not interested.' },
        { type: 'dialogueFragment', speaker: 'Quest Giver', text: 'Gold, of course. 500 pieces upon completion. And perhaps... something more valuable.' },
        { type: 'dialogueFragment', speaker: 'Quest Giver', text: 'Excellent! Head north through the forest. You\'ll find the ruins at the base of the mountain.' },
        { type: 'dialogueFragment', speaker: 'Quest Giver', text: 'A pity. If you change your mind, you know where to find me.' },
        { type: 'instruction', instruction: 'StartQuest("ancient_artifact")' }
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3, label: 'Negotiate' },
        { from: 2, to: 4, label: 'Accept' },
        { from: 2, to: 5, label: 'Decline' },
        { from: 3, to: 6 },
        { from: 4, to: 7 },
        { from: 5, to: 8 },
        { from: 6, to: 4 },
        { from: 7, to: 9 }
      ]
    };

    return `Here's a quest dialogue I've created for you:\n\n**Quest Giver** offers a dangerous mission to retrieve an ancient artifact. The player can:\n- **Negotiate** for better rewards\n- **Accept** immediately\n- **Decline** the quest\n\nThe dialogue includes proper branching and an instruction node to start the quest.\n\n\`\`\`json\n${JSON.stringify(dialogue, null, 2)}\n\`\`\`\n\nClick **Apply to Canvas** to add this to your project!`;
  }

  private generateShopDialogue(context: string): string {
    const dialogue: GeneratedDialogue = {
      title: 'Shop Dialogue',
      characters: [
        { name: 'Merchant', color: '#f39c12' },
        { name: 'Player', color: '#4a90e2' }
      ],
      nodes: [
        { type: 'dialogue', speaker: 'Merchant', text: 'Welcome, welcome! The finest goods in all the land, right here!' },
        { type: 'hub', label: 'Shop Menu' },
        { type: 'dialogueFragment', speaker: 'Player', text: 'Let me see what you have.', menuText: '[Browse] Show me your wares' },
        { type: 'dialogueFragment', speaker: 'Player', text: 'I have some things to sell.', menuText: '[Sell] I want to sell' },
        { type: 'dialogueFragment', speaker: 'Player', text: 'Just looking around.', menuText: '[Leave] Goodbye' },
        { type: 'instruction', instruction: 'OpenShopUI("buy")' },
        { type: 'instruction', instruction: 'OpenShopUI("sell")' },
        { type: 'dialogueFragment', speaker: 'Merchant', text: 'Come back anytime!' }
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 1, to: 2, label: 'Buy' },
        { from: 1, to: 3, label: 'Sell' },
        { from: 1, to: 4, label: 'Leave' },
        { from: 2, to: 5 },
        { from: 3, to: 6 },
        { from: 4, to: 7 },
        { from: 5, to: 1 },
        { from: 6, to: 1 }
      ]
    };

    return `Here's a shop dialogue with a menu system:\n\n**Merchant** greets the player with options to:\n- **Buy** - Opens the buy interface\n- **Sell** - Opens the sell interface\n- **Leave** - Exit the conversation\n\nThe hub node allows returning to the menu after transactions.\n\n\`\`\`json\n${JSON.stringify(dialogue, null, 2)}\n\`\`\`\n\nClick **Apply to Canvas** to add this to your project!`;
  }

  private generateConversationDialogue(context: string): string {
    const dialogue: GeneratedDialogue = {
      title: 'Conversation',
      characters: [
        { name: 'Stranger', color: '#9b59b6' },
        { name: 'Player', color: '#4a90e2' }
      ],
      nodes: [
        { type: 'dialogue', speaker: 'Stranger', text: 'You\'re not from around here, are you?' },
        { type: 'branch', label: 'Response' },
        { type: 'dialogueFragment', speaker: 'Player', text: 'What gave it away?', menuText: '[Curious] What gave it away?' },
        { type: 'dialogueFragment', speaker: 'Player', text: 'Mind your own business.', menuText: '[Hostile] Mind your business' },
        { type: 'dialogueFragment', speaker: 'Stranger', text: 'The way you walk. The way you look at everything like it\'s the first time. Don\'t worry, your secret\'s safe with me.' },
        { type: 'dialogueFragment', speaker: 'Stranger', text: 'Easy there. I meant no offense. Just making conversation.' },
        { type: 'dialogueFragment', speaker: 'Stranger', text: 'If you need any help finding your way around, just ask. Name\'s Morgan.' }
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 1, to: 2, label: 'Curious' },
        { from: 1, to: 3, label: 'Hostile' },
        { from: 2, to: 4 },
        { from: 3, to: 5 },
        { from: 4, to: 6 },
        { from: 5, to: 6 }
      ]
    };

    return `Here's a conversation with a mysterious stranger:\n\nThe **Stranger** notices the player is new. Player can respond:\n- **Curious** - Friendly path, learns more\n- **Hostile** - Defensive, but stranger stays friendly\n\nBoth paths converge at the end.\n\n\`\`\`json\n${JSON.stringify(dialogue, null, 2)}\n\`\`\`\n\nClick **Apply to Canvas** to add this to your project!`;
  }

  private generateSimpleDialogue(context: string): string {
    return `I'd be happy to help you create dialogue! Here are some things I can generate:\n\n• **Quest dialogues** - "Create a quest where a wizard needs help"\n• **Shop interactions** - "Make a merchant dialogue with buy/sell"\n• **Character conversations** - "Write a conversation with a mysterious stranger"\n• **Branching choices** - "Create a dialogue with moral choices"\n\nTell me more about your game or the specific scene you're working on, and I'll create a complete dialogue flow for you!`;
  }

  private onApplyDialogue(dialogue: GeneratedDialogue): void {
    // Add characters
    for (const char of dialogue.characters) {
      const existing = this.model.getCharacters().find(c => c.displayName === char.name);
      if (!existing) {
        this.model.addCharacter(char.name, char.color);
      }
    }

    // Calculate starting position
    const existingNodes = this.model.getNodes();
    let startX = 100;
    let startY = 100;
    
    if (existingNodes.length > 0) {
      const maxX = Math.max(...existingNodes.map(n => n.position.x + n.size.width));
      startX = maxX + 150;
    }

    // Create nodes
    const createdNodes: Node[] = [];
    const nodeSpacingX = 300;
    const nodeSpacingY = 120;
    let currentX = startX;
    let currentY = startY;
    let column = 0;

    for (const nodeDef of dialogue.nodes) {
      const node = this.model.addNode(nodeDef.type, { x: currentX, y: currentY });
      createdNodes.push(node);

      // Set node data based on type
      if (nodeDef.type === 'dialogue' || nodeDef.type === 'dialogueFragment') {
        if (node.data.type === 'dialogue' || node.data.type === 'dialogueFragment') {
          const charId = this.model.getCharacters().find(c => c.displayName === nodeDef.speaker)?.id;
          node.data.data.speaker = charId || '';
          node.data.data.text = nodeDef.text || '';
          if (nodeDef.menuText && node.data.type === 'dialogueFragment') {
            node.data.data.menuText = nodeDef.menuText;
          }
        }
      } else if (nodeDef.type === 'condition' && node.data.type === 'condition') {
        node.data.data.script.expression = nodeDef.condition || '';
      } else if (nodeDef.type === 'instruction' && node.data.type === 'instruction') {
        node.data.data.script.expression = nodeDef.instruction || '';
      } else if ((nodeDef.type === 'branch' || nodeDef.type === 'hub') && nodeDef.label) {
        node.technicalName = nodeDef.label;
      }

      // Position nodes in a flowing layout
      currentY += nodeSpacingY;
      if (currentY > startY + nodeSpacingY * 3) {
        currentY = startY;
        currentX += nodeSpacingX;
        column++;
      }
    }

    // Create connections
    for (const conn of dialogue.connections) {
      const fromNode = createdNodes[conn.from];
      const toNode = createdNodes[conn.to];
      
      if (fromNode && toNode) {
        // Add output ports if needed for branch/hub nodes
        if (fromNode.nodeType === 'branch' || fromNode.nodeType === 'hub') {
          const existingConns = dialogue.connections.filter(c => c.from === conn.from);
          const connIndex = existingConns.indexOf(conn);
          while (fromNode.outputPorts.length <= connIndex) {
            NodeFactory.addOutputPort(fromNode, conn.label);
          }
          if (conn.label && fromNode.outputPorts[connIndex]) {
            fromNode.outputPorts[connIndex].label = conn.label;
          }
          this.model.addConnection(fromNode.id, connIndex, toNode.id, 0);
        } else {
          this.model.addConnection(fromNode.id, 0, toNode.id, 0);
        }
      }
    }

    this.render();
    this.hideCanvasHint();
    this.statusBar.setMessage(`Applied "${dialogue.title}" - ${createdNodes.length} nodes created`, 3000);
    
    // Auto-save project
    this.autoSaveProject();
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
      this.isFirstLaunch = true;
      this.welcomeOverlay.show();
    } else {
      this.isFirstLaunch = false;
      // Show empty state hint if no nodes
      this.updateCanvasHint();
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
      // Show canvas hint for blank template
      this.updateCanvasHint();
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
    this.hideCanvasHint();
  }

  private addHelpButton(): void {
    const helpBtn = document.createElement('button');
    helpBtn.className = 'help-button';
    helpBtn.innerHTML = '?';
    helpBtn.title = 'Show welcome screen';
    helpBtn.addEventListener('click', () => {
      this.welcomeOverlay.show();
    });
    document.body.appendChild(helpBtn);
  }

  private updateCanvasHint(): void {
    const nodes = this.model.getNodes();
    const container = document.getElementById('canvas-container');
    
    // Remove existing hint
    const existingHint = container?.querySelector('.canvas-hint');
    if (existingHint) existingHint.remove();
    
    if (nodes.length === 0 && container) {
      const hint = document.createElement('div');
      hint.className = 'canvas-hint';
      hint.innerHTML = `
        <div class="canvas-hint-icon">💬</div>
        <div class="canvas-hint-text">
          <strong>Drag nodes</strong> from the left panel<br>
          or <strong>right-click</strong> to add nodes
        </div>
      `;
      container.appendChild(hint);
    }
  }

  private hideCanvasHint(): void {
    const hint = document.querySelector('.canvas-hint');
    if (hint) hint.remove();
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
