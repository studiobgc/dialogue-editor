/**
 * SceneRenderer - Outsider Art-Inspired Illustration System
 * 
 * Inspired by 1960s outsider artists:
 * - Henry Darger (dense, layered, obsessive)
 * - Adolf Wölfli (pattern-heavy, horror vacui)
 * - Martín Ramírez (repetitive lines, tunnels)
 * - Bill Traylor (simple but powerful shapes)
 * 
 * Techniques:
 * - Wobbly, shaking lines (nothing is straight)
 * - Repetitive mark-making (hatching, spirals, dots)
 * - Asymmetry (intentionally off-balance)
 * - Dense layering (multiple passes)
 * - Raw, visible strokes
 * - Horror vacui (fill the space)
 */

export interface SceneConfig {
  location: string;
  characters: string[];
  mood: 'neutral' | 'tense' | 'warm' | 'mysterious';
  objects?: string[];
}

// Outsider art palette - raw, not refined
const PALETTE = {
  // Papers and grounds (yellowed, aged)
  paper: '#F2EBD9',
  paperDark: '#E5DCC8',
  paperWarm: '#F0E4D0',
  
  // Inks (slightly faded, imperfect)
  ink: '#2A2622',
  inkLight: '#5A5650',
  inkFaded: '#8A8680',
  
  // Raw colors (like cheap colored pencils)
  red: '#C45D4A',
  blue: '#4A6A8A',
  green: '#5A7A5A',
  yellow: '#D4B84A',
  orange: '#C47A4A',
  purple: '#6A5A7A',
  
  // Character colors (muted, earthy)
  mara: '#8A6A5A',
  eli: '#5A6A5A',
  dana: '#7A6A4A',
  player: '#4A4A5A',
};

