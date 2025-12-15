/**
 * Core graph data types for the dialogue editor
 * These mirror the Rust backend types for serialization compatibility
 */

export type NodeType = 
  | 'dialogue' 
  | 'dialogueFragment'
  | 'branch' 
  | 'condition' 
  | 'instruction'
  | 'hub'
  | 'jump'
  | 'flowFragment';

export type VariableType = 'string' | 'number' | 'boolean';

export type ConnectionType = 'flow' | 'data';

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface ArticyId {
  low: number;
  high: number;
}

export interface Port {
  id: string;
  nodeId: string;
  type: 'input' | 'output';
  index: number;
  label?: string;
}

export interface Connection {
  id: string;
  fromNodeId: string;
  fromPortIndex: number;
  toNodeId: string;
  toPortIndex: number;
  connectionType: ConnectionType;
  label?: string;
}

export interface ScriptFragment {
  expression: string;
  isCondition: boolean;
}

export interface DialogueNodeData {
  speaker?: string;
  speakerId?: ArticyId;
  text: string;
  menuText?: string;
  stageDirections?: string;
  autoTransition: boolean;
}

export interface BranchNodeData {
  // Branch nodes just have multiple outputs
}

export interface ConditionNodeData {
  script: ScriptFragment;
}

export interface InstructionNodeData {
  script: ScriptFragment;
}

export interface HubNodeData {
  displayName?: string;
}

export interface JumpNodeData {
  targetNodeId?: string;
  targetPinIndex?: number;
}

export interface FlowFragmentNodeData {
  displayName: string;
  text?: string;
}

export type NodeData = 
  | { type: 'dialogue'; data: DialogueNodeData }
  | { type: 'dialogueFragment'; data: DialogueNodeData }
  | { type: 'branch'; data: BranchNodeData }
  | { type: 'condition'; data: ConditionNodeData }
  | { type: 'instruction'; data: InstructionNodeData }
  | { type: 'hub'; data: HubNodeData }
  | { type: 'jump'; data: JumpNodeData }
  | { type: 'flowFragment'; data: FlowFragmentNodeData };

export interface Node {
  id: string;
  technicalName: string;
  nodeType: NodeType;
  position: Position;
  size: Size;
  inputPorts: Port[];
  outputPorts: Port[];
  data: NodeData;
  color?: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
}

export interface Variable {
  id: string;
  namespace: string;
  name: string;
  type: VariableType;
  defaultValue: string | number | boolean;
  description?: string;
}

export interface VariableNamespace {
  name: string;
  description?: string;
  variables: Variable[];
}

export interface Character {
  id: string;
  articyId: ArticyId;
  technicalName: string;
  displayName: string;
  color: string;
  previewImage?: string;
  // Extended character profile (MOUTHWASHING-inspired)
  description?: string;
  philosophy?: string;
  flaw?: string;
  want?: string;
  obsession?: string;
  secret?: string;
}

export interface Skill {
  description: string;
  color: string;
}

export interface SkillCategories {
  social?: Record<string, Skill>;
  interior?: Record<string, Skill>;
}

export interface DialogueGraph {
  id: string;
  name: string;
  technicalName: string;
  nodes: Node[];
  connections: Connection[];
  variables: VariableNamespace[];
  characters: Character[];
  createdAt: number;
  modifiedAt: number;
  metadata?: Record<string, unknown>;
}

export interface Project {
  id: string;
  name: string;
  technicalName: string;
  guid: string;
  graphs: DialogueGraph[];
  globalVariables: VariableNamespace[];
  characters: Character[];
  createdAt: number;
  modifiedAt: number;
}

export interface ValidationError {
  nodeId?: string;
  connectionId?: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  code: string;
}

export interface ValidationReport {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface ExportOptions {
  format: 'json' | 'articyue';
  includeMetadata: boolean;
  prettyPrint: boolean;
  targetPath?: string;
}

export interface ImportResult {
  success: boolean;
  project?: Project;
  errors?: string[];
}
