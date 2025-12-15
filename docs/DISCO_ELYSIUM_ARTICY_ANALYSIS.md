# Disco Elysium + Articy:Draft Analysis
## Insights for dialogue-editor Development

**Source**: "The Making of Disco Elysium - Part Three: Writing" documentary + Articy:Draft 2.4 feature overview

---

## 1. Disco Elysium's Writing Approach

### Key Takeaways from Documentary

1. **Scale**: 1.2 million words of dialogue - requires robust tooling
2. **Skill System as Characters**: The 24 skills (Electrochemistry, Drama, Encyclopedia, Volition, etc.) are treated as internal voices that interject into conversations
3. **Skill Check Integration**: Dialogue options show skill checks inline with difficulty ratings (Easy/Medium/Hard) and Success/Failure outcomes
4. **Rich Character Context**: Character portraits with names and descriptive titles (e.g., "KLAASJE (MISS ORANJE DISCO DANCER)")
5. **Environmental Storytelling**: Objects can be dialogue participants (FILE CABINET speaks)
6. **Branching with Memory**: Dialogue references past choices and world state

### Dialogue UI Patterns (In-Game)
- **Speaker Attribution**: Bold character name, em-dash, dialogue text
- **Skill Interjections**: Colored text with skill name + difficulty in brackets
- **Player Choices**: Numbered list (1-5+) with orange/red highlight for selected/available
- **Continue Button**: Orange "CONTINUE ►" for non-choice progression
- **Portrait Panel**: Character art alongside dialogue
- **Task Updates**: Modal overlay "TASK UPDATED: [task name]"

---

## 2. Articy:Draft UX Patterns

### Core UI Components (from screenshots)

#### A. Flow Canvas
- **Grid Background**: Dark blue-gray with subtle grid lines
- **Node Types**: 
  - Dialogue Fragments (blue header, character portrait, text body)
  - Conditions (purple, shows expression like `IsRaining()`)
  - Hubs (yellow folder icon, named targets like "Hub 01")
  - Jump Nodes (navigation to other flow locations)
  - Annotations (documentation)
- **Connections**: Curved bezier lines with directional arrows
- **Color Coding**: Different node types have distinct colors (blue=dialogue, purple=condition, yellow=hub/jump, green/orange/red=custom)

#### B. Node Cards
- **Header**: Title bar with icon + name
- **Portrait Area**: Character image thumbnail
- **Text Fields**: "Insert menu text", "Insert stage directions", dialogue content
- **Connection Points**: Left (input) and right (output) handles

#### C. Conditional Branching
- **Visual**: Condition node splits flow into labeled branches ("RAINING" / "SUNNY")
- **Expression**: Shows actual condition code `IsRaining() && IsOutside("Player")`
- **Error Indicator**: Red exclamation for syntax errors

#### D. Flow Simulation Panel
- **Split View**: Flow canvas left, simulation preview right
- **Real-time Preview**: Shows dialogue as it would appear in-game
- **Playback Controls**: Play, stop, step buttons
- **Variable State Tab**: Shows current variable values during simulation

#### E. Variable Management
- **Tree Navigation**: Left sidebar with project hierarchy
- **Variable Sets**: Groups like "QuestStates", "NewVariableSet"
- **Table View**: Name, Description, Type, Default Value columns
- **Filter**: Search/filter bar for variables

#### F. Document/Script View
- **Screenplay Format**: Proper scene headings, character names centered, parentheticals
- **FADE IN/Scene Headers**: Traditional screenplay conventions
- **Side-by-Side**: Document view alongside flow canvas

#### G. Relationship Tracking
- **Edge Labels**: "Relationship to Paul: -5" on connections
- **Bidirectional**: Can track both directions of relationships

---

## 3. Architecture Recommendations for dialogue-editor

### Data Model Enhancements

