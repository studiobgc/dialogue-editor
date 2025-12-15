/**
 * Renders connections between nodes
 */

import { Connection, Node, Position } from '../types/graph';
import { NodeRenderer } from './NodeRenderer';
import { Viewport } from './Viewport';

export interface ConnectionRenderStyle {
  flowColor: string;
  dataColor: string;
  selectedColor: string;
  hoveredColor: string;
  lineWidth: number;
  selectedLineWidth: number;
  arrowSize: number;
  curveTension: number;
}

const DEFAULT_STYLE: ConnectionRenderStyle = {
  flowColor: '#a6e3a1', // Soft green
  dataColor: '#89b4fa', // Soft blue
  selectedColor: '#cba6f7', // Soft purple
  hoveredColor: '#f5c2e7', // Pink/light purple for hover
  lineWidth: 2,
  selectedLineWidth: 3,
  arrowSize: 8,
  curveTension: 0.5
};

export class ConnectionRenderer {
  private style: ConnectionRenderStyle;
  private nodeRenderer: NodeRenderer;

  constructor(nodeRenderer: NodeRenderer, style?: Partial<ConnectionRenderStyle>) {
    this.style = { ...DEFAULT_STYLE, ...style };
    this.nodeRenderer = nodeRenderer;
  }

  /**
   * Render a connection between two nodes
   */
  renderConnection(
    ctx: CanvasRenderingContext2D,
    connection: Connection,
    nodes: Map<string, Node>,
    viewport: Viewport,
    isSelected: boolean,
    isHovered: boolean
  ): void {
    const fromNode = nodes.get(connection.fromNodeId);
    const toNode = nodes.get(connection.toNodeId);

    if (!fromNode || !toNode) return;

    const fromPos = this.nodeRenderer.getPortPosition(fromNode, 'output', connection.fromPortIndex);
    const toPos = this.nodeRenderer.getPortPosition(toNode, 'input', connection.toPortIndex);

    this.renderCurve(ctx, fromPos, toPos, connection.connectionType, isSelected, isHovered);

    // Draw label if present
    if (connection.label) {
      this.renderLabel(ctx, fromPos, toPos, connection.label);
    }
  }

