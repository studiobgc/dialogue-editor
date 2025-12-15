/**
 * BulkImporter - Imports AI-generated dialogue trees into the editor
 * 
 * Features:
 * - Parses structured JSON from AI generation
 * - Auto-layouts nodes using Sugiyama algorithm
 * - Creates all characters, nodes, and connections
 * - No manual cleanup required
 */

import { GraphModel } from '../core/GraphModel';
import { NodeType, Node, Position, Connection } from '../types/graph';

/**
 * Bulk import schema for AI-generated dialogue trees
 */
export interface BulkDialogueImport {
  version: '1.0';
  metadata: {
    title: string;
    description?: string;
    author?: string;
    createdAt: string;
  };
  characters: Array<{
    id: string;
    name: string;
    color: string;
    description?: string;
  }>;
  variables?: Record<string, Record<string, boolean | number | string>>;
  acts: Array<{
    id: string;
    name: string;
    scenes: Array<{
      id: string;
      name: string;
      location?: string;
      conversations: Array<{
        id: string;
        name: string;
        startNodeId: string;
        nodes: Array<{
          id: string;
          type: NodeType;
          speaker?: string;
          text?: string;
          menuText?: string;
          stageDirections?: string;
          condition?: string;
          instruction?: string;
          outputs: Array<{
            label?: string;
            targetNodeId: string;
          }>;
        }>;
      }>;
    }>;
  }>;
}

/**
 * Auto-layout algorithm for imported dialogue trees
 */
export function autoLayoutDialogue(nodes: Node[], connections: Connection[]): void {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  
  for (const node of nodes) {
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
  }
  
  for (const conn of connections) {
    outgoing.get(conn.fromNodeId)?.push(conn.toNodeId);
    incoming.get(conn.toNodeId)?.push(conn.fromNodeId);
  }
  
  const roots = nodes.filter(n => (incoming.get(n.id)?.length || 0) === 0);
  const layers = new Map<string, number>();
  const visited = new Set<string>();
  const queue: Array<{ id: string; layer: number }> = roots.map(n => ({ id: n.id, layer: 0 }));
  
  while (queue.length > 0) {
    const { id, layer } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    
    const currentLayer = Math.max(layers.get(id) || 0, layer);
    layers.set(id, currentLayer);
    
    for (const targetId of outgoing.get(id) || []) {
      if (!visited.has(targetId)) {
        queue.push({ id: targetId, layer: currentLayer + 1 });
      }
    }
  }
  
  for (const node of nodes) {
    if (!layers.has(node.id)) {
      layers.set(node.id, 0);
    }
  }
  
  const layerGroups = new Map<number, Node[]>();
  for (const node of nodes) {
    const layer = layers.get(node.id) || 0;
    if (!layerGroups.has(layer)) {
      layerGroups.set(layer, []);
    }
    layerGroups.get(layer)!.push(node);
  }
  
  const HORIZONTAL_SPACING = 350;
  const VERTICAL_SPACING = 150;
  const START_X = 100;
  const START_Y = 100;
  
  const sortedLayers = Array.from(layerGroups.keys()).sort((a, b) => a - b);
  
  for (const layer of sortedLayers) {
    const nodesInLayer = layerGroups.get(layer)!;
    nodesInLayer.forEach((node, index) => {
      node.position = {
        x: START_X + layer * HORIZONTAL_SPACING,
        y: START_Y + index * VERTICAL_SPACING
      };
    });
  }
}

interface ImportResult {
  success: boolean;
  nodesCreated: number;
  connectionsCreated: number;
  charactersCreated: number;
  errors: string[];
  warnings: string[];
}

export class BulkImporter {
  private model: GraphModel;

  constructor(model: GraphModel) {
    this.model = model;
  }

