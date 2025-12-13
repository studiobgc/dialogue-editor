/**
 * Manages all user interactions with the graph editor
 */

import { Node, Position, NodeType, Connection } from '../types/graph';
import { GraphModel } from '../core/GraphModel';
import { GraphRenderer } from '../renderer/GraphRenderer';
import { Viewport } from '../renderer/Viewport';

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
  private hoveredPortInfo: { nodeId: string; type: 'input' | 'output'; index: number } | null = null;

  private lastClickTime = 0;
  private lastClickNodeId: string | null = null;
  private doubleClickThreshold = 300;

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

    // Middle mouse button = pan
    if (e.button === 1) {
      this.startPan(screenPos, worldPos);
      e.preventDefault();
      return;
    }

    // Left mouse button
    if (e.button === 0) {
      const nodes = this.model.getNodes();
      const hitNode = this.renderer.hitTestNode(nodes, worldPos);

      // Check for port click first
      if (hitNode) {
        const portHit = this.renderer.getNodeRenderer().hitTestPort(hitNode, worldPos);
        if (portHit) {
          this.startConnectionDrag(screenPos, worldPos, hitNode.id, portHit.type, portHit.index);
          return;
        }
      }

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

    this.renderer.setConnectionPreview(null, null);
    this.renderer.setSelectionBox(null, null);
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();

    const screenPos = this.getScreenPos(e);
    
    // Smooth zoom with momentum - smaller steps for smoother feel
    const zoomIntensity = 0.002;
    const delta = -e.deltaY * zoomIntensity;
    const currentZoom = this.viewport.getZoom();
    const newZoom = currentZoom * (1 + delta);

    this.viewport.setZoom(newZoom, screenPos.x, screenPos.y);
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
  }

  // ==================== DRAG HANDLERS ====================

  private startPan(screenPos: Position, worldPos: Position): void {
    this.dragState = {
      type: 'pan',
      startScreenPos: screenPos,
      startWorldPos: worldPos
    };
    this.canvas.style.cursor = 'grabbing';
  }

  private handlePan(screenPos: Position): void {
    const dx = screenPos.x - this.dragState.startScreenPos.x;
    const dy = screenPos.y - this.dragState.startScreenPos.y;
    
    this.viewport.pan(dx, dy);
    this.dragState.startScreenPos = screenPos;
    
    this.render();
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

    for (const [nodeId, startPos] of this.dragState.nodeStartPositions) {
      this.model.updateNodePosition(nodeId, {
        x: startPos.x + dx,
        y: startPos.y + dy
      });
    }

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
    }

    this.render();
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
        this.hoveredPortInfo = { nodeId: hitNode.id, type: portHit.type, index: portHit.index };
        this.canvas.style.cursor = 'crosshair';
      } else {
        this.hoveredPortInfo = null;
        this.canvas.style.cursor = this.dragState.type === 'none' ? 'default' : this.canvas.style.cursor;
      }
    } else {
      this.hoveredPortInfo = null;
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
   * Add a node at a position
   */
  addNode(nodeType: NodeType, worldPos: Position): Node {
    const node = this.model.addNode(nodeType, worldPos);
    
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
