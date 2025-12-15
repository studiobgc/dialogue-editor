/**
 * ArticyExporter - Exports dialogue data in Articy:draft X compatible JSON format
 * 
 * This generates the exact JSON structure that the ArticyXImporterForUnreal plugin expects,
 * allowing seamless integration with Unreal Engine projects.
 * 
 * Based on analysis of: https://github.com/ArticySoftware/ArticyXImporterForUnreal
 */

import { DialogueGraph, Node, Connection, Character, NodeType } from '../types/graph';

// Articy ID generator (64-bit hex IDs like Articy uses)
let idCounter = 0x100000000;
function generateArticyId(): string {
  return '0x' + (idCounter++).toString(16).toUpperCase().padStart(16, '0');
}

// Map our node types to Articy types
const NODE_TYPE_MAP: Record<NodeType, string> = {
  dialogue: 'Dialogue',
  dialogueFragment: 'DialogueFragment',
  flowFragment: 'FlowFragment',
  branch: 'Hub', // Articy uses Hub for branching
  condition: 'Condition',
  instruction: 'Instruction',
  hub: 'Hub',
  jump: 'Jump'
};

interface ArticyProject {
  Name: string;
  DetailName: string;
  Guid: string;
  TechnicalName: string;
}

interface ArticySettings {
  set_TextFormatter: string;
  set_UseScriptSupport: boolean;
  set_IncludedNodes: string;
  ExportVersion: string;
}

interface ArticyGlobalVariable {
  Variable: string;
  Type: 'Boolean' | 'Integer' | 'String';
  Description: string;
  Value: boolean | number | string;
}

interface ArticyGVNamespace {
  Namespace: string;
  Description: string;
  Variables: ArticyGlobalVariable[];
}

interface ArticyPin {
  Id: string;
  Owner: string;
  Text: string;
  Connections: string[];
}

interface ArticyModel {
  Type: string;
  Properties: {
    Id: string;
    TechnicalName: string;
    Parent: string;
    DisplayName?: string;
    Text?: string;
    MenuText?: string;
    StageDirections?: string;
    Speaker?: string;
    InputPins?: ArticyPin[];
    OutputPins?: ArticyPin[];
    Expression?: string;
    Instruction?: string;
    Target?: string;
    TargetPin?: string;
  };
  Template?: Record<string, unknown>;
}

interface ArticyPackage {
  Name: string;
  Description: string;
  IsDefaultPackage: boolean;
  Id: string;
  Models: ArticyModel[];
}

interface ArticyExportData {
  Project: ArticyProject;
  Settings: ArticySettings;
  GlobalVariables: ArticyGVNamespace[];
  ObjectDefinitions: unknown[];
  Packages: ArticyPackage[];
  Hierarchy: {
    Id: string;
    Type: string;
    Children: unknown[];
  };
}

export class ArticyExporter {
  private graph: DialogueGraph;
  private nodeIdMap: Map<string, string> = new Map(); // our ID -> Articy ID
  private pinIdMap: Map<string, string> = new Map(); // connection key -> pin ID
  private characterIdMap: Map<string, string> = new Map(); // our char ID -> Articy ID

  constructor(graph: DialogueGraph) {
    this.graph = graph;
    this.generateIdMaps();
  }

  private generateIdMaps(): void {
    // Generate Articy IDs for all nodes
    for (const node of this.graph.nodes) {
      this.nodeIdMap.set(node.id, generateArticyId());
    }
    
    // Generate Articy IDs for characters
    for (const char of this.graph.characters) {
      this.characterIdMap.set(char.id, generateArticyId());
    }

    // Generate pin IDs for connections
    for (const conn of this.graph.connections) {
      const outputKey = `${conn.fromNodeId}:out:${conn.fromPortIndex}`;
      const inputKey = `${conn.toNodeId}:in:${conn.toPortIndex}`;
      
      if (!this.pinIdMap.has(outputKey)) {
        this.pinIdMap.set(outputKey, generateArticyId());
      }
      if (!this.pinIdMap.has(inputKey)) {
        this.pinIdMap.set(inputKey, generateArticyId());
      }
    }
  }

  private getArticyId(nodeId: string): string {
    return this.nodeIdMap.get(nodeId) || generateArticyId();
  }

  private getCharacterArticyId(charId: string): string {
    return this.characterIdMap.get(charId) || '';
  }

