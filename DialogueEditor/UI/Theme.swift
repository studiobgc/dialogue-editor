import Cocoa
import simd

/// Theme: De Palma meets Sneakers
/// High contrast, split-screen aesthetic, utilitarian hacker tools
/// "Too Many Secrets" - clean reveals, monospace typography, terminal glow
struct Theme {
    
    // MARK: - Core Colors (De Palma high contrast)
    
    /// Deep void black - the darkness between frames
    static let void = NSColor(red: 0.04, green: 0.04, blue: 0.06, alpha: 1.0)
    
    /// Phosphor terminal green - Sneakers computer aesthetic
    static let phosphor = NSColor(red: 0.2, green: 0.9, blue: 0.4, alpha: 1.0)
    
    /// Amber warning - like old CRT displays
    static let amber = NSColor(red: 0.95, green: 0.65, blue: 0.1, alpha: 1.0)
    
    /// Cool cyan - surveillance camera blue
    static let cyan = NSColor(red: 0.3, green: 0.8, blue: 0.95, alpha: 1.0)
    
    /// Hot magenta - De Palma's signature neon
    static let magenta = NSColor(red: 0.95, green: 0.2, blue: 0.6, alpha: 1.0)
    
    /// Crimson - danger, tension
    static let crimson = NSColor(red: 0.85, green: 0.15, blue: 0.2, alpha: 1.0)
    
    // MARK: - Surface Colors
    
    /// Panel background - slightly lifted from void
    static let surface = NSColor(red: 0.08, green: 0.08, blue: 0.10, alpha: 1.0)
    
    /// Secondary surface - subtle elevation
    static let surfaceSecondary = NSColor(red: 0.12, green: 0.12, blue: 0.14, alpha: 1.0)
    
    /// Border - barely visible grid lines
    static let border = NSColor(red: 0.18, green: 0.18, blue: 0.22, alpha: 1.0)
    
    /// Text primary - crisp white with slight warmth
    static let textPrimary = NSColor(red: 0.95, green: 0.93, blue: 0.90, alpha: 1.0)
    
    /// Text secondary - dimmed for hierarchy
    static let textSecondary = NSColor(red: 0.55, green: 0.53, blue: 0.50, alpha: 1.0)
    
    // MARK: - Node Type Colors
    
    static let nodeDialogue = NSColor(red: 0.23, green: 0.51, blue: 0.96, alpha: 1.0)
    static let nodeBranch = NSColor(red: 0.96, green: 0.62, blue: 0.04, alpha: 1.0)
    static let nodeCondition = NSColor(red: 0.06, green: 0.72, blue: 0.51, alpha: 1.0)
    static let nodeInstruction = NSColor(red: 0.94, green: 0.27, blue: 0.27, alpha: 1.0)
    static let nodeHub = NSColor(red: 0.02, green: 0.71, blue: 0.83, alpha: 1.0)
    static let nodeJump = NSColor(red: 0.55, green: 0.36, blue: 0.96, alpha: 1.0)
    
    // MARK: - Metal Colors (SIMD)
    
    static func simdColor(_ color: NSColor) -> SIMD4<Float> {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        color.usingColorSpace(.deviceRGB)?.getRed(&r, green: &g, blue: &b, alpha: &a)
        return SIMD4<Float>(Float(r), Float(g), Float(b), Float(a))
    }
    
    // MARK: - Typography (Sneakers terminal aesthetic)
    
    static let fontMono = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
    static let fontMonoBold = NSFont.monospacedSystemFont(ofSize: 12, weight: .bold)
    static let fontMonoSmall = NSFont.monospacedSystemFont(ofSize: 10, weight: .regular)
    
    static let fontUI = NSFont.systemFont(ofSize: 12, weight: .medium)
    static let fontUISmall = NSFont.systemFont(ofSize: 10, weight: .regular)
    static let fontUIBold = NSFont.systemFont(ofSize: 12, weight: .bold)
    
    // MARK: - Layout Constants
    
    static let nodeWidth: CGFloat = 220
    static let nodeMinHeight: CGFloat = 60
    static let nodeCornerRadius: CGFloat = 6
    static let nodePadding: CGFloat = 12
    static let portRadius: CGFloat = 6
    static let connectionWidth: CGFloat = 2
    
    static let gridMinorSize: CGFloat = 20
    static let gridMajorSize: CGFloat = 100
    
    // MARK: - Animation Timing
    
    static let animationFast: Double = 0.15
    static let animationNormal: Double = 0.25
    static let animationSlow: Double = 0.4
    
    // MARK: - Glow Effects (De Palma neon)
    
    static func glowColor(for baseColor: NSColor, intensity: CGFloat = 0.5) -> NSColor {
        return baseColor.withAlphaComponent(intensity)
    }
    
    // MARK: - Scanline Effect Parameters
    
    static let scanlineOpacity: Float = 0.03
    static let scanlineFrequency: Float = 2.0
}

// MARK: - NSColor Extensions

extension NSColor {
    var simd: SIMD4<Float> {
        Theme.simdColor(self)
    }
    
    convenience init(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")
        
        var rgb: UInt64 = 0
        Scanner(string: hexSanitized).scanHexInt64(&rgb)
        
        let r = CGFloat((rgb & 0xFF0000) >> 16) / 255.0
        let g = CGFloat((rgb & 0x00FF00) >> 8) / 255.0
        let b = CGFloat(rgb & 0x0000FF) / 255.0
        
        self.init(red: r, green: g, blue: b, alpha: 1.0)
    }
}