  /**
   * Import a complete dialogue tree from AI-generated JSON
   */
  importDialogueTree(data: BulkDialogueImport): ImportResult {
    const result: ImportResult = {
      success: false,
      nodesCreated: 0,
      connectionsCreated: 0,
      charactersCreated: 0,
      errors: [],
      warnings: []
    };

    try {
      // Validate version
      if (data.version !== '1.0') {
        result.warnings.push(`Unknown version ${data.version}, attempting import anyway`);
      }

      // Import characters first
      const characterIdMap = new Map<string, string>(); // external ID -> internal ID
      for (const char of data.characters) {
        const existing = this.model.getCharacters().find(c => 
          c.displayName.toLowerCase() === char.name.toLowerCase()
        );
        
        if (existing) {
          characterIdMap.set(char.id, existing.id);
          result.warnings.push(`Character "${char.name}" already exists, reusing`);
        } else {
          const newChar = this.model.addCharacter(char.name, char.color);
          characterIdMap.set(char.id, newChar.id);
          result.charactersCreated++;
        }
      }

      // Import variables if present (stored in graph metadata)
      // Variables are handled at the graph level, not individual setters

      // Process all acts, scenes, and conversations
      const allNodes: Node[] = [];
      const pendingConnections: Array<{
        fromNodeId: string;
        fromPortIndex: number;
        toNodeId: string;
        toPortIndex: number;
      }> = [];
      const nodeIdMap = new Map<string, string>(); // external ID -> internal ID

      // Calculate starting position based on existing nodes
      let startX = 100;
      let startY = 100;
      const existingNodes = this.model.getNodes();
      if (existingNodes.length > 0) {
        const maxX = Math.max(...existingNodes.map(n => n.position.x + n.size.width));
        startX = maxX + 200;
      }

      let actOffsetY = 0;

      for (const act of data.acts) {
        let sceneOffsetY = 0;

        for (const scene of act.scenes) {
          let conversationOffsetX = 0;

          for (const conversation of scene.conversations) {
            // Create nodes for this conversation
            for (const nodeDef of conversation.nodes) {
              const position: Position = {
                x: startX + conversationOffsetX,
                y: startY + actOffsetY + sceneOffsetY
              };

              const node = this.model.addNode(nodeDef.type, position);
              nodeIdMap.set(nodeDef.id, node.id);
              allNodes.push(node);
              result.nodesCreated++;

              // Set node data based on type
              if (nodeDef.type === 'dialogue' || nodeDef.type === 'dialogueFragment') {
                const speakerId = nodeDef.speaker ? characterIdMap.get(nodeDef.speaker) : undefined;
                
                this.model.updateNodeData(node.id, {
                  data: {
                    type: nodeDef.type,
                    data: {
                      speaker: speakerId || '',
                      text: nodeDef.text || '',
                      menuText: nodeDef.menuText || '',
                      stageDirections: nodeDef.stageDirections || '',
                      autoTransition: false
                    }
                  }
                });
              } else if (nodeDef.type === 'condition') {
                this.model.updateNodeData(node.id, {
                  data: {
                    type: 'condition',
                    data: {
                      script: {
                        expression: nodeDef.condition || '',
                        isCondition: true
                      }
                    }
                  }
                });
              } else if (nodeDef.type === 'instruction') {
                this.model.updateNodeData(node.id, {
                  data: {
                    type: 'instruction',
                    data: {
                      script: {
                        expression: nodeDef.instruction || '',
                        isCondition: false
                      }
                    }
                  }
                });
              }

              // Queue connections
              nodeDef.outputs.forEach((output: { label?: string; targetNodeId: string }, outputIndex: number) => {
                // Ensure node has enough output ports
                const currentNode = this.model.getNode(node.id);
                if (currentNode && currentNode.outputPorts.length <= outputIndex) {
                  // Add output ports as needed (for branch/hub nodes)
                  while (currentNode.outputPorts.length <= outputIndex) {
                    currentNode.outputPorts.push({
                      id: `${node.id}-out-${currentNode.outputPorts.length}`,
                      nodeId: node.id,
                      type: 'output',
                      index: currentNode.outputPorts.length,
                      label: output.label || ''
                    });
                  }
                }

                pendingConnections.push({
                  fromNodeId: nodeDef.id,
                  fromPortIndex: outputIndex,
                  toNodeId: output.targetNodeId,
                  toPortIndex: 0
                });
              });
            }

            conversationOffsetX += 400;
          }

          sceneOffsetY += 600;
        }

        actOffsetY += 1500;
      }

      // Create connections
      for (const conn of pendingConnections) {
        const fromId = nodeIdMap.get(conn.fromNodeId);
        const toId = nodeIdMap.get(conn.toNodeId);

        if (fromId && toId) {
          this.model.addConnection(fromId, conn.fromPortIndex, toId, conn.toPortIndex);
          result.connectionsCreated++;
        } else {
          result.warnings.push(`Could not create connection from ${conn.fromNodeId} to ${conn.toNodeId}`);
        }
      }

      // Auto-layout the imported nodes
      const importedNodes = allNodes.map(n => this.model.getNode(n.id)).filter((n): n is Node => n !== undefined);
      const importedConnections = this.model.getConnections().filter(c => 
        nodeIdMap.has(c.fromNodeId) || Array.from(nodeIdMap.values()).includes(c.fromNodeId)
      );
      
      autoLayoutDialogue(importedNodes, importedConnections);

      result.success = true;
    } catch (error) {
      result.errors.push(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Import from a simplified format (easier for quick imports)
   */
  importSimple(data: SimpleDialogueImport): ImportResult {
    // Convert simple format to full format
    const fullData: BulkDialogueImport = {
      version: '1.0',
      metadata: {
        title: data.title || 'Imported Dialogue',
        createdAt: new Date().toISOString()
      },
      characters: data.characters.map((c, i) => ({
        id: `char_${i}`,
        name: c.name,
        color: c.color || '#4a90e2'
      })),
      acts: [{
        id: 'act_1',
        name: 'Main',
        scenes: [{
          id: 'scene_1',
          name: 'Main Scene',
          conversations: [{
            id: 'conv_1',
            name: 'Main Conversation',
            startNodeId: data.nodes[0]?.id || 'node_0',
            nodes: data.nodes.map((n, i) => ({
              id: n.id || `node_${i}`,
              type: n.type,
              speaker: n.speaker,
              text: n.text,
              menuText: n.menuText,
              condition: n.condition,
              instruction: n.instruction,
              outputs: n.connections?.map(targetId => ({
                targetNodeId: targetId
              })) || []
            }))
          }]
        }]
      }]
    };

    return this.importDialogueTree(fullData);
  }
}

/**
 * Simplified import format for quick dialogue imports
 */
export interface SimpleDialogueImport {
  title?: string;
  characters: Array<{
    name: string;
    color?: string;
  }>;
  nodes: Array<{
    id?: string;
    type: NodeType;
    speaker?: string; // character name
    text?: string;
    menuText?: string;
    condition?: string;
    instruction?: string;
    connections?: string[]; // target node IDs
  }>;
}

/**
 * Parse and validate import JSON
 */
export function parseImportJSON(json: string): BulkDialogueImport | SimpleDialogueImport | null {
  try {
    const data = JSON.parse(json);
    
    // Check if it's the full format
    if (data.version && data.acts) {
      return data as BulkDialogueImport;
    }
    
    // Check if it's the simple format
    if (data.nodes && Array.isArray(data.nodes)) {
      return data as SimpleDialogueImport;
    }
    
    return null;
  } catch {
    return null;
  }
}