// Seed for deterministic randomness per scene
let seed = 1;
function seededRandom(): number {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

function resetSeed(s: number): void {
  seed = s;
}

export class SceneRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width = 400;
  private height = 300;
  private dpr: number;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    this.ctx = ctx;
    this.ctx.scale(this.dpr, this.dpr);
  }

  render(config: SceneConfig): HTMLCanvasElement {
    // Seed based on location for consistency
    resetSeed(this.hashString(config.location));
    
    this.clear(config.mood);
    this.drawBackground(config.location);
    this.drawRoom(config.location);
    this.drawPatternLayer(config.location, config.mood);
    this.drawCharacters(config.characters, config.location);
    this.drawObjects(config.objects || [], config.location);
    this.drawBorderMarks();
    
    return this.canvas;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) || 1;
  }

  private clear(mood: string): void {
    const ctx = this.ctx;
    
    // Base paper color varies by mood
    let baseColor = PALETTE.paper;
    if (mood === 'tense') baseColor = '#F0E8E0';
    else if (mood === 'warm') baseColor = '#F4ECD8';
    else if (mood === 'mysterious') baseColor = '#E8E8F0';
    
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Add paper texture with tiny dots
    ctx.fillStyle = 'rgba(0,0,0,0.02)';
    for (let i = 0; i < 200; i++) {
      const x = seededRandom() * this.width;
      const y = seededRandom() * this.height;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  private drawBackground(location: string): void {
    const ctx = this.ctx;
    
    // Obsessive background pattern based on location
    ctx.strokeStyle = PALETTE.inkFaded;
    ctx.lineWidth = 0.5;
    
    if (location.includes('RADIO')) {
      // Concentric circles (radio waves) - Ramírez style
      for (let r = 20; r < 400; r += 15) {
        this.wobbleCircle(200, 150, r, 0.3);
      }
    } else if (location.includes('HALLWAY')) {
      // Converging lines (tunnel) - Ramírez style
      for (let i = 0; i < 30; i++) {
        const x = i * 15;
        this.wobbleLine(x, 0, 200, 150);
        this.wobbleLine(400 - x, 0, 200, 150);
        this.wobbleLine(x, 300, 200, 150);
        this.wobbleLine(400 - x, 300, 200, 150);
      }
    } else if (location.includes('KITCHEN')) {
      // Grid pattern (tiles) - slightly off
      for (let x = 0; x < this.width; x += 25) {
        this.wobbleLine(x + seededRandom() * 5, 0, x + seededRandom() * 5, 300);
      }
      for (let y = 0; y < this.height; y += 25) {
        this.wobbleLine(0, y + seededRandom() * 5, 400, y + seededRandom() * 5);
      }
    } else if (location.includes('DINING')) {
      // Radiating lines from center (like a table)
      for (let a = 0; a < Math.PI * 2; a += 0.15) {
        const x = 200 + Math.cos(a) * 200;
        const y = 150 + Math.sin(a) * 200;
        this.wobbleLine(200, 150, x, y);
      }
    } else {
      // Default: horizontal hatching
      for (let y = 10; y < this.height; y += 8) {
        this.wobbleLine(0, y, this.width, y + seededRandom() * 4 - 2);
      }
    }
  }

  private drawRoom(location: string): void {
    const ctx = this.ctx;
    
    // Draw room with wobbly lines, not filled shapes
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    
    // Floor - wonky quadrilateral
    const floorPoints = [
      { x: 40 + seededRandom() * 10, y: 200 + seededRandom() * 10 },
      { x: 200 + seededRandom() * 10, y: 120 + seededRandom() * 10 },
      { x: 360 + seededRandom() * 10, y: 200 + seededRandom() * 10 },
      { x: 200 + seededRandom() * 10, y: 280 + seededRandom() * 10 },
    ];
    
    // Fill floor with hatching
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(floorPoints[0].x, floorPoints[0].y);
    for (const p of floorPoints.slice(1)) {
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.clip();
    
    ctx.strokeStyle = PALETTE.inkLight;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 50; i++) {
      const y = 100 + i * 5;
      this.wobbleLine(0, y, 400, y + seededRandom() * 10);
    }
    ctx.restore();
    
    // Floor outline
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    this.wobblePolygon(floorPoints);
    
    // Back walls - just lines, not filled
    // Left wall
    this.wobbleLine(floorPoints[0].x, floorPoints[0].y, 50, 60);
    this.wobbleLine(50, 60, 200, 10);
    this.wobbleLine(200, 10, floorPoints[1].x, floorPoints[1].y);
    
    // Right wall
    this.wobbleLine(200, 10, 350, 60);
    this.wobbleLine(350, 60, floorPoints[2].x, floorPoints[2].y);
    
    // Add some cross-hatching on walls
    ctx.strokeStyle = PALETTE.inkFaded;
    ctx.lineWidth = 0.3;
    for (let i = 0; i < 20; i++) {
      const x = 60 + seededRandom() * 120;
      const y1 = 70 + seededRandom() * 100;
      const y2 = y1 + 20 + seededRandom() * 30;
      this.wobbleLine(x, y1, x + seededRandom() * 20 - 10, y2);
    }
  }

  private drawPatternLayer(location: string, mood: string): void {
    const ctx = this.ctx;
    
    // Add obsessive decorative marks based on mood
    if (mood === 'tense') {
      // Anxious scribbles
      ctx.strokeStyle = PALETTE.red;
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 15; i++) {
        const x = seededRandom() * this.width;
        const y = seededRandom() * this.height;
        this.scribble(x, y, 20 + seededRandom() * 30);
      }
    } else if (mood === 'mysterious') {
      // Spiral marks
      ctx.strokeStyle = PALETTE.purple;
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 8; i++) {
        const x = seededRandom() * this.width;
        const y = seededRandom() * this.height;
        this.spiral(x, y, 10 + seededRandom() * 20);
      }
    } else if (mood === 'warm') {
      // Little sun/star marks
      ctx.strokeStyle = PALETTE.orange;
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 10; i++) {
        const x = seededRandom() * this.width;
        const y = seededRandom() * this.height;
        this.star(x, y, 5 + seededRandom() * 10);
      }
    }
    
    // Location-specific marks
    if (location.includes('RADIO')) {
      // Small antenna symbols scattered
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const x = 50 + seededRandom() * 140;
        const y = 50 + seededRandom() * 100;
        this.antenna(x, y, 8 + seededRandom() * 8);
      }
    } else if (location.includes('DINING')) {
      // Plate circles
      ctx.strokeStyle = PALETTE.inkLight;
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const x = 120 + seededRandom() * 160;
        const y = 140 + seededRandom() * 80;
        this.wobbleCircle(x, y, 12 + seededRandom() * 8, 1);
        this.wobbleCircle(x, y, 8 + seededRandom() * 4, 0.5);
      }
    }
  }

  private drawCharacters(characters: string[], location: string): void {
    const ctx = this.ctx;
    const positions = this.getPositions(characters.length, location);
    
    characters.forEach((char, i) => {
      const pos = positions[i];
      const color = this.getCharacterColor(char);
      const isPlayer = char.includes('player') || char.includes('char_p');
      
      // Characters are primitive figures - Traylor style
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      
      if (isPlayer) {
        // Player is just an outline, observer
        this.drawFigureOutline(pos.x, pos.y, 40);
      } else {
        // NPCs are more solid, with character
        this.drawFigure(pos.x, pos.y, 40, char);
      }
    });
  }

  private drawFigure(x: number, y: number, size: number, char: string): void {
    const ctx = this.ctx;
    
    // Body - wonky trapezoid
    ctx.beginPath();
    ctx.moveTo(x - size * 0.3 + seededRandom() * 4, y);
    ctx.lineTo(x - size * 0.2 + seededRandom() * 4, y - size * 0.5);
    ctx.lineTo(x + size * 0.2 + seededRandom() * 4, y - size * 0.5);
    ctx.lineTo(x + size * 0.3 + seededRandom() * 4, y);
    ctx.closePath();
    ctx.fill();
    
    // Head - wobbly circle
    const headY = y - size * 0.7;
    this.wobbleCircle(x + seededRandom() * 4, headY, size * 0.2, 2);
    ctx.fill();
    
    // Character-specific marks
    if (char.includes('mara') || char.includes('host')) {
      // Spoon - simple line with blob
      ctx.lineWidth = 2;
      this.wobbleLine(x + 15, y - 20, x + 30, y - 5);
      ctx.beginPath();
      ctx.arc(x + 32, y - 3, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (char.includes('eli') || char.includes('partner')) {
      // Glasses - two circles on head
      ctx.lineWidth = 1;
      this.wobbleCircle(x - 5, headY, 4, 1);
      this.wobbleCircle(x + 5, headY, 4, 1);
    } else if (char.includes('dana') || char.includes('guest')) {
      // Wine glass - triangle + line
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 18, y - 25);
      ctx.lineTo(x + 12, y - 15);
      ctx.lineTo(x + 24, y - 15);
      ctx.closePath();
      ctx.stroke();
      this.wobbleLine(x + 18, y - 15, x + 18, y - 8);
    }
    
    // Add texture - little marks inside figure
    ctx.strokeStyle = PALETTE.paper;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 5; i++) {
      const mx = x - 8 + seededRandom() * 16;
      const my = y - 10 - seededRandom() * 20;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + seededRandom() * 6 - 3, my + seededRandom() * 6 - 3);
      ctx.stroke();
    }
  }

  private drawFigureOutline(x: number, y: number, size: number): void {
    const ctx = this.ctx;
    ctx.lineWidth = 2;
    
    // Body outline only - dashed/broken
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x - size * 0.3, y);
    ctx.lineTo(x - size * 0.2, y - size * 0.5);
    ctx.lineTo(x + size * 0.2, y - size * 0.5);
    ctx.lineTo(x + size * 0.3, y);
    ctx.closePath();
    ctx.stroke();
    
    // Head outline
    this.wobbleCircle(x, y - size * 0.7, size * 0.2, 2);
    ctx.setLineDash([]);
    
    // Question mark inside? Or just empty
    ctx.fillStyle = PALETTE.inkFaded;
    ctx.font = '12px serif';
    ctx.textAlign = 'center';
    ctx.fillText('?', x, y - size * 0.2);
  }

  private drawObjects(objects: string[], location: string): void {
    const ctx = this.ctx;
    
    for (const obj of objects) {
      if (obj === 'colander') {
        // Colander - bowl with dots
        const cx = 280 + seededRandom() * 20;
        const cy = 180;
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 2;
        
        // Bowl shape
        ctx.beginPath();
        ctx.ellipse(cx, cy, 20, 10, 0, 0, Math.PI);
        ctx.stroke();
        this.wobbleLine(cx - 20, cy, cx - 20, cy - 8);
        this.wobbleLine(cx + 20, cy, cx + 20, cy - 8);
        
        // Holes - obsessive dots
        ctx.fillStyle = PALETTE.ink;
        for (let i = 0; i < 15; i++) {
          const hx = cx - 15 + seededRandom() * 30;
          const hy = cy - 5 + seededRandom() * 10;
          ctx.beginPath();
          ctx.arc(hx, hy, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (obj === 'wine') {
        // Wine bottle - simple shape with hatching
        const bx = 150 + seededRandom() * 20;
        const by = 170;
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 1.5;
        
        // Bottle body
        ctx.beginPath();
        ctx.moveTo(bx - 8, by);
        ctx.lineTo(bx - 8, by - 25);
        ctx.lineTo(bx - 3, by - 30);
        ctx.lineTo(bx - 3, by - 40);
        ctx.lineTo(bx + 3, by - 40);
        ctx.lineTo(bx + 3, by - 30);
        ctx.lineTo(bx + 8, by - 25);
        ctx.lineTo(bx + 8, by);
        ctx.closePath();
        ctx.stroke();
        
        // Fill with hatching
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 8; i++) {
          const ly = by - 5 - i * 3;
          this.wobbleLine(bx - 6, ly, bx + 6, ly);
        }
      } else if (obj === 'napkin_swan') {
        // Abstract bird shape
        const sx = 200 + seededRandom() * 40;
        const sy = 160;
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 1;
        
        // Bird body - triangle
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - 10, sy + 8);
        ctx.lineTo(sx + 10, sy + 8);
        ctx.closePath();
        ctx.stroke();
        
        // Neck - curved line up
        this.wobbleLine(sx, sy, sx + 5, sy - 15);
        // Head - dot
        ctx.beginPath();
        ctx.arc(sx + 5, sy - 17, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawBorderMarks(): void {
    const ctx = this.ctx;
    
    // Obsessive border marks - like the artist couldn't stop
    ctx.strokeStyle = PALETTE.inkFaded;
    ctx.lineWidth = 0.5;
    
    // Top edge marks
    for (let x = 10; x < this.width - 10; x += 8 + seededRandom() * 8) {
      const len = 3 + seededRandom() * 6;
      this.wobbleLine(x, 2, x + seededRandom() * 4 - 2, 2 + len);
    }
    
    // Bottom edge marks
    for (let x = 10; x < this.width - 10; x += 8 + seededRandom() * 8) {
      const len = 3 + seededRandom() * 6;
      this.wobbleLine(x, this.height - 2, x + seededRandom() * 4 - 2, this.height - 2 - len);
    }
    
    // Side marks (sparser)
    for (let y = 20; y < this.height - 20; y += 15 + seededRandom() * 15) {
      this.wobbleLine(2, y, 2 + 3 + seededRandom() * 5, y + seededRandom() * 4 - 2);
      this.wobbleLine(this.width - 2, y, this.width - 2 - 3 - seededRandom() * 5, y + seededRandom() * 4 - 2);
    }
  }

  // === Drawing primitives with wobble ===

  private wobbleLine(x1: number, y1: number, x2: number, y2: number): void {
    const ctx = this.ctx;
    const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const steps = Math.max(2, Math.floor(dist / 10));
    
    ctx.beginPath();
    ctx.moveTo(x1 + seededRandom() * 2 - 1, y1 + seededRandom() * 2 - 1);
    
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t + seededRandom() * 3 - 1.5;
      const y = y1 + (y2 - y1) * t + seededRandom() * 3 - 1.5;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  private wobbleCircle(cx: number, cy: number, r: number, lineWidth: number): void {
    const ctx = this.ctx;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    
    const steps = Math.max(12, Math.floor(r));
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const wobbleR = r + seededRandom() * 3 - 1.5;
      const x = cx + Math.cos(angle) * wobbleR;
      const y = cy + Math.sin(angle) * wobbleR;
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  private wobblePolygon(points: Array<{x: number, y: number}>): void {
    const ctx = this.ctx;
    ctx.beginPath();
    
    points.forEach((p, i) => {
      const next = points[(i + 1) % points.length];
      const dist = Math.sqrt((next.x - p.x) ** 2 + (next.y - p.y) ** 2);
      const steps = Math.max(2, Math.floor(dist / 15));
      
      if (i === 0) ctx.moveTo(p.x, p.y);
      
      for (let j = 1; j <= steps; j++) {
        const t = j / steps;
        const x = p.x + (next.x - p.x) * t + seededRandom() * 3 - 1.5;
        const y = p.y + (next.y - p.y) * t + seededRandom() * 3 - 1.5;
        ctx.lineTo(x, y);
      }
    });
    
    ctx.closePath();
    ctx.stroke();
  }

  private scribble(x: number, y: number, size: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    let cx = x, cy = y;
    for (let i = 0; i < 20; i++) {
      cx += seededRandom() * size - size / 2;
      cy += seededRandom() * size - size / 2;
      cx = Math.max(x - size, Math.min(x + size, cx));
      cy = Math.max(y - size, Math.min(y + size, cy));
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  private spiral(x: number, y: number, size: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    
    for (let i = 0; i < 50; i++) {
      const angle = i * 0.3;
      const r = i * size / 50;
      const px = x + Math.cos(angle) * r + seededRandom() * 2 - 1;
      const py = y + Math.sin(angle) * r + seededRandom() * 2 - 1;
      
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  private star(x: number, y: number, size: number): void {
    const ctx = this.ctx;
    const points = 5 + Math.floor(seededRandom() * 4);
    
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(angle) * size;
      const py = y + Math.sin(angle) * size;
      this.wobbleLine(x, y, px, py);
    }
  }

  private antenna(x: number, y: number, size: number): void {
    const ctx = this.ctx;
    // Vertical line
    this.wobbleLine(x, y, x, y - size);
    // Horizontal bar at top
    this.wobbleLine(x - size * 0.4, y - size, x + size * 0.4, y - size);
    // Diagonal lines
    this.wobbleLine(x - size * 0.3, y - size * 0.7, x, y - size);
    this.wobbleLine(x + size * 0.3, y - size * 0.7, x, y - size);
  }

  private getPositions(count: number, location: string): Array<{x: number, y: number}> {
    // Intentionally asymmetric positioning
    const basePositions = [
      { x: 120 + seededRandom() * 30, y: 220 + seededRandom() * 20 },
      { x: 280 + seededRandom() * 30, y: 210 + seededRandom() * 20 },
      { x: 180 + seededRandom() * 30, y: 240 + seededRandom() * 20 },
      { x: 240 + seededRandom() * 30, y: 250 + seededRandom() * 20 },
    ];
    
    return basePositions.slice(0, count);
  }

  private getCharacterColor(char: string): string {
    const c = char.toLowerCase();
    if (c.includes('mara') || c.includes('host')) return PALETTE.mara;
    if (c.includes('eli') || c.includes('partner')) return PALETTE.eli;
    if (c.includes('dana') || c.includes('guest')) return PALETTE.dana;
    return PALETTE.player;
  }

  // Static method to get scene config from dialogue text
  static getSceneConfig(nodeText: string, speakerId?: string): SceneConfig {
    const text = nodeText.toLowerCase();
    
    // Determine location
    let location = 'THE APARTMENT';
    if (text.includes('kitchen') || text.includes('cooking') || text.includes('stove') || text.includes('colander')) {
      location = 'THE KITCHEN';
    } else if (text.includes('hallway') || text.includes('hall') || text.includes('first door') || text.includes('second door')) {
      location = 'THE HALLWAY';
    } else if (text.includes('radio') || text.includes('forty-three') || text.includes('43')) {
      location = 'THE RADIO ROOM';
    } else if (text.includes('bathroom') || text.includes('mirror') || text.includes('soap') || text.includes('lavender')) {
      location = 'THE BATHROOM';
    } else if (text.includes('table') || text.includes('napkin') || text.includes('course') || text.includes('plate') || text.includes('swan')) {
      location = 'THE DINING ROOM';
    } else if (text.includes('couch') || text.includes('sitting') || text.includes('living')) {
      location = 'THE LIVING ROOM';
    } else if (text.includes('door') || text.includes('arrived') || text.includes('shoes') || text.includes('jacket') || text.includes('coat')) {
      location = 'THE ENTRYWAY';
    }
    
    // Determine mood
    let mood: SceneConfig['mood'] = 'neutral';
    if (text.includes('tension') || text.includes('crying') || text.includes('angry') || text.includes('cold') || text.includes('sharp') || text.includes('break')) {
      mood = 'tense';
    } else if (text.includes('warm') || text.includes('smile') || text.includes('laugh') || text.includes('good')) {
      mood = 'warm';
    } else if (text.includes('strange') || text.includes('signal') || text.includes('static') || text.includes('mysterious')) {
      mood = 'mysterious';
    }
    
    // Characters
    const characters: string[] = [];
    if (speakerId) characters.push(speakerId);
    if (!text.startsWith('[')) {
      if (!characters.includes('char_host')) characters.push('char_host');
      if (!characters.includes('char_partner')) characters.push('char_partner');
      if (!characters.includes('char_guest1')) characters.push('char_guest1');
    }
    if (!characters.includes('char_p')) characters.push('char_p');
    
    // Objects
    const objects: string[] = [];
    if (text.includes('colander')) objects.push('colander');
    if (text.includes('wine') || text.includes('sancerre') || text.includes('grüner')) objects.push('wine');
    if (text.includes('napkin') || text.includes('swan')) objects.push('napkin_swan');
    
    return { location, characters, mood, objects };
  }
}
