import Foundation
import simd

/// Handles text rendering and layout for nodes
/// Uses Core Text for high-quality typography
class NodeRenderer {
    
    // MARK: - Text Layout
    
    struct NodeLayout {
        let headerHeight: Float
        let contentHeight: Float
        let totalHeight: Float
        let textLines: [String]
    }
    
    /// Calculate the layout for a node based on its content
    static func calculateLayout(for node: Node, maxWidth: Float = Float(Theme.nodeWidth)) -> NodeLayout {
        let padding = Float(Theme.nodePadding)
        let headerHeight: Float = 24
        
        // Calculate content height based on text
        let text = node.displayText
        let lines = wrapText(text, maxWidth: maxWidth - padding * 2, font: Theme.fontMono)
        
        let lineHeight: Float = 16
        let contentHeight = Float(max(1, lines.count)) * lineHeight + padding
        
        let totalHeight = max(Float(Theme.nodeMinHeight), headerHeight + contentHeight + padding)
        
        return NodeLayout(
            headerHeight: headerHeight,
            contentHeight: contentHeight,
            totalHeight: totalHeight,
            textLines: lines
        )
    }
    
    /// Wrap text to fit within a given width
    private static func wrapText(_ text: String, maxWidth: Float, font: NSFont) -> [String] {
        guard !text.isEmpty else { return [""] }
        
        let words = text.split(separator: " ").map(String.init)
        var lines: [String] = []
        var currentLine = ""
        
        let attributes: [NSAttributedString.Key: Any] = [.font: font]
        
        for word in words {
            let testLine = currentLine.isEmpty ? word : "\(currentLine) \(word)"
            let size = (testLine as NSString).size(withAttributes: attributes)
            
            if Float(size.width) > maxWidth && !currentLine.isEmpty {
                lines.append(currentLine)
                currentLine = word
            } else {
                currentLine = testLine
            }
        }
        
        if !currentLine.isEmpty {
            lines.append(currentLine)
        }
        
        return lines.isEmpty ? [""] : lines
    }
    
    /// Update node size based on layout
    static func updateNodeSize(_ node: Node) {
        let layout = calculateLayout(for: node)
        node.size = SIMD2<Float>(Float(Theme.nodeWidth), layout.totalHeight)
    }
}
