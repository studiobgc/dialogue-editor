# Dialogue Editor - Native Swift + Metal

A GPU-accelerated dialogue tree editor for macOS, built with Metal for 120Hz ProMotion support on M3 Max.

## Design Philosophy

**Visual influences:**
- **Brian De Palma** - High contrast, split-screen duality, voyeuristic framing
- **Sneakers (1992)** - Utilitarian hacker tools, phosphor terminal glow, "SETEC ASTRONOMY" reveals

**Technical approach:**
- **Metal 2** for GPU-accelerated 2D rendering
- **Instanced rendering** for efficient batch drawing of nodes
- **Custom shaders** with scanline effects and glow
- **120fps** targeting ProMotion displays

## Architecture

```
DialogueEditor/
├── App/
│   ├── AppDelegate.swift      # App lifecycle
│   └── DialogueEditor.entitlements
├── Core/
│   ├── Node.swift             # Node types and data models
│   └── GraphModel.swift       # Observable graph state
├── Rendering/
│   ├── MetalRenderer.swift    # GPU rendering coordinator
│   ├── Shaders.metal          # Metal shaders (nodes, connections, grid)
│   ├── Viewport.swift         # Pan/zoom/coordinate transforms
│   ├── NodeRenderer.swift     # Text layout calculations
│   └── ConnectionRenderer.swift # Bezier curve generation
├── UI/
│   ├── CanvasView.swift       # Metal canvas with interaction
│   ├── MainWindowController.swift # Split-view layout
│   ├── PaletteView.swift      # Draggable node palette
│   ├── PropertiesPanel.swift  # Node property editing
│   └── Theme.swift            # Color palette and styling
└── Resources/
    ├── Assets.xcassets
    └── Main.storyboard
```

## Building

1. Open `DialogueEditor.xcodeproj` in Xcode 15+
2. Select the "DialogueEditor" scheme
3. Build and run (⌘R)

## Requirements

- macOS 14.0+
- Xcode 15.0+
- Apple Silicon (M1/M2/M3) recommended for best Metal performance

## Features

- **GPU-accelerated canvas** with smooth pan/zoom
- **Node palette** with drag-to-create
- **Bezier connections** between nodes
- **Selection box** for multi-select
- **Undo/redo** support
- **JSON import/export** compatible with web version

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| ⌘N | New document |
| ⌘O | Open document |
| ⌘S | Save document |
| ⌘Z | Undo |
| ⇧⌘Z | Redo |
| ⌘A | Select all |
| ⌫ | Delete selected |
| Esc | Clear selection |

## Theme: De Palma × Sneakers

The visual aesthetic combines:

- **Void black** (#0A0A0F) - Deep background
- **Phosphor green** (#33E666) - Terminal accent, "hacker" aesthetic
- **Amber** (#F2A60C) - Warnings, branch nodes
- **Cyan** (#4DCDF2) - Cool accent, navigation
- **Magenta** (#F2339A) - De Palma neon signature
- **Crimson** (#D92626) - Danger, instruction nodes

Subtle CRT scanline effect and glow create the "seed-round Figma" feel.
