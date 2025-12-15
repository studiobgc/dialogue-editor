/**
 * MCPBridge - Connects the dialogue editor to the MCP server
 * 
 * This allows Cascade/Claude to edit the graph through Windsurf
 * without needing a separate API key.
 */

import { GraphModel } from '../core/GraphModel';
import { NodeType, Position } from '../types/graph';

export class MCPBridge {
  private model: GraphModel;
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private onStatusChange?: (connected: boolean) => void;

  constructor(model: GraphModel) {
    this.model = model;
  }

  connect(onStatusChange?: (connected: boolean) => void): void {
    this.onStatusChange = onStatusChange;
    this.attemptConnect();
  }

  private attemptConnect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket('ws://localhost:9999');

      this.ws.onopen = () => {
        console.log('[MCPBridge] Connected to MCP server');
        this.onStatusChange?.(true);
        this.sendState();
      };

      this.ws.onclose = () => {
        console.log('[MCPBridge] Disconnected from MCP server');
        this.onStatusChange?.(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // Will trigger onclose
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };
    } catch (e) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.attemptConnect();
    }, 3000);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // Send current graph state to MCP server
  sendState(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const graph = this.model.getGraph();
    this.ws.send(JSON.stringify({
      type: 'state_update',
      state: {
        projectName: graph.name,
        nodes: graph.nodes,
        characters: graph.characters,
        connections: graph.connections,
        selectedNodeIds: [] // Will be updated separately
      }
    }));
  }

  // Update selected nodes
  sendSelection(nodeIds: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      type: 'state_update',
      state: {
        ...this.model.getGraph(),
        selectedNodeIds: nodeIds
      }
    }));
  }

  // Handle commands from MCP server
  private handleMessage(message: { type: string; requestId?: number; command?: MCPCommand }): void {
    if (message.type === 'get_state') {
      this.sendState();
      return;
    }

    if (message.type === 'command' && message.command) {
      const result = this.executeCommand(message.command);
      
      if (message.requestId && this.ws) {
        this.ws.send(JSON.stringify({
          type: 'command_result',
          requestId: message.requestId,
          result
        }));
      }

      // Send updated state after command
      this.sendState();
    }
  }

  private executeCommand(cmd: MCPCommand): { success: boolean; error?: string; nodeId?: string } {
    try {
      switch (cmd.type) {
        case 'edit_node': {
          if (!cmd.nodeId) return { success: false, error: 'No nodeId provided' };
          const node = this.model.getNode(cmd.nodeId);
          if (!node) return { success: false, error: 'Node not found' };
          const changes = cmd.changes || {};

          if (node.data.type === 'dialogue' || node.data.type === 'dialogueFragment') {
            this.model.updateNodeData(cmd.nodeId, {
              data: {
                type: node.data.type,
                data: {
                  ...node.data.data,
                  text: changes.text ?? node.data.data.text,
                  speaker: changes.speaker ?? node.data.data.speaker,
                  menuText: changes.menuText ?? node.data.data.menuText,
                  stageDirections: changes.stageDirections ?? node.data.data.stageDirections
                }
              }
            });
          } else if (node.data.type === 'condition' || node.data.type === 'instruction') {
            this.model.updateNodeData(cmd.nodeId, {
              data: {
                type: node.data.type,
                data: {
                  script: {
                    expression: changes.expression ?? node.data.data.script?.expression ?? '',
                    isCondition: node.data.type === 'condition'
                  }
                }
              }
            });
          }
          return { success: true };
        }

        case 'add_node': {
          if (!cmd.nodeType) return { success: false, error: 'No nodeType provided' };
          const position: Position = cmd.position || { x: 400, y: 200 };
          const newNode = this.model.addNode(cmd.nodeType, position);

          // Set node data
          if (cmd.data) {
            if (cmd.nodeType === 'dialogueFragment' || cmd.nodeType === 'dialogue') {
              this.model.updateNodeData(newNode.id, {
                data: {
                  type: cmd.nodeType,
                  data: {
                    speaker: cmd.data.speaker || '',
                    text: cmd.data.text || '',
                    menuText: cmd.data.menuText || '',
                    stageDirections: cmd.data.stageDirections || '',
                    autoTransition: false
                  }
                }
              });
            } else if (cmd.nodeType === 'condition') {
              this.model.updateNodeData(newNode.id, {
                data: {
                  type: 'condition',
                  data: {
                    script: {
                      expression: cmd.data.expression || '',
                      isCondition: true
                    }
                  }
                }
              });
            } else if (cmd.nodeType === 'instruction') {
              this.model.updateNodeData(newNode.id, {
                data: {
                  type: 'instruction',
                  data: {
                    script: {
                      expression: cmd.data.expression || '',
                      isCondition: false
                    }
                  }
                }
              });
            }
          }

          // Connect from previous node if specified
          if (cmd.connectFrom) {
            this.model.addConnection(cmd.connectFrom, 0, newNode.id, 0);
          }

          return { success: true, nodeId: newNode.id };
        }

        case 'delete_node': {
          if (!cmd.nodeId) return { success: false, error: 'No nodeId provided' };
          // TODO: Implement delete node in GraphModel
          // For now, this is a no-op - deletion requires GraphModel changes
          console.warn('Delete node not yet implemented in MCP bridge');
          return { success: false, error: 'Delete not implemented' };
        }

        case 'connect_nodes': {
          if (!cmd.fromNodeId || !cmd.toNodeId) return { success: false, error: 'Missing node IDs' };
          this.model.addConnection(
            cmd.fromNodeId,
            cmd.fromPortIndex || 0,
            cmd.toNodeId,
            cmd.toPortIndex || 0
          );
          return { success: true };
        }

        case 'add_character': {
          if (!cmd.name || !cmd.color) return { success: false, error: 'Missing name or color' };
          const char = this.model.addCharacter(cmd.name, cmd.color);
          return { success: true, nodeId: char.id };
        }

        case 'batch_add_dialogue': {
          let lastNodeId = cmd.startFromNodeId;
          let yOffset = 0;
          const dialogues = cmd.dialogues || [];

          for (const dialogue of dialogues) {
            const startNode = lastNodeId ? this.model.getNode(lastNodeId) : null;
            const position: Position = {
              x: (startNode?.position.x || 100) + 350,
              y: (startNode?.position.y || 100) + yOffset
            };

            const newNode = this.model.addNode('dialogueFragment', position);
            
            this.model.updateNodeData(newNode.id, {
              data: {
                type: 'dialogueFragment',
                data: {
                  speaker: dialogue.speakerId,
                  text: dialogue.text,
                  stageDirections: dialogue.stageDirections || '',
                  menuText: '',
                  autoTransition: false
                }
              }
            });

            if (lastNodeId) {
              this.model.addConnection(lastNodeId, 0, newNode.id, 0);
            }

            lastNodeId = newNode.id;
            yOffset += 150;
          }

          return { success: true };
        }

        default:
          return { success: false, error: `Unknown command type: ${(cmd as MCPCommand).type}` };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

// Command types from MCP server
interface MCPCommand {
  type: string;
  nodeId?: string;
  nodeType?: NodeType;
  position?: Position;
  data?: {
    speaker?: string;
    text?: string;
    menuText?: string;
    stageDirections?: string;
    expression?: string;
  };
  changes?: {
    text?: string;
    speaker?: string;
    menuText?: string;
    stageDirections?: string;
    expression?: string;
  };
  connectFrom?: string;
  fromNodeId?: string;
  toNodeId?: string;
  fromPortIndex?: number;
  toPortIndex?: number;
  name?: string;
  color?: string;
  startFromNodeId?: string;
  dialogues?: Array<{
    speakerId: string;
    text: string;
    stageDirections?: string;
  }>;
}
