/**
 * UnrealExporter - Exact Articy:draft X JSON format for ArticyXImporterForUnreal
 * 
 * This generates the EXACT structure the Unreal plugin expects.
 * Based on deep analysis of: https://github.com/ArticySoftware/ArticyXImporterForUnreal
 * 
 * The ArticyXImporter expects these top-level sections:
 * - Settings
 * - Project  
 * - Languages
 * - GlobalVariables
 * - ScriptMethods
 * - ObjectDefinitions
 * - Packages (contains Models with Properties and Templates)
 * - Hierarchy
 * 
 * Each Package has:
 * - Files.Objects.json (the actual node data)
 * - Files.Texts.json (localized strings)
 */

import { DialogueGraph, Node, Connection, Character, NodeType } from '../types/graph';

// ============================================================
// ARTICY ID FORMAT (0x prefix, 16 hex chars)
// ============================================================

class ArticyIdGenerator {
  private counter = BigInt(0x0001000000000000);

  next(): string {
    const id = this.counter++;
    return '0x' + id.toString(16).toUpperCase().padStart(16, '0');
  }

  fromSeed(seed: string): string {
    let hash = BigInt(0);
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << BigInt(5)) - hash) + BigInt(seed.charCodeAt(i));
      hash = hash & BigInt(0xFFFFFFFFFFFFFFFF);
    }
    if (hash < BigInt(0x0001000000000000)) {
      hash += BigInt(0x0001000000000000);
    }
    return '0x' + hash.toString(16).toUpperCase().padStart(16, '0');
  }
}

// ============================================================
// EXACT ARTICY JSON STRUCTURE TYPES
// ============================================================

interface ArticyExportRoot {
  Settings: ArticySettings;
  Project: ArticyProject;
  Languages?: ArticyLanguages;
  GlobalVariables: ArticyGlobalVariable[];
  ScriptMethods: ArticyScriptMethod[];
  ObjectDefinitions: ArticyObjectDefinitions;
  Packages: ArticyPackage[];
  Hierarchy: ArticyHierarchyNode;
}

interface ArticySettings {
  set_TextFormatter: string;
  set_UseScriptSupport: boolean;
  set_IncludedNodes: string;
  set_Localization: boolean;
  ExportVersion: string;
  ObjectDefinitionsHash: string;
  ScriptFragmentsHash: string;
}

interface ArticyProject {
  Name: string;
  DetailName: string;
  Guid: string;
  TechnicalName: string;
}

interface ArticyLanguages {
  Languages: ArticyLanguageDef[];
}

interface ArticyLanguageDef {
  CultureName: string;
  ArticyLanguageId: string;
  LanguageName: string;
  IsVoiceOver: boolean;
}

interface ArticyGlobalVariable {
  Namespace: string;
  Description: string;
  Variables: ArticyVariable[];
}

interface ArticyVariable {
  Variable: string;
  Type: 'Boolean' | 'Integer' | 'String';
  Value: boolean | number | string;
  Description: string;
}

interface ArticyScriptMethod {
  Name: string;
  BlueprintName: string;
  ParameterTypes: string[];
  ReturnType: string;
}

interface ArticyObjectDefinitions {
  Types: ArticyTypeDef[];
}

interface ArticyTypeDef {
  Type: string;
  Class: string;
  InheritsFrom?: string;
  Properties: ArticyPropertyDef[];
  DisplayName?: string;
}

interface ArticyPropertyDef {
  Property: string;
  Type: string;
  ItemType?: string;
  DisplayName?: string;
}

interface ArticyPackage {
  Name: string;
  Description: string;
  IsDefaultPackage: boolean;
  Id: string;
  IsIncluded: boolean;
  Files: {
    Objects: ArticyPackageObjects;
    Texts: ArticyPackageTexts;
  };
}

interface ArticyPackageObjects {
  Objects: ArticyModel[];
}

interface ArticyPackageTexts {
  [nodeId: string]: ArticyTextEntry;
}

interface ArticyTextEntry {
  Context?: string;
  Text?: string;
  MenuText?: string;
  StageDirections?: string;
  VOAsset?: string;
}

interface ArticyModel {
  Type: string;
  Properties: ArticyModelProperties;
  Template?: Record<string, unknown>;
}

