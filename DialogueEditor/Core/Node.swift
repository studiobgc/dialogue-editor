import Foundation
import simd

// MARK: - Node Types

enum NodeType: String, Codable, CaseIterable {
    case dialogue
    case dialogueFragment
    case branch
    case condition
    case instruction
    case hub
    case jump
    
    var displayName: String {
        switch self {
        case .dialogue: return "Dialogue"
        case .dialogueFragment: return "Fragment"
        case .branch: return "Branch"
        case .condition: return "Condition"
        case .instruction: return "Instruction"
        case .hub: return "Hub"
        case .jump: return "Jump"
        }
    }
    
    var color: SIMD4<Float> {
        switch self {
        case .dialogue, .dialogueFragment: return Theme.nodeDialogue.simd
        case .branch: return Theme.nodeBranch.simd
        case .condition: return Theme.nodeCondition.simd
        case .instruction: return Theme.nodeInstruction.simd
        case .hub: return Theme.nodeHub.simd
        case .jump: return Theme.nodeJump.simd
        }
    }
    
    var icon: String {
        switch self {
        case .dialogue: return "D"
        case .dialogueFragment: return "F"
        case .branch: return "B"
        case .condition: return "?"
        case .instruction: return "!"
        case .hub: return "H"
        case .jump: return "J"
        }
    }
}

// MARK: - Port

struct Port: Identifiable, Codable {
    let id: UUID
    var label: String
    var index: Int
    
    init(label: String = "", index: Int = 0) {
        self.id = UUID()
        self.label = label
        self.index = index
    }
}

// MARK: - Node Data

protocol NodeData: Codable {
    var type: NodeType { get }
}

struct DialogueData: NodeData, Codable {
    let type: NodeType = .dialogue
    var speaker: String
    var text: String
    var menuText: String
    var stageDirections: String
    
    init(speaker: String = "", text: String = "", menuText: String = "", stageDirections: String = "") {
        self.speaker = speaker
        self.text = text
        self.menuText = menuText
        self.stageDirections = stageDirections
    }
}

struct BranchData: NodeData, Codable {
    let type: NodeType = .branch
    var label: String
    
    init(label: String = "Choice") {
        self.label = label
    }
}

struct ConditionData: NodeData, Codable {
    let type: NodeType = .condition
    var expression: String
    
    init(expression: String = "") {
        self.expression = expression
    }
}

struct InstructionData: NodeData, Codable {
    let type: NodeType = .instruction
    var script: String
    
    init(script: String = "") {
        self.script = script
    }
}

struct HubData: NodeData, Codable {
    let type: NodeType = .hub
    var label: String
    
    init(label: String = "Hub") {
        self.label = label
    }
}

struct JumpData: NodeData, Codable {
    let type: NodeType = .jump
    var targetId: UUID?
    
    init(targetId: UUID? = nil) {
        self.targetId = targetId
    }
}

// MARK: - Node

class Node: Identifiable, ObservableObject, Codable {
    let id: UUID
    var nodeType: NodeType
    var technicalName: String
    
    @Published var position: SIMD2<Float>
    @Published var size: SIMD2<Float>
    
    var inputPorts: [Port]
    var outputPorts: [Port]
    
    var dialogueData: DialogueData?
    var branchData: BranchData?
    var conditionData: ConditionData?
    var instructionData: InstructionData?
    var hubData: HubData?
    var jumpData: JumpData?
    
    // Rendering state (not persisted)
    var isSelected: Bool = false
    var isHovered: Bool = false
    var glowIntensity: Float = 0.0
    
    init(type: NodeType, position: SIMD2<Float> = .zero) {
        self.id = UUID()
        self.nodeType = type
        self.technicalName = "\(type.displayName)_\(UUID().uuidString.prefix(6))"
        self.position = position
        self.size = SIMD2<Float>(Float(Theme.nodeWidth), Float(Theme.nodeMinHeight))
        
        // Default ports
        self.inputPorts = [Port(label: "In", index: 0)]
        
        switch type {
        case .branch, .hub:
            self.outputPorts = [
                Port(label: "Option 1", index: 0),
                Port(label: "Option 2", index: 1)
            ]
        case .condition:
            self.outputPorts = [
                Port(label: "True", index: 0),
                Port(label: "False", index: 1)
            ]
        default:
            self.outputPorts = [Port(label: "Out", index: 0)]
        }
        
        // Initialize type-specific data
        switch type {
        case .dialogue, .dialogueFragment:
            self.dialogueData = DialogueData()
        case .branch:
            self.branchData = BranchData()
        case .condition:
            self.conditionData = ConditionData()
        case .instruction:
            self.instructionData = InstructionData()
        case .hub:
            self.hubData = HubData()
        case .jump:
            self.jumpData = JumpData()
        }
    }
    
