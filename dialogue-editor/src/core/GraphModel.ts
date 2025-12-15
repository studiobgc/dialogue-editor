/**
 * Core graph data model with operations for managing dialogue graphs
 */

import {
  Node,
  Connection,
  DialogueGraph,
  Position,
  NodeType,
  ValidationReport,
  ValidationError,
  VariableNamespace,
  Character
} from '../types/graph';
import { IdGenerator } from './IdGenerator';
import { NodeFactory } from './NodeFactory';

export interface GraphChangeEvent {
  type: 'node-added' | 'node-removed' | 'node-updated' | 'connection-added' | 'connection-removed' | 'graph-loaded';
  nodeId?: string;
  connectionId?: string;
  data?: unknown;
}

export type GraphChangeListener = (event: GraphChangeEvent) => void;

export class GraphModel {
  private graph: DialogueGraph;
  private listeners: Set<GraphChangeListener> = new Set();
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private maxUndoSteps = 100;

  constructor(graph?: DialogueGraph) {
    this.graph = graph || this.createEmptyGraph();
  }

  /**
   * Create an empty dialogue graph
   */
  private createEmptyGraph(): DialogueGraph {
    return {
      id: IdGenerator.generateId(),
      name: 'Untitled Graph',
      technicalName: 'untitled_graph',
      nodes: [],
      connections: [],
      variables: [],
      characters: [],
      createdAt: Date.now(),
      modifiedAt: Date.now()
    };
  }

  /**
   * Get the current graph
   */
  getGraph(): DialogueGraph {
    return this.graph;
  }

  /**
   * Load a graph, replacing the current one
   */
  loadGraph(graph: DialogueGraph): void {
    this.saveUndoState();
    this.graph = graph;
    this.graph.modifiedAt = Date.now();
    this.emit({ type: 'graph-loaded' });
  }

  /**
   * Create a new empty graph
   */
  newGraph(name?: string): void {
    this.saveUndoState();
    this.graph = this.createEmptyGraph();
    if (name) {
      this.graph.name = name;
      this.graph.technicalName = IdGenerator.toTechnicalName(name);
    }
    this.emit({ type: 'graph-loaded' });
  }

  // ==================== NODE OPERATIONS ====================

  /**
   * Get all nodes
   */
  getNodes(): Node[] {
    return this.graph.nodes;
  }

  /**
   * Get a node by ID
   */
  getNode(id: string): Node | undefined {
    return this.graph.nodes.find(n => n.id === id);
  }

  /**
   * Add a new node
   */
  addNode(nodeType: NodeType, position: Position, name?: string): Node {
    this.saveUndoState();
    const node = NodeFactory.createNode(nodeType, position, name);
    this.graph.nodes.push(node);
    this.graph.modifiedAt = Date.now();
    this.emit({ type: 'node-added', nodeId: node.id, data: node });
    return node;
  }

  /**
   * Remove a node and its connections
   */
  removeNode(id: string): boolean {
    const nodeIndex = this.graph.nodes.findIndex(n => n.id === id);
    if (nodeIndex === -1) return false;

    this.saveUndoState();

    // Remove all connections to/from this node
    this.graph.connections = this.graph.connections.filter(
      c => c.fromNodeId !== id && c.toNodeId !== id
    );

    // Remove the node
    this.graph.nodes.splice(nodeIndex, 1);
    this.graph.modifiedAt = Date.now();
    this.emit({ type: 'node-removed', nodeId: id });
    return true;
  }

  /**
   * Update a node's position
   */
  updateNodePosition(id: string, position: Position): boolean {
    const node = this.getNode(id);
    if (!node) return false;

    node.position = position;
    this.graph.modifiedAt = Date.now();
    this.emit({ type: 'node-updated', nodeId: id, data: { position } });
    return true;
  }

  /**
   * Update a node's data
   */
  updateNodeData(id: string, data: Partial<Node>): boolean {
    const node = this.getNode(id);
    if (!node) return false;

    this.saveUndoState();
    Object.assign(node, data);
    this.graph.modifiedAt = Date.now();
    this.emit({ type: 'node-updated', nodeId: id, data });
    return true;
  }

  /**
   * Clone a node
   */
  cloneNode(id: string, offset?: Position): Node | undefined {
    const node = this.getNode(id);
    if (!node) return undefined;

    this.saveUndoState();
    const cloned = NodeFactory.cloneNode(node, offset);
    this.graph.nodes.push(cloned);
    this.graph.modifiedAt = Date.now();
    this.emit({ type: 'node-added', nodeId: cloned.id, data: cloned });
    return cloned;
  }

  // ==================== CONNECTION OPERATIONS ====================

  /**
   * Get all connections
   */
  getConnections(): Connection[] {
    return this.graph.connections;
  }

