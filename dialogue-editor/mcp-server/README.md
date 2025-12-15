# Dialogue Editor MCP Server

This MCP server allows Cascade/Claude to directly edit your dialogue graphs through Windsurf - no separate API key needed!

## Setup

### 1. Install dependencies

```bash
cd mcp-server
npm install
```

### 2. Add to Windsurf MCP config

Open your Windsurf MCP settings (`~/.codeium/windsurf/mcp_config.json`) and add:

```json
{
  "mcpServers": {
    "dialogue-editor": {
      "command": "node",
      "args": ["/Users/ben/Documents/GitHub/articy-clone/dialogue-editor/mcp-server/index.js"]
    }
  }
}
```

### 3. Restart Windsurf

After updating the config, restart Windsurf to load the MCP server.

### 4. Start the dialogue editor

```bash
cd dialogue-editor
npm run dev
```

The editor will automatically connect to the MCP server on `ws://localhost:9999`.

## Usage

Once connected, you can talk to Cascade naturally:

- "Make Mara's line more passive-aggressive"
- "Add a new character named Viktor with a red color"
- "Create a branch after node_5 with three options"
- "Rewrite the selected dialogue to be funnier"
- "Add a condition that checks if tension is above 3"

## Available Tools

| Tool | Description |
|------|-------------|
| `get_graph_state` | Get current nodes, characters, connections |
| `get_selected_nodes` | See what's selected in the editor |
| `edit_node_text` | Change dialogue text |
| `edit_node_speaker` | Change who speaks |
| `add_dialogue_node` | Add new dialogue |
| `add_hub_node` | Add player choice point |
| `add_condition_node` | Add conditional branch |
| `add_instruction_node` | Add variable setter |
| `connect_nodes` | Connect two nodes |
| `add_character` | Add new character |
| `batch_add_dialogue` | Add multiple lines at once |

## Architecture

```
┌─────────────┐     WebSocket      ┌─────────────┐
│  Dialogue   │◄──────────────────►│    MCP      │
│   Editor    │    port 9999       │   Server    │
│  (browser)  │                    │  (node.js)  │
└─────────────┘                    └──────┬──────┘
                                          │ stdio
                                          ▼
                                   ┌─────────────┐
                                   │  Windsurf   │
                                   │  (Cascade)  │
                                   └─────────────┘
```
