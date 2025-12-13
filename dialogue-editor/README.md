# Dialogue Editor - Desktop Application

A Tauri-based desktop dialogue tree editor with a canvas-based UI.

## Prerequisites

- **Node.js** 18+ 
- **Rust** 1.70+
- **Tauri CLI** 2.0+

## Installation

```bash
# Install Node dependencies
npm install

# Install Tauri CLI (if not already installed)
npm install -g @tauri-apps/cli
```

## Development

```bash
# Start development server with hot reload
npm run tauri dev
```

## Production Build

```bash
# Build for current platform
npm run tauri build
```

## Project Structure

```
src/
├── core/
│   ├── IdGenerator.ts      # ID generation utilities
│   ├── NodeFactory.ts      # Node creation with defaults
│   └── GraphModel.ts       # Core graph data model
├── renderer/
│   ├── Viewport.ts         # Pan/zoom coordinate system
│   ├── NodeRenderer.ts     # Node drawing
│   ├── ConnectionRenderer.ts # Connection curves
│   └── GraphRenderer.ts    # Main renderer coordinator
├── editor/
│   └── InteractionManager.ts # Mouse/keyboard handling
├── ui/
│   ├── Toolbar.ts          # Top toolbar
│   ├── Palette.ts          # Node palette (left)
│   ├── PropertiesPanel.ts  # Properties editor (right)
│   ├── ContextMenu.ts      # Right-click menus
│   └── StatusBar.ts        # Bottom status bar
├── types/
│   └── graph.ts            # TypeScript interfaces
├── styles/
│   └── main.css            # Application styles
└── main.ts                 # Entry point

src-tauri/
├── src/
│   ├── graph/
│   │   ├── mod.rs          # Module exports
│   │   ├── types.rs        # Rust data structures
│   │   ├── model.rs        # Graph operations
│   │   └── id.rs           # ID utilities
│   ├── commands.rs         # Tauri IPC commands
│   ├── validation.rs       # Graph validation
│   ├── export.rs           # Export formats
│   └── main.rs             # Rust entry point
├── Cargo.toml
└── tauri.conf.json
```

## Features

### Canvas Editor
- Pan with middle mouse button or Shift+drag
- Zoom with scroll wheel
- Select nodes by clicking
- Multi-select with Shift+click or box selection
- Drag to move selected nodes
- Delete with Delete/Backspace key

### Node Palette
- Drag nodes from palette onto canvas
- Categories: Flow, Logic, Navigation

### Properties Panel
- Edit selected node properties
- Type-specific editors
- Real-time updates

### Keyboard Shortcuts
- `Ctrl/Cmd + Z` - Undo
- `Ctrl/Cmd + Y` or `Ctrl/Cmd + Shift + Z` - Redo
- `Ctrl/Cmd + A` - Select all
- `Ctrl/Cmd + D` - Duplicate
- `Delete/Backspace` - Delete selected
- `Escape` - Clear selection

## Tauri Commands

The Rust backend exposes these commands:

| Command | Description |
|---------|-------------|
| `new_graph` | Create new graph |
| `load_graph` | Load from JSON |
| `save_graph` | Save to JSON |
| `add_node` | Add node at position |
| `remove_node` | Remove node by ID |
| `add_connection` | Connect two nodes |
| `validate_graph` | Run validation |
| `export_for_unreal` | Export Unreal format |

## Export Formats

### Native (.dialogue.json)
Full graph data for save/load within the editor.

### Unreal Export (.articyue.json)
Structured format for import into Unreal Engine plugin.