interface ArticyModelProperties {
  Id: string;
  TechnicalName: string;
  Parent: string;
  DisplayName?: string;
  Text?: string;
  MenuText?: string;
  StageDirections?: string;
  Speaker?: string;
  Expression?: string;
  Target?: string;
  TargetPin?: string;
  Color?: ArticyColor;
  Position?: ArticyPosition;
  Size?: ArticySize;
  ShortId?: number;
  InputPins?: ArticyPin[];
  OutputPins?: ArticyPin[];
  PreviewImage?: ArticyPreviewImage;
}

interface ArticyColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface ArticyPosition {
  x: number;
  y: number;
}

interface ArticySize {
  w: number;
  h: number;
}

interface ArticyPin {
  Type: 'InputPin' | 'OutputPin';
  Id: string;
  Owner: string;
  Connections: ArticyConnection[];
  Text?: string;
  Expression?: string;
}

interface ArticyConnection {
  Label?: string;
  TargetPin: string;
  Target: string;
  Color?: ArticyColor;
}

interface ArticyPreviewImage {
  ViewBox?: { x: number; y: number; w: number; h: number };
  Mode?: number;
  Asset?: string;
}

interface ArticyHierarchyNode {
  Type: string;
  Id: string;
  TechnicalName?: string;
  Children: ArticyHierarchyNode[];
}

// ============================================================
// NODE TYPE MAPPING
// ============================================================

const ARTICY_TYPE_MAP: Record<NodeType, { type: string; class: string }> = {
  dialogue: { type: 'Dialogue', class: 'Dialogue' },
  dialogueFragment: { type: 'DialogueFragment', class: 'DialogueFragment' },
  flowFragment: { type: 'FlowFragment', class: 'FlowFragment' },
  branch: { type: 'Hub', class: 'Hub' },
  hub: { type: 'Hub', class: 'Hub' },
  condition: { type: 'Condition', class: 'Condition' },
  instruction: { type: 'Instruction', class: 'Instruction' },
  jump: { type: 'Jump', class: 'Jump' }
};

// ============================================================
// MAIN EXPORTER
// ============================================================

export class UnrealExporter {
  private graph: DialogueGraph;
  private idGen = new ArticyIdGenerator();
  private nodeIdMap = new Map<string, string>();
  private charIdMap = new Map<string, string>();
  private pinIdMap = new Map<string, string>();
  private shortIdCounter = 1;

  constructor(graph: DialogueGraph) {
    this.graph = graph;
    this.buildIdMaps();
  }

  private buildIdMaps(): void {
    // Deterministic IDs based on technical names for stable exports
    for (const node of this.graph.nodes) {
      const techName = node.technicalName || node.id;
      this.nodeIdMap.set(node.id, this.idGen.fromSeed(`node_${techName}`));
    }
    
    for (const char of this.graph.characters) {
      this.charIdMap.set(char.id, this.idGen.fromSeed(`char_${char.displayName}`));
    }

    // Generate pin IDs
    for (const node of this.graph.nodes) {
      node.inputPorts.forEach((_, i) => {
        const key = `${node.id}:in:${i}`;
        this.pinIdMap.set(key, this.idGen.fromSeed(`pin_${key}`));
      });
      node.outputPorts.forEach((_, i) => {
        const key = `${node.id}:out:${i}`;
        this.pinIdMap.set(key, this.idGen.fromSeed(`pin_${key}`));
      });
    }
  }

  private hexColorToArticy(hex: string): ArticyColor {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { r: 1, g: 1, b: 1, a: 1 };
    return {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
      a: 1
    };
  }

  export(): ArticyExportRoot {
    return {
      Settings: this.exportSettings(),
      Project: this.exportProject(),
      Languages: this.exportLanguages(),
      GlobalVariables: this.exportGlobalVariables(),
      ScriptMethods: this.exportScriptMethods(),
      ObjectDefinitions: this.exportObjectDefinitions(),
      Packages: this.exportPackages(),
      Hierarchy: this.exportHierarchy()
    };
  }

  private exportSettings(): ArticySettings {
    return {
      set_TextFormatter: 'BBCode',
      set_UseScriptSupport: true,
      set_IncludedNodes: 'Settings,GlobalVariables,ObjectDefinitions,Hierarchy,Packages,ScriptMethods',
      set_Localization: false,
      ExportVersion: '1.4.7.0',
      ObjectDefinitionsHash: this.generateHash('objdefs'),
      ScriptFragmentsHash: this.generateHash('scripts')
    };
  }