  /**
   * Get connections for a node
   */
  getNodeConnections(nodeId: string): Connection[] {
    return this.graph.connections.filter(
      c => c.fromNodeId === nodeId || c.toNodeId === nodeId
    );
  }

  /**
   * Check if a connection already exists
   */
  connectionExists(fromNodeId: string, fromPortIndex: number, toNodeId: string, toPortIndex: number): boolean {
    return this.graph.connections.some(
      c => c.fromNodeId === fromNodeId && 
           c.fromPortIndex === fromPortIndex &&
           c.toNodeId === toNodeId &&
           c.toPortIndex === toPortIndex
    );
  }

  /**
   * Check if a connection is valid
   */
  canConnect(fromNodeId: string, fromPortIndex: number, toNodeId: string, toPortIndex: number): boolean {
    // Can't connect to self
    if (fromNodeId === toNodeId) return false;

    // Check if connection already exists
    if (this.connectionExists(fromNodeId, fromPortIndex, toNodeId, toPortIndex)) return false;

    const fromNode = this.getNode(fromNodeId);
    const toNode = this.getNode(toNodeId);

    if (!fromNode || !toNode) return false;

    // Check port indices are valid
    if (fromPortIndex >= fromNode.outputPorts.length) return false;
    if (toPortIndex >= toNode.inputPorts.length) return false;

    // Check if input port is already connected (only one input connection allowed)
    const existingInputConnection = this.graph.connections.find(
      c => c.toNodeId === toNodeId && c.toPortIndex === toPortIndex
    );
    if (existingInputConnection) return false;

    return true;
  }

  /**
   * Add a connection between nodes
   */
  addConnection(fromNodeId: string, fromPortIndex: number, toNodeId: string, toPortIndex: number, label?: string): Connection | undefined {
    if (!this.canConnect(fromNodeId, fromPortIndex, toNodeId, toPortIndex)) {
      return undefined;
    }

    this.saveUndoState();

    const connection: Connection = {
      id: IdGenerator.generateId(),
      fromNodeId,
      fromPortIndex,
      toNodeId,
      toPortIndex,
      connectionType: 'flow',
      label
    };

    this.graph.connections.push(connection);
    this.graph.modifiedAt = Date.now();
    this.emit({ type: 'connection-added', connectionId: connection.id, data: connection });
    return connection;
  }

  /**
   * Remove a connection
   */
  removeConnection(id: string): boolean {
    const index = this.graph.connections.findIndex(c => c.id === id);
    if (index === -1) return false;

    this.saveUndoState();
    this.graph.connections.splice(index, 1);
    this.graph.modifiedAt = Date.now();
    this.emit({ type: 'connection-removed', connectionId: id });
    return true;
  }

  /**
   * Remove connections from a specific port
   */
  removePortConnections(nodeId: string, portType: 'input' | 'output', portIndex: number): void {
    this.saveUndoState();
    
    this.graph.connections = this.graph.connections.filter(c => {
      if (portType === 'output') {
        return !(c.fromNodeId === nodeId && c.fromPortIndex === portIndex);
      } else {
        return !(c.toNodeId === nodeId && c.toPortIndex === portIndex);
      }
    });
    
    this.graph.modifiedAt = Date.now();
  }

  // ==================== VARIABLES ====================

  /**
   * Get all variable namespaces
   */
  getVariables(): VariableNamespace[] {
    return this.graph.variables;
  }

  /**
   * Add a variable namespace
   */
  addVariableNamespace(name: string, description?: string): VariableNamespace {
    this.saveUndoState();
    const namespace: VariableNamespace = {
      name,
      description,
      variables: []
    };
    this.graph.variables.push(namespace);
    this.graph.modifiedAt = Date.now();
    return namespace;
  }

  // ==================== CHARACTERS ====================

  /**
   * Get all characters
   */
  getCharacters(): Character[] {
    return this.graph.characters;
  }

  /**
   * Add a character
   */
  addCharacter(displayName: string, color: string): Character {
    this.saveUndoState();
    const character: Character = {
      id: IdGenerator.generateId(),
      articyId: IdGenerator.generateArticyId(),
      technicalName: IdGenerator.toTechnicalName(displayName),
      displayName,
      color
    };
    this.graph.characters.push(character);
    this.graph.modifiedAt = Date.now();
    return character;
  }

  // ==================== VALIDATION ====================

