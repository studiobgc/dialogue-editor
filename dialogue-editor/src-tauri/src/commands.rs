use std::sync::Mutex;
use tauri::State;
use crate::graph::*;
use crate::validation;
use crate::export;

/// Application state holding the current graph
pub struct AppState {
    pub graph: Mutex<DialogueGraph>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            graph: Mutex::new(DialogueGraph::new("Untitled")),
        }
    }
}

// ==================== GRAPH OPERATIONS ====================

#[tauri::command]
pub fn new_graph(name: String, state: State<AppState>) -> Result<DialogueGraph, String> {
    let mut graph = state.graph.lock().map_err(|e| e.to_string())?;
    *graph = DialogueGraph::new(&name);
    Ok(graph.clone())
}

#[tauri::command]
pub fn load_graph(json: String, state: State<AppState>) -> Result<DialogueGraph, String> {
    let new_graph: DialogueGraph = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse graph: {}", e))?;
    
    let mut graph = state.graph.lock().map_err(|e| e.to_string())?;
    *graph = new_graph;
    Ok(graph.clone())
}

#[tauri::command]
pub fn save_graph(state: State<AppState>) -> Result<String, String> {
    let graph = state.graph.lock().map_err(|e| e.to_string())?;
    serde_json::to_string_pretty(&*graph)
        .map_err(|e| format!("Failed to serialize graph: {}", e))
}

#[tauri::command]
pub fn get_graph(state: State<AppState>) -> Result<DialogueGraph, String> {
    let graph = state.graph.lock().map_err(|e| e.to_string())?;
    Ok(graph.clone())
}

// ==================== NODE OPERATIONS ====================

#[tauri::command]
pub fn add_node(
    node_type: NodeType,
    x: f64,
    y: f64,
    state: State<AppState>
) -> Result<Node, String> {
    let mut graph = state.graph.lock().map_err(|e| e.to_string())?;
    let node = graph.add_node(node_type, Position { x, y });
    Ok(node.clone())
}

#[tauri::command]
pub fn remove_node(id: String, state: State<AppState>) -> Result<bool, String> {
    let mut graph = state.graph.lock().map_err(|e| e.to_string())?;
    Ok(graph.remove_node(&id))
}

