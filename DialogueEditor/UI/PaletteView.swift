import Cocoa

/// Node palette with draggable node types
/// Sneakers utilitarian aesthetic - clean, functional, terminal-like
class PaletteView: NSView {
    
    // MARK: - Properties
    
    var onNodeDrag: ((NodeType, NSPoint) -> Void)?
    
    private var nodeItems: [PaletteItem] = []
    private let itemHeight: CGFloat = 44
    private let sectionPadding: CGFloat = 16
    
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
        
        // Create sections
        var yOffset: CGFloat = sectionPadding
        
        // Title
        let titleLabel = createLabel("NODES", color: Theme.textSecondary, font: Theme.fontMonoBold)
        titleLabel.frame = NSRect(x: 16, y: bounds.height - yOffset - 20, width: bounds.width - 32, height: 20)
        titleLabel.autoresizingMask = [.minYMargin]
        addSubview(titleLabel)
        yOffset += 32
        
        // Flow section
        yOffset = addSection("FLOW", types: [.dialogue, .dialogueFragment], startY: yOffset)
        
        // Logic section
        yOffset = addSection("LOGIC", types: [.branch, .condition, .instruction], startY: yOffset)
        
        // Navigation section
        yOffset = addSection("NAVIGATION", types: [.hub, .jump], startY: yOffset)
    }
    
    private func addSection(_ title: String, types: [NodeType], startY: CGFloat) -> CGFloat {
        var yOffset = startY
        
        // Section header
        let header = createLabel(title, color: Theme.textSecondary, font: Theme.fontMonoSmall)
        header.frame = NSRect(x: 16, y: bounds.height - yOffset - 16, width: bounds.width - 32, height: 16)
        header.autoresizingMask = [.minYMargin]
        addSubview(header)
        yOffset += 24
        
        // Items
        for type in types {
            let item = PaletteItem(nodeType: type)
            item.frame = NSRect(x: 12, y: bounds.height - yOffset - itemHeight, width: bounds.width - 24, height: itemHeight)
            item.autoresizingMask = [.width, .minYMargin]
            item.onDrag = { [weak self] screenPoint in
                self?.onNodeDrag?(type, screenPoint)
            }
            addSubview(item)
            nodeItems.append(item)
            yOffset += itemHeight + 4
        }
        
        yOffset += 8
        return yOffset
    }
    
    private func createLabel(_ text: String, color: NSColor, font: NSFont) -> NSTextField {
        let label = NSTextField(labelWithString: text)
        label.textColor = color
        label.font = font
        label.isBezeled = false
        label.drawsBackground = false
        label.isEditable = false
        label.isSelectable = false
        return label
    }
}

// MARK: - PaletteItem

class PaletteItem: NSView {
    
    let nodeType: NodeType
    var onDrag: ((NSPoint) -> Void)?
    
    private var isHighlighted = false {
        didSet { needsDisplay = true }
    }
    
    private var trackingArea: NSTrackingArea?
    
    init(nodeType: NodeType) {
        self.nodeType = nodeType
        super.init(frame: .zero)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private func setupUI() {
        wantsLayer = true
        layer?.cornerRadius = 6
        layer?.borderWidth = 1
        layer?.borderColor = Theme.border.cgColor
        
        updateTrackingArea()
    }
    
    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        updateTrackingArea()
    }
    
    private func updateTrackingArea() {
        if let existing = trackingArea {
            removeTrackingArea(existing)
        }
        
        trackingArea = NSTrackingArea(
            rect: bounds,
            options: [.mouseEnteredAndExited, .activeInKeyWindow],
            owner: self,
            userInfo: nil
        )
        addTrackingArea(trackingArea!)
    }
    
    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        
        // Background
        let bgColor = isHighlighted ? Theme.surfaceSecondary : Theme.surface
        bgColor.setFill()
        
        let path = NSBezierPath(roundedRect: bounds.insetBy(dx: 1, dy: 1), xRadius: 5, yRadius: 5)
        path.fill()
        
        // Icon badge
        let badgeRect = NSRect(x: 12, y: (bounds.height - 24) / 2, width: 24, height: 24)
        
        // Convert nodeType color to NSColor
        let typeColor = NSColor(
            red: CGFloat(nodeType.color.x),
            green: CGFloat(nodeType.color.y),
            blue: CGFloat(nodeType.color.z),
            alpha: 1.0
        )
        typeColor.setFill()
        
        let badgePath = NSBezierPath(roundedRect: badgeRect, xRadius: 4, yRadius: 4)
        badgePath.fill()
        
        // Icon letter
        let iconAttr: [NSAttributedString.Key: Any] = [
            .font: NSFont.monospacedSystemFont(ofSize: 12, weight: .bold),
            .foregroundColor: NSColor.white
        ]
        let iconStr = nodeType.icon as NSString
        let iconSize = iconStr.size(withAttributes: iconAttr)
        let iconPoint = NSPoint(
            x: badgeRect.midX - iconSize.width / 2,
            y: badgeRect.midY - iconSize.height / 2
        )
        iconStr.draw(at: iconPoint, withAttributes: iconAttr)
        
        // Label
        let labelAttr: [NSAttributedString.Key: Any] = [
            .font: Theme.fontUI,
            .foregroundColor: Theme.textPrimary
        ]
        let labelStr = nodeType.displayName as NSString
        let labelPoint = NSPoint(x: 44, y: (bounds.height - 16) / 2)
        labelStr.draw(at: labelPoint, withAttributes: labelAttr)
    }
    
    override func mouseEntered(with event: NSEvent) {
        isHighlighted = true
        layer?.borderColor = Theme.phosphor.cgColor
    }
    
    override func mouseExited(with event: NSEvent) {
        isHighlighted = false
        layer?.borderColor = Theme.border.cgColor
    }
    
    override func mouseDown(with event: NSEvent) {
        // Start drag
        NSCursor.closedHand.push()
    }
    
    override func mouseDragged(with event: NSEvent) {
        // Create dragging image
        let image = NSImage(size: bounds.size)
        image.lockFocus()
        draw(bounds)
        image.unlockFocus()
        
        // Begin dragging session
        let draggingItem = NSDraggingItem(pasteboardWriter: nodeType.rawValue as NSString)
        draggingItem.setDraggingFrame(bounds, contents: image)
        
        beginDraggingSession(with: [draggingItem], event: event, source: self)
    }
    
    override func mouseUp(with event: NSEvent) {
        NSCursor.pop()
        
        // If dropped outside, notify with screen position
        let screenPoint = NSEvent.mouseLocation
        onDrag?(screenPoint)
    }
}

// MARK: - NSDraggingSource

extension PaletteItem: NSDraggingSource {
    func draggingSession(_ session: NSDraggingSession, sourceOperationMaskFor context: NSDraggingContext) -> NSDragOperation {
        return .copy
    }
    
    func draggingSession(_ session: NSDraggingSession, endedAt screenPoint: NSPoint, operation: NSDragOperation) {
        onDrag?(screenPoint)
    }
}
