/**
 * MCPBridge - Connects the dialogue editor to the MCP server
 * 
 * This allows Cascade/Claude to edit the graph through Windsurf
 * without needing a separate API key.
 */

import { GraphModel } from '../core/GraphModel';
import { NodeType, Position } from '../types/graph';
import { 
  findNonOverlappingPosition, 
  findPositionAfterNode, 
  findBranchPosition,
  NODE_WIDTH,
  NODE_HEIGHT,
  NODE_PADDING,
  H_GAP,
  V_GAP,
  DEFAULT_START_POSITION,
  DEFAULT_NEW_NODE_POSITION
} from '../utils/LayoutUtils';

export interface MCPBridgeCallbacks {
  onStatusChange?: (connected: boolean) => void;
  onCommandExecuted?: (summary: string) => void;  // Called with human-readable summary of what changed
  onAutoSave?: () => void;         // Called to trigger auto-save
}

export class MCPBridge {
  private model: GraphModel;
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private callbacks: MCPBridgeCallbacks = {};

  constructor(model: GraphModel) {
    this.model = model;
  }

  connect(callbacks?: MCPBridgeCallbacks): void {
    this.callbacks = callbacks || {};
    this.attemptConnect();
  }

  private attemptConnect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket('ws://localhost:9999');

      this.ws.onopen = () => {
        console.log('[MCPBridge] Connected to MCP server');
        this.callbacks.onStatusChange?.(true);
        this.sendState();
      };

      this.ws.onclose = () => {
        console.log('[MCPBridge] Disconnected from MCP server');
        this.callbacks.onStatusChange?.(false);
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
    console.log('[MCPBridge] Received message:', message.type, message.command?.type);
    
    if (message.type === 'get_state') {
      this.sendState();
      return;
    }

    if (message.type === 'command' && message.command) {
      console.log('[MCPBridge] Executing command:', message.command.type);
      const result = this.executeCommand(message.command);
      console.log('[MCPBridge] Command result:', result);
      
      if (message.requestId && this.ws) {
        this.ws.send(JSON.stringify({
          type: 'command_result',
          requestId: message.requestId,
          result
        }));
      }

      // Send updated state after command
      this.sendState();
      
      // Trigger live reload and auto-save callbacks
      if (result.success) {
        const summary = this.buildChangeSummary(message.command, result);
        this.callbacks.onCommandExecuted?.(summary);
        this.callbacks.onAutoSave?.();
      }
    }
  }

  private buildChangeSummary(cmd: MCPCommand, result: { success: boolean; nodeId?: string }): string {
    const graph = this.model.getGraph();
    // Cast to access optional properties
    const c = cmd as unknown as Record<string, unknown>;
    
    switch (cmd.type) {
      case 'load_project': {
        const nodeCount = graph.nodes.length;
        const charCount = graph.characters.length;
        return `Loaded ${nodeCount} nodes, ${charCount} characters`;
      }
      
      case 'edit_node_text': {
        const node = cmd.nodeId ? this.model.getNode(cmd.nodeId) : null;
        const speaker = this.getSpeakerName(node || null);
        const text = c.text as string | undefined;
        const preview = text ? `"${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"` : '';
        return speaker ? `${speaker}: ${preview}` : `Updated: ${preview}`;
      }
      
      case 'edit_node_speaker': {
        const speakerId = c.speakerId as string | undefined;
        const char = speakerId ? this.model.getCharacters().find(ch => ch.id === speakerId) : null;
        return char ? `Speaker → ${char.displayName}` : 'Changed speaker';
      }
      
      case 'add_node':
      case 'add_dialogue_node': {
        const speakerId = c.speakerId as string | undefined;
        const text = c.text as string | undefined;
        const char = speakerId ? this.model.getCharacters().find(ch => ch.id === speakerId) : null;
        const preview = text ? `"${text.substring(0, 25)}..."` : '';
        return char ? `+ ${char.displayName}: ${preview}` : '+ New dialogue';
      }
      
      case 'add_hub_node':
        return '+ Choice point';
      
      case 'add_condition_node': {
        const expr = c.expression as string | undefined;
        return expr ? `+ If: ${expr}` : '+ Condition';
      }
      
      case 'add_instruction_node': {
        const expr = c.expression as string | undefined;
        return expr ? `+ Set: ${expr}` : '+ Instruction';
      }
      
      case 'connect_nodes':
        return '→ Nodes connected';
      
      case 'delete_node':
        return '- Node removed';
      
      case 'add_character': {
        const name = c.name as string | undefined;
        return name ? `+ Character: ${name}` : '+ Character';
      }
      
      case 'batch_add_dialogue': {
        const dialogues = c.dialogues as unknown[] | undefined;
        const count = dialogues?.length || 0;
        return `+ ${count} dialogue lines`;
      }
      
      default:
        return 'Graph updated';
    }
  }