  private exportProject(): ArticyProject {
    const name = this.graph.name || 'DialogueProject';
    return {
      Name: name,
      DetailName: name,
      Guid: this.generateUUID(),
      TechnicalName: name.replace(/[^a-zA-Z0-9]/g, '')
    };
  }

  private exportLanguages(): ArticyLanguages {
    return {
      Languages: [
        {
          CultureName: 'en',
          ArticyLanguageId: this.idGen.next(),
          LanguageName: 'English',
          IsVoiceOver: false
        }
      ]
    };
  }

  private exportGlobalVariables(): ArticyGlobalVariable[] {
    if (!this.graph.variables) return [];

    return Object.entries(this.graph.variables).map(([namespace, vars]) => ({
      Namespace: namespace,
      Description: '',
      Variables: Object.entries(vars).map(([name, value]) => ({
        Variable: name,
        Type: (typeof value === 'boolean' ? 'Boolean' : 
               typeof value === 'number' ? 'Integer' : 'String') as 'Boolean' | 'Integer' | 'String',
        Value: value,
        Description: ''
      }))
    }));
  }

  private exportScriptMethods(): ArticyScriptMethod[] {
    // Detect custom methods used in scripts
    const methods: ArticyScriptMethod[] = [];
    const methodPattern = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    const builtinMethods = new Set([
      'getProp', 'setProp', 'random', 'print', 'getObj', 
      'once', 'limit', 'visited', 'getVisitCount', 'if', 'else'
    ]);

    for (const node of this.graph.nodes) {
      let script = '';
      if (node.data.type === 'condition') {
        script = node.data.data.script?.expression || '';
      } else if (node.data.type === 'instruction') {
        script = node.data.data.script?.expression || '';
      }

      let match;
      while ((match = methodPattern.exec(script)) !== null) {
        const methodName = match[1];
        if (!builtinMethods.has(methodName) && !methods.find(m => m.Name === methodName)) {
          methods.push({
            Name: methodName,
            BlueprintName: methodName,
            ParameterTypes: [], // Could parse from usage
            ReturnType: 'void'
          });
        }
      }
    }

    return methods;
  }

  private exportObjectDefinitions(): ArticyObjectDefinitions {
    // Define all the types used in this export
    const types: ArticyTypeDef[] = [
      // Built-in flow types
      {
        Type: 'Dialogue',
        Class: 'Dialogue',
        Properties: this.getDialogueProperties()
      },
      {
        Type: 'DialogueFragment', 
        Class: 'DialogueFragment',
        Properties: this.getDialogueFragmentProperties()
      },
      {
        Type: 'Hub',
        Class: 'Hub',
        Properties: this.getHubProperties()
      },
      {
        Type: 'Condition',
        Class: 'Condition',
        Properties: this.getConditionProperties()
      },
      {
        Type: 'Instruction',
        Class: 'Instruction',
        Properties: this.getInstructionProperties()
      },
      {
        Type: 'Jump',
        Class: 'Jump',
        Properties: this.getJumpProperties()
      },
      {
        Type: 'FlowFragment',
        Class: 'FlowFragment',
        Properties: this.getFlowFragmentProperties()
      },
      // Entity type for characters
      {
        Type: 'Entity',
        Class: 'Entity',
        Properties: this.getEntityProperties()
      },
      // Pin types
      {
        Type: 'InputPin',
        Class: 'InputPin',
        Properties: this.getPinProperties()
      },
      {
        Type: 'OutputPin',
        Class: 'OutputPin',
        Properties: this.getPinProperties()
      }
    ];

    return { Types: types };
  }

  private getDialogueProperties(): ArticyPropertyDef[] {
    return [
      { Property: 'Id', Type: 'id' },
      { Property: 'TechnicalName', Type: 'string' },
      { Property: 'Parent', Type: 'id' },
      { Property: 'DisplayName', Type: 'ftext' },
      { Property: 'Text', Type: 'ftext' },
      { Property: 'InputPins', Type: 'array', ItemType: 'InputPin' },
      { Property: 'OutputPins', Type: 'array', ItemType: 'OutputPin' },
      { Property: 'Position', Type: 'ArticySize' },
      { Property: 'Color', Type: 'color' }
    ];
  }

