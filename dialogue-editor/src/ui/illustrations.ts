/**
 * Isometric Illustrations for Playtest Mode
 * 
 * Hand-drawn aesthetic, childlike but sophisticated
 * Matches Elaine May's writing: observational, specific, understated
 * 
 * All illustrations are isometric views of the Weissman apartment
 * Components are reusable: rooms, furniture, characters
 */

// SVG filter for hand-drawn wobble effect
export const SVG_FILTERS = `
<defs>
  <filter id="wobble" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="1" result="noise" seed="1"/>
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="paper-texture">
    <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5" result="noise"/>
    <feDiffuseLighting in="noise" lighting-color="#f5f0e8" surfaceScale="2">
      <feDistantLight azimuth="45" elevation="60"/>
    </feDiffuseLighting>
  </filter>
</defs>
`;

// Character silhouettes (isometric, simple shapes)
export const CHARACTERS = {
  mara: `
    <g class="person" transform="translate(0, 0)">
      <!-- Body -->
      <ellipse cx="0" cy="-20" rx="8" ry="10"/>
      <!-- Head -->
      <circle cx="0" cy="-38" r="7"/>
      <!-- Hair (short, styled) -->
      <path d="M-7,-38 Q-8,-46 0,-48 Q8,-46 7,-38" fill="#3a3530"/>
      <!-- Wooden spoon (her signature) -->
      <line x1="10" y1="-25" x2="18" y2="-15" stroke="#8a7560" stroke-width="2"/>
      <ellipse cx="20" cy="-12" rx="4" ry="2" fill="#8a7560"/>
    </g>
  `,
  eli: `
    <g class="person" transform="translate(0, 0)">
      <!-- Body (slightly larger) -->
      <ellipse cx="0" cy="-20" rx="10" ry="11"/>
      <!-- Head -->
      <circle cx="0" cy="-40" r="8"/>
      <!-- Glasses -->
      <circle cx="-4" cy="-40" r="3" fill="none" stroke="#3a3530" stroke-width="1"/>
      <circle cx="4" cy="-40" r="3" fill="none" stroke="#3a3530" stroke-width="1"/>
      <line x1="-1" y1="-40" x2="1" y2="-40" stroke="#3a3530"/>
    </g>
  `,
  dana: `
    <g class="person" transform="translate(0, 0)">
      <!-- Body -->
      <ellipse cx="0" cy="-18" rx="7" ry="9"/>
      <!-- Head -->
      <circle cx="0" cy="-34" r="6"/>
      <!-- Wine glass -->
      <path d="M12,-25 L12,-18 L8,-18 L10,-12" fill="none" stroke="#8a6550" stroke-width="1.5"/>
      <ellipse cx="12" cy="-25" rx="4" ry="2" fill="#d8c0a0" stroke="#8a6550"/>
    </g>
  `,
  player: `
    <g class="person-outline" transform="translate(0, 0)">
      <!-- Body (outline only - you're the observer) -->
      <ellipse cx="0" cy="-18" rx="7" ry="9"/>
      <!-- Head -->
      <circle cx="0" cy="-34" r="6"/>
    </g>
  `
};

