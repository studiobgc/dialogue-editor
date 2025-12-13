/**
 * Main graph renderer that coordinates node and connection rendering
 */

import { Node, Connection, Position } from '../types/graph';
import { GraphModel } from '../core/GraphModel';
import { Viewport } from './Viewport';
import { NodeRenderer } from './NodeRenderer';
import { ConnectionRenderer } from './ConnectionRenderer';
import { RenderLoop, RenderStats } from './RenderLoop';
import { SpatialIndex } from './SpatialIndex';
import { NodeCache } from './NodeCache';

export interface GridStyle {
  minorGridSize: number;
  majorGridSize: number;
  minorGridColor: string;
  majorGridColor: string;
  backgroundColor: string;
}

const DEFAULT_GRID_STYLE: GridStyle = {
  minorGridSize: 20,
  majorGridSize: 100,
  minorGridColor: '#2a2a3e',
  majorGridColor: '#363652',
  backgroundColor: '#1e1e2e'
};

export class GraphRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private viewport: Viewport;
  private nodeRenderer: NodeRenderer;
  private connectionRenderer: ConnectionRenderer;
  private gridStyle: GridStyle;
  
  // Performance optimizations
  private renderLoop: RenderLoop;
  private spatialIndex: SpatialIndex;
  private nodeCache: NodeCache;
  private lastModel: GraphModel | null = null;
  private renderStats: RenderStats | null = null;
  
  private selectedNodeIds: Set<string> = new Set();
  private hoveredNodeId: string | null = null;
  private selectedConnectionIds: Set<string> = new Set();
  private hoveredConnectionId: string | null = null;
  
  private connectionPreview: { from: Position; to: Position; isValid: boolean } | null = null;
  private selectionBox: { start: Position; end: Position } | null = null;

  private needsRender = true;
  
  // Smooth animation state
  private targetZoom: number = 1;
  private targetPan: Position = { x: 0, y: 0 };
  private isAnimating: boolean = false;

  constructor(canvas: HTMLCanvasElement, gridStyle?: Partial<GridStyle>) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.gridStyle = { ...DEFAULT_GRID_STYLE, ...gridStyle };
    
    this.viewport = new Viewport(canvas.width, canvas.height);
    this.nodeRenderer = new NodeRenderer();
    this.connectionRenderer = new ConnectionRenderer(this.nodeRenderer);
    
    // Initialize performance systems
    this.renderLoop = new RenderLoop();
    this.spatialIndex = new SpatialIndex(200);
    this.nodeCache = new NodeCache();

    this.setupCanvas();
    this.startRenderLoop();
    
    // Track render stats
    this.renderLoop.onStats((stats) => {
      this.renderStats = stats;
    });
  }

  /**
   * Setup canvas for high DPI displays
   */
  private setupCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    
    this.ctx.scale(dpr, dpr);
    this.viewport.setSize(rect.width, rect.height);
  }

  /**
   * Handle window resize
   */
  resize(): void {
    this.setupCanvas();
    this.requestRender();
  }

  /**
   * Get the viewport
   */
  getViewport(): Viewport {
    return this.viewport;
  }

  /**
   * Get the node renderer
   */
  getNodeRenderer(): NodeRenderer {
    return this.nodeRenderer;
  }

  // ==================== SELECTION STATE ====================

  setSelectedNodes(nodeIds: Set<string>): void {
    this.selectedNodeIds = nodeIds;
    this.requestRender();
  }

  setHoveredNode(nodeId: string | null): void {
    if (this.hoveredNodeId !== nodeId) {
      this.hoveredNodeId = nodeId;
      this.requestRender();
    }
  }

  setSelectedConnections(connectionIds: Set<string>): void {
    this.selectedConnectionIds = connectionIds;
    this.requestRender();
  }

  setHoveredConnection(connectionId: string | null): void {
    if (this.hoveredConnectionId !== connectionId) {
      this.hoveredConnectionId = connectionId;
      this.requestRender();
    }
  }

  // ==================== PREVIEW STATE ====================

  setConnectionPreview(from: Position | null, to: Position | null, isValid = true): void {
    if (from && to) {
      this.connectionPreview = { from, to, isValid };
    } else {
      this.connectionPreview = null;
    }
    this.requestRender();
  }

  setSelectionBox(start: Position | null, end: Position | null): void {
    if (start && end) {
      this.selectionBox = { start, end };
    } else {
      this.selectionBox = null;
    }
    this.requestRender();
  }

  // ==================== RENDERING ====================

  requestRender(): void {
    this.needsRender = true;
    this.renderLoop.requestRender();
  }

  private startRenderLoop(): void {
    this.renderLoop.start((deltaTime) => {
      if (this.lastModel) {
        this.updateAnimations(deltaTime);
        this.renderInternal(this.lastModel);
      }
    });
  }
  
  private updateAnimations(deltaTime: number): void {
    if (!this.isAnimating) return;
    
    const lerpFactor = Math.min(1, deltaTime * 0.01); // Smooth interpolation
    const currentZoom = this.viewport.getZoom();
    const currentPan = this.viewport.getPan();
    
    // Lerp zoom
    const newZoom = currentZoom + (this.targetZoom - currentZoom) * lerpFactor;
    if (Math.abs(newZoom - this.targetZoom) > 0.001) {
      this.viewport.setZoom(newZoom);
    }
    
    // Lerp pan
    const newPanX = currentPan.x + (this.targetPan.x - currentPan.x) * lerpFactor;
    const newPanY = currentPan.y + (this.targetPan.y - currentPan.y) * lerpFactor;
    if (Math.abs(newPanX - this.targetPan.x) > 0.5 || Math.abs(newPanY - this.targetPan.y) > 0.5) {
      this.viewport.setPan(newPanX, newPanY);
      this.requestRender();
    } else {
      this.isAnimating = false;
    }
  }
  
  /**
   * Animate to a target zoom and pan
   */
  animateTo(zoom: number, panX: number, panY: number): void {
    this.targetZoom = zoom;
    this.targetPan = { x: panX, y: panY };
    this.isAnimating = true;
    this.requestRender();
  }
  
  /**
   * Get current render stats
   */
  getRenderStats(): RenderStats | null {
    return this.renderStats;
  }

  /**
   * Render the entire graph
   */
  render(model: GraphModel): void {
    this.lastModel = model;
    
    // Update spatial index if nodes changed
    const nodes = model.getNodes();
    this.spatialIndex.rebuild(nodes);
    
    this.requestRender();
  }
  
  /**
   * Internal render called by render loop
   */
  private renderInternal(model: GraphModel): void {
    const nodes = model.getNodes();
    const connections = model.getConnections();
    
    // Get visible bounds for culling
    const visibleBounds = this.viewport.getVisibleBounds();

    // Clear canvas with optimized clear
    this.ctx.fillStyle = this.gridStyle.backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Save context state
    this.ctx.save();

    // Apply viewport transform
    this.viewport.applyTransform(this.ctx);

    // Draw grid (skip if zoomed out too far)
    this.drawGrid();

    // Build node map for quick lookups
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Build set of connected port IDs
    const connectedPorts = new Set<string>();
    for (const conn of connections) {
      const fromNode = nodeMap.get(conn.fromNodeId);
      const toNode = nodeMap.get(conn.toNodeId);
      if (fromNode && fromNode.outputPorts[conn.fromPortIndex]) {
        connectedPorts.add(fromNode.outputPorts[conn.fromPortIndex].id);
      }
      if (toNode && toNode.inputPorts[conn.toPortIndex]) {
        connectedPorts.add(toNode.inputPorts[conn.toPortIndex].id);
      }
    }
    this.nodeRenderer.setConnectedPorts(connectedPorts);
    
    // Get visible node IDs using spatial index
    const visibleNodeIds = this.spatialIndex.queryRect(
      visibleBounds.minX,
      visibleBounds.minY,
      visibleBounds.maxX - visibleBounds.minX,
      visibleBounds.maxY - visibleBounds.minY
    );

    // Draw connections (behind nodes) - only for visible nodes
    for (const connection of connections) {
      // Skip if neither endpoint is visible
      if (!visibleNodeIds.has(connection.fromNodeId) && !visibleNodeIds.has(connection.toNodeId)) {
        continue;
      }
      
      const isSelected = this.selectedConnectionIds.has(connection.id);
      const isHovered = this.hoveredConnectionId === connection.id;
      this.connectionRenderer.renderConnection(
        this.ctx,
        connection,
        nodeMap,
        this.viewport,
        isSelected,
        isHovered
      );
    }

    // Draw connection preview
    if (this.connectionPreview) {
      this.connectionRenderer.renderPreview(
        this.ctx,
        this.connectionPreview.from,
        this.connectionPreview.to,
        this.connectionPreview.isValid
      );
    }

    // Draw only visible nodes
    for (const node of nodes) {
      if (!visibleNodeIds.has(node.id)) continue;
      
      const isSelected = this.selectedNodeIds.has(node.id);
      const isHovered = this.hoveredNodeId === node.id;
      this.nodeRenderer.renderNode(this.ctx, node, this.viewport, isSelected, isHovered);
    }

    // Draw selection box
    if (this.selectionBox) {
      this.drawSelectionBox();
    }

    // Restore context state
    this.ctx.restore();
  }

  /**
   * Draw the background grid
   */
  private drawGrid(): void {
    const bounds = this.viewport.getVisibleBounds();
    const zoom = this.viewport.getZoom();

    // Only draw grid if zoomed in enough
    if (zoom < 0.2) return;

    // Draw minor grid
    if (zoom > 0.5) {
      this.ctx.strokeStyle = this.gridStyle.minorGridColor;
      this.ctx.lineWidth = 1 / zoom;
      this.ctx.beginPath();

      const minorSize = this.gridStyle.minorGridSize;
      const startX = Math.floor(bounds.minX / minorSize) * minorSize;
      const startY = Math.floor(bounds.minY / minorSize) * minorSize;

      for (let x = startX; x <= bounds.maxX; x += minorSize) {
        if (x % this.gridStyle.majorGridSize !== 0) {
          this.ctx.moveTo(x, bounds.minY);
          this.ctx.lineTo(x, bounds.maxY);
        }
      }

      for (let y = startY; y <= bounds.maxY; y += minorSize) {
        if (y % this.gridStyle.majorGridSize !== 0) {
          this.ctx.moveTo(bounds.minX, y);
          this.ctx.lineTo(bounds.maxX, y);
        }
      }

      this.ctx.stroke();
    }

    // Draw major grid
    this.ctx.strokeStyle = this.gridStyle.majorGridColor;
    this.ctx.lineWidth = 1 / zoom;
    this.ctx.beginPath();

    const majorSize = this.gridStyle.majorGridSize;
    const startX = Math.floor(bounds.minX / majorSize) * majorSize;
    const startY = Math.floor(bounds.minY / majorSize) * majorSize;

    for (let x = startX; x <= bounds.maxX; x += majorSize) {
      this.ctx.moveTo(x, bounds.minY);
      this.ctx.lineTo(x, bounds.maxY);
    }

    for (let y = startY; y <= bounds.maxY; y += majorSize) {
      this.ctx.moveTo(bounds.minX, y);
      this.ctx.lineTo(bounds.maxX, y);
    }

    this.ctx.stroke();

    // Draw origin crosshair
    this.ctx.strokeStyle = '#4a4a6a';
    this.ctx.lineWidth = 2 / zoom;
    this.ctx.beginPath();
    this.ctx.moveTo(-20, 0);
    this.ctx.lineTo(20, 0);
    this.ctx.moveTo(0, -20);
    this.ctx.lineTo(0, 20);
    this.ctx.stroke();
  }

  /**
   * Draw the selection box
   */
  private drawSelectionBox(): void {
    if (!this.selectionBox) return;

    const { start, end } = this.selectionBox;
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);

    // Fill
    this.ctx.fillStyle = 'rgba(124, 58, 237, 0.1)';
    this.ctx.fillRect(x, y, width, height);

    // Border
    this.ctx.strokeStyle = '#7c3aed';
    this.ctx.lineWidth = 1 / this.viewport.getZoom();
    this.ctx.setLineDash([5 / this.viewport.getZoom(), 3 / this.viewport.getZoom()]);
    this.ctx.strokeRect(x, y, width, height);
    this.ctx.setLineDash([]);
  }

  // ==================== HIT TESTING ====================

  /**
   * Hit test for a node at the given world position
   */
  hitTestNode(nodes: Node[], worldPos: Position): Node | null {
    // Test in reverse order (top-most first)
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const { x, y } = node.position;
      const { width, height } = node.size;

      if (worldPos.x >= x && worldPos.x <= x + width &&
          worldPos.y >= y && worldPos.y <= y + height) {
        return node;
      }
    }
    return null;
  }

  /**
   * Hit test for a connection at the given world position
   */
  hitTestConnection(connections: Connection[], nodes: Node[], worldPos: Position): Connection | null {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    for (const connection of connections) {
      if (this.connectionRenderer.hitTestConnection(connection, nodeMap, worldPos)) {
        return connection;
      }
    }
    return null;
  }

  /**
   * Get nodes within a selection box
   */
  getNodesInBox(nodes: Node[], start: Position, end: Position): Node[] {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);

    return nodes.filter(node => {
      const { x, y } = node.position;
      const { width, height } = node.size;
      
      // Check if node intersects with selection box
      return !(x + width < minX || x > maxX || y + height < minY || y > maxY);
    });
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.renderLoop.stop();
    this.nodeCache.clear();
  }
  
  /**
   * Invalidate node cache for a specific node
   */
  invalidateNode(nodeId: string): void {
    this.nodeCache.invalidate(nodeId);
    this.requestRender();
  }
  
  /**
   * Get spatial index for external use
   */
  getSpatialIndex(): SpatialIndex {
    return this.spatialIndex;
  }
}
