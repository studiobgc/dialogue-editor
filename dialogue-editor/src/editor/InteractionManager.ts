/**
 * Manages all user interactions with the graph editor
 */

import { Node, Position, NodeType, Connection } from '../types/graph';
import { GraphModel } from '../core/GraphModel';
import { GraphRenderer } from '../renderer/GraphRenderer';
import { Viewport } from '../renderer/Viewport';
import { QuickCreateMenu, QuickCreateOption } from '../ui/QuickCreateMenu';
import { findNonOverlappingPosition, findPositionAfterNode } from '../utils/LayoutUtils';

export interface DragState {
  type: 'none' | 'pan' | 'node' | 'selection' | 'connection';
  startScreenPos: Position;
  startWorldPos: Position;
  nodeStartPositions?: Map<string, Position>;
  connectionSource?: { nodeId: string; portType: 'input' | 'output'; portIndex: number };
}

export interface InteractionCallbacks {
  onNodeSelected?: (nodeIds: string[]) => void;
  onNodeDoubleClick?: (node: Node) => void;
  onConnectionSelected?: (connectionId: string | null) => void;
  onContextMenu?: (worldPos: Position, node: Node | null) => void;
  onNodeCreated?: (node: Node) => void;
  onConnectionCreated?: (connection: Connection) => void;
}

export class InteractionManager {
  private canvas: HTMLCanvasElement;
  private model: GraphModel;
  private renderer: GraphRenderer;
  private viewport: Viewport;
  private callbacks: InteractionCallbacks;

  private dragState: DragState = {
    type: 'none',
    startScreenPos: { x: 0, y: 0 },
    startWorldPos: { x: 0, y: 0 }
  };

  private selectedNodeIds: Set<string> = new Set();
  private selectedConnectionId: string | null = null;
  private hoveredNodeId: string | null = null;
  private _hoveredPortInfo: { nodeId: string; type: 'input' | 'output'; index: number } | null = null;

  private lastClickTime = 0;
  private lastClickNodeId: string | null = null;
  private doubleClickThreshold = 300;
  
  // Inertia panning
  private velocity: Position = { x: 0, y: 0 };
  private lastPanTime: number = 0;
  private inertiaAnimationId: number | null = null;
  private readonly friction = 0.92;
  private readonly minVelocity = 0.5;
  
  // Space+drag pan (Figma-style)
  private isSpacePressed = false;