// Furniture components (isometric)
const FURNITURE = {
  couch: `
    <g class="furniture">
      <path d="M0,0 L60,30 L60,45 L0,15 Z" class="fill-warm"/>
      <path d="M60,30 L80,20 L80,35 L60,45 Z" class="fill-accent"/>
      <path d="M0,0 L20,-10 L80,20 L60,30 Z" class="fill-light"/>
      <!-- Cushions -->
      <ellipse cx="20" cy="8" rx="12" ry="6" class="fill-light"/>
      <ellipse cx="45" cy="22" rx="12" ry="6" class="fill-light"/>
    </g>
  `,
  diningTable: `
    <g class="furniture">
      <!-- Table top -->
      <path d="M0,0 L50,25 L100,0 L50,-25 Z" class="fill-warm"/>
      <!-- Legs -->
      <line x1="15" y1="0" x2="15" y2="20" class="detail"/>
      <line x1="85" y1="0" x2="85" y2="20" class="detail"/>
      <line x1="50" y1="25" x2="50" y2="45" class="detail"/>
      <line x1="50" y1="-25" x2="50" y2="-5" class="detail"/>
    </g>
  `,
  chair: `
    <g class="furniture">
      <!-- Seat -->
      <path d="M0,0 L15,7.5 L30,0 L15,-7.5 Z" class="fill-warm"/>
      <!-- Back -->
      <path d="M0,0 L0,-20 L15,-12.5 L15,7.5 Z" class="fill-accent"/>
      <!-- Legs -->
      <line x1="5" y1="0" x2="5" y2="10" class="detail"/>
      <line x1="25" y1="0" x2="25" y2="10" class="detail"/>
    </g>
  `,
  radio: `
    <g class="furniture">
      <!-- Radio body -->
      <rect x="0" y="-15" width="20" height="15" rx="2" class="fill-accent"/>
      <!-- Dial -->
      <circle cx="10" cy="-10" r="4" class="fill-warm"/>
      <!-- Antenna -->
      <line x1="15" y1="-15" x2="20" y2="-25" stroke="#3a3530"/>
    </g>
  `,
  colander: `
    <g class="furniture">
      <!-- Bowl shape -->
      <ellipse cx="0" cy="0" rx="12" ry="6" fill="none" stroke="#6a6560" stroke-width="1.5"/>
      <path d="M-12,0 Q-12,8 0,10 Q12,8 12,0" fill="none" stroke="#6a6560" stroke-width="1.5"/>
      <!-- Holes -->
      <circle cx="-4" cy="3" r="1" fill="#6a6560"/>
      <circle cx="4" cy="3" r="1" fill="#6a6560"/>
      <circle cx="0" cy="6" r="1" fill="#6a6560"/>
    </g>
  `,
  winebottle: `
    <g>
      <path d="M0,0 L0,-25 Q0,-30 3,-30 L3,-35 L-3,-35 L-3,-30 Q0,-30 0,-25" 
            fill="#4a3530" stroke="#3a3530"/>
    </g>
  `,
  wineglass: `
    <g>
      <ellipse cx="0" cy="0" rx="6" ry="3" fill="#e8dfd0" stroke="#8a8580"/>
      <line x1="0" y1="3" x2="0" y2="12" stroke="#8a8580"/>
      <ellipse cx="0" cy="14" rx="5" ry="2" fill="none" stroke="#8a8580"/>
    </g>
  `,
  napkinSwan: `
    <g>
      <!-- Folded napkin attempting to be a swan -->
      <path d="M0,0 L8,-5 L10,-12 Q12,-15 10,-14 L5,-8 L0,-5 Z" 
            fill="#f5f0e8" stroke="#c4bfb5" stroke-width="1"/>
      <path d="M0,0 L-5,3 L5,3 Z" fill="#f5f0e8" stroke="#c4bfb5"/>
    </g>
  `
};

