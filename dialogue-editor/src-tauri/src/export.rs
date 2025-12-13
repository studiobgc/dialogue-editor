use serde::{Deserialize, Serialize};
use crate::graph::*;

/// Export format compatible with Unreal Engine import
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnrealExport {
    pub format_version: String,
    pub project: ProjectInfo,
    pub global_variables: Vec<ExportVariableNamespace>,
    pub characters: Vec<ExportCharacter>,
    pub packages: Vec<ExportPackage>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub name: String,
    pub technical_name: String,
    pub guid: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportVariableNamespace {
    pub name: String,
    pub description: Option<String>,
    pub variables: Vec<ExportVariable>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportVariable {
    pub name: String,
    #[serde(rename = "type")]
    pub var_type: String,
    pub default_value: serde_json::Value,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportCharacter {
    pub id: String,
    pub technical_name: String,
    pub display_name: String,
    pub color: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPackage {
    pub name: String,
    pub is_default_package: bool,
    pub objects: Vec<ExportObject>,
    pub connections: Vec<ExportConnection>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportObject {
    pub id: String,
    pub technical_name: String,
    #[serde(rename = "type")]
    pub object_type: String,
    pub position: Position,
    pub properties: serde_json::Value,
    pub input_pins: Vec<ExportPin>,
    pub output_pins: Vec<ExportPin>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPin {
    pub id: String,
    pub index: usize,
    pub label: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportConnection {
    pub id: String,
    pub source_id: String,
    pub source_pin: usize,
    pub target_id: String,
    pub target_pin: usize,
}

/// Export a dialogue graph for Unreal Engine
pub fn export_for_unreal(graph: &DialogueGraph) -> Result<String, String> {
    let export = UnrealExport {
        format_version: "1.0".to_string(),
        project: ProjectInfo {
            name: graph.name.clone(),
            technical_name: graph.technical_name.clone(),
            guid: graph.id.clone(),
        },
        global_variables: graph.variables.iter().map(|ns| {
            ExportVariableNamespace {
                name: ns.name.clone(),
                description: ns.description.clone(),
                variables: ns.variables.iter().map(|v| {
                    ExportVariable {
                        name: v.name.clone(),
                        var_type: format!("{:?}", v.variable_type),
                        default_value: v.default_value.clone(),
                        description: v.description.clone(),
                    }
                }).collect(),
            }
        }).collect(),
        characters: graph.characters.iter().map(|c| {
            ExportCharacter {
                id: c.id.clone(),
                technical_name: c.technical_name.clone(),
                display_name: c.display_name.clone(),
                color: c.color.clone(),
            }
        }).collect(),
        packages: vec![ExportPackage {
            name: "Main".to_string(),
            is_default_package: true,
            objects: graph.nodes.iter().map(|n| {
                ExportObject {
                    id: n.id.clone(),
                    technical_name: n.technical_name.clone(),
                    object_type: map_node_type_to_articy(n.node_type),
                    position: n.position,
                    properties: serde_json::to_value(&n.data).unwrap_or(serde_json::Value::Null),
                    input_pins: n.input_ports.iter().map(|p| {
                        ExportPin {
                            id: p.id.clone(),
                            index: p.index,
                            label: p.label.clone(),
                        }
                    }).collect(),
                    output_pins: n.output_ports.iter().map(|p| {
                        ExportPin {
                            id: p.id.clone(),
                            index: p.index,
                            label: p.label.clone(),
                        }
                    }).collect(),
                }
            }).collect(),
            connections: graph.connections.iter().map(|c| {
                ExportConnection {
                    id: c.id.clone(),
                    source_id: c.from_node_id.clone(),
                    source_pin: c.from_port_index,
                    target_id: c.to_node_id.clone(),
                    target_pin: c.to_port_index,
                }
            }).collect(),
        }],
    };
    
    serde_json::to_string_pretty(&export)
        .map_err(|e| format!("Failed to serialize export: {}", e))
}

fn map_node_type_to_articy(node_type: NodeType) -> String {
    match node_type {
        NodeType::Dialogue => "Dialogue".to_string(),
        NodeType::DialogueFragment => "DialogueFragment".to_string(),
        NodeType::FlowFragment => "FlowFragment".to_string(),
        NodeType::Branch => "Hub".to_string(),
        NodeType::Condition => "Condition".to_string(),
        NodeType::Instruction => "Instruction".to_string(),
        NodeType::Hub => "Hub".to_string(),
        NodeType::Jump => "Jump".to_string(),
    }
}