  /**
   * Render a preview connection while dragging
   */
  renderPreview(
    ctx: CanvasRenderingContext2D,
    fromPos: Position,
    toPos: Position,
    isValid: boolean
  ): void {
    ctx.save();
    
    const color = isValid ? this.style.flowColor : '#ef4444';
    const glowColor = isValid ? 'rgba(126, 211, 33, 0.4)' : 'rgba(239, 68, 68, 0.4)';
    
    // Draw glow effect
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 12;
    ctx.globalAlpha = 0.9;
    
    // Animated dash pattern
    const time = Date.now() / 100;
    ctx.setLineDash([12, 6]);
    ctx.lineDashOffset = -time % 18;
    
    this.drawBezierCurve(ctx, fromPos, toPos, color, this.style.lineWidth + 1);
    
    // Draw target indicator circle
    ctx.beginPath();
    ctx.arc(toPos.x, toPos.y, 8, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.stroke();
    
    // Inner dot
    ctx.beginPath();
    ctx.arc(toPos.x, toPos.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.restore();
  }

  /**
   * Render the bezier curve connection
   */
  private renderCurve(
    ctx: CanvasRenderingContext2D,
    fromPos: Position,
    toPos: Position,
    connectionType: 'flow' | 'data',
    isSelected: boolean,
    isHovered: boolean
  ): void {
    let color: string;
    if (isSelected) {
      color = this.style.selectedColor;
    } else if (isHovered) {
      color = this.style.hoveredColor;
    } else {
      color = connectionType === 'flow' ? this.style.flowColor : this.style.dataColor;
    }

    const lineWidth = isSelected ? this.style.selectedLineWidth : 
                      isHovered ? this.style.lineWidth + 1 : this.style.lineWidth;
    
    ctx.save();
    
    // Add glow effect for selected/hovered
    if (isSelected || isHovered) {
      ctx.shadowColor = isSelected ? 'rgba(124, 58, 237, 0.5)' : 'rgba(167, 139, 250, 0.4)';
      ctx.shadowBlur = isSelected ? 10 : 6;
    }
    
    this.drawBezierCurve(ctx, fromPos, toPos, color, lineWidth);
    this.drawArrow(ctx, fromPos, toPos, color, isSelected || isHovered);
    
    ctx.restore();
  }

  /**
   * Draw a bezier curve between two points
   */
  private drawBezierCurve(
    ctx: CanvasRenderingContext2D,
    from: Position,
    to: Position,
    color: string,
    lineWidth: number
  ): void {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';

    const dx = to.x - from.x;
    const controlPointOffset = Math.min(Math.abs(dx) * this.style.curveTension, 150);

    ctx.moveTo(from.x, from.y);
    ctx.bezierCurveTo(
      from.x + controlPointOffset,
      from.y,
      to.x - controlPointOffset,
      to.y,
      to.x,
      to.y
    );

    ctx.stroke();
  }

  /**
   * Draw an arrow at the end of the connection
   */
  private drawArrow(
    ctx: CanvasRenderingContext2D,
    from: Position,
    to: Position,
    color: string,
    isHighlighted: boolean = false
  ): void {
    const arrowSize = isHighlighted ? this.style.arrowSize + 2 : this.style.arrowSize;
    const dx = to.x - from.x;
    const controlPointOffset = Math.min(Math.abs(dx) * this.style.curveTension, 150);

    // Calculate the tangent at the end point
    const t = 0.98;
    const p0 = from;
    const p1 = { x: from.x + controlPointOffset, y: from.y };
    const p2 = { x: to.x - controlPointOffset, y: to.y };
    const p3 = to;

    // Bezier derivative at t
    const tangentX = 3 * (1 - t) * (1 - t) * (p1.x - p0.x) +
                     6 * (1 - t) * t * (p2.x - p1.x) +
                     3 * t * t * (p3.x - p2.x);
    const tangentY = 3 * (1 - t) * (1 - t) * (p1.y - p0.y) +
                     6 * (1 - t) * t * (p2.y - p1.y) +
                     3 * t * t * (p3.y - p2.y);

    const angle = Math.atan2(tangentY, tangentX);

    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - arrowSize * Math.cos(angle - Math.PI / 6),
      to.y - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      to.x - arrowSize * Math.cos(angle + Math.PI / 6),
      to.y - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Render a label on the connection
   */
  private renderLabel(
    ctx: CanvasRenderingContext2D,
    from: Position,
    to: Position,
    label: string
  ): void {
    // Position label at the midpoint of the curve
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;

    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const metrics = ctx.measureText(label);
    const padding = 4;
    const width = metrics.width + padding * 2;
    const height = 16;

    // Draw background
    ctx.fillStyle = '#2a2a3e';
    ctx.strokeStyle = '#4a4a6a';
    ctx.lineWidth = 1;
    
    ctx.beginPath();
    ctx.roundRect(midX - width / 2, midY - height / 2, width, height, 3);
    ctx.fill();
    ctx.stroke();

    // Draw text
    ctx.fillStyle = '#e4e4ef';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, midX, midY);
  }

  /**
   * Hit test for connection click
   */
  hitTestConnection(
    connection: Connection,
    nodes: Map<string, Node>,
    worldPos: Position,
    threshold = 8
  ): boolean {
    const fromNode = nodes.get(connection.fromNodeId);
    const toNode = nodes.get(connection.toNodeId);

    if (!fromNode || !toNode) return false;

    const from = this.nodeRenderer.getPortPosition(fromNode, 'output', connection.fromPortIndex);
    const to = this.nodeRenderer.getPortPosition(toNode, 'input', connection.toPortIndex);

    // Sample points along the bezier curve and check distance
    const dx = to.x - from.x;
    const controlPointOffset = Math.min(Math.abs(dx) * this.style.curveTension, 150);

    for (let t = 0; t <= 1; t += 0.05) {
      const point = this.bezierPoint(
        from,
        { x: from.x + controlPointOffset, y: from.y },
        { x: to.x - controlPointOffset, y: to.y },
        to,
        t
      );

      const distSq = (worldPos.x - point.x) ** 2 + (worldPos.y - point.y) ** 2;
      if (distSq <= threshold * threshold) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate a point on a bezier curve
   */
  private bezierPoint(p0: Position, p1: Position, p2: Position, p3: Position, t: number): Position {
    const cx = 3 * (p1.x - p0.x);
    const bx = 3 * (p2.x - p1.x) - cx;
    const ax = p3.x - p0.x - cx - bx;

    const cy = 3 * (p1.y - p0.y);
    const by = 3 * (p2.y - p1.y) - cy;
    const ay = p3.y - p0.y - cy - by;

    const t2 = t * t;
    const t3 = t2 * t;

    return {
      x: ax * t3 + bx * t2 + cx * t + p0.x,
      y: ay * t3 + by * t2 + cy * t + p0.y
    };
  }
}