  /**
   * Validate the graph for errors
   */
  validate(): ValidationReport {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Build node lookup for quick access
    const nodeMap = new Map(this.graph.nodes.map(n => [n.id, n]));

    // Check for orphaned nodes (nodes with no connections)
    if (this.graph.nodes.length > 1) {
      const connectedNodeIds = new Set<string>();
      for (const conn of this.graph.connections) {
        connectedNodeIds.add(conn.fromNodeId);
        connectedNodeIds.add(conn.toNodeId);
      }

      for (const node of this.graph.nodes) {
        if (!connectedNodeIds.has(node.id)) {
          warnings.push({
            nodeId: node.id,
            severity: 'warning',
            message: `Node "${node.technicalName}" is not connected to any other nodes`,
            code: 'ORPHANED_NODE'
          });
        }
      }
    }

    // Check dialogue nodes for missing speakers
    for (const node of this.graph.nodes) {
      if (node.nodeType === 'dialogue' || node.nodeType === 'dialogueFragment') {
        const data = node.data as { type: string; data: { speaker?: string; text: string } };
        if (!data.data.speaker && !data.data.text) {
          warnings.push({
            nodeId: node.id,
            severity: 'warning',
            message: `Dialogue node "${node.technicalName}" has no speaker or text`,
            code: 'EMPTY_DIALOGUE'
          });
        }
      }
    }

    // Check jump nodes for valid targets
    for (const node of this.graph.nodes) {
      if (node.nodeType === 'jump') {
        const data = node.data as { type: 'jump'; data: { targetNodeId?: string } };
        if (data.data.targetNodeId) {
          if (!nodeMap.has(data.data.targetNodeId)) {
            errors.push({
              nodeId: node.id,
              severity: 'error',
              message: `Jump node "${node.technicalName}" references non-existent target`,
              code: 'INVALID_JUMP_TARGET'
            });
          }
        } else {
          warnings.push({
            nodeId: node.id,
            severity: 'warning',
            message: `Jump node "${node.technicalName}" has no target set`,
            code: 'MISSING_JUMP_TARGET'
          });
        }
      }
    }

    // Check condition nodes for empty expressions
    for (const node of this.graph.nodes) {
      if (node.nodeType === 'condition') {
        const data = node.data as { type: 'condition'; data: { script: { expression: string } } };
        if (!data.data.script.expression.trim()) {
          warnings.push({
            nodeId: node.id,
            severity: 'warning',
            message: `Condition node "${node.technicalName}" has empty expression`,
            code: 'EMPTY_CONDITION'
          });
        }
      }
    }

    // Check for cycles (would cause infinite loops in flow)
    const cycleNodes = this.detectCycles();
    for (const nodeId of cycleNodes) {
      const node = nodeMap.get(nodeId);
      warnings.push({
        nodeId,
        severity: 'warning',
        message: `Node "${node?.technicalName}" is part of a cycle - may cause infinite loops`,
        code: 'CYCLE_DETECTED'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Detect cycles in the graph using DFS
   */
  private detectCycles(): Set<string> {
    const cycleNodes = new Set<string>();
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    // Build adjacency list
    const adjacencyList = new Map<string, string[]>();
    for (const node of this.graph.nodes) {
      adjacencyList.set(node.id, []);
    }
    for (const conn of this.graph.connections) {
      const list = adjacencyList.get(conn.fromNodeId);
      if (list) {
        list.push(conn.toNodeId);
      }
    }

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) {
            cycleNodes.add(nodeId);
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          cycleNodes.add(nodeId);
          cycleNodes.add(neighbor);
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of this.graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }

    return cycleNodes;
  }

  // ==================== UNDO/REDO ====================

  private saveUndoState(): void {
    const state = JSON.stringify(this.graph);
    this.undoStack.push(state);
    if (this.undoStack.length > this.maxUndoSteps) {
      this.undoStack.shift();
    }
    // Clear redo stack on new action
    this.redoStack = [];
  }

  undo(): boolean {
    if (this.undoStack.length === 0) return false;

    const currentState = JSON.stringify(this.graph);
    this.redoStack.push(currentState);

    const previousState = this.undoStack.pop()!;
    this.graph = JSON.parse(previousState);
    this.emit({ type: 'graph-loaded' });
    return true;
  }

  redo(): boolean {
    if (this.redoStack.length === 0) return false;

    const currentState = JSON.stringify(this.graph);
    this.undoStack.push(currentState);

    const nextState = this.redoStack.pop()!;
    this.graph = JSON.parse(nextState);
    this.emit({ type: 'graph-loaded' });
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  // ==================== EVENTS ====================

  addListener(listener: GraphChangeListener): void {
    this.listeners.add(listener);
  }

  removeListener(listener: GraphChangeListener): void {
    this.listeners.delete(listener);
  }

  private emit(event: GraphChangeEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  // ==================== SERIALIZATION ====================

  /**
   * Export the graph to JSON
   */
  toJSON(): string {
    return JSON.stringify(this.graph, null, 2);
  }

  /**
   * Import a graph from JSON
   */
  static fromJSON(json: string): GraphModel {
    const graph = JSON.parse(json) as DialogueGraph;
    return new GraphModel(graph);
  }
}