```typescript
// Core node types to support
interface DialogueNode {
  id: string;
  type: 'dialogue' | 'condition' | 'hub' | 'jump' | 'instruction' | 'annotation';
  speaker?: CharacterRef;
  portrait?: string;
  menuText?: string;        // Short text shown in choice list
  stageDirections?: string; // Parenthetical/action text
  dialogueText: string;     // Main spoken text
  position: { x: number; y: number };
  color?: string;
  metadata?: Record<string, unknown>;
}

interface ConditionNode {
  id: string;
  type: 'condition';
  expression: string;       // e.g., "IsRaining() && player.location === 'outside'"
  branches: {
    label: string;          // "RAINING", "SUNNY", etc.
    targetId: string;
  }[];
  position: { x: number; y: number };
}

interface Character {
  id: string;
  name: string;
  displayName: string;      // "KLAASJE (MISS ORANJE DISCO DANCER)"
  portraits: Portrait[];
  color?: string;           // Node color when this character speaks
}

interface Variable {
  id: string;
  name: string;
  setId: string;            // Group/namespace
  type: 'boolean' | 'integer' | 'string' | 'float';
  defaultValue: unknown;
  description?: string;
}

interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;           // "Relationship to Paul: -5"
  condition?: string;       // Optional inline condition
}
```

### UI Components to Build

1. **Flow Canvas** (Priority: HIGH)
   - Infinite pan/zoom canvas with grid
   - Drag-and-drop node placement
   - Bezier curve connections
   - Multi-select and group operations

2. **Node Palette** (Priority: HIGH)
   - Toolbar with node type icons
   - Drag to create or click to place
   - Types: Dialogue Fragment, Hub, Jump, Condition, Instruction, Annotation

3. **Node Inspector** (Priority: HIGH)
   - Context-sensitive property panel
   - Character selector with portrait preview
   - Text fields for menu text, stage directions, dialogue
   - Condition expression editor

4. **Variable Manager** (Priority: MEDIUM)
   - Tree view for variable sets
   - Table editor for variables
   - Type selector and default value editor

5. **Flow Simulator** (Priority: MEDIUM)
   - Preview panel showing dialogue flow
   - Step/play/stop controls
   - Variable state display
   - Branch selection for testing paths

6. **Document Export** (Priority: LOW)
   - Screenplay format export
   - Side-by-side preview

---

## 4. UX Principles from Articy

### Visual Hierarchy
- **Dark Theme**: Reduces eye strain for long writing sessions
- **Color Coding**: Instant node type recognition
- **Grid Alignment**: Helps organize complex flows
- **Minimap**: Corner preview for navigation in large flows

### Interaction Patterns
- **Right-Click Context Menu**: Quick node creation and actions
- **Double-Click to Edit**: Inline text editing
- **Drag Handles**: Connection points on node edges
- **Snap to Grid**: Optional alignment assistance

### Writing-First Design
- **Large Text Areas**: Prioritize dialogue content
- **Portrait Integration**: Character visualization while writing
- **Stage Directions**: First-class support for action/emotion notes
- **Menu Text vs Dialogue**: Separate short choice text from full response

---

## 5. Implementation Roadmap

### Phase 1: Core Canvas (Current Focus)
- [x] Basic React Flow setup
- [ ] Custom node types (Dialogue, Condition, Hub)
- [ ] Node inspector panel
- [ ] Character/portrait integration

### Phase 2: Writing Experience
- [ ] Inline text editing on nodes
- [ ] Stage direction support
- [ ] Menu text field
- [ ] Character selector with portraits

### Phase 3: Logic & Variables
- [ ] Condition expression editor
- [ ] Variable manager panel
- [ ] Variable reference autocomplete
- [ ] Conditional branching visualization

### Phase 4: Simulation & Export
- [ ] Flow simulation preview
- [ ] Step-through debugging
- [ ] Variable state inspection
- [ ] Screenplay export format

---

## 6. Key Differentiators to Consider

### vs Articy:Draft
- **Web-based**: No install, collaborative potential
- **Open Source**: Community contributions
- **Modern Stack**: React, TypeScript, better DX

### Potential Innovations
- **AI Assistance**: Suggest dialogue variations, check consistency
- **Real-time Collaboration**: Multiple writers on same flow
- **Version Control**: Git-friendly format, diff visualization
- **Plugin System**: Custom node types, exporters

---

## Appendix: Screenshot Reference

| Screenshot | Content |
|------------|---------|
| sc_1 | Disco Elysium concept art - pier scene annotations |
| sc_2-5, 8-9, 11, 18-19, 32 | In-game dialogue UI examples |
| sc_6-7 | Inventory system UI |
| sc_10, 12 | Environmental art/level design |
| sc_13-14 | Articy variable management |
| sc_15-16 | Articy conditional branching |
| sc_17 | Articy flow simulation split view |
| sc_20-28 | Articy flow canvas with story nodes |
| sc_29-30 | Articy screenplay/document view |
| sc_31, 33 | Articy dialogue nodes with relationships |

