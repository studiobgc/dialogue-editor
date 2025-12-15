#!/usr/bin/env node

/**
 * Dialogue Editor MCP Server
 * 
 * This MCP server allows Cascade/Claude to directly edit dialogue graphs
 * in the running dialogue editor through Windsurf.
 * 
 * Architecture:
 * - MCP Server exposes tools for graph manipulation
 * - WebSocket server connects to the dialogue editor
 * - When tools are called, commands are sent to the editor
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { WebSocketServer } from 'ws';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createServer } from 'http';

// ============================================================
// STATE
// ============================================================

let editorConnection = null;
let graphState = {
  projectName: 'Unknown',
  nodes: [],
  characters: [],
  connections: [],
  selectedNodeIds: []
};

// Pending requests waiting for editor response
const pendingRequests = new Map();
let requestId = 0;

// ============================================================
// WEBSOCKET SERVER (connects to dialogue editor)
// ============================================================

const wss = new WebSocketServer({ port: 9999 });

wss.on('connection', (ws) => {
  console.error('[MCP] Dialogue editor connected');
  editorConnection = ws;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'state_update') {
        graphState = message.state;
        console.error(`[MCP] State updated: ${graphState.nodes?.length || 0} nodes`);
      }
      
      if (message.type === 'command_result' && message.requestId) {
        const pending = pendingRequests.get(message.requestId);
        if (pending) {
          pending.resolve(message.result);
          pendingRequests.delete(message.requestId);
        }
      }
    } catch (e) {
      console.error('[MCP] Failed to parse message:', e);
    }
  });

  ws.on('close', () => {
    console.error('[MCP] Dialogue editor disconnected');
    editorConnection = null;
  });

  // Request initial state
  ws.send(JSON.stringify({ type: 'get_state' }));
});

console.error('[MCP] WebSocket server listening on port 9999');

// ============================================================
// HTTP SERVER (for triggering commands externally)
// ============================================================

const httpServer = createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/load-project') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { filePath } = JSON.parse(body);
        const fullPath = resolve(filePath);
        const fileContent = readFileSync(fullPath, 'utf-8');
        const projectData = JSON.parse(fileContent);
        
        console.error(`[MCP] Loading project from ${fullPath} (${projectData.acts?.[0]?.scenes?.[0]?.conversations?.[0]?.nodes?.length || 0} nodes in first conv)`);
        
        const result = await sendCommand({
          type: 'load_project',
          projectData
        });
        
        console.error('[MCP] Load project result:', result);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, result }));
      } catch (err) {
        console.error('[MCP] Load project error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

httpServer.listen(9998, () => {
  console.error('[MCP] HTTP server listening on port 9998');
});

// ============================================================
// SEND COMMAND TO EDITOR
// ============================================================

async function sendCommand(command) {
  if (!editorConnection) {
    throw new Error('Dialogue editor not connected. Open the editor and it will connect automatically.');
  }

  const id = ++requestId;
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error('Command timed out'));
    }, 10000);

    pendingRequests.set(id, {
      resolve: (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      reject
    });

    editorConnection.send(JSON.stringify({
      type: 'command',
      requestId: id,
      command
    }));
  });
}

// ============================================================
// MCP SERVER
// ============================================================

const server = new Server(
  {
    name: 'dialogue-editor',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ============================================================
// TOOLS
// ============================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_graph_state',
        description: 'Get the current state of the dialogue graph including all nodes, characters, and connections. Use this first to understand what exists.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_selected_nodes',
        description: 'Get details about the currently selected nodes in the editor. Useful when user says "this node" or "the selected one".',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'edit_node_text',
        description: 'Edit the text content of a dialogue node. Use this to rewrite or modify dialogue.',
        inputSchema: {
          type: 'object',
          properties: {
            nodeId: { type: 'string', description: 'ID of the node to edit' },
            text: { type: 'string', description: 'New text content' },
            menuText: { type: 'string', description: 'Optional short text for choice menus' },
            stageDirections: { type: 'string', description: 'Optional stage directions/notes' }
          },
          required: ['nodeId', 'text']
        }
      },
      {
        name: 'edit_node_speaker',
        description: 'Change which character speaks a dialogue node.',
        inputSchema: {
          type: 'object',
          properties: {
            nodeId: { type: 'string', description: 'ID of the node to edit' },
            speakerId: { type: 'string', description: 'Character ID to set as speaker' }
          },
          required: ['nodeId', 'speakerId']
        }
      },
      {
        name: 'add_dialogue_node',
        description: 'Add a new dialogue node to the graph.',
        inputSchema: {
          type: 'object',
          properties: {
            speakerId: { type: 'string', description: 'Character ID for who speaks' },
            text: { type: 'string', description: 'Dialogue text' },
            menuText: { type: 'string', description: 'Optional short text for menus' },
            stageDirections: { type: 'string', description: 'Optional stage directions' },
            connectFromNodeId: { type: 'string', description: 'Optional node ID to connect from' },
            positionX: { type: 'number', description: 'X position (optional)' },
            positionY: { type: 'number', description: 'Y position (optional)' }
          },
          required: ['speakerId', 'text']
        }
      },
      {
        name: 'add_hub_node',
        description: 'Add a hub/branch node for player choices.',
        inputSchema: {
          type: 'object',
          properties: {
            connectFromNodeId: { type: 'string', description: 'Node to connect from' },
            positionX: { type: 'number' },
            positionY: { type: 'number' }
          },
          required: []
        }
      },
      {
        name: 'add_condition_node',
        description: 'Add a condition node that branches based on game state.',
        inputSchema: {
          type: 'object',
          properties: {
            expression: { type: 'string', description: 'Condition expression, e.g., "Game.tension >= 2"' },
            connectFromNodeId: { type: 'string' },
            positionX: { type: 'number' },
            positionY: { type: 'number' }
          },
          required: ['expression']
        }
      },
      {
        name: 'add_instruction_node',
        description: 'Add an instruction node that sets game variables.',
        inputSchema: {
          type: 'object',
          properties: {
            expression: { type: 'string', description: 'Instruction, e.g., "Game.tension = Game.tension + 1"' },
            connectFromNodeId: { type: 'string' },
            positionX: { type: 'number' },
            positionY: { type: 'number' }
          },
          required: ['expression']
        }
      },
      {
        name: 'delete_node',
        description: 'Delete a node from the graph.',
        inputSchema: {
          type: 'object',
          properties: {
            nodeId: { type: 'string', description: 'ID of node to delete' }
          },
          required: ['nodeId']
        }
      },
      {
        name: 'connect_nodes',
        description: 'Create a connection between two nodes.',
        inputSchema: {
          type: 'object',
          properties: {
            fromNodeId: { type: 'string' },
            toNodeId: { type: 'string' },
            fromPortIndex: { type: 'number', description: 'Output port index (default 0)' },
            toPortIndex: { type: 'number', description: 'Input port index (default 0)' },
            label: { type: 'string', description: 'Optional label for the connection' }
          },
          required: ['fromNodeId', 'toNodeId']
        }
      },
      {
        name: 'add_character',
        description: 'Add a new character to the project.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Character display name' },
            color: { type: 'string', description: 'Hex color, e.g., "#FF5733"' },
            description: { type: 'string', description: 'Optional character description' }
          },
          required: ['name', 'color']
        }
      },
      {
        name: 'batch_add_dialogue',
        description: 'Add multiple dialogue nodes at once in a sequence. Useful for adding a whole conversation.',
        inputSchema: {
          type: 'object',
          properties: {
            startFromNodeId: { type: 'string', description: 'Node to connect the first new node from' },
            dialogues: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  speakerId: { type: 'string' },
                  text: { type: 'string' },
                  stageDirections: { type: 'string' }
                },
                required: ['speakerId', 'text']
              },
              description: 'Array of dialogue lines to add in sequence'
            }
          },
          required: ['dialogues']
        }
      },
      {
        name: 'load_project',
        description: 'Load a dialogue project from a JSON file path. This replaces the current graph in the editor.',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Absolute path to the JSON file to load' }
          },
          required: ['filePath']
        }
      }
    ]
  };
});

// ============================================================
// TOOL HANDLERS
// ============================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_graph_state': {
        if (!editorConnection) {
          return {
            content: [{ type: 'text', text: 'Editor not connected. Please open the dialogue editor.' }]
          };
        }
        
        // Format state for readability
        const summary = {
          projectName: graphState.projectName,
          characters: graphState.characters?.map(c => ({ id: c.id, name: c.displayName || c.name })) || [],
          nodeCount: graphState.nodes?.length || 0,
          connectionCount: graphState.connections?.length || 0,
          nodes: graphState.nodes?.slice(0, 20).map(n => ({
            id: n.id,
            type: n.nodeType,
            text: n.data?.data?.text?.substring(0, 100) || n.data?.data?.script?.expression,
            speaker: n.data?.data?.speaker
          })) || []
        };
        
        return {
          content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }]
        };
      }

      case 'get_selected_nodes': {
        const selected = graphState.selectedNodeIds || [];
        const nodes = selected.map(id => 
          graphState.nodes?.find(n => n.id === id)
        ).filter(Boolean);
        
        return {
          content: [{ type: 'text', text: JSON.stringify(nodes, null, 2) }]
        };
      }

      case 'edit_node_text': {
        const result = await sendCommand({
          type: 'edit_node',
          nodeId: args.nodeId,
          changes: {
            text: args.text,
            menuText: args.menuText,
            stageDirections: args.stageDirections
          }
        });
        return {
          content: [{ type: 'text', text: `Updated node ${args.nodeId}` }]
        };
      }

      case 'edit_node_speaker': {
        const result = await sendCommand({
          type: 'edit_node',
          nodeId: args.nodeId,
          changes: { speaker: args.speakerId }
        });
        return {
          content: [{ type: 'text', text: `Changed speaker for node ${args.nodeId}` }]
        };
      }

      case 'add_dialogue_node': {
        const result = await sendCommand({
          type: 'add_node',
          nodeType: 'dialogueFragment',
          position: { x: args.positionX || 400, y: args.positionY || 200 },
          data: {
            speaker: args.speakerId,
            text: args.text,
            menuText: args.menuText,
            stageDirections: args.stageDirections
          },
          connectFrom: args.connectFromNodeId
        });
        return {
          content: [{ type: 'text', text: `Added dialogue node: "${args.text.substring(0, 50)}..."` }]
        };
      }

      case 'add_hub_node': {
        const result = await sendCommand({
          type: 'add_node',
          nodeType: 'hub',
          position: { x: args.positionX || 400, y: args.positionY || 200 },
          connectFrom: args.connectFromNodeId
        });
        return {
          content: [{ type: 'text', text: 'Added hub node for player choices' }]
        };
      }

      case 'add_condition_node': {
        const result = await sendCommand({
          type: 'add_node',
          nodeType: 'condition',
          position: { x: args.positionX || 400, y: args.positionY || 200 },
          data: { expression: args.expression },
          connectFrom: args.connectFromNodeId
        });
        return {
          content: [{ type: 'text', text: `Added condition: ${args.expression}` }]
        };
      }

      case 'add_instruction_node': {
        const result = await sendCommand({
          type: 'add_node',
          nodeType: 'instruction',
          position: { x: args.positionX || 400, y: args.positionY || 200 },
          data: { expression: args.expression },
          connectFrom: args.connectFromNodeId
        });
        return {
          content: [{ type: 'text', text: `Added instruction: ${args.expression}` }]
        };
      }

      case 'delete_node': {
        await sendCommand({
          type: 'delete_node',
          nodeId: args.nodeId
        });
        return {
          content: [{ type: 'text', text: `Deleted node ${args.nodeId}` }]
        };
      }

      case 'connect_nodes': {
        await sendCommand({
          type: 'connect_nodes',
          fromNodeId: args.fromNodeId,
          toNodeId: args.toNodeId,
          fromPortIndex: args.fromPortIndex || 0,
          toPortIndex: args.toPortIndex || 0,
          label: args.label
        });
        return {
          content: [{ type: 'text', text: `Connected ${args.fromNodeId} → ${args.toNodeId}` }]
        };
      }

      case 'add_character': {
        await sendCommand({
          type: 'add_character',
          name: args.name,
          color: args.color,
          description: args.description
        });
        return {
          content: [{ type: 'text', text: `Added character: ${args.name}` }]
        };
      }

      case 'batch_add_dialogue': {
        await sendCommand({
          type: 'batch_add_dialogue',
          startFromNodeId: args.startFromNodeId,
          dialogues: args.dialogues
        });
        return {
          content: [{ type: 'text', text: `Added ${args.dialogues.length} dialogue nodes` }]
        };
      }

      case 'load_project': {
        try {
          const filePath = resolve(args.filePath);
          const fileContent = readFileSync(filePath, 'utf-8');
          const projectData = JSON.parse(fileContent);
          
          await sendCommand({
            type: 'load_project',
            projectData
          });
          
          return {
            content: [{ type: 'text', text: `Loaded project from ${filePath}` }]
          };
        } catch (err) {
          return {
            content: [{ type: 'text', text: `Failed to load project: ${err.message}` }],
            isError: true
          };
        }
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true
        };
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true
    };
  }
});

// ============================================================
// RESOURCES (read-only access to graph data)
// ============================================================

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'dialogue://graph/state',
        name: 'Current Graph State',
        description: 'The current state of the dialogue graph',
        mimeType: 'application/json'
      },
      {
        uri: 'dialogue://graph/characters',
        name: 'Characters',
        description: 'All characters in the project',
        mimeType: 'application/json'
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === 'dialogue://graph/state') {
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(graphState, null, 2)
      }]
    };
  }

  if (uri === 'dialogue://graph/characters') {
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(graphState.characters || [], null, 2)
      }]
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// ============================================================
// START SERVER
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] Dialogue Editor MCP server running');
}

main().catch(console.error);
