# Dialogue Editor System

A cutting-edge dialogue tree editor with Unreal Engine integration, inspired by articy:draft.

## Project Structure

```
articy-clone/
├── dialogue-editor/          # Tauri desktop application
│   ├── src/                  # TypeScript frontend
│   │   ├── core/             # Graph model, node factory, ID generation
│   │   ├── renderer/         # Canvas rendering (nodes, connections, viewport)
│   │   ├── editor/           # Interaction management
│   │   ├── ui/               # UI components (toolbar, palette, properties)
│   │   ├── types/            # TypeScript type definitions
│   │   └── main.ts           # Application entry point
│   ├── src-tauri/            # Rust backend
│   │   ├── src/
│   │   │   ├── graph/        # Data models, operations
│   │   │   ├── commands.rs   # Tauri commands
│   │   │   ├── validation.rs # Graph validation
│   │   │   └── export.rs     # Export to Unreal format
│   │   └── Cargo.toml
│   └── package.json
│
├── UnrealPlugin/             # Unreal Engine 5 plugin
│   ├── Source/
│   │   ├── DialogueRuntime/  # Runtime module (ships with game)
│   │   │   ├── Public/
│   │   │   │   ├── DialogueDatabase.h
│   │   │   │   ├── DialogueFlowPlayer.h
│   │   │   │   ├── DialogueGlobalVariables.h
│   │   │   │   ├── DialogueNode.h
│   │   │   │   ├── DialoguePin.h
│   │   │   │   ├── DialogueCharacter.h
│   │   │   │   └── ...
│   │   │   └── Private/
│   │   └── DialogueEditor/   # Editor module (dev only)
│   │       ├── Public/
│   │       │   ├── DialogueJSONFactory.h
│   │       │   ├── DialogueImportData.h
│   │       │   ├── DialogueAssetGenerator.h
│   │       │   └── ...
│   │       └── Private/
│   └── DialogueSystem.uplugin
│
└── ARTICY_PLUGIN_ANALYSIS.md # Architecture analysis of ArticyXImporter
```

## Features

### Desktop Editor (Tauri)

- **Node-Based Graph Editor**: Visual dialogue tree creation
- **Multiple Node Types**: Dialogue, Branch, Condition, Instruction, Hub, Jump, Flow Fragment
- **Canvas Rendering**: Hardware-accelerated 2D canvas with pan/zoom
- **Connection System**: Bezier curve connections with validation
- **Properties Panel**: Edit node properties in real-time
- **Undo/Redo**: Full history support
- **Validation**: Detect orphaned nodes, cycles, missing data
- **Export**: JSON format compatible with Unreal plugin

### Unreal Engine Plugin

- **Two-Module Design**: Runtime (ships with game) + Editor (dev only)
- **DialogueDatabase**: Central access point for all dialogue objects
- **DialogueFlowPlayer**: Actor component for dialogue traversal
- **Global Variables**: Type-safe variable system with namespaces
- **Shadow State**: Speculative execution for branch evaluation
- **Blueprint Integration**: Full Blueprint support for all systems
- **JSON Import**: Drag-and-drop import from desktop editor

## Getting Started

### Desktop Editor

```bash
cd dialogue-editor

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

### Unreal Plugin

1. Copy the `UnrealPlugin` folder to your project's `Plugins` directory
2. Rename to `DialogueSystem`
3. Regenerate project files
4. Enable the plugin in Edit → Plugins

## Architecture

### Data Model

```
DialogueGraph
├── Nodes[]
│   ├── id, technicalName, nodeType
│   ├── position, size
│   ├── inputPorts[], outputPorts[]
│   └── data (type-specific)
├── Connections[]
│   ├── fromNodeId, fromPortIndex
│   └── toNodeId, toPortIndex
├── Variables[]
│   └── Namespaces[] → Variables[]
└── Characters[]
```

### Node Types

| Type | Description | Ports |
|------|-------------|-------|
| **Dialogue** | Main dialogue container | 1 in, N out |
| **DialogueFragment** | Individual line of dialogue | 1 in, N out |
| **Branch** | Choice point for player | 1 in, N out |
| **Condition** | Script-based branching | 1 in, 2 out (true/false) |
| **Instruction** | Execute script | 1 in, 1 out |
| **Hub** | Merge/split point | N in, N out |
| **Jump** | Jump to another node | 1 in, 0 out |
| **FlowFragment** | Grouping container | N in, N out |

### Flow Player

The `UDialogueFlowPlayer` component handles dialogue traversal:

```cpp
// Blueprint usage
UPROPERTY()
UDialogueFlowPlayer* FlowPlayer;

// Setup
FlowPlayer->SetStartNodeById("node_123");
FlowPlayer->PauseOn = EDialoguePausableType::DialogueFragment;

// Events
FlowPlayer->OnPlayerPaused.AddDynamic(this, &AMyActor::OnDialoguePaused);
FlowPlayer->OnBranchesUpdated.AddDynamic(this, &AMyActor::OnBranchesUpdated);

// Play
FlowPlayer->Play(0); // Play first branch
```

### Shadow State

Shadow state enables speculative script execution without side effects:

```cpp
// Evaluate conditions without changing variables
FlowPlayer->ShadowedOperation([&]() {
    // This runs speculatively
    bool result = Condition->Evaluate(GVs, MethodProvider);
    // Variables are restored after this block
});
```

## Export Format

The desktop editor exports JSON compatible with Unreal:

```json
{
  "formatVersion": "1.0",
  "project": {
    "name": "My Dialogue",
    "technicalName": "my_dialogue",
    "guid": "abc-123"
  },
  "globalVariables": [
    {
      "name": "Player",
      "variables": [
        { "name": "Health", "type": "Number", "defaultValue": 100 }
      ]
    }
  ],
  "characters": [
    { "id": "char1", "displayName": "Hero", "color": "#4a90e2" }
  ],
  "packages": [
    {
      "name": "Main",
      "isDefaultPackage": true,
      "objects": [...],
      "connections": [...]
    }
  ]
}
```

## Key Patterns (from Articy Analysis)

1. **Interface-Based Design**: Use interfaces like `IDialogueObjectWithText`, `IDialogueConditionProvider` for capability queries
2. **128-bit IDs**: Stable across exports/reimports
3. **Clone Support**: Object cloning for multiple dialogue instances
4. **Code Generation**: Generate project-specific classes for type safety
5. **Package System**: Modular content organization

## Development

### Frontend (TypeScript)

- **Framework**: Vanilla TypeScript with Canvas 2D
- **Build**: Vite
- **Styling**: CSS custom properties for theming

### Backend (Rust)

- **Framework**: Tauri 2.0
- **Serialization**: serde + serde_json
- **IPC**: Tauri command system

### Unreal Plugin (C++)

- **Engine**: Unreal Engine 5.x
- **Modules**: Runtime + Editor
- **Build**: UnrealBuildTool

## License

MIT License - See LICENSE file for details.
