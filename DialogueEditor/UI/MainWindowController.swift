import Cocoa

/// Main window controller - De Palma split-screen layout
/// Left: Palette, Center: Canvas, Right: Properties
class MainWindowController: NSWindowController {
    
    // MARK: - UI Components
    
    private var canvasView: CanvasView!
    private var paletteView: PaletteView!
    private var propertiesPanel: PropertiesPanel!
    private var splitView: NSSplitView!
    private var toolbar: NSToolbar!
    
    // MARK: - Model
    
    private let model = GraphModel()
    
    // MARK: - Initialization
    
    convenience init() {
        // Create window with De Palma high-contrast aesthetic
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1400, height: 900),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        
        window.title = "Dialogue Editor"
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.backgroundColor = Theme.void
        window.minSize = NSSize(width: 900, height: 600)
        window.center()
        
        // Enable full window content for immersive feel
        window.isMovableByWindowBackground = true
        
        self.init(window: window)
        
        setupUI()
        setupToolbar()
        setupBindings()
        
        // Add demo content
        addDemoContent()
    }
    
    // MARK: - UI Setup
    
    private func setupUI() {
        guard let window = window else { return }
        
        // Main split view (De Palma split-screen aesthetic)
        splitView = NSSplitView()
        splitView.isVertical = true
        splitView.dividerStyle = .thin
        splitView.autoresizingMask = [.width, .height]
        
        // Palette (left panel)
        paletteView = PaletteView(frame: NSRect(x: 0, y: 0, width: 200, height: 800))
        paletteView.onNodeDrag = { [weak self] type, screenPoint in
            self?.handlePaletteDrag(type: type, screenPoint: screenPoint)
        }
        
        let paletteContainer = NSView()
        paletteContainer.wantsLayer = true
        paletteContainer.layer?.backgroundColor = Theme.surface.cgColor
        paletteView.frame = paletteContainer.bounds
        paletteView.autoresizingMask = [.width, .height]
        paletteContainer.addSubview(paletteView)
        
        // Canvas (center)
        canvasView = CanvasView(frame: NSRect(x: 0, y: 0, width: 800, height: 800))
        canvasView.model = model
        canvasView.onNodeSelected = { [weak self] nodeId in
            self?.handleNodeSelected(nodeId)
        }
        canvasView.onNodeDoubleClick = { [weak self] nodeId in
            self?.handleNodeDoubleClick(nodeId)
        }
        canvasView.onConnectionCreated = { [weak self] fromId, fromPort, toId, toPort in
            self?.model.addConnection(from: fromId, fromPort: fromPort, to: toId, toPort: toPort)
        }
        
        let canvasContainer = NSView()
        canvasContainer.wantsLayer = true
        canvasContainer.layer?.backgroundColor = Theme.void.cgColor
        canvasView.frame = canvasContainer.bounds
        canvasView.autoresizingMask = [.width, .height]
        canvasContainer.addSubview(canvasView)
        
        // Properties panel (right)
        propertiesPanel = PropertiesPanel(frame: NSRect(x: 0, y: 0, width: 280, height: 800))
        propertiesPanel.onPropertyChange = { [weak self] nodeId, property, value in
            self?.handlePropertyChange(nodeId: nodeId, property: property, value: value)
        }
        
        let propertiesContainer = NSView()
        propertiesContainer.wantsLayer = true
        propertiesContainer.layer?.backgroundColor = Theme.surface.cgColor
        propertiesPanel.frame = propertiesContainer.bounds
        propertiesPanel.autoresizingMask = [.width, .height]
        propertiesContainer.addSubview(propertiesPanel)
        
        // Add to split view
        splitView.addArrangedSubview(paletteContainer)
        splitView.addArrangedSubview(canvasContainer)
        splitView.addArrangedSubview(propertiesContainer)
        
        // Set split view constraints
        splitView.setHoldingPriority(.defaultLow, forSubviewAt: 0)
        splitView.setHoldingPriority(.defaultHigh, forSubviewAt: 1)
        splitView.setHoldingPriority(.defaultLow, forSubviewAt: 2)
        
        // Set initial widths
        paletteContainer.frame.size.width = 200
        propertiesContainer.frame.size.width = 280
        
        window.contentView = splitView
    }
    
    private func setupToolbar() {
        toolbar = NSToolbar(identifier: "MainToolbar")
        toolbar.delegate = self
        toolbar.displayMode = .iconAndLabel
        toolbar.allowsUserCustomization = false
        
        window?.toolbar = toolbar
        window?.toolbarStyle = .unified
    }
    
    private func setupBindings() {
        // Keyboard shortcuts
        NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            return self?.handleKeyDown(event) ?? event
        }
    }
    
    // MARK: - Demo Content
    
    private func addDemoContent() {
        // Add some demo nodes to showcase the aesthetic
        let dialogue1 = model.addNode(type: .dialogue, at: SIMD2<Float>(100, 100))
        dialogue1.dialogueData = DialogueData(speaker: "Player", text: "What secrets do you hold?")
        NodeRenderer.updateNodeSize(dialogue1)
        
        let branch = model.addNode(type: .branch, at: SIMD2<Float>(400, 100))
        branch.branchData = BranchData(label: "Response")
        NodeRenderer.updateNodeSize(branch)
        
        let dialogue2 = model.addNode(type: .dialogueFragment, at: SIMD2<Float>(700, 50))
        dialogue2.dialogueData = DialogueData(speaker: "NPC", text: "Too many secrets...")
        NodeRenderer.updateNodeSize(dialogue2)
        
        let dialogue3 = model.addNode(type: .dialogueFragment, at: SIMD2<Float>(700, 200))
        dialogue3.dialogueData = DialogueData(speaker: "NPC", text: "SETEC ASTRONOMY")
        NodeRenderer.updateNodeSize(dialogue3)
        
        // Create connections
        model.addConnection(from: dialogue1.id, fromPort: 0, to: branch.id, toPort: 0)
        model.addConnection(from: branch.id, fromPort: 0, to: dialogue2.id, toPort: 0)
        model.addConnection(from: branch.id, fromPort: 1, to: dialogue3.id, toPort: 0)
    }
    
    // MARK: - Event Handlers
    
    private func handlePaletteDrag(type: NodeType, screenPoint: NSPoint) {
        // Convert to canvas coordinates and add node
        if let windowPoint = window?.convertPoint(fromScreen: screenPoint) {
            let canvasPoint = canvasView.convert(windowPoint, from: nil)
            let worldPos = SIMD2<Float>(Float(canvasPoint.x), Float(canvasView.bounds.height - canvasPoint.y))
            canvasView.addNode(type: type, at: worldPos)
        }
    }
    
    private func handleNodeSelected(_ nodeId: UUID?) {
        if let nodeId = nodeId, let node = model.getNode(id: nodeId) {
            propertiesPanel.showNode(node, characters: model.characters)
        } else {
            propertiesPanel.clear()
        }
    }
    
    private func handleNodeDoubleClick(_ nodeId: UUID) {
        // Focus text editing in properties panel
        propertiesPanel.focusTextEditor()
    }
    
    private func handlePropertyChange(nodeId: UUID, property: String, value: Any) {
        guard let node = model.getNode(id: nodeId) else { return }
        
        switch property {
        case "text":
            if let text = value as? String {
                node.dialogueData?.text = text
                NodeRenderer.updateNodeSize(node)
            }
        case "speaker":
            if let speaker = value as? String {
                node.dialogueData?.speaker = speaker
            }
        case "expression":
            if let expression = value as? String {
                node.conditionData?.expression = expression
            }
        case "script":
            if let script = value as? String {
                node.instructionData?.script = script
            }
        default:
            break
        }
    }
    
    private func handleKeyDown(_ event: NSEvent) -> NSEvent? {
        // Global shortcuts
        if event.modifierFlags.contains(.command) {
            switch event.charactersIgnoringModifiers {
            case "n":
                newDocument()
                return nil
            case "s":
                saveDocument()
                return nil
            case "o":
                openDocument()
                return nil
            default:
                break
            }
        }
        return event
    }
    
    // MARK: - File Operations
    
    @objc func newDocument() {
        // Clear and start fresh
        model.nodes.removeAll()
        model.connections.removeAll()
        model.clearSelection()
        propertiesPanel.clear()
    }
    
    @objc func saveDocument() {
        let savePanel = NSSavePanel()
        savePanel.allowedContentTypes = [.json]
        savePanel.nameFieldStringValue = "\(model.name).dialogue.json"
        
        savePanel.beginSheetModal(for: window!) { response in
            if response == .OK, let url = savePanel.url {
                if let json = self.model.toJSON() {
                    try? json.write(to: url, atomically: true, encoding: .utf8)
                }
            }
        }
    }
    
    @objc func openDocument() {
        let openPanel = NSOpenPanel()
        openPanel.allowedContentTypes = [.json]
        openPanel.allowsMultipleSelection = false
        
        openPanel.beginSheetModal(for: window!) { response in
            if response == .OK, let url = openPanel.url {
                if let json = try? String(contentsOf: url, encoding: .utf8),
                   let loaded = GraphModel.fromJSON(json) {
                    // Load into current model
                    self.model.nodes = loaded.nodes
                    self.model.connections = loaded.connections
                    self.model.characters = loaded.characters
                    self.model.name = loaded.name
                }
            }
        }
    }
    
    @objc func fitView() {
        // Fit all nodes in view
        canvasView.perform(Selector(("fitAll")))
    }
}