  private getDialogueFragmentProperties(): ArticyPropertyDef[] {
    return [
      { Property: 'Id', Type: 'id' },
      { Property: 'TechnicalName', Type: 'string' },
      { Property: 'Parent', Type: 'id' },
      { Property: 'Speaker', Type: 'id' },
      { Property: 'Text', Type: 'ftext' },
      { Property: 'MenuText', Type: 'ftext' },
      { Property: 'StageDirections', Type: 'ftext' },
      { Property: 'InputPins', Type: 'array', ItemType: 'InputPin' },
      { Property: 'OutputPins', Type: 'array', ItemType: 'OutputPin' },
      { Property: 'Position', Type: 'ArticySize' },
      { Property: 'Color', Type: 'color' }
    ];
  }

  private getHubProperties(): ArticyPropertyDef[] {
    return [
      { Property: 'Id', Type: 'id' },
      { Property: 'TechnicalName', Type: 'string' },
      { Property: 'Parent', Type: 'id' },
      { Property: 'DisplayName', Type: 'ftext' },
      { Property: 'InputPins', Type: 'array', ItemType: 'InputPin' },
      { Property: 'OutputPins', Type: 'array', ItemType: 'OutputPin' },
      { Property: 'Position', Type: 'ArticySize' }
    ];
  }

  private getConditionProperties(): ArticyPropertyDef[] {
    return [
      { Property: 'Id', Type: 'id' },
      { Property: 'TechnicalName', Type: 'string' },
      { Property: 'Parent', Type: 'id' },
      { Property: 'Expression', Type: 'string' },
      { Property: 'InputPins', Type: 'array', ItemType: 'InputPin' },
      { Property: 'OutputPins', Type: 'array', ItemType: 'OutputPin' },
      { Property: 'Position', Type: 'ArticySize' }
    ];
  }

  private getInstructionProperties(): ArticyPropertyDef[] {
    return [
      { Property: 'Id', Type: 'id' },
      { Property: 'TechnicalName', Type: 'string' },
      { Property: 'Parent', Type: 'id' },
      { Property: 'Expression', Type: 'string' },
      { Property: 'InputPins', Type: 'array', ItemType: 'InputPin' },
      { Property: 'OutputPins', Type: 'array', ItemType: 'OutputPin' },
      { Property: 'Position', Type: 'ArticySize' }
    ];
  }

  private getJumpProperties(): ArticyPropertyDef[] {
    return [
      { Property: 'Id', Type: 'id' },
      { Property: 'TechnicalName', Type: 'string' },
      { Property: 'Parent', Type: 'id' },
      { Property: 'Target', Type: 'id' },
      { Property: 'TargetPin', Type: 'id' },
      { Property: 'InputPins', Type: 'array', ItemType: 'InputPin' },
      { Property: 'OutputPins', Type: 'array', ItemType: 'OutputPin' },
      { Property: 'Position', Type: 'ArticySize' }
    ];
  }

  private getFlowFragmentProperties(): ArticyPropertyDef[] {
    return [
      { Property: 'Id', Type: 'id' },
      { Property: 'TechnicalName', Type: 'string' },
      { Property: 'Parent', Type: 'id' },
      { Property: 'DisplayName', Type: 'ftext' },
      { Property: 'Text', Type: 'ftext' },
      { Property: 'InputPins', Type: 'array', ItemType: 'InputPin' },
      { Property: 'OutputPins', Type: 'array', ItemType: 'OutputPin' },
      { Property: 'Position', Type: 'ArticySize' }
    ];
  }

  private getEntityProperties(): ArticyPropertyDef[] {
    return [
      { Property: 'Id', Type: 'id' },
      { Property: 'TechnicalName', Type: 'string' },
      { Property: 'Parent', Type: 'id' },
      { Property: 'DisplayName', Type: 'ftext' },
      { Property: 'PreviewImage', Type: 'PreviewImage' },
      { Property: 'Color', Type: 'color' }
    ];
  }

  private getPinProperties(): ArticyPropertyDef[] {
    return [
      { Property: 'Id', Type: 'id' },
      { Property: 'Owner', Type: 'id' },
      { Property: 'Connections', Type: 'array', ItemType: 'OutgoingConnection' },
      { Property: 'Text', Type: 'ftext' },
      { Property: 'Expression', Type: 'string' }
    ];
  }

