/**
 * Renders nodes on the canvas - Articy Draft style
 * Clean, flat design with solid color headers and clear typography
 */

import { Node, Position, Character } from '../types/graph';
import { NODE_CONFIGS } from '../core/NodeFactory';
import { Viewport } from './Viewport';

// Character lookup function type
type CharacterLookup = (id: string) => Character | undefined;

export interface NodeRenderStyle {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  textColor: string;
  textSecondary: string;
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

// Articy-inspired dark theme
const DEFAULT_STYLE: NodeRenderStyle = {
  backgroundColor: '#2d2d30',      // VS Code dark gray
  borderColor: '#3e3e42',          // Subtle border
  borderWidth: 1,
  textColor: '#cccccc',            // Light gray text
  textSecondary: '#858585',        // Dimmed text
  selectedBorderColor: '#007acc',  // VS Code blue
  hoveredBorderColor: '#505050',   // Subtle hover
  portRadius: 6,                   // Slightly larger ports
  portColor: '#858585',
  portConnectedColor: '#4ec9b0',   // Teal for connected
  cornerRadius: 3,                 // Articy uses very slight rounding
  headerHeight: 26,                // Compact header like Articy
  fontFamily: 'Segoe UI, -apple-system, BlinkMacSystemFont, sans-serif',
  fontSize: 12,
  titleFontSize: 12
};

export class NodeRenderer {
  private style: NodeRenderStyle;
  private connectedPorts: Set<string> = new Set();
  private characterLookup: CharacterLookup = () => undefined;

  constructor(style?: Partial<NodeRenderStyle>) {
    this.style = { ...DEFAULT_STYLE, ...style };
  }

  /**
   * Set the character lookup function for resolving speaker IDs to names
   */
  setCharacterLookup(lookup: CharacterLookup): void {
    this.characterLookup = lookup;
  }

  /**
   * Set which ports are connected
   */
  setConnectedPorts(portIds: Set<string>): void {
    this.connectedPorts = portIds;
  }

