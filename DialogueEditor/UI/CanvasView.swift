import Cocoa
import MetalKit

/// Metal-backed canvas view for the dialogue graph
/// Handles all mouse/trackpad input for pan, zoom, selection, and node manipulation
class CanvasView: NSView {
    
    // MARK: - Properties
    
    private var mtkView: MTKView!
    private var renderer: MetalRenderer!
    
    var model: GraphModel? {
        didSet {
            renderer?.model = model
        }
    }
    
    // Interaction state
    private enum DragMode {
        case none
        case pan
        case node
        case selection
        case connection
    }
    
    private var dragMode: DragMode = .none
    private var dragStart: SIMD2<Float> = .zero
    private var dragStartWorld: SIMD2<Float> = .zero
    private var nodeStartPositions: [UUID: SIMD2<Float>] = [:]
    private var connectionSource: (nodeId: UUID, portType: PortType, index: Int)?
    
    // Double-click detection
    private var lastClickTime: TimeInterval = 0
    private var lastClickNodeId: UUID?
    
    // Callbacks
    var onNodeSelected: ((UUID?) -> Void)?
    var onNodeDoubleClick: ((UUID) -> Void)?
    var onConnectionCreated: ((UUID, Int, UUID, Int) -> Void)?
    
    // MARK: - Initialization
    
    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setupMetal()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupMetal()
    }
    
    private func setupMetal() {
        // Create Metal view
        mtkView = MTKView(frame: bounds)
        mtkView.autoresizingMask = [.width, .height]
        addSubview(mtkView)
        
        // Create renderer
        renderer = MetalRenderer(mtkView: mtkView)
        
        // Setup tracking area for mouse events
        let trackingArea = NSTrackingArea(
            rect: bounds,
            options: [.activeInKeyWindow, .mouseMoved, .mouseEnteredAndExited, .inVisibleRect],
            owner: self,
            userInfo: nil
        )
        addTrackingArea(trackingArea)
        
        // Accept first responder for keyboard events
        becomeFirstResponder()
    }
    
    override var acceptsFirstResponder: Bool { true }
    
    // MARK: - Coordinate Conversion
    
    private func screenToWorld(_ point: NSPoint) -> SIMD2<Float> {
        let flipped = NSPoint(x: point.x, y: bounds.height - point.y)
        return renderer.viewport.toWorldCoords(SIMD2<Float>(Float(flipped.x), Float(flipped.y)))
    }
    
    private func screenPos(from event: NSEvent) -> SIMD2<Float> {
        let point = convert(event.locationInWindow, from: nil)
        return SIMD2<Float>(Float(point.x), Float(bounds.height - point.y))
    }
    
    // MARK: - Mouse Events
    
    override func mouseDown(with event: NSEvent) {
        let screenPos = self.screenPos(from: event)
        let worldPos = renderer.viewport.toWorldCoords(screenPos)
        
        // Middle mouse or Cmd+click = pan
        if event.buttonNumber == 2 || event.modifierFlags.contains(.command) {
            startPan(screenPos: screenPos, worldPos: worldPos)
            return
        }
        
        // Check for port click (connection drag)
        if let hitPort = model?.hitTestPort(at: worldPos) {
            startConnectionDrag(node: hitPort.node, portType: hitPort.portType, index: hitPort.index, screenPos: screenPos, worldPos: worldPos)
            return
        }
        
        // Check for node click
        if let hitNode = model?.hitTestNode(at: worldPos) {
            handleNodeClick(node: hitNode, screenPos: screenPos, worldPos: worldPos, shiftKey: event.modifierFlags.contains(.shift))
            return
        }
        
        // Empty space click
        if event.modifierFlags.contains(.shift) {
            startSelectionBox(screenPos: screenPos, worldPos: worldPos)
        } else {
            model?.clearSelection()
            onNodeSelected?(nil)
            startPan(screenPos: screenPos, worldPos: worldPos)
        }
    }
    
    override func mouseDragged(with event: NSEvent) {
        let screenPos = self.screenPos(from: event)
        let worldPos = renderer.viewport.toWorldCoords(screenPos)
        
        switch dragMode {
        case .pan:
            handlePan(screenPos: screenPos)
        case .node:
            handleNodeDrag(worldPos: worldPos)
        case .selection:
            handleSelectionDrag(worldPos: worldPos)
        case .connection:
            handleConnectionDrag(worldPos: worldPos)
        case .none:
            break
        }
    }
    
    override func mouseUp(with event: NSEvent) {
        let screenPos = self.screenPos(from: event)
        let worldPos = renderer.viewport.toWorldCoords(screenPos)
        
        switch dragMode {
        case .selection:
            finishSelectionBox(worldPos: worldPos)
        case .connection:
            finishConnectionDrag(worldPos: worldPos)
        default:
            break
        }
        
        dragMode = .none
        renderer.selectionBox = nil
        renderer.connectionPreview = nil
        NSCursor.arrow.set()
    }
    
    override func mouseMoved(with event: NSEvent) {
        let worldPos = screenToWorld(convert(event.locationInWindow, from: nil))
        updateHoverState(worldPos: worldPos)
    }
    
    override func rightMouseDown(with event: NSEvent) {
        let worldPos = screenToWorld(convert(event.locationInWindow, from: nil))
        showContextMenu(at: event.locationInWindow, worldPos: worldPos)
    }
    
    // MARK: - Scroll/Zoom
    
    override func scrollWheel(with event: NSEvent) {
        let screenPos = self.screenPos(from: event)
        
        if event.modifierFlags.contains(.command) || event.momentumPhase == .began {
            // Zoom
            let zoomFactor: Float = event.scrollingDeltaY > 0 ? 1.1 : 0.9
            renderer.viewport.zoomBy(zoomFactor, around: screenPos)
        } else {
            // Pan
            let delta = SIMD2<Float>(Float(event.scrollingDeltaX), Float(-event.scrollingDeltaY))
            renderer.viewport.pan(delta: delta)
        }
    }
    
    override func magnify(with event: NSEvent) {
        let screenPos = self.screenPos(from: event)
        let zoomFactor = 1.0 + Float(event.magnification)
        renderer.viewport.zoomBy(zoomFactor, around: screenPos)
    }
    
    // MARK: - Drag Handlers
    
    private func startPan(screenPos: SIMD2<Float>, worldPos: SIMD2<Float>) {
        dragMode = .pan
        dragStart = screenPos
        NSCursor.closedHand.set()
    }
    
    private func handlePan(screenPos: SIMD2<Float>) {
        let delta = screenPos - dragStart
        renderer.viewport.pan(delta: delta)
        dragStart = screenPos
    }
    
    private func handleNodeClick(node: Node, screenPos: SIMD2<Float>, worldPos: SIMD2<Float>, shiftKey: Bool) {
        // Double-click detection
        let now = Date().timeIntervalSince1970
        if lastClickNodeId == node.id && now - lastClickTime < 0.3 {
            onNodeDoubleClick?(node.id)
            lastClickTime = 0
            return
        }
        lastClickTime = now
        lastClickNodeId = node.id
        
        // Selection
        if shiftKey {
            model?.selectNode(id: node.id, additive: true)
        } else if !(model?.selectedNodeIds.contains(node.id) ?? false) {
            model?.selectNode(id: node.id, additive: false)
        }
        
        onNodeSelected?(node.id)
        
        // Start node drag
        startNodeDrag(screenPos: screenPos, worldPos: worldPos)
    }
    
    private func startNodeDrag(screenPos: SIMD2<Float>, worldPos: SIMD2<Float>) {
        dragMode = .node
        dragStart = screenPos
        dragStartWorld = worldPos
        
        // Store starting positions of all selected nodes
        nodeStartPositions.removeAll()
        if let model = model {
            for nodeId in model.selectedNodeIds {
                if let node = model.getNode(id: nodeId) {
                    nodeStartPositions[nodeId] = node.position
                }
            }
        }
        
        NSCursor.closedHand.set()
    }
    
    private func handleNodeDrag(worldPos: SIMD2<Float>) {
        let delta = worldPos - dragStartWorld
        
        for (nodeId, startPos) in nodeStartPositions {
            model?.updateNodePosition(id: nodeId, position: startPos + delta)
        }
    }
    
    private func startSelectionBox(screenPos: SIMD2<Float>, worldPos: SIMD2<Float>) {
        dragMode = .selection
        dragStart = screenPos
        dragStartWorld = worldPos
        renderer.selectionBox = (worldPos, worldPos)
    }
    
    private func handleSelectionDrag(worldPos: SIMD2<Float>) {
        renderer.selectionBox = (dragStartWorld, worldPos)
    }
    
    private func finishSelectionBox(worldPos: SIMD2<Float>) {
        guard let model = model else { return }
        
        let minX = min(dragStartWorld.x, worldPos.x)
        let minY = min(dragStartWorld.y, worldPos.y)
        let maxX = max(dragStartWorld.x, worldPos.x)
        let maxY = max(dragStartWorld.y, worldPos.y)
        
        let nodesInBox = model.nodesInRect(
            min: SIMD2<Float>(minX, minY),
            max: SIMD2<Float>(maxX, maxY)
        )
        
        let ids = Set(nodesInBox.map { $0.id })
        model.selectNodes(ids: ids)
    }
    
    private func startConnectionDrag(node: Node, portType: PortType, index: Int, screenPos: SIMD2<Float>, worldPos: SIMD2<Float>) {
        // Only allow dragging from output ports
        guard portType == .output else { return }
        
        dragMode = .connection
        connectionSource = (node.id, portType, index)
        dragStartWorld = node.outputPortPosition(at: index)
        renderer.connectionPreview = (dragStartWorld, worldPos)
    }
    
    private func handleConnectionDrag(worldPos: SIMD2<Float>) {
        renderer.connectionPreview = (dragStartWorld, worldPos)
        
        // Update hovered port
        if let hitPort = model?.hitTestPort(at: worldPos), hitPort.portType == .input {
            renderer.hoveredPort = (hitPort.node.id, hitPort.portType, hitPort.index)
        } else {
            renderer.hoveredPort = nil
        }
    }
    
    private func finishConnectionDrag(worldPos: SIMD2<Float>) {
        guard let source = connectionSource,
              let hitPort = model?.hitTestPort(at: worldPos),
              hitPort.portType == .input else {
            renderer.hoveredPort = nil
            return
        }
        
        // Create connection
        onConnectionCreated?(source.nodeId, source.index, hitPort.node.id, hitPort.index)
        renderer.hoveredPort = nil
    }
    
    private func updateHoverState(worldPos: SIMD2<Float>) {
        guard let model = model else { return }
        
        // Update node hover
        for node in model.nodes {
            let wasHovered = node.isHovered
            node.isHovered = worldPos.x >= node.position.x &&
                            worldPos.x <= node.position.x + node.size.x &&
                            worldPos.y >= node.position.y &&
                            worldPos.y <= node.position.y + node.size.y
            
            if node.isHovered != wasHovered {
                // Hover state changed
            }
        }
        
        // Update port hover
        if let hitPort = model.hitTestPort(at: worldPos) {
            renderer.hoveredPort = (hitPort.node.id, hitPort.portType, hitPort.index)
        } else {
            renderer.hoveredPort = nil
        }
    }
    
    // MARK: - Context Menu
    
    private func showContextMenu(at windowPoint: NSPoint, worldPos: SIMD2<Float>) {
        let menu = NSMenu()
        
        if let hitNode = model?.hitTestNode(at: worldPos) {
            // Node context menu
            menu.addItem(withTitle: "Delete Node", action: #selector(deleteSelectedNodes), keyEquivalent: "")
            menu.addItem(withTitle: "Duplicate", action: #selector(duplicateSelectedNodes), keyEquivalent: "")
        } else {
            // Canvas context menu - add nodes
            let addMenu = NSMenu()
            for type in NodeType.allCases {
                let item = NSMenuItem(title: type.displayName, action: #selector(addNodeFromMenu(_:)), keyEquivalent: "")
                item.representedObject = (type, worldPos)
                addMenu.addItem(item)
            }
            
            let addItem = NSMenuItem(title: "Add Node", action: nil, keyEquivalent: "")
            addItem.submenu = addMenu
            menu.addItem(addItem)
            
            menu.addItem(NSMenuItem.separator())
            menu.addItem(withTitle: "Fit All", action: #selector(fitAll), keyEquivalent: "")
            menu.addItem(withTitle: "Reset View", action: #selector(resetView), keyEquivalent: "")
        }
        
        NSMenu.popUpContextMenu(menu, with: NSApp.currentEvent!, for: self)
    }
    
    @objc private func addNodeFromMenu(_ sender: NSMenuItem) {
        guard let (type, worldPos) = sender.representedObject as? (NodeType, SIMD2<Float>) else { return }
        model?.addNode(type: type, at: worldPos)
    }
    
    @objc private func deleteSelectedNodes() {
        model?.removeSelectedNodes()
    }
    
    @objc private func duplicateSelectedNodes() {
        // TODO: Implement duplication
    }
    
    @objc private func fitAll() {
        guard let model = model, !model.nodes.isEmpty else { return }
        
        var minX: Float = .greatestFiniteMagnitude
        var minY: Float = .greatestFiniteMagnitude
        var maxX: Float = -.greatestFiniteMagnitude
        var maxY: Float = -.greatestFiniteMagnitude
        
        for node in model.nodes {
            minX = min(minX, node.position.x)
            minY = min(minY, node.position.y)
            maxX = max(maxX, node.position.x + node.size.x)
            maxY = max(maxY, node.position.y + node.size.y)
        }
        
        renderer.viewport.fitBounds(
            min: SIMD2<Float>(minX, minY),
            max: SIMD2<Float>(maxX, maxY)
        )
    }
    
    @objc private func resetView() {
        renderer.viewport.reset()
    }
    
    // MARK: - Keyboard
    
    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 51, 117: // Delete, Backspace
            model?.removeSelectedNodes()
        case 0: // A
            if event.modifierFlags.contains(.command) {
                // Select all
                if let model = model {
                    model.selectNodes(ids: Set(model.nodes.map { $0.id }))
                }
            }
        case 6: // Z
            if event.modifierFlags.contains(.command) {
                if event.modifierFlags.contains(.shift) {
                    model?.redo()
                } else {
                    model?.undo()
                }
            }
        case 53: // Escape
            model?.clearSelection()
            onNodeSelected?(nil)
        default:
            super.keyDown(with: event)
        }
    }
    
    // MARK: - Public API
    
    func addNode(type: NodeType, at worldPos: SIMD2<Float>) {
        model?.addNode(type: type, at: worldPos)
    }
    
    func centerOn(nodeId: UUID) {
        guard let node = model?.getNode(id: nodeId) else { return }
        let center = node.position + node.size / 2
        renderer.viewport.centerOn(center)
    }
}