  private convertNode(node: Node): ArticyModel {
    const articyId = this.getArticyId(node.id);
    const articyType = NODE_TYPE_MAP[node.nodeType] || 'FlowFragment';
    
    // Build input pins
    const inputPins: ArticyPin[] = node.inputPorts.map((port, index) => {
      const pinKey = `${node.id}:in:${index}`;
      const pinId = this.pinIdMap.get(pinKey) || generateArticyId();
      
      // Find connections to this pin
      const connections = this.graph.connections
        .filter(c => c.toNodeId === node.id && c.toPortIndex === index)
        .map(c => {
          const outputKey = `${c.fromNodeId}:out:${c.fromPortIndex}`;
          return this.pinIdMap.get(outputKey) || '';
        })
        .filter(id => id);

      return {
        Id: pinId,
        Owner: articyId,
        Text: port.label || '',
        Connections: connections
      };
    });

    // Build output pins
    const outputPins: ArticyPin[] = node.outputPorts.map((port, index) => {
      const pinKey = `${node.id}:out:${index}`;
      const pinId = this.pinIdMap.get(pinKey) || generateArticyId();
      
      // Find connections from this pin
      const connections = this.graph.connections
        .filter(c => c.fromNodeId === node.id && c.fromPortIndex === index)
        .map(c => {
          const inputKey = `${c.toNodeId}:in:${c.toPortIndex}`;
          return this.pinIdMap.get(inputKey) || '';
        })
        .filter(id => id);

      return {
        Id: pinId,
        Owner: articyId,
        Text: port.label || '',
        Connections: connections
      };
    });

    const properties: ArticyModel['Properties'] = {
      Id: articyId,
      TechnicalName: node.technicalName || `Node_${node.id.substring(0, 8)}`,
      Parent: '0x0000000000000000', // Root
      InputPins: inputPins,
      OutputPins: outputPins
    };

    // Add type-specific properties
    if (node.data.type === 'dialogue' || node.data.type === 'dialogueFragment') {
      const data = node.data.data;
      properties.Text = data.text || '';
      properties.MenuText = data.menuText || '';
      properties.StageDirections = data.stageDirections || '';
      
      if (data.speaker) {
        properties.Speaker = this.getCharacterArticyId(data.speaker);
      }
    } else if (node.data.type === 'condition') {
      properties.Expression = node.data.data.script?.expression || '';
    } else if (node.data.type === 'instruction') {
      properties.Instruction = node.data.data.script?.expression || '';
    } else if (node.data.type === 'jump') {
      // Find target from connections
      const targetConn = this.graph.connections.find(c => c.fromNodeId === node.id);
      if (targetConn) {
        properties.Target = this.getArticyId(targetConn.toNodeId);
      }
    }

    return {
      Type: articyType,
      Properties: properties
    };
  }

  private convertCharacter(char: Character): ArticyModel {
    const articyId = this.getCharacterArticyId(char.id);
    
    return {
      Type: 'Entity', // Characters are Entities in Articy
      Properties: {
        Id: articyId,
        TechnicalName: char.technicalName || char.displayName.replace(/\s+/g, '_'),
        Parent: '0x0000000000000000',
        DisplayName: char.displayName
      },
      Template: {
        CharacterTemplate: {
          Color: char.color || '#FFFFFF'
        }
      }
    };
  }