// Room templates (isometric floor plans)
const ROOMS = {
  livingRoom: `
    <!-- Floor -->
    <path d="M200,300 L400,200 L600,300 L400,400 Z" class="fill-floor"/>
    <!-- Back wall left -->
    <path d="M200,300 L200,150 L400,50 L400,200 Z" class="fill-wall"/>
    <!-- Back wall right -->
    <path d="M400,50 L400,200 L600,300 L600,150 Z" class="fill-wall" style="fill: #e8e3d8"/>
    <!-- Window on left wall -->
    <rect x="260" y="100" width="60" height="80" fill="#d8e8f0" stroke="#3a3530"/>
    <line x1="290" y1="100" x2="290" y2="180" class="detail"/>
    <line x1="260" y1="140" x2="320" y2="140" class="detail"/>
  `,
  kitchen: `
    <!-- Floor -->
    <path d="M200,300 L400,200 L600,300 L400,400 Z" class="fill-floor" style="fill: #d8d0c0"/>
    <!-- Walls -->
    <path d="M200,300 L200,150 L400,50 L400,200 Z" class="fill-wall"/>
    <path d="M400,50 L400,200 L600,300 L600,150 Z" class="fill-wall" style="fill: #e8e3d8"/>
    <!-- Counter -->
    <path d="M220,280 L220,220 L350,155 L350,215 Z" fill="#d8c8b0" stroke="#3a3530"/>
    <!-- Stove -->
    <rect x="380" y="180" width="50" height="30" fill="#4a4540" stroke="#3a3530"/>
    <circle cx="395" cy="190" r="6" fill="#3a3530"/>
    <circle cx="415" cy="195" r="6" fill="#3a3530"/>
  `,
  hallway: `
    <!-- Floor - narrow corridor -->
    <path d="M300,350 L400,300 L500,350 L400,400 Z" class="fill-floor"/>
    <!-- Walls - perspective tunnel -->
    <path d="M300,350 L300,200 L400,150 L400,300 Z" class="fill-wall"/>
    <path d="M400,150 L400,300 L500,350 L500,200 Z" class="fill-wall" style="fill: #e8e3d8"/>
    <!-- Door 1 (bathroom) -->
    <rect x="320" y="220" width="40" height="60" fill="#c8b8a0" stroke="#3a3530"/>
    <circle cx="350" cy="250" r="2" fill="#8a7560"/>
    <!-- Door 2 (radio room - mysterious) -->
    <rect x="420" y="220" width="40" height="60" fill="#a89880" stroke="#3a3530"/>
    <!-- No handle - ominous -->
  `,
  diningArea: `
    <!-- Floor -->
    <path d="M150,320 L400,195 L650,320 L400,445 Z" class="fill-floor"/>
    <!-- Back wall -->
    <path d="M150,320 L150,120 L400,-5 L400,195 Z" class="fill-wall"/>
    <path d="M400,-5 L400,195 L650,320 L650,120 Z" class="fill-wall" style="fill: #e8e3d8"/>
  `,
  radioRoom: `
    <!-- Floor - smaller, cluttered -->
    <path d="M250,320 L400,245 L550,320 L400,395 Z" class="fill-floor" style="fill: #d0c8b8"/>
    <!-- Walls -->
    <path d="M250,320 L250,170 L400,95 L400,245 Z" class="fill-wall" style="fill: #e0d8c8"/>
    <path d="M400,95 L400,245 L550,320 L550,170 Z" class="fill-wall" style="fill: #d8d0c0"/>
    <!-- Shelves with radios -->
    <line x1="270" y1="180" x2="380" y2="125" stroke="#8a7560" stroke-width="3"/>
    <line x1="270" y1="220" x2="380" y2="165" stroke="#8a7560" stroke-width="3"/>
    <line x1="270" y1="260" x2="380" y2="205" stroke="#8a7560" stroke-width="3"/>
  `
};

