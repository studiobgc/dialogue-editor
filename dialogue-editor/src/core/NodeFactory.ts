/**
 * Factory for creating different node types with proper defaults
 */

import { 
  Node, 
  NodeType, 
  Position, 
  Port,
  DialogueNodeData,
  BranchNodeData,
  ConditionNodeData,
  InstructionNodeData,
  HubNodeData,
  JumpNodeData,
  FlowFragmentNodeData,
  NodeData
} from '../types/graph';
import { IdGenerator } from './IdGenerator';

export interface NodeConfig {
  displayName: string;
  color: string;
  defaultWidth: number;
  defaultHeight: number;
  minInputPorts: number;
  maxInputPorts: number;
  minOutputPorts: number;
  maxOutputPorts: number;
  canHaveScript: boolean;
  category: 'flow' | 'logic' | 'navigation';
}

export const NODE_CONFIGS: Record<NodeType, NodeConfig> = {
  dialogue: {
    displayName: 'Dialogue',
    color: '#3b82f6',
    defaultWidth: 280,
    defaultHeight: 120,
    minInputPorts: 1,
    maxInputPorts: 1,
    minOutputPorts: 1,
    maxOutputPorts: 8,
    canHaveScript: true,
    category: 'flow'
  },
  dialogueFragment: {
    displayName: 'Dialogue Fragment',
    color: '#3b82f6',
    defaultWidth: 260,
    defaultHeight: 100,
    minInputPorts: 1,
    maxInputPorts: 1,
    minOutputPorts: 1,
    maxOutputPorts: 4,
    canHaveScript: true,
    category: 'flow'
  },
  branch: {
    displayName: 'Branch',
    color: '#f59e0b',
    defaultWidth: 160,
    defaultHeight: 80,
    minInputPorts: 1,
    maxInputPorts: 1,
    minOutputPorts: 2,
    maxOutputPorts: 16,
    canHaveScript: false,
    category: 'logic'
  },
  condition: {
    displayName: 'Condition',
    color: '#10b981',
    defaultWidth: 200,
    defaultHeight: 80,
    minInputPorts: 1,
    maxInputPorts: 1,
    minOutputPorts: 2,
    maxOutputPorts: 2,
    canHaveScript: true,
    category: 'logic'
  },
  instruction: {
    displayName: 'Instruction',
    color: '#8b5cf6',
    defaultWidth: 200,
    defaultHeight: 70,
    minInputPorts: 1,
    maxInputPorts: 1,
    minOutputPorts: 1,
    maxOutputPorts: 1,
    canHaveScript: true,
    category: 'logic'
  },
  hub: {
    displayName: 'Hub',
    color: '#06b6d4',
    defaultWidth: 140,
    defaultHeight: 60,
    minInputPorts: 1,
    maxInputPorts: 16,
    minOutputPorts: 1,
    maxOutputPorts: 16,
    canHaveScript: false,
    category: 'navigation'
  },
  jump: {
    displayName: 'Jump',
    color: '#8b5cf6',
    defaultWidth: 160,
    defaultHeight: 60,
    minInputPorts: 1,
    maxInputPorts: 1,
    minOutputPorts: 0,
    maxOutputPorts: 0,
    canHaveScript: false,
    category: 'navigation'
  },
  flowFragment: {
    displayName: 'Flow Fragment',
    color: '#6366f1',
    defaultWidth: 300,
    defaultHeight: 140,
    minInputPorts: 1,
    maxInputPorts: 4,
    minOutputPorts: 1,
    maxOutputPorts: 4,
    canHaveScript: true,
    category: 'flow'
  }
};