  export(): ArticyExportData {
    const projectGuid = crypto.randomUUID ? crypto.randomUUID() : 
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });

    const models: ArticyModel[] = [
      ...this.graph.characters.map(c => this.convertCharacter(c)),
      ...this.graph.nodes.map(n => this.convertNode(n))
    ];

    return {
      Project: {
        Name: this.graph.name || 'Dialogue Project',
        DetailName: this.graph.name || 'Dialogue Project',
        Guid: projectGuid,
        TechnicalName: (this.graph.name || 'DialogueProject').replace(/\s+/g, '')
      },
      Settings: {
        set_TextFormatter: '',
        set_UseScriptSupport: true,
        set_IncludedNodes: 'Settings,GlobalVariables,ObjectDefinitions,Hierarchy,Packages,ScriptMethods',
        ExportVersion: '1.0.0'
      },
      GlobalVariables: this.graph.variables ? [{
        Namespace: 'Game',
        Description: 'Game variables',
        Variables: Object.entries(this.graph.variables).map(([_ns, vars]) => 
          Object.entries(vars).map(([key, value]): ArticyGlobalVariable => ({
            Variable: key,
            Type: (typeof value === 'boolean' ? 'Boolean' : 
                  typeof value === 'number' ? 'Integer' : 'String') as 'Boolean' | 'Integer' | 'String',
            Description: '',
            Value: value
          }))
        ).flat()
      }] : [],
      ObjectDefinitions: [],
      Packages: [{
        Name: 'Default',
        Description: 'Default package',
        IsDefaultPackage: true,
        Id: generateArticyId(),
        Models: models
      }],
      Hierarchy: {
        Id: '0x0000000000000001',
        Type: 'Project',
        Children: models.map(m => ({
          Id: m.Properties.Id,
          Type: m.Type,
          Children: []
        }))
      }
    };
  }

  exportJSON(): string {
    return JSON.stringify(this.export(), null, 2);
  }

  /**
   * Export in the exact format that ArticyXImporterForUnreal expects
   * This creates a .articyue5 compatible archive structure
   */
  exportForUnreal(): {
    'project.json': string;
    'globalvariables.json': string;
    'packages/default.json': string;
    'hierarchy.json': string;
  } {
    const data = this.export();
    
    return {
      'project.json': JSON.stringify({
        Project: data.Project,
        Settings: data.Settings
      }, null, 2),
      'globalvariables.json': JSON.stringify({
        GlobalVariables: data.GlobalVariables
      }, null, 2),
      'packages/default.json': JSON.stringify({
        Package: data.Packages[0]
      }, null, 2),
      'hierarchy.json': JSON.stringify({
        Hierarchy: data.Hierarchy
      }, null, 2)
    };
  }
}

/**
 * Bulk import schema for AI-generated dialogue trees
 * This is what I (Claude) will generate for you
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
          speaker?: string; // character ID
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
 * Uses a modified Sugiyama algorithm for hierarchical graph layout
 */
export function autoLayoutDialogue(nodes: Node[], connections: Connection[]): void {
  // Build adjacency list
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
  
  // Find root nodes (no incoming connections)
  const roots = nodes.filter(n => (incoming.get(n.id)?.length || 0) === 0);
  
  // Assign layers using BFS
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
  
  // Handle unvisited nodes (disconnected)
  for (const node of nodes) {
    if (!layers.has(node.id)) {
      layers.set(node.id, 0);
    }
  }
  
  // Group nodes by layer
  const layerGroups = new Map<number, Node[]>();
  for (const node of nodes) {
    const layer = layers.get(node.id) || 0;
    if (!layerGroups.has(layer)) {
      layerGroups.set(layer, []);
    }
    layerGroups.get(layer)!.push(node);
  }
  
  // Layout constants
  const HORIZONTAL_SPACING = 350;
  const VERTICAL_SPACING = 150;
  const START_X = 100;
  const START_Y = 100;
  
  // Position nodes
  const sortedLayers = Array.from(layerGroups.keys()).sort((a, b) => a - b);
  
  for (const layer of sortedLayers) {
    const nodesInLayer = layerGroups.get(layer)!;
    const layerHeight = nodesInLayer.length * VERTICAL_SPACING;
    const startY = START_Y + (layer === 0 ? 0 : -layerHeight / 2 + VERTICAL_SPACING / 2);
    
    nodesInLayer.forEach((node, index) => {
      node.position = {
        x: START_X + layer * HORIZONTAL_SPACING,
        y: startY + index * VERTICAL_SPACING
      };
    });
  }
  
  // Second pass: minimize edge crossings by reordering within layers
  for (let iteration = 0; iteration < 5; iteration++) {
    for (const layer of sortedLayers) {
      if (layer === 0) continue;
      
      const nodesInLayer = layerGroups.get(layer)!;
      
      // Calculate barycenter for each node
      const barycenters = nodesInLayer.map(node => {
        const parents = incoming.get(node.id) || [];
        if (parents.length === 0) return node.position.y;
        
        const sum = parents.reduce((acc, parentId) => {
          const parent = nodes.find(n => n.id === parentId);
          return acc + (parent?.position.y || 0);
        }, 0);
        
        return sum / parents.length;
      });
      
      // Sort by barycenter
      const sortedIndices = nodesInLayer
        .map((_, i) => i)
        .sort((a, b) => barycenters[a] - barycenters[b]);
      
      // Reposition
      const layerX = nodesInLayer[0]?.position.x || START_X;
      sortedIndices.forEach((originalIndex, newIndex) => {
        nodesInLayer[originalIndex].position = {
          x: layerX,
          y: START_Y + newIndex * VERTICAL_SPACING
        };
      });
    }
  }
}
