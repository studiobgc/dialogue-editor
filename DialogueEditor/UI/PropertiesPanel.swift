import Cocoa

/// Properties panel for editing selected node
/// De Palma high contrast + Sneakers terminal aesthetic
class PropertiesPanel: NSView {
    
    // MARK: - Properties
    
    var onPropertyChange: ((UUID, String, Any) -> Void)?
    
    private var currentNode: Node?
    private var characters: [Character] = []
    
    // UI Elements
    private var scrollView: NSScrollView!
    private var contentView: NSView!
    private var headerView: NSView!
    private var emptyStateView: NSView!
    
    private var nodeTypeLabel: NSTextField!
    private var nodeIdLabel: NSTextField!
    private var nodeBadge: NSView!
    
    private var textField: NSTextView!
    private var speakerPopup: NSPopUpButton!
    private var expressionField: NSTextField!
    
    // MARK: - Initialization
    
    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
    }
    
    private func setupUI() {
        wantsLayer = true
        layer?.backgroundColor = Theme.surface.cgColor
        
        setupScrollView()
        setupHeader()
        setupContent()
        setupEmptyState()
        
        showEmptyState()
    }
    
    private func setupScrollView() {
        scrollView = NSScrollView()
        scrollView.frame = bounds
        scrollView.autoresizingMask = [.width, .height]
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = false
        scrollView.borderType = .noBorder
        scrollView.backgroundColor = Theme.surface
        scrollView.drawsBackground = true
        addSubview(scrollView)
        
        contentView = NSView()
        contentView.frame = NSRect(x: 0, y: 0, width: bounds.width, height: 600)
        scrollView.documentView = contentView
    }
    
    private func setupHeader() {
        headerView = NSView()
        headerView.frame = NSRect(x: 0, y: contentView.bounds.height - 80, width: bounds.width, height: 80)
        headerView.autoresizingMask = [.width, .minYMargin]
        headerView.wantsLayer = true
        headerView.layer?.backgroundColor = Theme.surfaceSecondary.cgColor
        contentView.addSubview(headerView)
        
        // Node badge
        nodeBadge = NSView()
        nodeBadge.frame = NSRect(x: 16, y: 20, width: 40, height: 40)
        nodeBadge.wantsLayer = true
        nodeBadge.layer?.cornerRadius = 8
        nodeBadge.layer?.backgroundColor = Theme.nodeDialogue.cgColor
        headerView.addSubview(nodeBadge)
        
        // Node type label
        nodeTypeLabel = NSTextField(labelWithString: "Dialogue")
        nodeTypeLabel.frame = NSRect(x: 68, y: 38, width: 180, height: 20)
        nodeTypeLabel.font = Theme.fontUIBold
        nodeTypeLabel.textColor = Theme.textPrimary
        nodeTypeLabel.autoresizingMask = [.width]
        headerView.addSubview(nodeTypeLabel)
        
        // Node ID label
        nodeIdLabel = NSTextField(labelWithString: "")
        nodeIdLabel.frame = NSRect(x: 68, y: 20, width: 180, height: 16)
        nodeIdLabel.font = Theme.fontMonoSmall
        nodeIdLabel.textColor = Theme.textSecondary
        nodeIdLabel.autoresizingMask = [.width]
        headerView.addSubview(nodeIdLabel)
    }
    
    private func setupContent() {
        var yOffset: CGFloat = contentView.bounds.height - 100
        
        // Speaker section (for dialogue nodes)
        yOffset = addSection("SPEAKER", startY: yOffset) { container in
            self.speakerPopup = NSPopUpButton(frame: NSRect(x: 0, y: 0, width: container.bounds.width, height: 28))
            self.speakerPopup.autoresizingMask = [.width]
            self.speakerPopup.target = self
            self.speakerPopup.action = #selector(self.speakerChanged)
            self.stylePopup(self.speakerPopup)
            container.addSubview(self.speakerPopup)
            return 36
        }
        
        // Text section
        yOffset = addSection("DIALOGUE TEXT", startY: yOffset) { container in
            let scrollView = NSScrollView(frame: NSRect(x: 0, y: 0, width: container.bounds.width, height: 120))
            scrollView.autoresizingMask = [.width]
            scrollView.hasVerticalScroller = true
            scrollView.borderType = .noBorder
            
            self.textField = NSTextView(frame: scrollView.bounds)
            self.textField.autoresizingMask = [.width]
            self.textField.font = Theme.fontMono
            self.textField.textColor = Theme.textPrimary
            self.textField.backgroundColor = Theme.surfaceSecondary
            self.textField.insertionPointColor = Theme.phosphor
            self.textField.delegate = self
            self.textField.isRichText = false
            self.textField.textContainerInset = NSSize(width: 8, height: 8)
            
            scrollView.documentView = self.textField
            scrollView.wantsLayer = true
            scrollView.layer?.cornerRadius = 4
            scrollView.layer?.borderWidth = 1
            scrollView.layer?.borderColor = Theme.border.cgColor
            
            container.addSubview(scrollView)
            return 128
        }
        
        // Expression section (for condition nodes)
        yOffset = addSection("EXPRESSION", startY: yOffset) { container in
            self.expressionField = NSTextField()
            self.expressionField.frame = NSRect(x: 0, y: 0, width: container.bounds.width, height: 28)
            self.expressionField.autoresizingMask = [.width]
            self.expressionField.font = Theme.fontMono
            self.expressionField.textColor = Theme.textPrimary
            self.expressionField.backgroundColor = Theme.surfaceSecondary
            self.expressionField.isBezeled = false
            self.expressionField.focusRingType = .none
            self.expressionField.delegate = self
            self.expressionField.wantsLayer = true
            self.expressionField.layer?.cornerRadius = 4
            self.expressionField.layer?.borderWidth = 1
            self.expressionField.layer?.borderColor = Theme.border.cgColor
            container.addSubview(self.expressionField)
            return 36
        }
    }
    
    private func addSection(_ title: String, startY: CGFloat, builder: (NSView) -> CGFloat) -> CGFloat {
        var yOffset = startY - 24
        
        // Section header
        let header = NSTextField(labelWithString: title)
        header.frame = NSRect(x: 16, y: yOffset, width: bounds.width - 32, height: 16)
        header.font = Theme.fontMonoSmall
        header.textColor = Theme.textSecondary
        header.autoresizingMask = [.width, .minYMargin]
        contentView.addSubview(header)
        
        yOffset -= 8
        
        // Content container
        let container = NSView()
        container.frame = NSRect(x: 16, y: yOffset - 150, width: bounds.width - 32, height: 150)
        container.autoresizingMask = [.width, .minYMargin]
        contentView.addSubview(container)
        
        let contentHeight = builder(container)
        container.frame.size.height = contentHeight
        container.frame.origin.y = yOffset - contentHeight
        
        return yOffset - contentHeight - 16
    }
    
    private func setupEmptyState() {
        emptyStateView = NSView()
        emptyStateView.frame = bounds
        emptyStateView.autoresizingMask = [.width, .height]
        addSubview(emptyStateView)
        
        // Icon
        let icon = NSTextField(labelWithString: "⚡")
        icon.frame = NSRect(x: (bounds.width - 48) / 2, y: bounds.height / 2 + 20, width: 48, height: 48)
        icon.font = NSFont.systemFont(ofSize: 40)
        icon.alignment = .center
        icon.alphaValue = 0.4
        icon.autoresizingMask = [.minXMargin, .maxXMargin, .minYMargin, .maxYMargin]
        emptyStateView.addSubview(icon)
        
        // Title
        let title = NSTextField(labelWithString: "No Node Selected")
        title.frame = NSRect(x: 16, y: bounds.height / 2 - 10, width: bounds.width - 32, height: 20)
        title.font = Theme.fontUIBold
        title.textColor = Theme.textPrimary
        title.alignment = .center
        title.autoresizingMask = [.width, .minYMargin, .maxYMargin]
        emptyStateView.addSubview(title)
        
        // Hint
        let hint = NSTextField(labelWithString: "Click a node to edit its properties")
        hint.frame = NSRect(x: 16, y: bounds.height / 2 - 35, width: bounds.width - 32, height: 20)
        hint.font = Theme.fontUISmall
        hint.textColor = Theme.textSecondary
        hint.alignment = .center
        hint.autoresizingMask = [.width, .minYMargin, .maxYMargin]
        emptyStateView.addSubview(hint)
    }
    
    private func stylePopup(_ popup: NSPopUpButton) {
        popup.bezelStyle = .texturedRounded
        popup.isBordered = true
    }
    
    // MARK: - Public API
    
    func showNode(_ node: Node, characters: [Character]) {
        self.currentNode = node
        self.characters = characters
        
        emptyStateView.isHidden = true
        scrollView.isHidden = false
        
        // Update header
        nodeTypeLabel.stringValue = node.nodeType.displayName
        nodeIdLabel.stringValue = String(node.id.uuidString.prefix(8))
        
        // Update badge color
        nodeBadge.layer?.backgroundColor = NSColor(
            red: CGFloat(node.nodeType.color.x),
            green: CGFloat(node.nodeType.color.y),
            blue: CGFloat(node.nodeType.color.z),
            alpha: 1.0
        ).cgColor
        
        // Update speaker popup
        speakerPopup.removeAllItems()
        speakerPopup.addItem(withTitle: "None")
        for character in characters {
            speakerPopup.addItem(withTitle: character.displayName)
        }
        
        if let dialogueData = node.dialogueData {
            if let speaker = characters.first(where: { $0.displayName == dialogueData.speaker }) {
                speakerPopup.selectItem(withTitle: speaker.displayName)
            }
            textField.string = dialogueData.text
        }
        
        if let conditionData = node.conditionData {
            expressionField.stringValue = conditionData.expression
        }
        
        // Show/hide sections based on node type
        let isDialogue = node.nodeType == .dialogue || node.nodeType == .dialogueFragment
        let isCondition = node.nodeType == .condition
        
        speakerPopup.superview?.superview?.isHidden = !isDialogue
        textField.enclosingScrollView?.superview?.superview?.isHidden = !isDialogue
        expressionField.superview?.superview?.isHidden = !isCondition
    }
    
    func clear() {
        currentNode = nil
        showEmptyState()
    }
    
    func focusTextEditor() {
        window?.makeFirstResponder(textField)
    }
    
    private func showEmptyState() {
        emptyStateView.isHidden = false
        scrollView.isHidden = true
    }
    
    // MARK: - Actions
    
    @objc private func speakerChanged() {
        guard let node = currentNode else { return }
        let speaker = speakerPopup.titleOfSelectedItem ?? ""
        onPropertyChange?(node.id, "speaker", speaker == "None" ? "" : speaker)
    }
}

// MARK: - NSTextViewDelegate

extension PropertiesPanel: NSTextViewDelegate {
    func textDidChange(_ notification: Notification) {
        guard let node = currentNode else { return }
        onPropertyChange?(node.id, "text", textField.string)
    }
}

// MARK: - NSTextFieldDelegate

extension PropertiesPanel: NSTextFieldDelegate {
    func controlTextDidChange(_ obj: Notification) {
        guard let node = currentNode,
              let textField = obj.object as? NSTextField else { return }
        
        if textField == expressionField {
            onPropertyChange?(node.id, "expression", textField.stringValue)
        }
    }
}