    // MARK: - Codable
    
    enum CodingKeys: String, CodingKey {
        case id, nodeType, technicalName, position, size
        case inputPorts, outputPorts
        case dialogueData, branchData, conditionData, instructionData, hubData, jumpData
    }
    
    required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        nodeType = try container.decode(NodeType.self, forKey: .nodeType)
        technicalName = try container.decode(String.self, forKey: .technicalName)
        
        let posArray = try container.decode([Float].self, forKey: .position)
        position = SIMD2<Float>(posArray[0], posArray[1])
        
        let sizeArray = try container.decode([Float].self, forKey: .size)
        size = SIMD2<Float>(sizeArray[0], sizeArray[1])
        
        inputPorts = try container.decode([Port].self, forKey: .inputPorts)
        outputPorts = try container.decode([Port].self, forKey: .outputPorts)
        
        dialogueData = try container.decodeIfPresent(DialogueData.self, forKey: .dialogueData)
        branchData = try container.decodeIfPresent(BranchData.self, forKey: .branchData)
        conditionData = try container.decodeIfPresent(ConditionData.self, forKey: .conditionData)
        instructionData = try container.decodeIfPresent(InstructionData.self, forKey: .instructionData)
        hubData = try container.decodeIfPresent(HubData.self, forKey: .hubData)
        jumpData = try container.decodeIfPresent(JumpData.self, forKey: .jumpData)
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(nodeType, forKey: .nodeType)
        try container.encode(technicalName, forKey: .technicalName)
        try container.encode([position.x, position.y], forKey: .position)
        try container.encode([size.x, size.y], forKey: .size)
        try container.encode(inputPorts, forKey: .inputPorts)
        try container.encode(outputPorts, forKey: .outputPorts)
        try container.encodeIfPresent(dialogueData, forKey: .dialogueData)
        try container.encodeIfPresent(branchData, forKey: .branchData)
        try container.encodeIfPresent(conditionData, forKey: .conditionData)
        try container.encodeIfPresent(instructionData, forKey: .instructionData)
        try container.encodeIfPresent(hubData, forKey: .hubData)
        try container.encodeIfPresent(jumpData, forKey: .jumpData)
    }
    
    // MARK: - Port Positions
    
    func inputPortPosition(at index: Int) -> SIMD2<Float> {
        let spacing = size.y / Float(inputPorts.count + 1)
        return SIMD2<Float>(position.x, position.y + spacing * Float(index + 1))
    }
    
    func outputPortPosition(at index: Int) -> SIMD2<Float> {
        let spacing = size.y / Float(outputPorts.count + 1)
        return SIMD2<Float>(position.x + size.x, position.y + spacing * Float(index + 1))
    }
    
    // MARK: - Display Text
    
    var displayText: String {
        switch nodeType {
        case .dialogue, .dialogueFragment:
            return dialogueData?.text.isEmpty == false ? dialogueData!.text : technicalName
        case .branch:
            return branchData?.label ?? "Branch"
        case .condition:
            return conditionData?.expression.isEmpty == false ? conditionData!.expression : "Condition"
        case .instruction:
            return instructionData?.script.isEmpty == false ? instructionData!.script : "Instruction"
        case .hub:
            return hubData?.label ?? "Hub"
        case .jump:
            return "Jump"
        }
    }
}

// MARK: - Connection

struct Connection: Identifiable, Codable {
    let id: UUID
    var fromNodeId: UUID
    var fromPortIndex: Int
    var toNodeId: UUID
    var toPortIndex: Int
    
    init(from fromNodeId: UUID, fromPort: Int, to toNodeId: UUID, toPort: Int) {
        self.id = UUID()
        self.fromNodeId = fromNodeId
        self.fromPortIndex = fromPort
        self.toNodeId = toNodeId
        self.toPortIndex = toPort
    }
}

// MARK: - Character

struct Character: Identifiable, Codable {
    let id: UUID
    var displayName: String
    var color: String // Hex color
    
    init(name: String, color: String = "#4A90E2") {
        self.id = UUID()
        self.displayName = name
        self.color = color
    }
}