// Scene compositions - specific illustrations for each location/moment
export const SCENE_ILLUSTRATIONS: Record<string, string> = {
  
  // SCENE 1: The Entryway / Living Room
  'entryway': `
    <svg viewBox="0 0 800 500" class="illustration-svg">
      ${SVG_FILTERS}
      ${ROOMS.livingRoom}
      
      <!-- Couch -->
      <g transform="translate(280, 320)">
        ${FURNITURE.couch}
      </g>
      
      <!-- Mara at door -->
      <g transform="translate(500, 280)">
        ${CHARACTERS.mara}
      </g>
      
      <!-- Eli nearby -->
      <g transform="translate(420, 300)">
        ${CHARACTERS.eli}
      </g>
      
      <!-- Dana on couch with wine -->
      <g transform="translate(320, 310)">
        ${CHARACTERS.dana}
      </g>
      
      <!-- Player (outline) at entrance -->
      <g transform="translate(560, 320)">
        ${CHARACTERS.player}
      </g>
      
      <!-- Coat rack detail -->
      <line x1="580" y1="260" x2="580" y2="320" stroke="#5a5550" stroke-width="2"/>
      <line x1="570" y1="270" x2="590" y2="270" stroke="#5a5550" stroke-width="2"/>
    </svg>
  `,

  'living_room': `
    <svg viewBox="0 0 800 500" class="illustration-svg">
      ${SVG_FILTERS}
      ${ROOMS.livingRoom}
      
      <!-- Couch -->
      <g transform="translate(280, 320)">
        ${FURNITURE.couch}
      </g>
      
      <!-- Coffee table -->
      <g transform="translate(380, 350)">
        <path d="M0,0 L30,15 L60,0 L30,-15 Z" class="fill-accent"/>
      </g>
      
      <!-- Wine bottles on table -->
      <g transform="translate(395, 340)">${FURNITURE.winebottle}</g>
      <g transform="translate(410, 335)">${FURNITURE.wineglass}</g>
      <g transform="translate(425, 340)">${FURNITURE.wineglass}</g>
      
      <!-- Characters seated -->
      <g transform="translate(300, 305)">
        ${CHARACTERS.dana}
      </g>
      
      <g transform="translate(340, 315)">
        ${CHARACTERS.player}
      </g>
    </svg>
  `,

  // SCENE 2: Dining Area
  'dining': `
    <svg viewBox="0 0 800 500" class="illustration-svg">
      ${SVG_FILTERS}
      ${ROOMS.diningArea}
      
      <!-- Dining table -->
      <g transform="translate(350, 300)">
        ${FURNITURE.diningTable}
      </g>
      
      <!-- Chairs around table -->
      <g transform="translate(300, 260)">${FURNITURE.chair}</g>
      <g transform="translate(420, 260)" style="transform: scaleX(-1)">${FURNITURE.chair}</g>
      <g transform="translate(350, 340)">${FURNITURE.chair}</g>
      <g transform="translate(350, 230)">${FURNITURE.chair}</g>
      
      <!-- Napkin swans on table -->
      <g transform="translate(330, 285)">${FURNITURE.napkinSwan}</g>
      <g transform="translate(370, 295)">${FURNITURE.napkinSwan}</g>
      <g transform="translate(355, 275)">${FURNITURE.napkinSwan}</g>
      <g transform="translate(390, 285)">${FURNITURE.napkinSwan}</g>
      
      <!-- Wine -->
      <g transform="translate(400, 280)">${FURNITURE.winebottle}</g>
      
      <!-- Characters at table -->
      <g transform="translate(310, 245)">${CHARACTERS.mara}</g>
      <g transform="translate(410, 245)">${CHARACTERS.eli}</g>
      <g transform="translate(340, 320)">${CHARACTERS.dana}</g>
      <g transform="translate(380, 210)">${CHARACTERS.player}</g>
      
      <!-- First course - tiny plate -->
      <g transform="translate(360, 270)">
        <ellipse cx="0" cy="0" rx="8" ry="4" fill="#f5f0e8" stroke="#c4bfb5"/>
        <circle cx="0" cy="-1" r="2" fill="#d8c8b0"/>
      </g>
    </svg>
  `,

  'dining_tension': `
    <svg viewBox="0 0 800 500" class="illustration-svg">
      ${SVG_FILTERS}
      ${ROOMS.diningArea}
      
      <!-- Dining table -->
      <g transform="translate(350, 300)">
        ${FURNITURE.diningTable}
      </g>
      
      <!-- Spilled water effect -->
      <ellipse cx="370" cy="295" rx="25" ry="12" fill="#d8e8f0" opacity="0.5"/>
      
      <!-- Soggy napkin swans -->
      <g transform="translate(355, 290)" opacity="0.7">${FURNITURE.napkinSwan}</g>
      
      <!-- Characters - Mara standing, tense -->
      <g transform="translate(260, 280)">${CHARACTERS.mara}</g>
      <g transform="translate(410, 245)">${CHARACTERS.eli}</g>
      <g transform="translate(340, 320)">${CHARACTERS.dana}</g>
      <g transform="translate(380, 210)">${CHARACTERS.player}</g>
    </svg>
  `,

  // Hallway scenes
  'hallway': `
    <svg viewBox="0 0 800 500" class="illustration-svg">
      ${SVG_FILTERS}
      ${ROOMS.hallway}
      
      <!-- Player alone in hallway -->
      <g transform="translate(400, 340)">
        ${CHARACTERS.player}
      </g>
      
      <!-- Mysterious light under door 2 -->
      <rect x="425" y="278" width="30" height="2" fill="#e8e0d0" opacity="0.6"/>
    </svg>
  `,

  // Kitchen scenes
  'kitchen': `
    <svg viewBox="0 0 800 500" class="illustration-svg">
      ${SVG_FILTERS}
      ${ROOMS.kitchen}
      
      <!-- Mara cooking -->
      <g transform="translate(300, 260)">
        ${CHARACTERS.mara}
      </g>
      
      <!-- Eli with colander -->
      <g transform="translate(420, 280)">
        ${CHARACTERS.eli}
      </g>
      <g transform="translate(440, 250)">
        ${FURNITURE.colander}
      </g>
      
      <!-- Pots and pans -->
      <circle cx="395" cy="185" r="8" fill="#4a4540" stroke="#3a3530"/>
      <circle cx="415" cy="190" r="10" fill="#5a5550" stroke="#3a3530"/>
    </svg>
  `,

  'kitchen_crying': `
    <svg viewBox="0 0 800 500" class="illustration-svg">
      ${SVG_FILTERS}
      ${ROOMS.kitchen}
      
      <!-- Mara and Eli embracing -->
      <g transform="translate(350, 270)">
        <ellipse cx="0" cy="-20" rx="16" ry="12" fill="#4a4540"/>
        <circle cx="-5" cy="-38" r="7" fill="#4a4540"/>
        <circle cx="5" cy="-40" r="8" fill="#4a4540"/>
      </g>
      
      <!-- Colander on counter - abandoned -->
      <g transform="translate(260, 240)">
        ${FURNITURE.colander}
      </g>
      
      <!-- Player peeking in (partial, at door) -->
      <g transform="translate(500, 300)" opacity="0.6">
        ${CHARACTERS.player}
      </g>
    </svg>
  `,

  // Radio room
  'radio_room': `
    <svg viewBox="0 0 800 500" class="illustration-svg">
      ${SVG_FILTERS}
      ${ROOMS.radioRoom}
      
      <!-- Many radios on shelves -->
      <g transform="translate(290, 165)">${FURNITURE.radio}</g>
      <g transform="translate(320, 152)">${FURNITURE.radio}</g>
      <g transform="translate(350, 140)">${FURNITURE.radio}</g>
      
      <g transform="translate(290, 205)">${FURNITURE.radio}</g>
      <g transform="translate(320, 192)">${FURNITURE.radio}</g>
      <g transform="translate(350, 180)">${FURNITURE.radio}</g>
      
      <g transform="translate(290, 245)">${FURNITURE.radio}</g>
      <g transform="translate(320, 232)">${FURNITURE.radio}</g>
      <g transform="translate(350, 220)">${FURNITURE.radio}</g>
      
      <!-- More radios scattered -->
      <g transform="translate(420, 280)">${FURNITURE.radio}</g>
      <g transform="translate(450, 295)">${FURNITURE.radio}</g>
      <g transform="translate(480, 280)">${FURNITURE.radio}</g>
      
      <!-- One radio glowing/active -->
      <g transform="translate(350, 180)">
        <circle cx="10" cy="-10" r="6" fill="#e8d8a0" opacity="0.5"/>
      </g>
      
      <!-- Player exploring -->
      <g transform="translate(400, 340)">
        ${CHARACTERS.player}
      </g>
      
      <!-- Eli appears in doorway -->
      <g transform="translate(500, 310)" opacity="0.8">
        ${CHARACTERS.eli}
      </g>
    </svg>
  `,

  // Default/fallback
  'default': `
    <svg viewBox="0 0 800 500" class="illustration-svg">
      ${SVG_FILTERS}
      <!-- Simple room outline -->
      <path d="M200,350 L400,250 L600,350 L400,450 Z" class="fill-floor"/>
      <path d="M200,350 L200,200 L400,100 L400,250 Z" class="fill-wall"/>
      <path d="M400,100 L400,250 L600,350 L600,200 Z" class="fill-wall" style="fill: #e8e3d8"/>
      
      <!-- Minimal furniture suggestion -->
      <ellipse cx="350" cy="320" rx="40" ry="20" class="fill-warm" opacity="0.5"/>
      
      <!-- Player -->
      <g transform="translate(400, 340)">
        ${CHARACTERS.player}
      </g>
    </svg>
  `
};

