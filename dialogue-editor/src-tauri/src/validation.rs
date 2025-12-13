use std::collections::{HashMap, HashSet};
use crate::graph::*;

/// Validate a dialogue graph
pub fn validate(graph: &DialogueGraph) -> ValidationReport {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();
    
    // Build node lookup
    let node_map: HashMap<&str, &Node> = graph.nodes.iter()
        .map(|n| (n.id.as_str(), n))
        .collect();
    
    // Check for orphaned nodes
    if graph.nodes.len() > 1 {
        let connected_ids: HashSet<&str> = graph.connections.iter()
            .flat_map(|c| vec![c.from_node_id.as_str(), c.to_node_id.as_str()])
            .collect();
        
        for node in &graph.nodes {
            if !connected_ids.contains(node.id.as_str()) {
                warnings.push(ValidationError {
                    node_id: Some(node.id.clone()),
                    connection_id: None,
                    severity: ValidationSeverity::Warning,
                    message: format!("Node '{}' is not connected to any other nodes", node.technical_name),
                    code: "ORPHANED_NODE".to_string(),
                });
            }
        }
    }
    
    // Check dialogue nodes
    for node in &graph.nodes {
        match &node.data {
            NodeData::Dialogue(data) | NodeData::DialogueFragment(data) => {
                if data.speaker.is_none() && data.text.is_empty() {
                    warnings.push(ValidationError {
                        node_id: Some(node.id.clone()),
                        connection_id: None,
                        severity: ValidationSeverity::Warning,
                        message: format!("Dialogue node '{}' has no speaker or text", node.technical_name),
                        code: "EMPTY_DIALOGUE".to_string(),
                    });
                }
            }
            NodeData::Jump(data) => {
                if let Some(target_id) = &data.target_node_id {
                    if !node_map.contains_key(target_id.as_str()) {
                        errors.push(ValidationError {
                            node_id: Some(node.id.clone()),
                            connection_id: None,
                            severity: ValidationSeverity::Error,
                            message: format!("Jump node '{}' references non-existent target", node.technical_name),
                            code: "INVALID_JUMP_TARGET".to_string(),
                        });
                    }
                } else {
                    warnings.push(ValidationError {
                        node_id: Some(node.id.clone()),
                        connection_id: None,
                        severity: ValidationSeverity::Warning,
                        message: format!("Jump node '{}' has no target set", node.technical_name),
                        code: "MISSING_JUMP_TARGET".to_string(),
                    });
                }
            }
            NodeData::Condition { script } => {
                if script.expression.trim().is_empty() {
                    warnings.push(ValidationError {
                        node_id: Some(node.id.clone()),
                        connection_id: None,
                        severity: ValidationSeverity::Warning,
                        message: format!("Condition node '{}' has empty expression", node.technical_name),
                        code: "EMPTY_CONDITION".to_string(),
                    });
                }
            }
            NodeData::Instruction { script } => {
                if script.expression.trim().is_empty() {
                    warnings.push(ValidationError {
                        node_id: Some(node.id.clone()),
                        connection_id: None,
                        severity: ValidationSeverity::Warning,
                        message: format!("Instruction node '{}' has empty script", node.technical_name),
                        code: "EMPTY_INSTRUCTION".to_string(),
                    });
                }
            }
            _ => {}
        }
    }
    
    // Check for cycles
    let cycle_nodes = detect_cycles(graph);
    for node_id in cycle_nodes {
        if let Some(node) = node_map.get(node_id.as_str()) {
            warnings.push(ValidationError {
                node_id: Some(node_id),
                connection_id: None,
                severity: ValidationSeverity::Warning,
                message: format!("Node '{}' is part of a cycle - may cause infinite loops", node.technical_name),
                code: "CYCLE_DETECTED".to_string(),
            });
        }
    }
    
    // Validate connections reference valid nodes
    for conn in &graph.connections {
        if !node_map.contains_key(conn.from_node_id.as_str()) {
            errors.push(ValidationError {
                node_id: None,
                connection_id: Some(conn.id.clone()),
                severity: ValidationSeverity::Error,
                message: format!("Connection references non-existent source node '{}'", conn.from_node_id),
                code: "INVALID_CONNECTION_SOURCE".to_string(),
            });
        }
        
        if !node_map.contains_key(conn.to_node_id.as_str()) {
            errors.push(ValidationError {
                node_id: None,
                connection_id: Some(conn.id.clone()),
                severity: ValidationSeverity::Error,
                message: format!("Connection references non-existent target node '{}'", conn.to_node_id),
                code: "INVALID_CONNECTION_TARGET".to_string(),
            });
        }
    }
    
    ValidationReport {
        is_valid: errors.is_empty(),
        errors,
        warnings,
    }
}

/// Detect cycles in the graph using DFS
fn detect_cycles(graph: &DialogueGraph) -> HashSet<String> {
    let mut cycle_nodes = HashSet::new();
    let mut visited = HashSet::new();
    let mut recursion_stack = HashSet::new();
    
    // Build adjacency list
    let mut adjacency: HashMap<&str, Vec<&str>> = HashMap::new();
    for node in &graph.nodes {
        adjacency.insert(&node.id, Vec::new());
    }
    for conn in &graph.connections {
        if let Some(list) = adjacency.get_mut(conn.from_node_id.as_str()) {
            list.push(&conn.to_node_id);
        }
    }
    
    fn dfs<'a>(
        node_id: &'a str,
        adjacency: &HashMap<&'a str, Vec<&'a str>>,
        visited: &mut HashSet<&'a str>,
        recursion_stack: &mut HashSet<&'a str>,
        cycle_nodes: &mut HashSet<String>,
    ) -> bool {
        visited.insert(node_id);
        recursion_stack.insert(node_id);
        
        if let Some(neighbors) = adjacency.get(node_id) {
            for &neighbor in neighbors {
                if !visited.contains(neighbor) {
                    if dfs(neighbor, adjacency, visited, recursion_stack, cycle_nodes) {
                        cycle_nodes.insert(node_id.to_string());
                        return true;
                    }
                } else if recursion_stack.contains(neighbor) {
                    cycle_nodes.insert(node_id.to_string());
                    cycle_nodes.insert(neighbor.to_string());
                    return true;
                }
            }
        }
        
        recursion_stack.remove(node_id);
        false
    }
    
    for node in &graph.nodes {
        if !visited.contains(node.id.as_str()) {
            dfs(&node.id, &adjacency, &mut visited, &mut recursion_stack, &mut cycle_nodes);
        }
    }
    
    cycle_nodes
}