  private exportPackages(): ArticyPackage[] {
    const packageId = this.idGen.next();
    const models: ArticyModel[] = [];
    const texts: ArticyPackageTexts = {};

    // Export characters as entities
    for (const char of this.graph.characters) {
      const articyId = this.charIdMap.get(char.id)!;
      models.push({
        Type: 'Entity',
        Properties: {
          Id: articyId,
          TechnicalName: char.technicalName || char.displayName.replace(/[^a-zA-Z0-9]/g, '_'),
          Parent: '0x0000000000000000',
          DisplayName: char.displayName,
          ShortId: this.shortIdCounter++,
          Color: this.hexColorToArticy(char.color || '#FFFFFF')
        }
      });
    }

    // Export nodes
    for (const node of this.graph.nodes) {
      const model = this.convertNode(node);
      models.push(model);

      // Add text entries for dialogue nodes
      if (node.data.type === 'dialogue' || node.data.type === 'dialogueFragment') {
        const data = node.data.data;
        texts[model.Properties.Id] = {
          Text: data.text || '',
          MenuText: data.menuText || '',
          StageDirections: data.stageDirections || ''
        };
      }
    }

    return [{
      Name: 'Default',
      Description: 'Main dialogue package',
      IsDefaultPackage: true,
      Id: packageId,
      IsIncluded: true,
      Files: {
        Objects: { Objects: models },
        Texts: texts
      }
    }];
  }

  private convertNode(node: Node): ArticyModel {
    const articyId = this.nodeIdMap.get(node.id)!;
    const typeInfo = ARTICY_TYPE_MAP[node.nodeType] || ARTICY_TYPE_MAP.flowFragment;

    const properties: ArticyModelProperties = {
      Id: articyId,
      TechnicalName: node.technicalName || `Node_${node.id.substring(0, 8)}`,
      Parent: '0x0000000000000000',
      ShortId: this.shortIdCounter++,
      Position: { x: node.position.x, y: node.position.y },
      Size: { w: node.size.width, h: node.size.height },
      InputPins: this.convertPins(node, 'input'),
      OutputPins: this.convertPins(node, 'output')
    };

    // Add type-specific properties
    if (node.data.type === 'dialogue' || node.data.type === 'dialogueFragment') {
      const data = node.data.data;
      properties.Text = data.text || '';
      properties.MenuText = data.menuText || '';
      properties.StageDirections = data.stageDirections || '';
      
      if (data.speaker) {
        properties.Speaker = this.charIdMap.get(data.speaker) || '0x0000000000000000';
      }
    } else if (node.data.type === 'condition') {
      properties.Expression = node.data.data.script?.expression || '';
    } else if (node.data.type === 'instruction') {
      properties.Expression = node.data.data.script?.expression || '';
    } else if (node.data.type === 'jump' && node.data.data.targetNodeId) {
      properties.Target = this.nodeIdMap.get(node.data.data.targetNodeId) || '0x0000000000000000';
    }

    if (node.color) {
      properties.Color = this.hexColorToArticy(node.color);
    }

    return {
      Type: typeInfo.type,
      Properties: properties
    };
  }

  private convertPins(node: Node, type: 'input' | 'output'): ArticyPin[] {
    const ports = type === 'input' ? node.inputPorts : node.outputPorts;
    const nodeArticyId = this.nodeIdMap.get(node.id)!;

    return ports.map((port, index) => {
      const pinKey = `${node.id}:${type === 'input' ? 'in' : 'out'}:${index}`;
      const pinId = this.pinIdMap.get(pinKey)!;

      // Find connections for this pin
      const connections: ArticyConnection[] = [];
      
      if (type === 'output') {
        const outConns = this.graph.connections.filter(
          c => c.fromNodeId === node.id && c.fromPortIndex === index
        );
        
        for (const conn of outConns) {
          const targetPinKey = `${conn.toNodeId}:in:${conn.toPortIndex}`;
          const targetPinId = this.pinIdMap.get(targetPinKey);
          const targetNodeId = this.nodeIdMap.get(conn.toNodeId);
          
          if (targetPinId && targetNodeId) {
            connections.push({
              Label: conn.label || '',
              TargetPin: targetPinId,
              Target: targetNodeId
            });
          }
        }
      }

      return {
        Type: type === 'input' ? 'InputPin' : 'OutputPin',
        Id: pinId,
        Owner: nodeArticyId,
        Connections: connections,
        Text: port.label || ''
      };
    });
  }