  private getSpeakerName(node: import('../types/graph').Node | null): string | null {
    if (!node) return null;
    const data = node.data as { data?: { speaker?: string } };
    const speakerId = data?.data?.speaker;
    if (!speakerId) return null;
    const char = this.model.getCharacters().find(c => c.id === speakerId);
    return char?.displayName || null;
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
          
          // Smart positioning using LayoutUtils
          let position: Position;
          const existingNodes = this.model.getGraph().nodes;
          
          if (cmd.connectFrom) {
            // Position relative to source node
            const sourceNode = this.model.getNode(cmd.connectFrom);
            if (sourceNode) {
              position = findPositionAfterNode(existingNodes, sourceNode);
            } else {
              position = cmd.position || findNonOverlappingPosition(existingNodes, DEFAULT_NEW_NODE_POSITION);
            }
          } else if (cmd.position) {
            // Use provided position but ensure no overlap
            position = findNonOverlappingPosition(existingNodes, cmd.position);
          } else {
            // Default position, avoid overlaps
            position = findNonOverlappingPosition(existingNodes, DEFAULT_NEW_NODE_POSITION);
          }
          
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
          const dialogues = cmd.dialogues || [];

          for (const dialogue of dialogues) {
            const existingNodes = this.model.getGraph().nodes;
            let position: Position;
            
            if (lastNodeId) {
              const sourceNode = this.model.getNode(lastNodeId);
              if (sourceNode) {
                position = findPositionAfterNode(existingNodes, sourceNode);
              } else {
                position = findNonOverlappingPosition(existingNodes, DEFAULT_NEW_NODE_POSITION);
              }
            } else {
              position = findNonOverlappingPosition(existingNodes, DEFAULT_START_POSITION);
            }

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
          }

          return { success: true };
        }

        case 'load_project': {
          if (!cmd.projectData) return { success: false, error: 'No projectData provided' };
          
          // Convert the JSON format to internal graph format
          const graph = this.convertProjectToGraph(cmd.projectData);
          this.model.loadGraph(graph);
          
          return { success: true };
        }

