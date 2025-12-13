/**
 * Renders nodes on the canvas
 */

import { Node, NodeType, Position } from '../types/graph';
import { NODE_CONFIGS } from '../core/NodeFactory';
import { Viewport } from './Viewport';

export interface NodeRenderStyle {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  textColor: string;
  selectedBorderColor: string;
  hoveredBorderColor: string;
  portRadius: number;
  portColor: string;
  portConnectedColor: string;
  cornerRadius: number;
  headerHeight: number;
  fontFamily: string;
  fontSize: number;
  titleFontSize: number;
}

const DEFAULT_STYLE: NodeRenderStyle = {
  backgroundColor: '#2a2a3e',
  borderColor: '#4a4a6a',
  borderWidth: 2,
  textColor: '#e4e4ef',
  selectedBorderColor: '#7c3aed',
  hoveredBorderColor: '#a78bfa',
  portRadius: 6,
  portColor: '#6b7280',
  portConnectedColor: '#7ed321',
  cornerRadius: 8,
  headerHeight: 28,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: 12,
  titleFontSize: 13
};

export class NodeRenderer {
  private style: NodeRenderStyle;
  private connectedPorts: Set<string> = new Set();

  constructor(style?: Partial<NodeRenderStyle>) {
    this.style = { ...DEFAULT_STYLE, ...style };
  }

  /**
   * Set which ports are connected
   */
  setConnectedPorts(portIds: Set<string>): void {
    this.connectedPorts = portIds;
  }

  /**
   * Render a node
   */
  renderNode(
    ctx: CanvasRenderingContext2D,
    node: Node,
    viewport: Viewport,
    isSelected: boolean,
    isHovered: boolean
  ): void {
    const { x, y } = node.position;
    const { width, height } = node.size;

    // Skip if not visible
    if (!viewport.isRectVisible(x, y, width, height)) return;

    const config = NODE_CONFIGS[node.nodeType];
    const nodeColor = node.color || config.color;

    // Draw shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;

    // Draw node body
    ctx.fillStyle = this.style.backgroundColor;
    this.roundRect(ctx, x, y, width, height, this.style.cornerRadius);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Draw header
    ctx.fillStyle = nodeColor;
    this.roundRectTop(ctx, x, y, width, this.style.headerHeight, this.style.cornerRadius);
    ctx.fill();

    // Draw border
    ctx.strokeStyle = isSelected 
      ? this.style.selectedBorderColor 
      : isHovered 
        ? this.style.hoveredBorderColor 
        : this.style.borderColor;
    ctx.lineWidth = isSelected ? 3 : this.style.borderWidth;
    this.roundRect(ctx, x, y, width, height, this.style.cornerRadius);
    ctx.stroke();

    // Draw node type icon
    this.drawNodeIcon(ctx, node.nodeType, x + 8, y + 6, 16);

    // Draw title
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${this.style.titleFontSize}px ${this.style.fontFamily}`;
    ctx.textBaseline = 'middle';
    const title = this.getNodeTitle(node);
    const maxTitleWidth = width - 40;
    const truncatedTitle = this.truncateText(ctx, title, maxTitleWidth);
    ctx.fillText(truncatedTitle, x + 28, y + this.style.headerHeight / 2);

    // Draw content based on node type
    this.drawNodeContent(ctx, node, x, y + this.style.headerHeight, width, height - this.style.headerHeight);

    // Draw ports
    this.drawPorts(ctx, node, isHovered);
  }

  /**
   * Draw input and output ports
   */
  private drawPorts(ctx: CanvasRenderingContext2D, node: Node, isHovered: boolean): void {
    const { x, y } = node.position;
    const { width, height } = node.size;

    // Input ports (left side)
    const inputSpacing = height / (node.inputPorts.length + 1);
    node.inputPorts.forEach((port, i) => {
      const portY = y + inputSpacing * (i + 1);
      const isConnected = this.connectedPorts.has(port.id);
      
      ctx.beginPath();
      ctx.arc(x, portY, this.style.portRadius, 0, Math.PI * 2);
      ctx.fillStyle = isConnected ? this.style.portConnectedColor : this.style.portColor;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw port label if hovered
      if (isHovered && port.label) {
        ctx.fillStyle = this.style.textColor;
        ctx.font = `11px ${this.style.fontFamily}`;
        ctx.textAlign = 'left';
        ctx.fillText(port.label, x + 12, portY + 3);
      }
    });

    // Output ports (right side)
    const outputSpacing = height / (node.outputPorts.length + 1);
    node.outputPorts.forEach((port, i) => {
      const portY = y + outputSpacing * (i + 1);
      const isConnected = this.connectedPorts.has(port.id);
      
      ctx.beginPath();
      ctx.arc(x + width, portY, this.style.portRadius, 0, Math.PI * 2);
      ctx.fillStyle = isConnected ? this.style.portConnectedColor : this.style.portColor;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw port label if hovered
      if (isHovered && port.label) {
        ctx.fillStyle = this.style.textColor;
        ctx.font = `11px ${this.style.fontFamily}`;
        ctx.textAlign = 'right';
        ctx.fillText(port.label, x + width - 12, portY + 3);
      }
    });
  }

  /**
   * Draw node-specific content
   */
  private drawNodeContent(
    ctx: CanvasRenderingContext2D,
    node: Node,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    ctx.fillStyle = this.style.textColor;
    ctx.font = `${this.style.fontSize}px ${this.style.fontFamily}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    const padding = 10;
    const textX = x + padding;
    const textY = y + 8;
    const maxWidth = width - padding * 2;
    const lineHeight = 16;

    switch (node.nodeType) {
      case 'dialogue':
      case 'dialogueFragment': {
        const data = node.data as { type: string; data: { speaker?: string; text: string } };
        
        // Draw speaker
        if (data.data.speaker) {
          ctx.fillStyle = '#a78bfa';
          ctx.font = `600 ${this.style.fontSize}px ${this.style.fontFamily}`;
          ctx.fillText(data.data.speaker + ':', textX, textY);
        }
        
        // Draw text preview
        if (data.data.text) {
          ctx.fillStyle = this.style.textColor;
          ctx.font = `${this.style.fontSize}px ${this.style.fontFamily}`;
          const lines = this.wrapText(ctx, data.data.text, maxWidth, 3);
          lines.forEach((line, i) => {
            ctx.fillText(line, textX, textY + lineHeight * (i + 1));
          });
        }
        break;
      }

      case 'condition': {
        const data = node.data as { type: 'condition'; data: { script: { expression: string } } };
        ctx.fillStyle = '#10b981';
        ctx.font = `italic ${this.style.fontSize}px "SF Mono", "Fira Code", monospace`;
        const expr = data.data.script.expression || '(empty condition)';
        ctx.fillText(this.truncateText(ctx, expr, maxWidth), textX, textY);
        break;
      }

      case 'instruction': {
        const data = node.data as { type: 'instruction'; data: { script: { expression: string } } };
        ctx.fillStyle = '#8b5cf6';
        ctx.font = `italic ${this.style.fontSize}px "SF Mono", "Fira Code", monospace`;
        const expr = data.data.script.expression || '(empty instruction)';
        ctx.fillText(this.truncateText(ctx, expr, maxWidth), textX, textY);
        break;
      }

      case 'jump': {
        const data = node.data as { type: 'jump'; data: { targetNodeId?: string } };
        ctx.fillStyle = '#f59e0b';
        const target = data.data.targetNodeId ? `→ ${data.data.targetNodeId.substring(0, 12)}...` : '(no target)';
        ctx.fillText(target, textX, textY);
        break;
      }

      case 'hub': {
        ctx.fillStyle = '#06b6d4';
        ctx.textAlign = 'center';
        ctx.fillText('⋮', x + width / 2, textY);
        break;
      }

      case 'flowFragment': {
        const data = node.data as { type: 'flowFragment'; data: { displayName: string; text?: string } };
        ctx.fillStyle = this.style.textColor;
        if (data.data.text) {
          const lines = this.wrapText(ctx, data.data.text, maxWidth, 4);
          lines.forEach((line, i) => {
            ctx.fillText(line, textX, textY + lineHeight * i);
          });
        }
        break;
      }
    }
  }