  /**
   * Render a node - Articy Draft style
   * Clean flat design with solid color header bar
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

    if (!width || !height || width <= 0 || height <= 0) return;
    if (!viewport.isRectVisible(x, y, width, height)) return;

    const config = NODE_CONFIGS[node.nodeType];
    const nodeColor = node.color || config.color;

    ctx.save();

    // === SHADOW (subtle, Articy-style) ===
    if (isSelected) {
      ctx.shadowColor = 'rgba(0, 122, 204, 0.5)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 2;
    } else {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;
    }

    // === NODE BODY ===
    ctx.fillStyle = this.style.backgroundColor;
    this.roundRect(ctx, x, y, width, height, this.style.cornerRadius);
    ctx.fill();

    // Reset shadow for rest of drawing
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // === HEADER BAR (solid color like Articy) ===
    ctx.fillStyle = nodeColor;
    this.roundRectTop(ctx, x, y, width, this.style.headerHeight, this.style.cornerRadius);
    ctx.fill();

    // === BORDER ===
    if (isSelected) {
      ctx.strokeStyle = this.style.selectedBorderColor;
      ctx.lineWidth = 2;
    } else if (isHovered) {
      ctx.strokeStyle = this.style.hoveredBorderColor;
      ctx.lineWidth = 1;
    } else {
      ctx.strokeStyle = this.style.borderColor;
      ctx.lineWidth = 1;
    }
    this.roundRect(ctx, x, y, width, height, this.style.cornerRadius);
    ctx.stroke();

    // === HEADER TEXT (node type) ===
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${this.style.titleFontSize}px ${this.style.fontFamily}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const title = this.getNodeTitle(node);
    ctx.fillText(title, x + 10, y + this.style.headerHeight / 2);

    // === CONTENT AREA ===
    this.drawNodeContent(ctx, node, x, y + this.style.headerHeight, width, height - this.style.headerHeight);

    ctx.restore();

    // === PORTS (drawn outside save/restore for crisp rendering) ===
    this.drawPorts(ctx, node, isHovered || isSelected);
  }

  /**
   * Draw input and output ports - Articy style (simple clean circles)
   */
  private drawPorts(ctx: CanvasRenderingContext2D, node: Node, isActive: boolean): void {
    const { x, y } = node.position;
    const { width, height } = node.size;
    const r = this.style.portRadius;

    // Input ports (left side) - Articy positions them at node edge
    const inputSpacing = height / (node.inputPorts.length + 1);
    node.inputPorts.forEach((port, i) => {
      const py = y + inputSpacing * (i + 1);
      const isConnected = this.connectedPorts.has(port.id);
      
      // Port circle
      ctx.beginPath();
      ctx.arc(x, py, r, 0, Math.PI * 2);
      
      if (isConnected) {
        ctx.fillStyle = this.style.portConnectedColor;
        ctx.fill();
      } else {
        ctx.fillStyle = this.style.backgroundColor;
        ctx.fill();
        ctx.strokeStyle = isActive ? '#ffffff' : this.style.portColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });

    // Output ports (right side)
    const outputSpacing = height / (node.outputPorts.length + 1);
    node.outputPorts.forEach((port, i) => {
      const py = y + outputSpacing * (i + 1);
      const isConnected = this.connectedPorts.has(port.id);
      
      ctx.beginPath();
      ctx.arc(x + width, py, r, 0, Math.PI * 2);
      
      if (isConnected) {
        ctx.fillStyle = this.style.portConnectedColor;
        ctx.fill();
      } else {
        ctx.fillStyle = this.style.backgroundColor;
        ctx.fill();
        ctx.strokeStyle = isActive ? '#ffffff' : this.style.portColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });
  }

  /**
   * Draw node-specific content - Articy style with clean typography
   */
  private drawNodeContent(
    ctx: CanvasRenderingContext2D,
    node: Node,
    x: number,
    y: number,
    width: number,
    _height: number
  ): void {
    const pad = 10;
    const tx = x + pad;
    const ty = y + 6;
    const maxW = width - pad * 2;
    const lh = 15; // line height

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    switch (node.nodeType) {
      case 'dialogue':
      case 'dialogueFragment': {
        const data = node.data as { type: string; data: { speaker?: string; text: string } };
        const speakerId = data.data.speaker;
        const text = data.data.text;
        
        // Look up character to get display name and color
        const character = speakerId ? this.characterLookup(speakerId) : undefined;
        const speakerName = character?.displayName || speakerId;
        const speakerColor = character?.color || '#569cd6';
        
        // Speaker name in character color
        if (speakerName) {
          ctx.fillStyle = speakerColor;
          ctx.font = `bold ${this.style.fontSize}px ${this.style.fontFamily}`;
          ctx.fillText(speakerName, tx, ty);
        }
        
        // Dialogue text
        if (text) {
          ctx.fillStyle = this.style.textColor;
          ctx.font = `${this.style.fontSize}px ${this.style.fontFamily}`;
          const lines = this.wrapText(ctx, text, maxW, 3);
          const startY = speakerName ? ty + lh : ty;
          lines.forEach((line, i) => {
            ctx.fillText(line, tx, startY + lh * i);
          });
        } else {
          // Placeholder
          ctx.fillStyle = this.style.textSecondary;
          ctx.font = `italic ${this.style.fontSize}px ${this.style.fontFamily}`;
          ctx.fillText('Double-click to edit...', tx, speakerName ? ty + lh : ty);
        }
        break;
      }

      case 'condition': {
        const data = node.data as { type: 'condition'; data: { script: { expression: string } } };
        ctx.fillStyle = '#4ec9b0'; // Teal for code
        ctx.font = `${this.style.fontSize}px "Consolas", "SF Mono", monospace`;
        const expr = data.data.script.expression || 'if (condition)';
        ctx.fillText(this.truncateText(ctx, expr, maxW), tx, ty);
        break;
      }

      case 'instruction': {
        const data = node.data as { type: 'instruction'; data: { script: { expression: string } } };
        ctx.fillStyle = '#dcdcaa'; // Yellow for instructions
        ctx.font = `${this.style.fontSize}px "Consolas", "SF Mono", monospace`;
        const expr = data.data.script.expression || 'action()';
        ctx.fillText(this.truncateText(ctx, expr, maxW), tx, ty);
        break;
      }

      case 'jump': {
        const data = node.data as { type: 'jump'; data: { targetNodeId?: string } };
        ctx.fillStyle = this.style.textSecondary;
        ctx.font = `${this.style.fontSize}px ${this.style.fontFamily}`;
        const target = data.data.targetNodeId ? `→ ${data.data.targetNodeId.substring(0, 16)}` : '(no target)';
        ctx.fillText(target, tx, ty);
        break;
      }

      case 'hub': {
        ctx.fillStyle = this.style.textSecondary;
        ctx.font = `${this.style.fontSize}px ${this.style.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.fillText('Hub', x + width / 2, ty);
        break;
      }

      case 'flowFragment': {
        const data = node.data as { type: 'flowFragment'; data: { displayName: string; text?: string } };
        if (data.data.text) {
          ctx.fillStyle = this.style.textColor;
          ctx.font = `${this.style.fontSize}px ${this.style.fontFamily}`;
          const lines = this.wrapText(ctx, data.data.text, maxW, 4);
          lines.forEach((line, i) => {
            ctx.fillText(line, tx, ty + lh * i);
          });
        }
        break;
      }
    }
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
   * Hit test for port click - larger hit area for easier targeting
   */
  hitTestPort(node: Node, worldPos: Position): { type: 'input' | 'output'; index: number } | null {
    const hitRadius = this.style.portRadius + 8; // Generous hit area

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