// Map node IDs or scene keywords to illustrations
export function getIllustrationForScene(nodeId: string, nodeText: string, location?: string): string {
  // Check location first
  if (location) {
    const loc = location.toLowerCase();
    if (loc.includes('kitchen')) return SCENE_ILLUSTRATIONS['kitchen'];
    if (loc.includes('hallway') || loc.includes('hall')) return SCENE_ILLUSTRATIONS['hallway'];
    if (loc.includes('radio')) return SCENE_ILLUSTRATIONS['radio_room'];
    if (loc.includes('dining')) return SCENE_ILLUSTRATIONS['dining'];
    if (loc.includes('entry') || loc.includes('living')) return SCENE_ILLUSTRATIONS['entryway'];
  }
  
  // Check node text for context
  const text = nodeText.toLowerCase();
  
  // Kitchen scenes
  if (text.includes('colander') && text.includes('holding')) {
    return SCENE_ILLUSTRATIONS['kitchen'];
  }
  if (text.includes('mara is crying') || text.includes('eli is holding her')) {
    return SCENE_ILLUSTRATIONS['kitchen_crying'];
  }
  if (text.includes('kitchen') || text.includes('stove') || text.includes('cooking')) {
    return SCENE_ILLUSTRATIONS['kitchen'];
  }
  
  // Hallway scenes
  if (text.includes('hallway') || text.includes('down the hall') || text.includes('first door') || text.includes('second door')) {
    return SCENE_ILLUSTRATIONS['hallway'];
  }
  
  // Radio room
  if (text.includes('radio') && (text.includes('room') || text.includes('office') || text.includes('43') || text.includes('forty'))) {
    return SCENE_ILLUSTRATIONS['radio_room'];
  }
  
  // Dining scenes
  if (text.includes('napkin') || text.includes('swan') || text.includes('first course') || text.includes('second course')) {
    return SCENE_ILLUSTRATIONS['dining'];
  }
  if (text.includes('table') && (text.includes('water') || text.includes('spill') || text.includes('tablecloth'))) {
    return SCENE_ILLUSTRATIONS['dining_tension'];
  }
  if (text.includes('plate') || text.includes('eat') || text.includes('course') || text.includes('food')) {
    return SCENE_ILLUSTRATIONS['dining'];
  }
  
  // Wine/arrival scenes
  if (text.includes('wine') || text.includes('sancerre') || text.includes('grüner')) {
    return SCENE_ILLUSTRATIONS['living_room'];
  }
  
  // Arrival/entryway
  if (text.includes('shoes') || text.includes('coat') || text.includes('jacket') || text.includes('arrived') || text.includes('found it')) {
    return SCENE_ILLUSTRATIONS['entryway'];
  }
  
  // Default to living room if nothing matches
  return SCENE_ILLUSTRATIONS['default'];
}

// Get location label for the scene
export function getLocationLabel(nodeText: string): string {
  const text = nodeText.toLowerCase();
  
  if (text.includes('kitchen') || text.includes('cooking') || text.includes('colander')) {
    return 'THE KITCHEN';
  }
  if (text.includes('hallway') || text.includes('down the hall')) {
    return 'THE HALLWAY';
  }
  if (text.includes('radio') || text.includes('43') || text.includes('vintage')) {
    return "ELI'S RADIO ROOM";
  }
  if (text.includes('bathroom') || text.includes('mirror') || text.includes('lavender')) {
    return 'THE BATHROOM';
  }
  if (text.includes('table') || text.includes('napkin') || text.includes('course') || text.includes('swan')) {
    return 'THE DINING ROOM';
  }
  if (text.includes('couch') || text.includes('sitting')) {
    return 'THE LIVING ROOM';
  }
  if (text.includes('shoes') || text.includes('arrived') || text.includes('found it')) {
    return 'THE ENTRYWAY';
  }
  
  return 'THE WEISSMAN APARTMENT';
}
