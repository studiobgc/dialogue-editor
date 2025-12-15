/**
 * SceneRenderer - Canvas-based procedural illustration system
 * 
 * Design principles:
 * - Utilitarian, not fancy
 * - Simple geometric shapes (circles, rectangles, lines)
 * - Accessible colors with good contrast
 * - Fast procedural generation
 * - No complex SVG paths or hand-drawn effects
 */

export interface SceneConfig {
  location: string;
  characters: string[];
  mood: 'neutral' | 'tense' | 'warm' | 'mysterious';
  objects?: string[];
}

// Simple, accessible color palette
const COLORS = {
  // Backgrounds
  floor: '#E8E4DC',
  wall: '#F5F2EC',
  wallShadow: '#DDD8D0',
  
  // Characters (high contrast, accessible)
  mara: '#4A6670',
  eli: '#5C7A5C',
  dana: '#8B6B4A',
  player: '#6B6B8B',
  
  // Objects
  furniture: '#C4B8A8',
  furnitureDark: '#9A8E7E',
  accent: '#B85C38',
  
  // UI
  text: '#3A3A3A',
  textLight: '#6A6A6A',
  border: '#AAAAAA',
};

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
    this.clear();
    this.drawRoom(config.location, config.mood);
    this.drawObjects(config.objects || [], config.location);
    this.drawCharacters(config.characters, config.location);
    this.drawLabel(config.location);
    return this.canvas;
  }

  private clear(): void {
    this.ctx.fillStyle = COLORS.wall;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  private drawRoom(location: string, mood: string): void {
    const ctx = this.ctx;
    
    // Simple isometric floor
    ctx.fillStyle = COLORS.floor;
    ctx.beginPath();
    ctx.moveTo(50, 200);
    ctx.lineTo(200, 130);
    ctx.lineTo(350, 200);
    ctx.lineTo(200, 270);
    ctx.closePath();
    ctx.fill();
    
    // Back walls
    ctx.fillStyle = COLORS.wall;
    ctx.beginPath();
    ctx.moveTo(50, 200);
    ctx.lineTo(50, 80);
    ctx.lineTo(200, 10);
    ctx.lineTo(200, 130);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = COLORS.wallShadow;
    ctx.beginPath();
    ctx.moveTo(200, 10);
    ctx.lineTo(200, 130);
    ctx.lineTo(350, 200);
    ctx.lineTo(350, 80);
    ctx.closePath();
    ctx.fill();
    
    // Room-specific details
    if (location.includes('KITCHEN')) {
      this.drawKitchenDetails();
    } else if (location.includes('DINING')) {
      this.drawDiningDetails();
    } else if (location.includes('HALLWAY')) {
      this.drawHallwayDetails();
    } else if (location.includes('RADIO')) {
      this.drawRadioRoomDetails();
    } else if (location.includes('BATHROOM')) {
      this.drawBathroomDetails();
    } else {
      this.drawLivingRoomDetails();
    }
    
    // Mood overlay
    if (mood === 'tense') {
      ctx.fillStyle = 'rgba(180, 80, 80, 0.03)';
      ctx.fillRect(0, 0, this.width, this.height);
    } else if (mood === 'warm') {
      ctx.fillStyle = 'rgba(200, 150, 80, 0.03)';
      ctx.fillRect(0, 0, this.width, this.height);
    } else if (mood === 'mysterious') {
      ctx.fillStyle = 'rgba(80, 80, 120, 0.03)';
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  private drawLivingRoomDetails(): void {
    const ctx = this.ctx;
    
    // Couch (simple rectangle)
    ctx.fillStyle = COLORS.furniture;
    ctx.fillRect(100, 180, 80, 30);
    ctx.fillStyle = COLORS.furnitureDark;
    ctx.fillRect(100, 175, 80, 8);
    
    // Window on back wall
    ctx.fillStyle = '#D8E8F0';
    ctx.fillRect(80, 100, 50, 40);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(80, 100, 50, 40);
    ctx.beginPath();
    ctx.moveTo(105, 100);
    ctx.lineTo(105, 140);
    ctx.stroke();
  }

  private drawKitchenDetails(): void {
    const ctx = this.ctx;
    
    // Counter
    ctx.fillStyle = COLORS.furniture;
    ctx.beginPath();
    ctx.moveTo(70, 180);
    ctx.lineTo(70, 150);
    ctx.lineTo(150, 115);
    ctx.lineTo(150, 145);
    ctx.closePath();
    ctx.fill();
    
    // Stove
    ctx.fillStyle = COLORS.furnitureDark;
    ctx.fillRect(250, 160, 50, 25);
    
    // Burners
    ctx.fillStyle = '#3A3A3A';
    ctx.beginPath();
    ctx.arc(265, 168, 6, 0, Math.PI * 2);
    ctx.arc(285, 172, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawDiningDetails(): void {
    const ctx = this.ctx;
    
    // Table (simple diamond)
    ctx.fillStyle = COLORS.furniture;
    ctx.beginPath();
    ctx.moveTo(200, 160);
    ctx.lineTo(250, 185);
    ctx.lineTo(200, 210);
    ctx.lineTo(150, 185);
    ctx.closePath();
    ctx.fill();
    
    // Table legs
    ctx.strokeStyle = COLORS.furnitureDark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(165, 185);
    ctx.lineTo(165, 200);
    ctx.moveTo(235, 185);
    ctx.lineTo(235, 200);
    ctx.stroke();
    
    // Place settings (simple circles)
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    for (const pos of [[175, 175], [225, 175], [175, 195], [225, 195]]) {
      ctx.beginPath();
      ctx.arc(pos[0], pos[1], 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  private drawHallwayDetails(): void {
    const ctx = this.ctx;
    
    // Narrower room feel - add side walls extending
    ctx.fillStyle = COLORS.wallShadow;
    ctx.fillRect(60, 100, 20, 120);
    ctx.fillRect(320, 100, 20, 120);
    
    // Door 1
    ctx.fillStyle = COLORS.furniture;
    ctx.fillRect(100, 110, 40, 70);
    ctx.fillStyle = COLORS.furnitureDark;
    ctx.beginPath();
    ctx.arc(130, 145, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Door 2 (mysterious)
    ctx.fillStyle = '#8A8070';
    ctx.fillRect(260, 110, 40, 70);
    // Light under door
    ctx.fillStyle = 'rgba(255, 240, 200, 0.4)';
    ctx.fillRect(265, 177, 30, 3);
  }

  private drawRadioRoomDetails(): void {
    const ctx = this.ctx;
    
    // Shelves
    ctx.strokeStyle = COLORS.furnitureDark;
    ctx.lineWidth = 3;
    for (let y = 90; y <= 150; y += 30) {
      ctx.beginPath();
      ctx.moveTo(70, y);
      ctx.lineTo(170, y - 30);
      ctx.stroke();
    }
    
    // Radios (simple rectangles)
    ctx.fillStyle = COLORS.furnitureDark;
    for (let i = 0; i < 9; i++) {
      const x = 80 + (i % 3) * 25;
      const y = 65 + Math.floor(i / 3) * 28;
      ctx.fillRect(x, y, 18, 12);
    }
    
    // One radio glowing
    ctx.fillStyle = 'rgba(255, 220, 150, 0.5)';
    ctx.beginPath();
    ctx.arc(139, 71, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBathroomDetails(): void {
    const ctx = this.ctx;
    
    // Mirror
    ctx.fillStyle = '#E8F0F0';
    ctx.fillRect(160, 60, 80, 60);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(160, 60, 80, 60);
    
    // Sink
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(175, 150, 50, 20);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(175, 150, 50, 20);
    
    // Three soap bottles
    ctx.fillStyle = '#D8C8E8';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(185 + i * 15, 135, 8, 14);
    }
  }

  private drawObjects(objects: string[], location: string): void {
    const ctx = this.ctx;
    
    for (const obj of objects) {
      if (obj === 'colander') {
        // Colander
        ctx.strokeStyle = COLORS.furnitureDark;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(280, 170, 15, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Holes
        ctx.fillStyle = COLORS.furnitureDark;
        for (const p of [[-5, 2], [5, 2], [0, 5]]) {
          ctx.beginPath();
          ctx.arc(280 + p[0], 170 + p[1], 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (obj === 'wine') {
        // Wine bottle
        ctx.fillStyle = '#4A3530';
        ctx.fillRect(220, 155, 8, 20);
        ctx.fillRect(222, 148, 4, 8);
        
        // Wine glass
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(240, 165, 6, 3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(240, 168);
        ctx.lineTo(240, 178);
        ctx.stroke();
      } else if (obj === 'napkin_swan') {
        // Simple folded napkin shape
        ctx.fillStyle = '#FAFAFA';
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(195, 175);
        ctx.lineTo(200, 165);
        ctx.lineTo(205, 175);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  private drawCharacters(characters: string[], location: string): void {
    const ctx = this.ctx;
    
    // Position characters based on count and location
    const positions = this.getCharacterPositions(characters.length, location);
    
    characters.forEach((char, i) => {
      const pos = positions[i] || { x: 200, y: 200 };
      const color = this.getCharacterColor(char);
      
      // Simple character representation: circle head + rounded body
      ctx.fillStyle = color;
      
      // Body (rounded rectangle approximation)
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y, 12, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Head
      ctx.beginPath();
      ctx.arc(pos.x, pos.y - 22, 10, 0, Math.PI * 2);
      ctx.fill();
      
      // Character-specific details
      if (char.includes('mara') || char.includes('host')) {
        // Wooden spoon
        ctx.strokeStyle = '#8B7355';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pos.x + 12, pos.y - 8);
        ctx.lineTo(pos.x + 22, pos.y + 2);
        ctx.stroke();
      } else if (char.includes('eli') || char.includes('partner')) {
        // Glasses
        ctx.strokeStyle = '#3A3A3A';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pos.x - 4, pos.y - 22, 4, 0, Math.PI * 2);
        ctx.arc(pos.x + 4, pos.y - 22, 4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (char.includes('dana') || char.includes('guest')) {
        // Wine glass
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(pos.x + 15, pos.y - 5, 4, 2, 0, 0, Math.PI * 2);
        ctx.moveTo(pos.x + 15, pos.y - 3);
        ctx.lineTo(pos.x + 15, pos.y + 3);
        ctx.stroke();
      } else if (char.includes('player') || char.includes('you')) {
        // Player is just an outline
        ctx.fillStyle = COLORS.wall;
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y, 11, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y - 22, 9, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y, 12, 16, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y - 22, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }

  private getCharacterPositions(count: number, location: string): Array<{x: number, y: number}> {
    // Different layouts based on location and count
    if (location.includes('DINING')) {
      return [
        { x: 140, y: 175 },  // Left of table
        { x: 260, y: 175 },  // Right of table
        { x: 200, y: 145 },  // Top of table
        { x: 200, y: 220 },  // Bottom of table
      ].slice(0, count);
    }
    
    if (location.includes('KITCHEN')) {
      return [
        { x: 120, y: 190 },
        { x: 280, y: 190 },
        { x: 200, y: 220 },
      ].slice(0, count);
    }
    
    if (location.includes('HALLWAY')) {
      return [
        { x: 200, y: 220 },
      ];
    }
    
    // Default: spread across room
    const spacing = 280 / (count + 1);
    return Array.from({ length: count }, (_, i) => ({
      x: 60 + spacing * (i + 1),
      y: 200 + (i % 2) * 15,
    }));
  }

  private getCharacterColor(char: string): string {
    const c = char.toLowerCase();
    if (c.includes('mara') || c.includes('host')) return COLORS.mara;
    if (c.includes('eli') || c.includes('partner')) return COLORS.eli;
    if (c.includes('dana') || c.includes('guest')) return COLORS.dana;
    return COLORS.player;
  }

  private drawLabel(location: string): void {
    const ctx = this.ctx;
    
    // Clean location label in top-left
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = COLORS.textLight;
    ctx.textAlign = 'left';
    ctx.fillText(location.toUpperCase(), 12, 20);
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
    
    // Determine characters present (simplified)
    const characters: string[] = [];
    if (speakerId) characters.push(speakerId);
    if (!text.startsWith('[')) {
      // Dialogue scene - add other characters
      if (!characters.includes('char_host') && !text.includes('mara exits')) {
        characters.push('char_host');
      }
      if (!characters.includes('char_partner')) {
        characters.push('char_partner');
      }
      if (!characters.includes('char_guest1')) {
        characters.push('char_guest1');
      }
    }
    if (!characters.includes('char_p')) {
      characters.push('char_p');
    }
    
    // Determine objects
    const objects: string[] = [];
    if (text.includes('colander')) objects.push('colander');
    if (text.includes('wine') || text.includes('sancerre') || text.includes('grüner')) objects.push('wine');
    if (text.includes('napkin') || text.includes('swan')) objects.push('napkin_swan');
    
    return { location, characters, mood, objects };
  }
}
