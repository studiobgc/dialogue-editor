# Design Philosophy: Dialogue Editor
## For Designers Who Write, Not Writers Who Design

---

## Inspiration from the Transcript

The Disco Elysium documentary revealed something profound: **their writers needed a tool that got out of the way**. The speaker emphasized how writers *hate* blank pages in Word documents, and how Articy's drag-to-create feature solved this by making the act of creation feel continuous—you're always extending from something, never starting from nothing.

### Key Insights

1. **"Writers hate a blank page"** - The drag-to-create feature means you never face emptiness. You pull new ideas from existing ones. The tool becomes a conversation partner, not a blank canvas demanding creativity.

2. **1.2 million words** - Scale matters. The tool must feel fast and responsive even with massive dialogue trees. Performance isn't a feature—it's the foundation.

3. **Skills as characters** - In Disco Elysium, the 24 skills are internal voices that interject. This suggests our "character" concept should be broader—anything can speak: objects, thoughts, internal voices, narrators.

4. **Storytelling, not programming** - Conditions and variables exist, but they should feel like story logic, not code. "If the player was kind to the dog" not "if(player.karma.dog > 5)"

---

## The Figma-Inspired Approach

You're a designer of 10 years. You think in layers, frames, components, and prototypes. Node-based dialogue tools feel alien because they come from game dev middleware culture—dark UIs, small text, "technical names," and academic graph theory aesthetics.

### What Figma Gets Right

| Figma Pattern | Dialogue Editor Translation |
|--------------|----------------------------|
| **Direct manipulation** | Click node to edit inline, not in a separate panel |
| **Cmd+/ Command Palette** | Quick actions: "add character", "create branch", "jump to..." |
| **Properties panel (right)** | Context-aware inspector that shows what matters |
| **Layers panel (left)** | Story structure: chapters, scenes, characters |
| **Frames organize content** | Flow Fragments contain dialogue sequences |
| **Components & instances** | Reusable dialogue patterns (shop menus, greetings) |
| **Auto-layout** | Smart node arrangement, automatic spacing |
| **Prototype mode** | Flow simulation / playtest mode |
| **Comments** | Annotations, writer notes, TODO markers |
| **Multiplayer cursors** | (Future) collaborative writing |

### What We'll Add

| New Pattern | Purpose |
|-------------|---------|
| **Drag-to-Create** | Pull new nodes from existing ones, never face blank canvas |
| **Character Quick-Switch** | Tab through speakers while typing |
| **Coachmarks** | Contextual hints that teach as you work |
| **Progressive disclosure** | Start simple, unlock complexity as needed |
| **Keyboard-first flow** | Enter to create next node, Tab to branch |

---

## Progressive Disclosure: Teaching Through Doing

### First Launch Experience

Instead of a tutorial video or wall of text, we'll use **contextual coachmarks**—small hints that appear exactly when relevant.

```
┌─────────────────────────────────────────────────┐
│                                                 │
│     ┌──────────────────────┐                   │
│     │ Start with a thought │ ←─ Coachmark      │
│     │ What does your       │    "Click here    │
│     │ character say first? │     to start      │
│     │                      │     writing"      │
│     │ [Type here...]       │                   │
│     └──────────────────────┘                   │
│                                                 │
│                         ┌──────────────────────┐
│                         │ 💡 Tip: Drag from   │
│                         │ the → to create the │
│                         │ next line           │
│                         └──────────────────────┘
└─────────────────────────────────────────────────┘
```

### Coachmark Sequence

1. **First node**: "Click to start writing. What does your character say?"
2. **After typing**: "Drag from → to create what happens next"
3. **After first connection**: "Great! Now you have a flow. Keep going!"
4. **After 3 nodes**: "Press Tab on a node to create a branch (player choice)"
5. **After branching**: "You're building a conversation tree! 🌳"

### Feature Unlock Progression

| Level | Features Available | Unlock Trigger |
|-------|-------------------|----------------|
| **Beginner** | Dialogue nodes, basic connections | Default |
| **Intermediate** | Branches, characters, colors | After 5 nodes created |
| **Advanced** | Conditions, variables, instructions | After first branch used |
| **Expert** | Custom expressions, jumps, flow fragments | After using conditions |

Hidden until needed—not because users can't handle it, but because they don't need the cognitive load until the moment it's useful.

---

## Node Design: Figma-Inspired Cards

### Current Problem: Articy's Nodes Feel Clinical

```
┌────────────────────────────────┐
│ ▪ DialogueFragment_0x4A2F     │  ← Technical name? Why?
├────────────────────────────────┤
│ Speaker: Character_NPC_01     │  ← IDs instead of names
│ Text: "Hello there."          │  ← Tiny text area
│ MenuText: [empty]             │  ← What's this?
└────────────────────────────────┘
```

### New Design: Content-First Cards

```
┌─────────────────────────────────────────────┐
│ ● Elena                                    →│
│ ─────────────────────────────────────────── │
│                                             │
│ "I've been waiting for you. The others     │
│ said you wouldn't come."                    │
│                                             │
│ ─────────────────────────────────────────── │
│ [If player hasn't met Elena before]        │  ← Only if condition set
└─────────────────────────────────────────────┘
     │
     ├──→ [Apologize] "Sorry I'm late..."
     │
     └──→ [Suspicious] "Who are the others?"
```

### Design Principles

