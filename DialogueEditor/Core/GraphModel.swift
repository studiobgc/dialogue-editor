import Foundation
import Combine

/// Observable graph model for dialogue trees
class GraphModel: ObservableObject {
    
    @Published private(set) var nodes: [Node] = []
    @Published private(set) var connections: [Connection] = []
    @Published private(set) var characters: [Character] = []
    
    @Published var name: String = "Untitled"
    @Published var selectedNodeIds: Set<UUID> = []
    @Published var selectedConnectionId: UUID?
    
    private var undoStack: [GraphState] = []
    private var redoStack: [GraphState] = []
    private let maxUndoLevels = 50
    
    init() {
        // Add default characters
        characters = [
            Character(name: "Player", color: "#4A90E2"),
            Character(name: "NPC", color: "#E74C3C")
        ]
    }
    
    // MARK: - State Management
    
    private struct GraphState: Codable {
        let nodes: [Node]
        let connections: [Connection]
    }
    
    private func saveState() {
        let state = GraphState(nodes: nodes, connections: connections)
        undoStack.append(state)
        if undoStack.count > maxUndoLevels {
            undoStack.removeFirst()
        }
        redoStack.removeAll()
    }
    
    func undo() {
        guard let state = undoStack.popLast() else { return }
        
        let currentState = GraphState(nodes: nodes, connections: connections)
        redoStack.append(currentState)
        
        nodes = state.nodes
        connections = state.connections
    }
    
    func redo() {
        guard let state = redoStack.popLast() else { return }
        
        let currentState = GraphState(nodes: nodes, connections: connections)
        undoStack.append(currentState)
        
        nodes = state.nodes
        connections = state.connections
    }
    
    // MARK: - Node Operations
    
    @discardableResult
    func addNode(type: NodeType, at position: SIMD2<Float>) -> Node {
        saveState()
        let node = Node(type: type, position: position)
        nodes.append(node)
        return node
    }
    
    func removeNode(id: UUID) {
        saveState()
        // Remove connections involving this node
        connections.removeAll { $0.fromNodeId == id || $0.toNodeId == id }
        nodes.removeAll { $0.id == id }
        selectedNodeIds.remove(id)
    }
    
    func removeSelectedNodes() {
        saveState()
        for id in selectedNodeIds {
            connections.removeAll { $0.fromNodeId == id || $0.toNodeId == id }
            nodes.removeAll { $0.id == id }
        }
        selectedNodeIds.removeAll()
    }
    
    func updateNodePosition(id: UUID, position: SIMD2<Float>) {
        if let node = nodes.first(where: { $0.id == id }) {
            node.position = position
        }
    }
    
    func getNode(id: UUID) -> Node? {
        return nodes.first { $0.id == id }
    }
    
    // MARK: - Connection Operations
    
    @discardableResult
    func addConnection(from fromNodeId: UUID, fromPort: Int, to toNodeId: UUID, toPort: Int) -> Connection? {
        // Validate connection
        guard fromNodeId != toNodeId else { return nil }
        guard nodes.contains(where: { $0.id == fromNodeId }) else { return nil }
        guard nodes.contains(where: { $0.id == toNodeId }) else { return nil }
        
        // Check if connection already exists
        if connections.contains(where: {
            $0.fromNodeId == fromNodeId && $0.fromPortIndex == fromPort &&
            $0.toNodeId == toNodeId && $0.toPortIndex == toPort
        }) {
            return nil
        }
        
        saveState()
        let connection = Connection(from: fromNodeId, fromPort: fromPort, to: toNodeId, toPort: toPort)
        connections.append(connection)
        return connection
    }
    
    func removeConnection(id: UUID) {
        saveState()
        connections.removeAll { $0.id == id }
        if selectedConnectionId == id {
            selectedConnectionId = nil
        }
    }
    
    // MARK: - Selection
    
    func selectNode(id: UUID, additive: Bool = false) {
        if additive {
            if selectedNodeIds.contains(id) {
                selectedNodeIds.remove(id)
            } else {
                selectedNodeIds.insert(id)
            }
        } else {
            selectedNodeIds = [id]
        }
        selectedConnectionId = nil
        updateNodeSelectionState()
    }
    
    func selectNodes(ids: Set<UUID>) {
        selectedNodeIds = ids
        selectedConnectionId = nil
        updateNodeSelectionState()
    }
    
    func clearSelection() {
        selectedNodeIds.removeAll()
        selectedConnectionId = nil
        updateNodeSelectionState()
    }
    
    private func updateNodeSelectionState() {
        for node in nodes {
            node.isSelected = selectedNodeIds.contains(node.id)
        }
    }
    
    // MARK: - Character Operations
    
    @discardableResult
    func addCharacter(name: String, color: String = "#4A90E2") -> Character {
        let character = Character(name: name, color: color)
        characters.append(character)
        return character
    }
    
    func removeCharacter(id: UUID) {
        characters.removeAll { $0.id == id }
    }
    
    // MARK: - Hit Testing
    
    func hitTestNode(at position: SIMD2<Float>) -> Node? {
        // Test in reverse order (top-most first)
        for node in nodes.reversed() {
            if position.x >= node.position.x &&
               position.x <= node.position.x + node.size.x &&
               position.y >= node.position.y &&
               position.y <= node.position.y + node.size.y {
                return node
            }
        }
        return nil
    }
    
    func hitTestPort(at position: SIMD2<Float>, radius: Float = 12) -> (node: Node, portType: PortType, index: Int)? {
        for node in nodes {
            // Check input ports
            for (index, _) in node.inputPorts.enumerated() {
                let portPos = node.inputPortPosition(at: index)
                let dx = position.x - portPos.x
                let dy = position.y - portPos.y
                if dx * dx + dy * dy <= radius * radius {
                    return (node, .input, index)
                }
            }
            
            // Check output ports
            for (index, _) in node.outputPorts.enumerated() {
                let portPos = node.outputPortPosition(at: index)
                let dx = position.x - portPos.x
                let dy = position.y - portPos.y
                if dx * dx + dy * dy <= radius * radius {
                    return (node, .output, index)
                }
            }
        }
        return nil
    }
    
    func nodesInRect(min: SIMD2<Float>, max: SIMD2<Float>) -> [Node] {
        return nodes.filter { node in
            let nodeMax = node.position + node.size
            return !(node.position.x > max.x || nodeMax.x < min.x ||
                    node.position.y > max.y || nodeMax.y < min.y)
        }
    }
    
    // MARK: - Serialization
    
    struct GraphData: Codable {
        let name: String
        let nodes: [Node]
        let connections: [Connection]
        let characters: [Character]
    }
    
    func toJSON() -> String? {
        let data = GraphData(name: name, nodes: nodes, connections: connections, characters: characters)
        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted
        
        guard let jsonData = try? encoder.encode(data) else { return nil }
        return String(data: jsonData, encoding: .utf8)
    }
    
    static func fromJSON(_ json: String) -> GraphModel? {
        guard let data = json.data(using: .utf8) else { return nil }
        
        let decoder = JSONDecoder()
        guard let graphData = try? decoder.decode(GraphData.self, from: data) else { return nil }
        
        let model = GraphModel()
        model.name = graphData.name
        model.nodes = graphData.nodes
        model.connections = graphData.connections
        model.characters = graphData.characters
        
        return model
    }
}

enum PortType {
    case input
    case output
}