#[tauri::command]
pub fn update_node(id: String, updates: serde_json::Value, state: State<AppState>) -> Result<Option<Node>, String> {
    let mut graph = state.graph.lock().map_err(|e| e.to_string())?;
    
    if let Some(node) = graph.get_node_mut(&id) {
        // Apply updates from JSON
        if let Some(pos) = updates.get("position") {
            if let (Some(x), Some(y)) = (pos.get("x").and_then(|v| v.as_f64()), pos.get("y").and_then(|v| v.as_f64())) {
                node.position = Position { x, y };
            }
        }
        
        if let Some(name) = updates.get("technicalName").and_then(|v| v.as_str()) {
            node.technical_name = name.to_string();
        }
        
        if let Some(color) = updates.get("color").and_then(|v| v.as_str()) {
            node.color = Some(color.to_string());
        }
        
        if let Some(data) = updates.get("data") {
            if let Ok(new_data) = serde_json::from_value(data.clone()) {
                node.data = new_data;
            }
        }
        
        graph.touch();
        Ok(Some(node.clone()))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn clone_node(id: String, offset_x: f64, offset_y: f64, state: State<AppState>) -> Result<Option<Node>, String> {
    let mut graph = state.graph.lock().map_err(|e| e.to_string())?;
    
    // Clone the node data
    if let Some(original) = graph.get_node(&id).cloned() {
        let mut cloned = original;
        cloned.id = generate_id();
        cloned.technical_name = format!("{}_copy", cloned.technical_name);
        cloned.position.x += offset_x;
        cloned.position.y += offset_y;
        
        // Generate new port IDs
        for port in &mut cloned.input_ports {
            port.id = generate_id();
            port.node_id = cloned.id.clone();
        }
        for port in &mut cloned.output_ports {
            port.id = generate_id();
            port.node_id = cloned.id.clone();
        }
        
        graph.nodes.push(cloned.clone());
        graph.touch();
        
        Ok(Some(cloned))
    } else {
        Ok(None)
    }
}

// ==================== CONNECTION OPERATIONS ====================

#[tauri::command]
pub fn add_connection(
    from_node_id: String,
    from_port_index: usize,
    to_node_id: String,
    to_port_index: usize,
    state: State<AppState>
) -> Result<Option<Connection>, String> {
    let mut graph = state.graph.lock().map_err(|e| e.to_string())?;
    
    if let Some(conn) = graph.add_connection(&from_node_id, from_port_index, &to_node_id, to_port_index) {
        Ok(Some(conn.clone()))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn remove_connection(id: String, state: State<AppState>) -> Result<bool, String> {
    let mut graph = state.graph.lock().map_err(|e| e.to_string())?;
    Ok(graph.remove_connection(&id))
}

// ==================== VALIDATION ====================

#[tauri::command]
pub fn validate_graph(state: State<AppState>) -> Result<ValidationReport, String> {
    let graph = state.graph.lock().map_err(|e| e.to_string())?;
    Ok(validation::validate(&graph))
}

// ==================== EXPORT ====================

#[tauri::command]
pub fn export_for_unreal(state: State<AppState>) -> Result<String, String> {
    let graph = state.graph.lock().map_err(|e| e.to_string())?;
    export::export_for_unreal(&graph)
}

#[tauri::command]
pub fn export_json(pretty: bool, state: State<AppState>) -> Result<String, String> {
    let graph = state.graph.lock().map_err(|e| e.to_string())?;
    
    if pretty {
        serde_json::to_string_pretty(&*graph)
    } else {
        serde_json::to_string(&*graph)
    }.map_err(|e| e.to_string())
}

// ==================== VARIABLES ====================

#[tauri::command]
pub fn add_variable_namespace(name: String, state: State<AppState>) -> Result<VariableNamespace, String> {
    let mut graph = state.graph.lock().map_err(|e| e.to_string())?;
    let ns = graph.add_variable_namespace(&name);
    Ok(ns.clone())
}

#[tauri::command]
pub fn add_variable(
    namespace: String,
    name: String,
    var_type: VariableType,
    default_value: serde_json::Value,
    state: State<AppState>
) -> Result<Option<Variable>, String> {
    let mut graph = state.graph.lock().map_err(|e| e.to_string())?;
    
    if let Some(ns) = graph.get_variable_namespace(&namespace) {
        let var = ns.add_variable(&name, var_type, default_value);
        Ok(Some(var.clone()))
    } else {
        Ok(None)
    }
}

// ==================== CHARACTERS ====================

#[tauri::command]
pub fn add_character(display_name: String, color: String, state: State<AppState>) -> Result<Character, String> {
    let mut graph = state.graph.lock().map_err(|e| e.to_string())?;
    let character = graph.add_character(&display_name, &color);
    Ok(character.clone())
}

#[tauri::command]
pub fn update_character(id: String, updates: serde_json::Value, state: State<AppState>) -> Result<Option<Character>, String> {
    let mut graph = state.graph.lock().map_err(|e| e.to_string())?;
    
    if let Some(idx) = graph.characters.iter().position(|c| c.id == id) {
        let character = &mut graph.characters[idx];
        
        if let Some(name) = updates.get("displayName").and_then(|v| v.as_str()) {
            character.display_name = name.to_string();
            character.technical_name = to_technical_name(name);
        }
        
        if let Some(color) = updates.get("color").and_then(|v| v.as_str()) {
            character.color = color.to_string();
        }
        
        graph.touch();
        Ok(Some(character.clone()))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn remove_character(id: String, state: State<AppState>) -> Result<bool, String> {
    let mut graph = state.graph.lock().map_err(|e| e.to_string())?;
    
    if let Some(idx) = graph.characters.iter().position(|c| c.id == id) {
        graph.characters.remove(idx);
        graph.touch();
        Ok(true)
    } else {
        Ok(false)
    }
}