        default:
          return { success: false, error: `Unknown command type: ${(cmd as MCPCommand).type}` };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Convert JSON project format to internal DialogueGraph format
   * Uses the same layout algorithm as native node creation for consistency
   */
  private convertProjectToGraph(projectData: ProjectData): import('../types/graph').DialogueGraph {
    const nodes: import('../types/graph').Node[] = [];
    const connections: import('../types/graph').Connection[] = [];
    const now = Date.now();
    
    // Uses imported constants from LayoutUtils (single source of truth)
    // NODE_WIDTH, NODE_HEIGHT, NODE_PADDING, H_GAP, V_GAP, DEFAULT_START_POSITION
    
    // Convert characters with all required fields (including extended profile)
    const characters: import('../types/graph').Character[] = (projectData.characters || []).map(c => ({
      id: c.id,
      articyId: { low: 0, high: 0 },
      technicalName: c.id,
      displayName: c.name,
      color: c.color,
      // Extended character profile
      description: c.description,
      philosophy: c.philosophy,
      flaw: c.flaw,
      want: c.want,
      obsession: c.obsession,
      secret: c.secret
    }));

    // Process all conversations - use native layout algorithm
    for (const act of projectData.acts || []) {
      for (const scene of act.scenes || []) {
        for (const conv of scene.conversations || []) {
          const convNodes = conv.nodes || [];
          if (convNodes.length === 0) continue;

          // Build parent->children adjacency map
          const childrenMap = new Map<string, string[]>();
          const hasParent = new Set<string>();
          
          for (const node of convNodes) {
            const children: string[] = [];
            if (node.outputs) {
              for (const output of node.outputs) {
                if (output.targetNodeId) {
                  children.push(output.targetNodeId);
                  hasParent.add(output.targetNodeId);
                }
              }
            }
            childrenMap.set(node.id, children);
          }

          // Find root (no incoming edges)
          const roots = convNodes.filter(n => !hasParent.has(n.id));
          const rootId = roots[0]?.id || convNodes[0]?.id;
          if (!rootId) continue;

          // BFS layout - same algorithm as autoLayoutFromNode
          const nodePositions = new Map<string, Position>();
          const visited = new Set<string>();
          const queue: { nodeId: string; depth: number; branchIndex: number }[] = [
            { nodeId: rootId, depth: 0, branchIndex: 0 }
          ];
          const depthCounts: number[] = [];

          while (queue.length > 0) {
            const { nodeId, depth, branchIndex } = queue.shift()!;
            
            if (visited.has(nodeId)) continue;
            visited.add(nodeId);

            // Position: depth controls X, branchIndex controls Y
            const x = DEFAULT_START_POSITION.x + depth * H_GAP;
            const y = DEFAULT_START_POSITION.y + branchIndex * V_GAP;
            nodePositions.set(nodeId, { x, y });

            // Queue children with proper branch indexing
            const children = childrenMap.get(nodeId) || [];
            if (!depthCounts[depth + 1]) depthCounts[depth + 1] = 0;
            
            for (const childId of children) {
              if (!visited.has(childId)) {
                queue.push({
                  nodeId: childId,
                  depth: depth + 1,
                  branchIndex: depthCounts[depth + 1]++
                });
              }
            }
          }

          // Handle orphans (unreachable from root) - place them below the tree
          const orphans = convNodes.filter(n => !visited.has(n.id));
          let orphanY = DEFAULT_START_POSITION.y + (depthCounts.reduce((a, b) => Math.max(a, b), 0) + 2) * V_GAP;
          for (const orphan of orphans) {
            nodePositions.set(orphan.id, { x: DEFAULT_START_POSITION.x, y: orphanY });
            orphanY += V_GAP;
          }

          // Create graph nodes with calculated positions
          for (const node of convNodes) {
            let nodeType: NodeType = 'dialogueFragment';
            if (node.type === 'hub') nodeType = 'hub';
            else if (node.type === 'condition') nodeType = 'condition';
            else if (node.type === 'instruction') nodeType = 'instruction';

            const pos = nodePositions.get(node.id) || DEFAULT_START_POSITION;

            const graphNode: import('../types/graph').Node = {
              id: node.id,
              technicalName: node.id,
              nodeType,
              position: pos,
              size: { width: NODE_WIDTH, height: NODE_HEIGHT },
              inputPorts: [{ id: `${node.id}_in_0`, nodeId: node.id, type: 'input', index: 0 }],
              outputPorts: (node.outputs || [{ targetNodeId: undefined }]).map((_, idx) => ({
                id: `${node.id}_out_${idx}`,
                nodeId: node.id,
                type: 'output' as const,
                index: idx
              })),
              data: this.buildNodeData(node, nodeType)
            };

            nodes.push(graphNode);

            // Create connections
            if (node.outputs) {
              node.outputs.forEach((output, idx) => {
                if (output.targetNodeId) {
                  connections.push({
                    id: `conn_${node.id}_${idx}`,
                    fromNodeId: node.id,
                    fromPortIndex: idx,
                    toNodeId: output.targetNodeId,
                    toPortIndex: 0,
                    connectionType: 'flow',
                    label: output.label
                  });
                }
              });
            }
          }
        }
      }
    }

    // Convert variables to VariableNamespace format
    const variables: import('../types/graph').VariableNamespace[] = [];
    if (projectData.variables) {
      for (const [nsName, nsVars] of Object.entries(projectData.variables)) {
        const vars: import('../types/graph').Variable[] = [];
        if (typeof nsVars === 'object' && nsVars !== null) {
          for (const [varName, value] of Object.entries(nsVars as Record<string, unknown>)) {
            vars.push({
              id: `${nsName}_${varName}`,
              namespace: nsName,
              name: varName,
              type: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string',
              defaultValue: value as string | number | boolean
            });
          }
        }
        variables.push({ name: nsName, variables: vars });
      }
    }

    return {
      id: 'graph_' + now,
      name: projectData.metadata?.title || 'Imported Project',
      technicalName: 'imported_project',
      nodes,
      connections,
      characters,
      variables,
      createdAt: now,
      modifiedAt: now
    };
  }

  private buildNodeData(node: ProjectNode, nodeType: NodeType): import('../types/graph').NodeData {
    if (nodeType === 'dialogueFragment') {
      return {
        type: 'dialogueFragment',
        data: {
          speaker: node.speaker || '',
          text: node.text || '',
          menuText: node.menuText || '',
          stageDirections: node.stageDirections || '',
          autoTransition: false
        }
      };
    } else if (nodeType === 'condition') {
      return {
        type: 'condition',
        data: {
          script: {
            expression: node.condition || '',
            isCondition: true
          }
        }
      };
    } else if (nodeType === 'instruction') {
      return {
        type: 'instruction',
        data: {
          script: {
            expression: node.instruction || '',
            isCondition: false
          }
        }
      };
    } else if (nodeType === 'hub') {
      return {
        type: 'hub',
        data: {}
      };
    }
    // Default fallback for other types
    return { type: 'hub', data: {} };
  }
}

// Project JSON format types
interface ProjectData {
  metadata?: { title?: string };
  characters?: Array<{ id: string; name: string; color: string; description?: string }>;
  variables?: Record<string, unknown>;
  acts?: Array<{
    scenes?: Array<{
      conversations?: Array<{
        nodes?: ProjectNode[];
      }>;
    }>;
  }>;
}

interface ProjectNode {
  id: string;
  type: string;
  speaker?: string;
  text?: string;
  menuText?: string;
  stageDirections?: string;
  condition?: string;
  instruction?: string;
  outputs?: Array<{ targetNodeId?: string; label?: string }>;
}

// Command types from MCP server
interface MCPCommand {
  type: string;
  nodeId?: string;
  nodeType?: NodeType;
  position?: Position;
  projectData?: ProjectData;
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