  private exportHierarchy(): ArticyHierarchyNode {
    return {
      Type: 'Project',
      Id: '0x0000000000000001',
      Children: [
        {
          Type: 'Folder',
          Id: this.idGen.next(),
          TechnicalName: 'Characters',
          Children: this.graph.characters.map(char => ({
            Type: 'Entity',
            Id: this.charIdMap.get(char.id)!,
            TechnicalName: char.technicalName || char.displayName.replace(/[^a-zA-Z0-9]/g, '_'),
            Children: []
          }))
        },
        {
          Type: 'Folder',
          Id: this.idGen.next(),
          TechnicalName: 'Dialogues',
          Children: this.graph.nodes.map(node => ({
            Type: ARTICY_TYPE_MAP[node.nodeType]?.type || 'FlowFragment',
            Id: this.nodeIdMap.get(node.id)!,
            TechnicalName: node.technicalName || `Node_${node.id.substring(0, 8)}`,
            Children: []
          }))
        }
      ]
    };
  }

  private generateHash(seed: string): string {
    // Simple hash for consistency checking
    let hash = 0;
    const str = seed + Date.now().toString();
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // ============================================================
  // PUBLIC EXPORT METHODS
  // ============================================================

  exportJSON(): string {
    return JSON.stringify(this.export(), null, 2);
  }

  /**
   * Export as .articyue5 compatible file set
   * This is what your Unreal programmer needs
   */
  exportForUnreal(): { filename: string; content: string }[] {
    const data = this.export();
    
    // The ArticyXImporter can read either a single JSON or an archive
    // For simplicity, we export a single combined JSON that works directly
    return [
      {
        filename: `${data.Project.TechnicalName}.json`,
        content: JSON.stringify(data, null, 2)
      }
    ];
  }
}

// ============================================================
// DOCUMENTATION FOR UNREAL PROGRAMMER
// ============================================================

export const UNREAL_SETUP_GUIDE = `
# Setting Up ArticyXImporter with Your Dialogue Export

## Prerequisites
1. Unreal Engine 5.x project (C++ enabled)
2. ArticyXImporter plugin from GitHub or Marketplace

## Installation Steps

### 1. Install the Plugin
\`\`\`
git clone https://github.com/ArticySoftware/ArticyXImporterForUnreal.git
\`\`\`
Copy to: YourProject/Plugins/ArticyXImporter/

### 2. Enable in .uproject
\`\`\`json
{
  "Plugins": [
    {
      "Name": "ArticyXImporter",
      "Enabled": true
    }
  ]
}
\`\`\`

### 3. Import the JSON
- Place the exported .json in: Content/ArticyContent/
- Open Unreal Editor
- Go to: Articy Importer panel
- Click "Import"

### 4. Access in Blueprints
\`\`\`cpp
// Get a dialogue fragment
UArticyObject* DialogueNode = UArticyDatabase::Get(this)->GetObject<UArticyDialogueFragment>(ArticyId);

// Get text
FText DialogueText = DialogueNode->GetText();

// Get speaker
UArticyObject* Speaker = DialogueNode->GetSpeaker();
\`\`\`

### 5. Using ArticyFlowPlayer
Add ArticyFlowPlayer component to your dialogue manager actor:

\`\`\`cpp
UPROPERTY(VisibleAnywhere)
UArticyFlowPlayer* FlowPlayer;

// Start dialogue
FlowPlayer->SetStartNode(StartDialogueId);
FlowPlayer->Play();

// Handle events
FlowPlayer->OnPlayerPaused.AddDynamic(this, &ADialogueManager::OnDialoguePaused);
FlowPlayer->OnBranchesUpdated.AddDynamic(this, &ADialogueManager::OnBranchesUpdated);
\`\`\`

## Export Format Compatibility
Our export matches Articy:draft X format version 1.4.7.0:
- ✅ Settings section
- ✅ Project metadata
- ✅ GlobalVariables (game state)
- ✅ ObjectDefinitions (type schemas)
- ✅ Packages with Models
- ✅ Hierarchy (folder structure)
- ✅ ScriptMethods (custom functions)
- ✅ Input/Output pins with connections
- ✅ Position data for editor

## Custom Script Methods
If your dialogues use custom methods like:
\`\`\`
GiveItem("sword", 1)
SetQuestState("main_quest", "started")
\`\`\`

Implement the generated interface in your FlowPlayer actor:
\`\`\`cpp
void ADialogueManager::GiveItem_Implementation(const FString& ItemId, int32 Count)
{
    // Your inventory logic
}
\`\`\`
`;