1. **Character indicator is a colored dot**, not a dropdown
2. **Text is primary**—large, readable, editable in place
3. **Technical details hidden** until hover/select
4. **Conditions shown as badges**, not code
5. **Connections are obvious**—clear visual flow

---

## The Drag-to-Create Interaction

### How It Works

1. User hovers near the right edge of a node → subtle `→` handle appears
2. User drags from the handle into empty space
3. **Quick Create Menu** appears at cursor position:

```
┌─────────────────────────┐
│ What happens next?      │
├─────────────────────────┤
│ 💬 Dialogue             │  ← Same speaker continues
│ 💬 Elena responds       │  ← Quick-switch to character
│ 💬 Marcus responds      │
│ ─────────────────────── │
│ ◇ Player choice        │  ← Creates branch
│ ❓ Condition            │  ← If/then logic
│ ⚡ Action               │  ← Game instruction
│ ─────────────────────── │
│ ○ Cancel                │
└─────────────────────────┘
```

4. Selection creates node, auto-connected, in edit mode
5. User types immediately—no extra clicks

### Keyboard Flow

```
[Type dialogue] → [Enter] → [New node, same speaker, typing]
[Type dialogue] → [Tab] → [Branch node with 2 choices]
[Type dialogue] → [Shift+Enter] → [New node, switch speaker]
```

---

## Information Architecture

### Left Sidebar: Story Structure

```
┌─────────────────────────┐
│ 📖 My RPG Dialogue      │
├─────────────────────────┤
│ ▼ Characters            │
│   ● Elena (12 lines)    │
│   ● Marcus (8 lines)    │
│   ● Player (15 lines)   │
│                         │
│ ▼ Scenes                │
│   📍 Town Square        │
│   📍 Elena's House      │
│   📍 The Forest         │
│                         │
│ ▼ Variables             │
│   met_elena: false      │
│   trust_level: 0        │
└─────────────────────────┘
```

### Right Panel: Context-Aware Inspector

When nothing selected:
```
┌─────────────────────────┐
│ Project Overview        │
├─────────────────────────┤
│ 45 dialogue nodes       │
│ 3 characters            │
│ 12 branches             │
│                         │
│ [▶ Playtest]            │
│ [📤 Export]             │
└─────────────────────────┘
```

When node selected:
```
┌─────────────────────────┐
│ Elena's Greeting        │
├─────────────────────────┤
│ Speaker                 │
│ [● Elena          ▼]    │
│                         │
│ Dialogue                │
│ ┌─────────────────────┐ │
│ │ "I've been waiting  │ │
│ │ for you..."         │ │
│ └─────────────────────┘ │
│                         │
│ ▶ Stage Direction       │
│ ▶ Conditions            │
│ ▶ Advanced              │
└─────────────────────────┘
```

---

## Rive State Machine Parallel

You mentioned struggling with Rive's state machine. There's a reason—state machines are a *programming* concept forced into a *design* tool. The same problem exists in dialogue tools.

### The Problem

State machines think in:
- States (nodes)
- Transitions (edges)
- Conditions (guards)
- Actions (side effects)

This is **computer science**, not **storytelling**.

### Our Solution: Story Logic

Instead of:
```
State: GREETING
Transition: ON_PLAYER_RESPONSE
  Guard: response == "friendly"
  Action: SET karma += 1
  Target: FRIENDLY_PATH
```

We show:
```
Elena: "Hello, stranger."
  ↓
  [If player is friendly] → Elena smiles, karma +1
  [If player is rude] → Elena frowns
```

The logic is the same, but the *language* is human.

---

## Visual Language

### Color System

| Element | Color | Meaning |
|---------|-------|---------|
| Dialogue node | Character color | Who's speaking |
| Branch node | Amber/Yellow | Player choice |
| Condition | Purple | Logic check |
| Instruction | Green | Game action |
| Connection | Gray → Colored | Flow direction |

### Typography

- **Node text**: 14px, readable, the star of the show
- **Labels**: 11px, muted, supporting information
- **Technical IDs**: Hidden by default

### Motion

- Connections draw smoothly when created
- Nodes ease into position
- Coachmarks fade in/out gently
- No jarring transitions

---

## Implementation Roadmap

### Phase 1: Drag-to-Create (This Session)
- [ ] Detect drag from output handle into empty space
- [ ] Show Quick Create Menu at cursor
- [ ] Create node and connection in one action
- [ ] Auto-focus text input on new node

### Phase 2: Figma-Style Toolbar
- [ ] Minimal top bar with essentials
- [ ] Floating toolbar near selection
- [ ] Command palette (Cmd+/)

### Phase 3: Coachmarks & Onboarding
- [ ] First-launch guided experience
- [ ] Contextual tips that appear once
- [ ] Progress tracking (beginner → expert)

### Phase 4: Inline Editing
- [ ] Double-click node to edit in place
- [ ] Tab to switch between fields
- [ ] Enter to create next node

### Phase 5: Story Structure Panel
- [ ] Character list with usage stats
- [ ] Scene/chapter organization
- [ ] Variable editor with friendly UI

---

## Summary

This tool should feel like **Figma for stories**—familiar to designers, approachable to non-writers, powerful enough for 1.2 million words. We're not building game dev middleware; we're building a **creative tool for storytellers**.

The drag-to-create feature isn't just a nice-to-have—it's the philosophical core. You're never starting from nothing. You're always continuing a thought.

> "Writers hate a blank page."

So we'll never show them one.