// MARK: - NSToolbarDelegate

extension MainWindowController: NSToolbarDelegate {
    
    func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        return [
            .flexibleSpace,
            .init("new"),
            .init("open"),
            .init("save"),
            .init("separator1"),
            .init("undo"),
            .init("redo"),
            .init("separator2"),
            .init("fit"),
            .init("reset")
        ]
    }
    
    func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        return toolbarAllowedItemIdentifiers(toolbar)
    }
    
    func toolbar(_ toolbar: NSToolbar, itemForItemIdentifier itemIdentifier: NSToolbarItem.Identifier, willBeInsertedIntoToolbar flag: Bool) -> NSToolbarItem? {
        
        let item = NSToolbarItem(itemIdentifier: itemIdentifier)
        
        switch itemIdentifier.rawValue {
        case "new":
            item.label = "New"
            item.image = NSImage(systemSymbolName: "doc.badge.plus", accessibilityDescription: "New")
            item.action = #selector(newDocument)
            item.target = self
            
        case "open":
            item.label = "Open"
            item.image = NSImage(systemSymbolName: "folder", accessibilityDescription: "Open")
            item.action = #selector(openDocument)
            item.target = self
            
        case "save":
            item.label = "Save"
            item.image = NSImage(systemSymbolName: "square.and.arrow.down", accessibilityDescription: "Save")
            item.action = #selector(saveDocument)
            item.target = self
            
        case "undo":
            item.label = "Undo"
            item.image = NSImage(systemSymbolName: "arrow.uturn.backward", accessibilityDescription: "Undo")
            item.action = #selector(performUndo)
            item.target = self
            
        case "redo":
            item.label = "Redo"
            item.image = NSImage(systemSymbolName: "arrow.uturn.forward", accessibilityDescription: "Redo")
            item.action = #selector(performRedo)
            item.target = self
            
        case "fit":
            item.label = "Fit"
            item.image = NSImage(systemSymbolName: "arrow.up.left.and.arrow.down.right", accessibilityDescription: "Fit")
            item.action = #selector(fitView)
            item.target = self
            
        case "reset":
            item.label = "Reset"
            item.image = NSImage(systemSymbolName: "arrow.counterclockwise", accessibilityDescription: "Reset")
            item.action = #selector(resetView)
            item.target = self
            
        case "separator1", "separator2":
            return NSToolbarItem(itemIdentifier: .flexibleSpace)
            
        default:
            return nil
        }
        
        return item
    }
    
    @objc func performUndo() {
        model.undo()
    }
    
    @objc func performRedo() {
        model.redo()
    }
    
    @objc func resetView() {
        // Reset viewport
    }
}

// MARK: - NSSplitViewDelegate

extension MainWindowController: NSSplitViewDelegate {
    
    func splitView(_ splitView: NSSplitView, constrainMinCoordinate proposedMinimumPosition: CGFloat, ofSubviewAt dividerIndex: Int) -> CGFloat {
        if dividerIndex == 0 {
            return 150 // Minimum palette width
        }
        return proposedMinimumPosition
    }
    
    func splitView(_ splitView: NSSplitView, constrainMaxCoordinate proposedMaximumPosition: CGFloat, ofSubviewAt dividerIndex: Int) -> CGFloat {
        if dividerIndex == 0 {
            return 300 // Maximum palette width
        }
        if dividerIndex == 1 {
            return splitView.frame.width - 200 // Leave room for properties
        }
        return proposedMaximumPosition
    }
}
