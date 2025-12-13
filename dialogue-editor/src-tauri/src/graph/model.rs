use std::collections::{HashMap, HashSet};
use chrono::Utc;
use crate::graph::{*, types::*};

impl DialogueGraph {
    /// Create a new empty dialogue graph
    pub fn new(name: &str) -> Self {
        let id = generate_id();
        let now = Utc::now().timestamp_millis();
        
        Self {
            id,
            name: name.to_string(),
            technical_name: to_technical_name(name),
            nodes: Vec::new(),
            connections: Vec::new(),
            variables: Vec::new(),
            characters: Vec::new(),
            created_at: now,
            modified_at: now,
            metadata: None,
        }
    }
    
    /// Mark the graph as modified
    pub fn touch(&mut self) {
        self.modified_at = Utc::now().timestamp_millis();
    }
    
    // ==================== NODE OPERATIONS ====================
    
    /// Get a node by ID
    pub fn get_node(&self, id: &str) -> Option<&Node> {
        self.nodes.iter().find(|n| n.id == id)
    }
    
    /// Get a mutable node by ID
    pub fn get_node_mut(&mut self, id: &str) -> Option<&mut Node> {
        self.nodes.iter_mut().find(|n| n.id == id)
    }
    
    /// Add a new node
    pub fn add_node(&mut self, node_type: NodeType, position: Position) -> &Node {
        let node = Node::new(node_type, position);
        self.nodes.push(node);
        self.touch();
        self.nodes.last().unwrap()
    }
    
    /// Remove a node and its connections
    pub fn remove_node(&mut self, id: &str) -> bool {
        let index = self.nodes.iter().position(|n| n.id == id);
        if let Some(idx) = index {
            // Remove connections to/from this node
            self.connections.retain(|c| c.from_node_id != id && c.to_node_id != id);
            self.nodes.remove(idx);
            self.touch();
            true
        } else {
            false
        }
    }
    
    // ==================== CONNECTION OPERATIONS ====================
    
    /// Check if a connection can be made
    pub fn can_connect(&self, from_node_id: &str, from_port_idx: usize, 
                       to_node_id: &str, to_port_idx: usize) -> bool {
        // Can't connect to self
        if from_node_id == to_node_id {
            return false;
        }
        
        // Check nodes exist
        let from_node = self.get_node(from_node_id);
        let to_node = self.get_node(to_node_id);
        
        if from_node.is_none() || to_node.is_none() {
            return false;
        }
        
        let from_node = from_node.unwrap();
        let to_node = to_node.unwrap();
        
        // Check port indices
        if from_port_idx >= from_node.output_ports.len() {
            return false;
        }
        if to_port_idx >= to_node.input_ports.len() {
            return false;
        }
        
        // Check if connection already exists
        let exists = self.connections.iter().any(|c| {
            c.from_node_id == from_node_id && c.from_port_index == from_port_idx &&
            c.to_node_id == to_node_id && c.to_port_index == to_port_idx
        });
        if exists {
            return false;
        }
        
        // Check if input port is already connected
        let input_taken = self.connections.iter().any(|c| {
            c.to_node_id == to_node_id && c.to_port_index == to_port_idx
        });
        if input_taken {
            return false;
        }
        
        true
    }
    
    /// Add a connection
    pub fn add_connection(&mut self, from_node_id: &str, from_port_idx: usize,
                          to_node_id: &str, to_port_idx: usize) -> Option<&Connection> {
        if !self.can_connect(from_node_id, from_port_idx, to_node_id, to_port_idx) {
            return None;
        }
        
        let connection = Connection {
            id: generate_id(),
            from_node_id: from_node_id.to_string(),
            from_port_index: from_port_idx,
            to_node_id: to_node_id.to_string(),
            to_port_index: to_port_idx,
            connection_type: ConnectionType::Flow,
            label: None,
        };
        
        self.connections.push(connection);
        self.touch();
        self.connections.last()
    }
    
    /// Remove a connection
    pub fn remove_connection(&mut self, id: &str) -> bool {
        let index = self.connections.iter().position(|c| c.id == id);
        if let Some(idx) = index {
            self.connections.remove(idx);
            self.touch();
            true
        } else {
            false
        }
    }
    
    // ==================== CHARACTERS ====================
    
    /// Add a character
    pub fn add_character(&mut self, display_name: &str, color: &str) -> &Character {
        let character = Character {
            id: generate_id(),
            articy_id: ArticyId::new(),
            technical_name: to_technical_name(display_name),
            display_name: display_name.to_string(),
            color: color.to_string(),
            preview_image: None,
        };
        
        self.characters.push(character);
        self.touch();
        self.characters.last().unwrap()
    }
    
