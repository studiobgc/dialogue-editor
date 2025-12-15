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
  minorGridColor: '#313244', // Surface0
  majorGridColor: '#45475a', // Surface1
  backgroundColor: '#11111b' // Crust (Deepest dark)
};

export class GraphRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private viewport: Viewport;
  private nodeRenderer: NodeRenderer;
  private connectionRenderer: ConnectionRenderer;
  private gridStyle: GridStyle;
  private dpr: number = 1;
  
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
  private alignmentGuides: { type: 'h' | 'v'; pos: number }[] = [];

  private _needsRender = true;
  
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
    
    // Initialize viewport to show origin in visible area
    this.viewport.reset();
    
    // Track render stats
    this.renderLoop.onStats((stats) => {
      this.renderStats = stats;
    });
  }

  /**
   * Setup canvas for high DPI displays
   */
  private setupCanvas(): void {
    this.dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    
    // Don't use ctx.scale() here - we'll incorporate DPR into the viewport transform
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
   * Apply viewport transform with DPR scaling
   * This combines DPR scaling with viewport pan/zoom in a single transform
   */
  private applyViewportTransform(): void {
    const zoom = this.viewport.getZoom();
    const pan = this.viewport.getPan();
    // Combine DPR scaling with viewport transform
    this.ctx.setTransform(
      this.dpr * zoom,
      0,
      0,
      this.dpr * zoom,
      this.dpr * pan.x,
      this.dpr * pan.y
    );
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

  setAlignmentGuides(guides: { type: 'h' | 'v'; pos: number }[]): void {
    this.alignmentGuides = guides;
    this.requestRender();
  }

  // ==================== RENDERING ====================

  requestRender(): void {
    this._needsRender = true;
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

    // Clear canvas with optimized clear (use CSS dimensions, not canvas pixel dimensions)
    const cssWidth = this.canvas.width / this.dpr;
    const cssHeight = this.canvas.height / this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.fillStyle = this.gridStyle.backgroundColor;
    this.ctx.fillRect(0, 0, cssWidth, cssHeight);

    // Save context state
    this.ctx.save();

    // Apply viewport transform with DPR scaling
    this.applyViewportTransform();

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

    // Draw alignment guides (Figma-style red lines)
    if (this.alignmentGuides.length > 0) {
      this.drawAlignmentGuides();
    }

    // Draw empty state guidance (Articy-style onboarding)
    if (nodes.length === 0) {
      this.drawEmptyStateGuidance();
    }

    // Restore context state
    this.ctx.restore();
  }

  /**
   * Draw empty canvas guidance - helps new users get started quickly
   */
  private drawEmptyStateGuidance(): void {
    const zoom = this.viewport.getZoom();
    const bounds = this.viewport.getVisibleBounds();
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    
    // Scale text inversely with zoom so it stays readable
    const fontSize = 14 / zoom;
    const smallFontSize = 12 / zoom;
    
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    // Main message
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    this.ctx.font = `600 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
    this.ctx.fillText('Press a key to create a node', centerX, centerY - 40 / zoom);
    
    // Keyboard shortcuts
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.font = `${smallFontSize}px "Segoe UI", system-ui, sans-serif`;
    
    const shortcuts = [
      'D = Dialogue   F = Fragment   B = Branch',
      'C = Condition   I = Instruction   H = Hub',
      '',
      'Or drag from the palette on the left'
    ];
    
    shortcuts.forEach((line, i) => {
      this.ctx.fillText(line, centerX, centerY + (i * 20) / zoom);
    });
  }

  /**
   * Draw alignment guides (Figma-style magenta/red lines)
   */
  private drawAlignmentGuides(): void {
    const bounds = this.viewport.getVisibleBounds();
    const zoom = this.viewport.getZoom();
    
    this.ctx.strokeStyle = '#ff4081'; // Magenta/pink like Figma
    this.ctx.lineWidth = 1 / zoom;
    this.ctx.setLineDash([4 / zoom, 4 / zoom]);

    for (const guide of this.alignmentGuides) {
      this.ctx.beginPath();
      if (guide.type === 'v') {
        // Vertical line
        this.ctx.moveTo(guide.pos, bounds.minY);
        this.ctx.lineTo(guide.pos, bounds.maxY);
      } else {
        // Horizontal line
        this.ctx.moveTo(bounds.minX, guide.pos);
        this.ctx.lineTo(bounds.maxX, guide.pos);
      }
      this.ctx.stroke();
    }

    this.ctx.setLineDash([]);
  }

  /**
   * Draw the background grid - optimized dot pattern like Figma
   */
  private drawGrid(): void {
    const bounds = this.viewport.getVisibleBounds();
    const zoom = this.viewport.getZoom();

    // Fade out grid at low zoom levels
    if (zoom < 0.15) return;
    
    const gridOpacity = Math.min(1, (zoom - 0.15) / 0.35);

    // Draw dot grid for minor spacing (more subtle, Figma-like)
    if (zoom > 0.4) {
      const dotSize = Math.max(1, 1.5 / zoom);
      const minorSize = this.gridStyle.minorGridSize;
      const startX = Math.floor(bounds.minX / minorSize) * minorSize;
      const startY = Math.floor(bounds.minY / minorSize) * minorSize;
      
      this.ctx.fillStyle = `rgba(74, 74, 106, ${0.4 * gridOpacity})`;
      
      for (let x = startX; x <= bounds.maxX; x += minorSize) {
        for (let y = startY; y <= bounds.maxY; y += minorSize) {
          // Skip major grid intersections
          if (x % this.gridStyle.majorGridSize === 0 && y % this.gridStyle.majorGridSize === 0) {
            continue;
          }
          this.ctx.beginPath();
          this.ctx.arc(x, y, dotSize, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
    }

    // Draw major grid lines (subtle)
    this.ctx.strokeStyle = `rgba(54, 54, 82, ${0.6 * gridOpacity})`;
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

    // Draw origin crosshair with glow
    const originOpacity = Math.min(1, zoom);
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(124, 58, 237, 0.3)';
    this.ctx.shadowBlur = 8;
    this.ctx.strokeStyle = `rgba(124, 58, 237, ${0.6 * originOpacity})`;
    this.ctx.lineWidth = 2 / zoom;
    this.ctx.beginPath();
    this.ctx.moveTo(-30, 0);
    this.ctx.lineTo(30, 0);
    this.ctx.moveTo(0, -30);
    this.ctx.lineTo(0, 30);
    this.ctx.stroke();
    this.ctx.restore();
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

    // Fill with subtle mauve
    this.ctx.fillStyle = 'rgba(203, 166, 247, 0.1)'; // Mauve with low opacity
    this.ctx.fillRect(x, y, width, height);

    // Border
    this.ctx.strokeStyle = '#cba6f7'; // Mauve
    this.ctx.lineWidth = 1 / this.viewport.getZoom();
    
    // Crisp solid border usually looks better in high fidelity than dashed for selection *area*
    // but Figma uses thin solid line. Articy uses dashed.
    // Let's go with a very thin solid line for a modern feel, or keep dashed if preferred.
    // Figma's selection rect is actually solid thin line.
    this.ctx.strokeRect(x, y, width, height);
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