  /**
   * Draw a node type icon
   */
  private drawNodeIcon(ctx: CanvasRenderingContext2D, nodeType: NodeType, x: number, y: number, size: number): void {
    ctx.fillStyle = '#ffffff';
    ctx.font = `${size - 2}px ${this.style.fontFamily}`;
    ctx.textBaseline = 'top';
    
    const icons: Record<NodeType, string> = {
      dialogue: '💬',
      dialogueFragment: '💭',
      branch: '⑂',
      condition: '?',
      instruction: '⚡',
      hub: '◉',
      jump: '↗',
      flowFragment: '▣'
    };
    
    ctx.fillText(icons[nodeType] || '■', x, y);
  }

  /**
   * Get the title for a node
   */
  private getNodeTitle(node: Node): string {
    switch (node.nodeType) {
      case 'dialogue':
        return 'Dialogue';
      case 'dialogueFragment':
        return 'Fragment';
      case 'flowFragment': {
        const data = node.data as { type: 'flowFragment'; data: { displayName: string } };
        return data.data.displayName || 'Flow Fragment';
      }
      default:
        return NODE_CONFIGS[node.nodeType].displayName;
    }
  }

  /**
   * Get the position of a port
   */
  getPortPosition(node: Node, portType: 'input' | 'output', portIndex: number): Position {
    const { x, y } = node.position;
    const { width, height } = node.size;

    if (portType === 'input') {
      const ports = node.inputPorts;
      const spacing = height / (ports.length + 1);
      return { x, y: y + spacing * (portIndex + 1) };
    } else {
      const ports = node.outputPorts;
      const spacing = height / (ports.length + 1);
      return { x: x + width, y: y + spacing * (portIndex + 1) };
    }
  }

  /**
   * Hit test for port click
   */
  hitTestPort(node: Node, worldPos: Position): { type: 'input' | 'output'; index: number } | null {
    const hitRadius = this.style.portRadius + 4;

    // Check input ports
    for (let i = 0; i < node.inputPorts.length; i++) {
      const portPos = this.getPortPosition(node, 'input', i);
      const dx = worldPos.x - portPos.x;
      const dy = worldPos.y - portPos.y;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        return { type: 'input', index: i };
      }
    }

    // Check output ports
    for (let i = 0; i < node.outputPorts.length; i++) {
      const portPos = this.getPortPosition(node, 'output', i);
      const dx = worldPos.x - portPos.x;
      const dy = worldPos.y - portPos.y;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        return { type: 'output', index: i };
      }
    }

    return null;
  }

  // ==================== HELPER METHODS ====================

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private roundRectTop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    const ellipsis = '...';
    let width = ctx.measureText(text).width;
    
    if (width <= maxWidth) return text;
    
    while (width > maxWidth && text.length > 0) {
      text = text.slice(0, -1);
      width = ctx.measureText(text + ellipsis).width;
    }
    
    return text + ellipsis;
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = ctx.measureText(testLine).width;

      if (width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;

        if (lines.length >= maxLines) {
          lines[lines.length - 1] = this.truncateText(ctx, lines[lines.length - 1], maxWidth);
          break;
        }
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine && lines.length < maxLines) {
      lines.push(currentLine);
    }

    return lines;
  }
}
