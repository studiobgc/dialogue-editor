use serde::{Deserialize, Serialize};
use super::ArticyId;

/// Node types in the dialogue graph
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NodeType {
    Dialogue,
    DialogueFragment,
    Branch,
    Condition,
    Instruction,
    Hub,
    Jump,
    FlowFragment,
}

impl NodeType {
    pub fn display_name(&self) -> &'static str {
        match self {
            NodeType::Dialogue => "Dialogue",
            NodeType::DialogueFragment => "Dialogue Fragment",
            NodeType::Branch => "Branch",
            NodeType::Condition => "Condition",
            NodeType::Instruction => "Instruction",
            NodeType::Hub => "Hub",
            NodeType::Jump => "Jump",
            NodeType::FlowFragment => "Flow Fragment",
        }
    }
    
    pub fn default_color(&self) -> &'static str {
        match self {
            NodeType::Dialogue => "#3b82f6",
            NodeType::DialogueFragment => "#3b82f6",
            NodeType::Branch => "#f59e0b",
            NodeType::Condition => "#10b981",
            NodeType::Instruction => "#8b5cf6",
            NodeType::Hub => "#06b6d4",
            NodeType::Jump => "#8b5cf6",
            NodeType::FlowFragment => "#6366f1",
        }
    }
}

/// Variable types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VariableType {
    String,
    Number,
    Boolean,
}

/// Connection types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConnectionType {
    Flow,
    Data,
}

/// 2D position
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Default)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

/// Size dimensions
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Size {
    pub width: f64,
    pub height: f64,
}

impl Default for Size {
    fn default() -> Self {
        Self { width: 200.0, height: 100.0 }
    }
}

/// A port on a node (input or output)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Port {
    pub id: String,
    pub node_id: String,
    #[serde(rename = "type")]
    pub port_type: PortType,
    pub index: usize,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PortType {
    Input,
    Output,
}

/// Script fragment for conditions and instructions
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScriptFragment {
    pub expression: String,
    pub is_condition: bool,
}

/// Dialogue-specific data
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DialogueData {
    pub speaker: Option<String>,
    pub speaker_id: Option<ArticyId>,
    pub text: String,
    pub menu_text: Option<String>,
    pub stage_directions: Option<String>,
    pub auto_transition: bool,
}

/// Jump-specific data
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct JumpData {
    pub target_node_id: Option<String>,
    pub target_pin_index: Option<usize>,
}

/// Flow fragment-specific data
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlowFragmentData {
    pub display_name: String,
    pub text: Option<String>,
}

impl Default for FlowFragmentData {
    fn default() -> Self {
        Self {
            display_name: "Flow Fragment".to_string(),
            text: None,
        }
    }
}

/// Hub-specific data
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HubData {
    pub display_name: Option<String>,
}

/// Node data payload based on type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase")]
pub enum NodeData {
    Dialogue(DialogueData),
    DialogueFragment(DialogueData),
    Branch,
    Condition { script: ScriptFragment },
    Instruction { script: ScriptFragment },
    Hub(HubData),
    Jump(JumpData),
    FlowFragment(FlowFragmentData),
}

impl Default for NodeData {
    fn default() -> Self {
        NodeData::DialogueFragment(DialogueData::default())
    }
}

/// A node in the dialogue graph
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Node {
    pub id: String,
    pub technical_name: String,
    pub node_type: NodeType,
    pub position: Position,
    pub size: Size,
    pub input_ports: Vec<Port>,
    pub output_ports: Vec<Port>,
    pub data: NodeData,
    pub color: Option<String>,
    pub parent_id: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

/// A connection between nodes
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    pub id: String,
    pub from_node_id: String,
    pub from_port_index: usize,
    pub to_node_id: String,
    pub to_port_index: usize,
    pub connection_type: ConnectionType,
    pub label: Option<String>,
}

/// A variable definition
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Variable {
    pub id: String,
    pub namespace: String,
    pub name: String,
    pub variable_type: VariableType,
    pub default_value: serde_json::Value,
    pub description: Option<String>,
}

/// A namespace containing variables
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VariableNamespace {
    pub name: String,
    pub description: Option<String>,
    pub variables: Vec<Variable>,
}

/// A character definition
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Character {
    pub id: String,
    pub articy_id: ArticyId,
    pub technical_name: String,
    pub display_name: String,
    pub color: String,
    pub preview_image: Option<String>,
}

/// The complete dialogue graph
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DialogueGraph {
    pub id: String,
    pub name: String,
    pub technical_name: String,
    pub nodes: Vec<Node>,
    pub connections: Vec<Connection>,
    pub variables: Vec<VariableNamespace>,
    pub characters: Vec<Character>,
    pub created_at: i64,
    pub modified_at: i64,
    pub metadata: Option<serde_json::Value>,
}

/// Validation error
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationError {
    pub node_id: Option<String>,
    pub connection_id: Option<String>,
    pub severity: ValidationSeverity,
    pub message: String,
    pub code: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ValidationSeverity {
    Error,
    Warning,
    Info,
}

/// Validation report
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationReport {
    pub is_valid: bool,
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<ValidationError>,
}