export class NodeFactory {
  /**
   * Create a new node with proper defaults
   */
  static createNode(nodeType: NodeType, position: Position, name?: string): Node {
    const config = NODE_CONFIGS[nodeType];
    const id = IdGenerator.generateId();
    const technicalName = name ? IdGenerator.toTechnicalName(name) : `${nodeType}_${id.substring(0, 8)}`;

    const inputPorts: Port[] = [];
    const outputPorts: Port[] = [];

    // Create default input ports
    for (let i = 0; i < config.minInputPorts; i++) {
      inputPorts.push({
        id: IdGenerator.generateId(),
        nodeId: id,
        type: 'input',
        index: i,
        label: config.minInputPorts > 1 ? `In ${i + 1}` : undefined
      });
    }

    // Create default output ports
    for (let i = 0; i < config.minOutputPorts; i++) {
      outputPorts.push({
        id: IdGenerator.generateId(),
        nodeId: id,
        type: 'output',
        index: i,
        label: config.minOutputPorts > 1 ? `Out ${i + 1}` : undefined
      });
    }

    const node: Node = {
      id,
      technicalName,
      nodeType,
      position,
      size: {
        width: config.defaultWidth,
        height: config.defaultHeight
      },
      inputPorts,
      outputPorts,
      data: this.createDefaultData(nodeType),
      color: config.color
    };

    return node;
  }

  /**
   * Create default data for a node type
   */
  private static createDefaultData(nodeType: NodeType): NodeData {
    switch (nodeType) {
      case 'dialogue':
      case 'dialogueFragment':
        return {
          type: nodeType,
          data: {
            text: '',
            autoTransition: false
          } as DialogueNodeData
        };
      
      case 'branch':
        return {
          type: 'branch',
          data: {} as BranchNodeData
        };
      
      case 'condition':
        return {
          type: 'condition',
          data: {
            script: { expression: '', isCondition: true }
          } as ConditionNodeData
        };
      
      case 'instruction':
        return {
          type: 'instruction',
          data: {
            script: { expression: '', isCondition: false }
          } as InstructionNodeData
        };
      
      case 'hub':
        return {
          type: 'hub',
          data: {} as HubNodeData
        };
      
      case 'jump':
        return {
          type: 'jump',
          data: {} as JumpNodeData
        };
      
      case 'flowFragment':
        return {
          type: 'flowFragment',
          data: {
            displayName: 'New Flow Fragment'
          } as FlowFragmentNodeData
        };
    }
  }

  /**
   * Add an output port to a node
   */
  static addOutputPort(node: Node, label?: string): Port {
    const config = NODE_CONFIGS[node.nodeType];
    if (node.outputPorts.length >= config.maxOutputPorts) {
      throw new Error(`Cannot add more output ports to ${node.nodeType}`);
    }

    const port: Port = {
      id: IdGenerator.generateId(),
      nodeId: node.id,
      type: 'output',
      index: node.outputPorts.length,
      label
    };

    node.outputPorts.push(port);
    return port;
  }

  /**
   * Add an input port to a node
   */
  static addInputPort(node: Node, label?: string): Port {
    const config = NODE_CONFIGS[node.nodeType];
    if (node.inputPorts.length >= config.maxInputPorts) {
      throw new Error(`Cannot add more input ports to ${node.nodeType}`);
    }

    const port: Port = {
      id: IdGenerator.generateId(),
      nodeId: node.id,
      type: 'input',
      index: node.inputPorts.length,
      label
    };

    node.inputPorts.push(port);
    return port;
  }

  /**
   * Clone a node with a new ID
   */
  static cloneNode(node: Node, offsetPosition?: Position): Node {
    const newId = IdGenerator.generateId();
    const offset = offsetPosition || { x: 50, y: 50 };

    const clonedNode: Node = {
      ...node,
      id: newId,
      technicalName: `${node.technicalName}_copy`,
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y
      },
      inputPorts: node.inputPorts.map((port, i) => ({
        ...port,
        id: IdGenerator.generateId(),
        nodeId: newId,
        index: i
      })),
      outputPorts: node.outputPorts.map((port, i) => ({
        ...port,
        id: IdGenerator.generateId(),
        nodeId: newId,
        index: i
      })),
      data: JSON.parse(JSON.stringify(node.data))
    };

    return clonedNode;
  }
}