  // Quick Create Menu for drag-to-create
  private quickCreateMenu: QuickCreateMenu;
  private pendingQuickCreate: {
    sourceNodeId: string;
    sourcePortIndex: number;
    worldPos: Position;
    screenPos: Position;
  } | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    model: GraphModel,
    renderer: GraphRenderer,
    callbacks?: InteractionCallbacks
  ) {
    this.canvas = canvas;
    this.model = model;
    this.renderer = renderer;
    this.viewport = renderer.getViewport();
    this.callbacks = callbacks || {};

    // Initialize Quick Create Menu
    this.quickCreateMenu = new QuickCreateMenu();

    this.setupEventListeners();
  }

  /**
   * Setup all event listeners
   */
  private setupEventListeners(): void {
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
    this.canvas.addEventListener('contextmenu', this.onContextMenu.bind(this));
    this.canvas.addEventListener('dblclick', this.onDoubleClick.bind(this));

    // Keyboard events
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (e.code === 'Space') {
      this.isSpacePressed = false;
      if (this.dragState.type === 'none') {
        this.canvas.style.cursor = 'default';
      }
    }
  }

  /**
   * Get screen position from mouse event
   */
  private getScreenPos(e: MouseEvent): Position {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  // ==================== MOUSE EVENTS ====================

  private onMouseDown(e: MouseEvent): void {
    const screenPos = this.getScreenPos(e);
    const worldPos = this.viewport.toWorldCoords(screenPos);

    // Middle mouse button = pan (standard)
    // Right mouse button = pan (Articy-style, more accessible)
    if (e.button === 1 || e.button === 2) {
      this.startPan(screenPos, worldPos);
      e.preventDefault();
      return;
    }

    // Space+click = pan (Figma-style)
    if (e.button === 0 && this.isSpacePressed) {
      this.startPan(screenPos, worldPos);
      e.preventDefault();
      return;
    }

    // Left mouse button
    if (e.button === 0) {
      const nodes = this.model.getNodes();
      
      // Check for port click first - check ALL nodes, not just the hit node
      // because ports extend outside the node bounds
      for (const node of nodes) {
        const portHit = this.renderer.getNodeRenderer().hitTestPort(node, worldPos);
        if (portHit) {
          this.startConnectionDrag(screenPos, worldPos, node.id, portHit.type, portHit.index);
          return;
        }
      }
      
      const hitNode = this.renderer.hitTestNode(nodes, worldPos);

      // Check for node click
      if (hitNode) {
        this.handleNodeClick(hitNode, screenPos, worldPos, e.shiftKey);
        return;
      }

      // Check for connection click
      const connections = this.model.getConnections();
      const hitConnection = this.renderer.hitTestConnection(connections, nodes, worldPos);
      if (hitConnection) {
        this.selectConnection(hitConnection.id);
        return;
      }

      // Empty space click - start selection box or pan
      if (e.shiftKey) {
        this.startSelectionBox(screenPos, worldPos);
      } else {
        this.clearSelection();
        this.startPan(screenPos, worldPos);
      }
    }
  }

  private onMouseMove(e: MouseEvent): void {
    const screenPos = this.getScreenPos(e);
    const worldPos = this.viewport.toWorldCoords(screenPos);

    // Update hover state
    this.updateHoverState(worldPos);

    // Handle drag
    switch (this.dragState.type) {
      case 'pan':
        this.handlePan(screenPos);
        break;
      case 'node':
        this.handleNodeDrag(worldPos);
        break;
      case 'selection':
        this.handleSelectionDrag(worldPos);
        break;
      case 'connection':
        this.handleConnectionDrag(worldPos);
        break;
    }
  }

  private onMouseUp(e: MouseEvent): void {
    const screenPos = this.getScreenPos(e);
    const worldPos = this.viewport.toWorldCoords(screenPos);

    switch (this.dragState.type) {
      case 'pan':
        // Start inertia animation when pan ends
        this.startInertia();
        break;
      case 'selection':
        this.finishSelectionBox(worldPos);
        break;
      case 'connection':
        this.finishConnectionDrag(worldPos);
        break;
    }

    this.dragState = {
      type: 'none',
      startScreenPos: { x: 0, y: 0 },
      startWorldPos: { x: 0, y: 0 }
    };

    this.canvas.style.cursor = 'default';
    this.renderer.setConnectionPreview(null, null);
    this.renderer.setSelectionBox(null, null);
    this.renderer.setAlignmentGuides([]); // Clear guides on drag end
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();

    const screenPos = this.getScreenPos(e);
    
    // Figma-style: Ctrl/Cmd+scroll OR pinch = zoom, regular scroll = pan
    const isZoom = e.ctrlKey || e.metaKey;
    
    if (isZoom) {
      // === ZOOM (Figma-style: smooth exponential, cursor-anchored) ===
      // Normalize delta: trackpads send small values, mice send larger
      let delta = -e.deltaY;
      if (e.deltaMode === 1) delta *= 16; // line mode
      if (e.deltaMode === 2) delta *= 100; // page mode
      
      // Exponential zoom for smooth feel at all zoom levels
      // Small multiplier for fine control
      const zoomFactor = Math.exp(delta * 0.002);
      const newZoom = this.viewport.getZoom() * zoomFactor;
      
      this.viewport.setZoom(newZoom, screenPos.x, screenPos.y);
    } else {
      // === PAN (1:1 screen pixels like Figma) ===
      let dx = e.deltaX;
      let dy = e.deltaY;
      
      // Shift+scroll = horizontal pan
      if (dx === 0 && e.shiftKey) {
        dx = dy;
        dy = 0;
      }
      
      // Normalize for line/page modes
      if (e.deltaMode === 1) { dx *= 16; dy *= 16; }
      if (e.deltaMode === 2) { dx *= 100; dy *= 100; }
      
      // Pan opposite to scroll direction (natural/Figma behavior)
      this.viewport.pan(-dx, -dy);
    }
    
    this.renderer.requestRender();
    this.render();
  }

  private onContextMenu(e: MouseEvent): void {
    e.preventDefault();

    const screenPos = this.getScreenPos(e);
    const worldPos = this.viewport.toWorldCoords(screenPos);

    const nodes = this.model.getNodes();
    const hitNode = this.renderer.hitTestNode(nodes, worldPos);

    if (this.callbacks.onContextMenu) {
      this.callbacks.onContextMenu(worldPos, hitNode);
    }
  }

  private onDoubleClick(e: MouseEvent): void {
    const screenPos = this.getScreenPos(e);
    const worldPos = this.viewport.toWorldCoords(screenPos);

    const nodes = this.model.getNodes();
    const hitNode = this.renderer.hitTestNode(nodes, worldPos);

    if (hitNode && this.callbacks.onNodeDoubleClick) {
      this.callbacks.onNodeDoubleClick(hitNode);
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    // Don't handle if typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Space = pan mode (Figma-style)
    if (e.code === 'Space' && !this.isSpacePressed) {
      this.isSpacePressed = true;
      this.canvas.style.cursor = 'grab';
      e.preventDefault();
      return;
    }

    const isMeta = e.metaKey || e.ctrlKey;

    // Delete selected nodes
    if (e.key === 'Delete' || e.key === 'Backspace') {
      this.deleteSelected();
      e.preventDefault();
    }

    // Select all
    if (isMeta && e.key === 'a') {
      this.selectAll();
      e.preventDefault();
    }

    // Undo
    if (isMeta && e.key === 'z' && !e.shiftKey) {
      this.model.undo();
      this.render();
      e.preventDefault();
    }

    // Redo
    if (isMeta && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      this.model.redo();
      this.render();
      e.preventDefault();
    }

    // Duplicate
    if (isMeta && e.key === 'd') {
      this.duplicateSelected();
      e.preventDefault();
    }

    // Escape - clear selection
    if (e.key === 'Escape') {
      this.clearSelection();
    }

    // === ZOOM SHORTCUTS ===
    // Zoom in: + or =
    if (e.key === '+' || e.key === '=' || (isMeta && e.key === '=')) {
      this.viewport.zoomIn();
      e.preventDefault();
    }

    // Zoom out: - or _
    if (e.key === '-' || e.key === '_' || (isMeta && e.key === '-')) {
      this.viewport.zoomOut();
      e.preventDefault();
    }

    // Zoom to 100%: Cmd+1
    if (isMeta && e.key === '1') {
      this.viewport.zoomToActual();
      e.preventDefault();
    }

    // Fit all content: Cmd+0
    if (isMeta && e.key === '0') {
      const nodes = this.model.getNodes();
      if (nodes.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const node of nodes) {
          minX = Math.min(minX, node.position.x);
          minY = Math.min(minY, node.position.y);
          maxX = Math.max(maxX, node.position.x + node.size.width);
          maxY = Math.max(maxY, node.position.y + node.size.height);
        }
        this.viewport.animateFitBounds(minX, minY, maxX, maxY);
      }
      e.preventDefault();
    }

    // === QUICK NODE CREATION (single key shortcuts) ===
    // D = Dialogue, B = Branch, C = Condition, J = Jump, H = Hub
    if (!isMeta && !e.shiftKey && !e.altKey) {
      const nodeTypeMap: Record<string, NodeType> = {
        'd': 'dialogue',
        'f': 'dialogueFragment', 
        'b': 'branch',
        'c': 'condition',
        'i': 'instruction',
        'j': 'jump',
        'h': 'hub'
      };
      
      const nodeType = nodeTypeMap[e.key.toLowerCase()];
      if (nodeType) {
        this.createNodeAtViewportCenter(nodeType);
        e.preventDefault();
      }
    }
  }

  /**
   * Create a node at the center of the current viewport
   */
  private createNodeAtViewportCenter(nodeType: NodeType): void {
    const bounds = this.viewport.getVisibleBounds();
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    
    // Use smart positioning to avoid overlap with existing nodes
    const smartPos = findNonOverlappingPosition(
      this.model.getNodes(),
      { x: centerX, y: centerY }
    );
    
    const node = this.model.addNode(nodeType, smartPos);
    
    // Select the new node
    this.selectedNodeIds.clear();
    this.selectedNodeIds.add(node.id);
    this.updateRendererSelection();
    this.notifySelectionChanged();
    
    // Notify callback
    if (this.callbacks.onNodeCreated) {
      this.callbacks.onNodeCreated(node);
    }
    
    this.render();
  }

  // ==================== DRAG HANDLERS ====================

  private startPan(screenPos: Position, worldPos: Position): void {
    // Stop any ongoing inertia animation
    if (this.inertiaAnimationId !== null) {
      cancelAnimationFrame(this.inertiaAnimationId);
      this.inertiaAnimationId = null;
    }
    
    this.velocity = { x: 0, y: 0 };
    this.lastPanTime = performance.now();
    
    this.dragState = {
      type: 'pan',
      startScreenPos: screenPos,
      startWorldPos: worldPos
    };
    this.canvas.style.cursor = 'grabbing';
  }

  private handlePan(screenPos: Position): void {
    const now = performance.now();
    const dt = Math.max(1, now - this.lastPanTime);
    
    const dx = screenPos.x - this.dragState.startScreenPos.x;
    const dy = screenPos.y - this.dragState.startScreenPos.y;
    
    // Calculate velocity for inertia
    this.velocity = {
      x: dx / dt * 16, // Normalize to ~60fps
      y: dy / dt * 16
    };
    this.lastPanTime = now;
    
    this.viewport.pan(dx, dy);
    this.dragState.startScreenPos = screenPos;
    
    this.render();
  }
  
  private startInertia(): void {
    // Only start inertia if velocity is significant
    const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
    if (speed < this.minVelocity) return;
    
    const animate = () => {
      // Apply friction
      this.velocity.x *= this.friction;
      this.velocity.y *= this.friction;
      
      // Check if we should stop
      const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
      if (speed < this.minVelocity) {
        this.inertiaAnimationId = null;
        return;
      }
      
      // Apply velocity
      this.viewport.pan(this.velocity.x, this.velocity.y);
      this.render();
      
      this.inertiaAnimationId = requestAnimationFrame(animate);
    };
    
    this.inertiaAnimationId = requestAnimationFrame(animate);
  }

  private handleNodeClick(node: Node, screenPos: Position, worldPos: Position, shiftKey: boolean): void {
    // Handle double-click detection
    const now = Date.now();
    if (this.lastClickNodeId === node.id && now - this.lastClickTime < this.doubleClickThreshold) {
      if (this.callbacks.onNodeDoubleClick) {
        this.callbacks.onNodeDoubleClick(node);
      }
      return;
    }
    this.lastClickTime = now;
    this.lastClickNodeId = node.id;

    // Handle selection
    if (shiftKey) {
      // Toggle selection
      if (this.selectedNodeIds.has(node.id)) {
        this.selectedNodeIds.delete(node.id);
      } else {
        this.selectedNodeIds.add(node.id);
      }
    } else if (!this.selectedNodeIds.has(node.id)) {
      // Select only this node
      this.selectedNodeIds.clear();
      this.selectedNodeIds.add(node.id);
    }

    this.selectedConnectionId = null;
    this.updateRendererSelection();
    this.notifySelectionChanged();

    // Start node drag
    this.startNodeDrag(screenPos, worldPos);
  }

  private startNodeDrag(screenPos: Position, worldPos: Position): void {
    const nodeStartPositions = new Map<string, Position>();
    for (const nodeId of this.selectedNodeIds) {
      const node = this.model.getNode(nodeId);
      if (node) {
        nodeStartPositions.set(nodeId, { ...node.position });
      }
    }

    this.dragState = {
      type: 'node',
      startScreenPos: screenPos,
      startWorldPos: worldPos,
      nodeStartPositions
    };

    this.canvas.style.cursor = 'move';
  }

  private handleNodeDrag(worldPos: Position): void {
    if (!this.dragState.nodeStartPositions) return;

    const dx = worldPos.x - this.dragState.startWorldPos.x;
    const dy = worldPos.y - this.dragState.startWorldPos.y;

    // Get all nodes for alignment detection
    const allNodes = this.model.getNodes();
    const draggedNodeIds = new Set(this.dragState.nodeStartPositions.keys());
    const otherNodes = allNodes.filter(n => !draggedNodeIds.has(n.id));

    // Snap threshold and grid
    const SNAP_THRESHOLD = 8;
    const GRID_SIZE = 20;

    // Collect alignment guides
    const guides: { type: 'h' | 'v'; pos: number }[] = [];

    for (const [nodeId, startPos] of this.dragState.nodeStartPositions) {
      const node = this.model.getNode(nodeId);
      if (!node) continue;

      let newX = startPos.x + dx;
      let newY = startPos.y + dy;
      const w = node.size.width;
      const h = node.size.height;

      // Smart alignment to other nodes (Figma-style)
      for (const other of otherNodes) {
        const ox = other.position.x;
        const oy = other.position.y;
        const ow = other.size.width;
        const oh = other.size.height;

        // Horizontal alignment (left, center, right edges)
        if (Math.abs(newX - ox) < SNAP_THRESHOLD) { newX = ox; guides.push({ type: 'v', pos: ox }); }
        if (Math.abs(newX + w - (ox + ow)) < SNAP_THRESHOLD) { newX = ox + ow - w; guides.push({ type: 'v', pos: ox + ow }); }
        if (Math.abs((newX + w/2) - (ox + ow/2)) < SNAP_THRESHOLD) { newX = ox + ow/2 - w/2; guides.push({ type: 'v', pos: ox + ow/2 }); }

        // Vertical alignment (top, center, bottom edges)
        if (Math.abs(newY - oy) < SNAP_THRESHOLD) { newY = oy; guides.push({ type: 'h', pos: oy }); }
        if (Math.abs(newY + h - (oy + oh)) < SNAP_THRESHOLD) { newY = oy + oh - h; guides.push({ type: 'h', pos: oy + oh }); }
        if (Math.abs((newY + h/2) - (oy + oh/2)) < SNAP_THRESHOLD) { newY = oy + oh/2 - h/2; guides.push({ type: 'h', pos: oy + oh/2 }); }
      }

      // Fall back to grid snap if no alignment
      if (guides.length === 0) {
        newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
        newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
      }

      this.model.updateNodePosition(nodeId, { x: newX, y: newY });
    }

    // Show alignment guides
    this.renderer.setAlignmentGuides(guides);
    this.render();
  }

  private startSelectionBox(screenPos: Position, worldPos: Position): void {
    this.dragState = {
      type: 'selection',
      startScreenPos: screenPos,
      startWorldPos: worldPos
    };
  }

  private handleSelectionDrag(worldPos: Position): void {
    this.renderer.setSelectionBox(this.dragState.startWorldPos, worldPos);
    this.render();
  }

  private finishSelectionBox(worldPos: Position): void {
    const nodes = this.model.getNodes();
    const selectedNodes = this.renderer.getNodesInBox(
      nodes,
      this.dragState.startWorldPos,
      worldPos
    );

    this.selectedNodeIds = new Set(selectedNodes.map(n => n.id));
    this.updateRendererSelection();
    this.notifySelectionChanged();
  }

  private startConnectionDrag(
    screenPos: Position,
    worldPos: Position,
    nodeId: string,
    portType: 'input' | 'output',
    portIndex: number
  ): void {
    this.dragState = {
      type: 'connection',
      startScreenPos: screenPos,
      startWorldPos: worldPos,
      connectionSource: { nodeId, portType, portIndex }
    };

    this.canvas.style.cursor = 'crosshair';
  }

  private handleConnectionDrag(worldPos: Position): void {
    if (!this.dragState.connectionSource) return;

    const { nodeId, portType, portIndex } = this.dragState.connectionSource;
    const node = this.model.getNode(nodeId);
    if (!node) return;

    const portPos = this.renderer.getNodeRenderer().getPortPosition(node, portType, portIndex);
    
    // Check if we're over a valid target port
    const nodes = this.model.getNodes();
    const targetNode = this.renderer.hitTestNode(nodes, worldPos);
    let isValid = false;
    let snapPos = worldPos; // Position to snap to if over valid port

    if (targetNode && targetNode.id !== nodeId) {
      const targetPortHit = this.renderer.getNodeRenderer().hitTestPort(targetNode, worldPos);
      if (targetPortHit && targetPortHit.type !== portType) {
        // Check if connection would be valid
        if (portType === 'output') {
          isValid = this.model.canConnect(nodeId, portIndex, targetNode.id, targetPortHit.index);
        } else {
          isValid = this.model.canConnect(targetNode.id, targetPortHit.index, nodeId, portIndex);
        }
        
        // Snap to target port position for better visual feedback
        if (isValid) {
          snapPos = this.renderer.getNodeRenderer().getPortPosition(
            targetNode, 
            targetPortHit.type, 
            targetPortHit.index
          );
          this.canvas.style.cursor = 'pointer';
        } else {
          this.canvas.style.cursor = 'not-allowed';
        }
      } else {
        this.canvas.style.cursor = 'crosshair';
      }
    } else {
      this.canvas.style.cursor = 'crosshair';
    }

    if (portType === 'output') {
      this.renderer.setConnectionPreview(portPos, snapPos, isValid);
    } else {
      this.renderer.setConnectionPreview(snapPos, portPos, isValid);
    }

    this.render();
  }

  private finishConnectionDrag(worldPos: Position): void {
    if (!this.dragState.connectionSource) return;

    const { nodeId: sourceNodeId, portType: sourcePortType, portIndex: sourcePortIndex } = this.dragState.connectionSource;
    
    const nodes = this.model.getNodes();
    const targetNode = this.renderer.hitTestNode(nodes, worldPos);

    if (targetNode && targetNode.id !== sourceNodeId) {
      const targetPortHit = this.renderer.getNodeRenderer().hitTestPort(targetNode, worldPos);
      
      if (targetPortHit && targetPortHit.type !== sourcePortType) {
        let connection: Connection | undefined;

        if (sourcePortType === 'output') {
          connection = this.model.addConnection(
            sourceNodeId,
            sourcePortIndex,
            targetNode.id,
            targetPortHit.index
          );
        } else {
          connection = this.model.addConnection(
            targetNode.id,
            targetPortHit.index,
            sourceNodeId,
            sourcePortIndex
          );
        }

        if (connection && this.callbacks.onConnectionCreated) {
          this.callbacks.onConnectionCreated(connection);
        }
      }
    } else if (sourcePortType === 'output') {
      // Dragged from output port into empty space - show Quick Create Menu!
      // This is the "writers hate a blank page" feature
      this.showQuickCreateMenu(sourceNodeId, sourcePortIndex, worldPos);
    }

    this.render();
  }

  /**
   * Show the Quick Create Menu when dragging from a port into empty space
   * "Writers hate a blank page" - this ensures you're always extending from something
   */
  private showQuickCreateMenu(sourceNodeId: string, sourcePortIndex: number, worldPos: Position): void {
    const screenPos = this.viewport.toScreenCoords(worldPos);
    const rect = this.canvas.getBoundingClientRect();

    // Get the source node to determine last speaker
    const sourceNode = this.model.getNode(sourceNodeId);
    let lastSpeakerId: string | undefined;
    
    if (sourceNode && (sourceNode.nodeType === 'dialogue' || sourceNode.nodeType === 'dialogueFragment')) {
      const data = sourceNode.data as { type: string; data: { speaker?: string } };
      lastSpeakerId = data.data.speaker;
    }

    // Store pending state for when user makes selection
    this.pendingQuickCreate = {
      sourceNodeId,
      sourcePortIndex,
      worldPos,
      screenPos: { x: rect.left + screenPos.x, y: rect.top + screenPos.y }
    };

    // Show the menu
    this.quickCreateMenu.show({
      position: { x: rect.left + screenPos.x, y: rect.top + screenPos.y },
      sourceNodeId,
      sourcePortIndex,
      characters: this.model.getCharacters(),
      lastSpeakerId,
      onSelect: (option: QuickCreateOption) => this.handleQuickCreateSelection(option),
      onCancel: () => this.handleQuickCreateCancel()
    });
  }

  /**
   * Handle selection from Quick Create Menu
   */
  private handleQuickCreateSelection(option: QuickCreateOption): void {
    if (!this.pendingQuickCreate) return;

    const { sourceNodeId, sourcePortIndex, worldPos } = this.pendingQuickCreate;

    // Create the new node with smart positioning to avoid overlap
    const smartPos = findNonOverlappingPosition(
      this.model.getNodes(),
      { x: worldPos.x, y: worldPos.y - 40 }
    );
    const newNode = this.model.addNode(option.type, smartPos);

    // Apply preset data if provided (e.g., pre-selected speaker)
    if (option.preset?.speakerId && (newNode.nodeType === 'dialogue' || newNode.nodeType === 'dialogueFragment')) {
      const data = newNode.data as { type: string; data: { speaker?: string; text: string } };
      data.data.speaker = option.preset.speakerId;
    }

    // Create the connection from source to new node
    const connection = this.model.addConnection(
      sourceNodeId,
      sourcePortIndex,
      newNode.id,
      0 // Connect to first input port
    );

    // Select the new node
    this.selectedNodeIds.clear();
    this.selectedNodeIds.add(newNode.id);
    this.updateRendererSelection();
    this.notifySelectionChanged();

    // Notify callbacks
    if (this.callbacks.onNodeCreated) {
      this.callbacks.onNodeCreated(newNode);
    }
    if (connection && this.callbacks.onConnectionCreated) {
      this.callbacks.onConnectionCreated(connection);
    }

    this.pendingQuickCreate = null;
    this.render();
  }

  /**
   * Handle cancellation of Quick Create Menu
   */
  private handleQuickCreateCancel(): void {
    this.pendingQuickCreate = null;
  }

  // ==================== HOVER STATE ====================

  private updateHoverState(worldPos: Position): void {
    const nodes = this.model.getNodes();
    const hitNode = this.renderer.hitTestNode(nodes, worldPos);

    // Update node hover
    const newHoveredNodeId = hitNode?.id || null;
    if (newHoveredNodeId !== this.hoveredNodeId) {
      this.hoveredNodeId = newHoveredNodeId;
      this.renderer.setHoveredNode(newHoveredNodeId);
    }

    // Update port hover
    if (hitNode) {
      const portHit = this.renderer.getNodeRenderer().hitTestPort(hitNode, worldPos);
      if (portHit) {
        this._hoveredPortInfo = { nodeId: hitNode.id, type: portHit.type, index: portHit.index };
        this.canvas.style.cursor = 'crosshair';
      } else {
        this._hoveredPortInfo = null;
        this.canvas.style.cursor = this.dragState.type === 'none' ? 'default' : this.canvas.style.cursor;
      }
    } else {
      this._hoveredPortInfo = null;
      if (this.dragState.type === 'none') {
        this.canvas.style.cursor = 'default';
      }
    }

    // Update connection hover
    if (!hitNode) {
      const connections = this.model.getConnections();
      const hitConnection = this.renderer.hitTestConnection(connections, nodes, worldPos);
      this.renderer.setHoveredConnection(hitConnection?.id || null);
    } else {
      this.renderer.setHoveredConnection(null);
    }

    this.render();
  }

  // ==================== SELECTION ====================

  private selectConnection(connectionId: string): void {
    this.selectedNodeIds.clear();
    this.selectedConnectionId = connectionId;
    this.updateRendererSelection();

    if (this.callbacks.onConnectionSelected) {
      this.callbacks.onConnectionSelected(connectionId);
    }
  }

  private clearSelection(): void {
    this.selectedNodeIds.clear();
    this.selectedConnectionId = null;
    this.updateRendererSelection();
    this.notifySelectionChanged();
  }

  private selectAll(): void {
    const nodes = this.model.getNodes();
    this.selectedNodeIds = new Set(nodes.map(n => n.id));
    this.updateRendererSelection();
    this.notifySelectionChanged();
  }

  private updateRendererSelection(): void {
    this.renderer.setSelectedNodes(this.selectedNodeIds);
    this.renderer.setSelectedConnections(
      this.selectedConnectionId ? new Set([this.selectedConnectionId]) : new Set()
    );
  }

  private notifySelectionChanged(): void {
    if (this.callbacks.onNodeSelected) {
      this.callbacks.onNodeSelected(Array.from(this.selectedNodeIds));
    }
  }

  // ==================== ACTIONS ====================

  deleteSelected(): void {
    // Delete selected connection
    if (this.selectedConnectionId) {
      this.model.removeConnection(this.selectedConnectionId);
      this.selectedConnectionId = null;
    }

    // Delete selected nodes
    for (const nodeId of this.selectedNodeIds) {
      this.model.removeNode(nodeId);
    }
    this.selectedNodeIds.clear();

    this.updateRendererSelection();
    this.render();
  }

  duplicateSelected(): void {
    const newNodeIds: string[] = [];

    for (const nodeId of this.selectedNodeIds) {
      const cloned = this.model.cloneNode(nodeId);
      if (cloned) {
        newNodeIds.push(cloned.id);
      }
    }

    // Select the new nodes
    this.selectedNodeIds = new Set(newNodeIds);
    this.updateRendererSelection();
    this.notifySelectionChanged();
    this.render();
  }

  /**
   * Add a node at a position with smart positioning to avoid overlap
   */
  addNode(nodeType: NodeType, worldPos: Position): Node {
    // Use smart positioning to prevent node overlap
    const smartPos = findNonOverlappingPosition(this.model.getNodes(), worldPos);
    const node = this.model.addNode(nodeType, smartPos);
    
    // Select the new node
    this.selectedNodeIds.clear();
    this.selectedNodeIds.add(node.id);
    this.updateRendererSelection();
    this.notifySelectionChanged();

    if (this.callbacks.onNodeCreated) {
      this.callbacks.onNodeCreated(node);
    }

    this.render();
    return node;
  }

  /**
   * Get selected node IDs
   */
  getSelectedNodeIds(): string[] {
    return Array.from(this.selectedNodeIds);
  }

  /**
   * Force render
   */
  render(): void {
    this.renderer.render(this.model);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    // Remove event listeners
    window.removeEventListener('keydown', this.onKeyDown.bind(this));
  }
}