    /// Get a character by ID
    pub fn get_character(&self, id: &str) -> Option<&Character> {
        self.characters.iter().find(|c| c.id == id)
    }
    
    // ==================== VARIABLES ====================
    
    /// Add a variable namespace
    pub fn add_variable_namespace(&mut self, name: &str) -> &VariableNamespace {
        let namespace = VariableNamespace {
            name: name.to_string(),
            description: None,
            variables: Vec::new(),
        };
        
        self.variables.push(namespace);
        self.touch();
        self.variables.last().unwrap()
    }
    
    /// Get a variable namespace by name
    pub fn get_variable_namespace(&mut self, name: &str) -> Option<&mut VariableNamespace> {
        self.variables.iter_mut().find(|ns| ns.name == name)
    }
}

impl Node {
    /// Create a new node with default configuration
    pub fn new(node_type: NodeType, position: Position) -> Self {
        let id = generate_id();
        let technical_name = format!("{}_{}", 
            node_type.display_name().replace(" ", "_").to_lowercase(),
            &id[..8]
        );
        
        let (size, data) = match node_type {
            NodeType::Dialogue => (
                Size { width: 280.0, height: 120.0 },
                NodeData::Dialogue(DialogueData::default())
            ),
            NodeType::DialogueFragment => (
                Size { width: 260.0, height: 100.0 },
                NodeData::DialogueFragment(DialogueData::default())
            ),
            NodeType::Branch => (
                Size { width: 160.0, height: 80.0 },
                NodeData::Branch
            ),
            NodeType::Condition => (
                Size { width: 200.0, height: 80.0 },
                NodeData::Condition { script: ScriptFragment { expression: String::new(), is_condition: true } }
            ),
            NodeType::Instruction => (
                Size { width: 200.0, height: 70.0 },
                NodeData::Instruction { script: ScriptFragment { expression: String::new(), is_condition: false } }
            ),
            NodeType::Hub => (
                Size { width: 140.0, height: 60.0 },
                NodeData::Hub(HubData::default())
            ),
            NodeType::Jump => (
                Size { width: 160.0, height: 60.0 },
                NodeData::Jump(JumpData::default())
            ),
            NodeType::FlowFragment => (
                Size { width: 300.0, height: 140.0 },
                NodeData::FlowFragment(FlowFragmentData::default())
            ),
        };
        
        let min_inputs = match node_type {
            NodeType::Hub => 1,
            _ => 1,
        };
        
        let min_outputs = match node_type {
            NodeType::Jump => 0,
            NodeType::Branch | NodeType::Condition => 2,
            _ => 1,
        };
        
        let mut input_ports = Vec::new();
        for i in 0..min_inputs {
            input_ports.push(Port {
                id: generate_id(),
                node_id: id.clone(),
                port_type: PortType::Input,
                index: i,
                label: None,
            });
        }
        
        let mut output_ports = Vec::new();
        for i in 0..min_outputs {
            output_ports.push(Port {
                id: generate_id(),
                node_id: id.clone(),
                port_type: PortType::Output,
                index: i,
                label: if node_type == NodeType::Condition {
                    Some(if i == 0 { "True".to_string() } else { "False".to_string() })
                } else {
                    None
                },
            });
        }
        
        Self {
            id,
            technical_name,
            node_type,
            position,
            size,
            input_ports,
            output_ports,
            data,
            color: Some(node_type.default_color().to_string()),
            parent_id: None,
            metadata: None,
        }
    }
    
    /// Add an output port
    pub fn add_output_port(&mut self, label: Option<String>) -> &Port {
        let port = Port {
            id: generate_id(),
            node_id: self.id.clone(),
            port_type: PortType::Output,
            index: self.output_ports.len(),
            label,
        };
        self.output_ports.push(port);
        self.output_ports.last().unwrap()
    }
    
    /// Add an input port
    pub fn add_input_port(&mut self, label: Option<String>) -> &Port {
        let port = Port {
            id: generate_id(),
            node_id: self.id.clone(),
            port_type: PortType::Input,
            index: self.input_ports.len(),
            label,
        };
        self.input_ports.push(port);
        self.input_ports.last().unwrap()
    }
}

impl VariableNamespace {
    /// Add a variable to the namespace
    pub fn add_variable(&mut self, name: &str, var_type: VariableType, default_value: serde_json::Value) -> &Variable {
        let variable = Variable {
            id: generate_id(),
            namespace: self.name.clone(),
            name: name.to_string(),
            variable_type: var_type,
            default_value,
            description: None,
        };
        self.variables.push(variable);
        self.variables.last().unwrap()
    }
}
