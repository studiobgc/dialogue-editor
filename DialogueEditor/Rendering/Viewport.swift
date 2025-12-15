import Foundation
import simd

/// Viewport manages pan, zoom, and coordinate transformations
/// Optimized for 120Hz ProMotion on M3 Max
class Viewport {
    
    // MARK: - Properties
    
    private(set) var offset: SIMD2<Float> = .zero
    private(set) var zoom: Float = 1.0
    private(set) var size: SIMD2<Float> = SIMD2<Float>(1920, 1080)
    
    let minZoom: Float = 0.1
    let maxZoom: Float = 3.0
    
    // Animation state for smooth transitions
    private var targetOffset: SIMD2<Float> = .zero
    private var targetZoom: Float = 1.0
    private var isAnimating: Bool = false
    
    // Inertia for smooth panning
    private var velocity: SIMD2<Float> = .zero
    private let friction: Float = 0.92
    private let minVelocity: Float = 0.5
    
    // MARK: - Computed Properties
    
    var viewProjectionMatrix: float4x4 {
        // Orthographic projection centered on viewport
        let left = -size.x / 2
        let right = size.x / 2
        let bottom = size.y / 2
        let top = -size.y / 2
        
        let ortho = float4x4(orthographicProjection: left, right: right, bottom: bottom, top: top, near: -1, far: 1)
        
        // Apply zoom and pan
        let scale = float4x4(scale: SIMD3<Float>(zoom, zoom, 1))
        let translate = float4x4(translation: SIMD3<Float>(offset.x, offset.y, 0))
        
        return ortho * scale * translate
    }
    
    var visibleBounds: (min: SIMD2<Float>, max: SIMD2<Float>) {
        let halfSize = size / (2 * zoom)
        let center = -offset / zoom
        return (center - halfSize, center + halfSize)
    }
    
    // MARK: - Size Management
    
    func setSize(_ newSize: SIMD2<Float>) {
        size = newSize
    }
    
    func setSize(width: CGFloat, height: CGFloat) {
        size = SIMD2<Float>(Float(width), Float(height))
    }
    
    // MARK: - Coordinate Transformations
    
    /// Convert screen coordinates to world coordinates
    func toWorldCoords(_ screenPos: SIMD2<Float>) -> SIMD2<Float> {
        // Screen pos relative to center
        let centered = screenPos - size / 2
        // Apply inverse transform
        return (centered - offset) / zoom
    }
    
    /// Convert world coordinates to screen coordinates
    func toScreenCoords(_ worldPos: SIMD2<Float>) -> SIMD2<Float> {
        return worldPos * zoom + offset + size / 2
    }
    
    // MARK: - Pan
    
    func pan(delta: SIMD2<Float>) {
        offset += delta
        velocity = delta
    }
    
    func setOffset(_ newOffset: SIMD2<Float>) {
        offset = newOffset
    }
    
    // MARK: - Zoom
    
    func setZoom(_ newZoom: Float, around screenPoint: SIMD2<Float>? = nil) {
        let clampedZoom = min(maxZoom, max(minZoom, newZoom))
        
        if let point = screenPoint {
            // Zoom towards the point
            let worldBefore = toWorldCoords(point)
            zoom = clampedZoom
            let worldAfter = toWorldCoords(point)
            offset += (worldAfter - worldBefore) * zoom
        } else {
            zoom = clampedZoom
        }
    }
    
    func zoomBy(_ factor: Float, around screenPoint: SIMD2<Float>? = nil) {
        setZoom(zoom * factor, around: screenPoint)
    }
    
    // MARK: - Animation
    
    func animateTo(offset: SIMD2<Float>, zoom: Float) {
        targetOffset = offset
        targetZoom = zoom
        isAnimating = true
    }
    
    func centerOn(_ worldPos: SIMD2<Float>, animated: Bool = true) {
        let newOffset = -worldPos * zoom
        if animated {
            animateTo(offset: newOffset, zoom: zoom)
        } else {
            offset = newOffset
        }
    }
    
    func fitBounds(min: SIMD2<Float>, max: SIMD2<Float>, padding: Float = 50) {
        let contentSize = max - min
        guard contentSize.x > 0 && contentSize.y > 0 else { return }
        
        let availableSize = size - SIMD2<Float>(padding * 2, padding * 2)
        let scaleX = availableSize.x / contentSize.x
        let scaleY = availableSize.y / contentSize.y
        
        let newZoom = min(scaleX, scaleY, 1.0)
        let center = (min + max) / 2
        
        targetZoom = newZoom
        targetOffset = -center * newZoom
        isAnimating = true
    }
    
    func reset() {
        animateTo(offset: .zero, zoom: 1.0)
    }
    
    // MARK: - Update (call every frame)
    
    func update(deltaTime: Float) -> Bool {
        var needsRedraw = false
        
        // Handle animation
        if isAnimating {
            let lerpFactor = min(1.0, deltaTime * 10.0)
            
            // Lerp zoom
            let zoomDiff = targetZoom - zoom
            if abs(zoomDiff) > 0.001 {
                zoom += zoomDiff * lerpFactor
                needsRedraw = true
            }
            
            // Lerp offset
            let offsetDiff = targetOffset - offset
            if length(offsetDiff) > 0.5 {
                offset += offsetDiff * lerpFactor
                needsRedraw = true
            } else {
                isAnimating = false
            }
        }
        
        // Handle inertia
        let speed = length(velocity)
        if speed > minVelocity {
            offset += velocity
            velocity *= friction
            needsRedraw = true
        } else {
            velocity = .zero
        }
        
        return needsRedraw
    }
    
    // MARK: - Hit Testing Helpers
    
    func isRectVisible(_ rect: (position: SIMD2<Float>, size: SIMD2<Float>)) -> Bool {
        let bounds = visibleBounds
        let rectMax = rect.position + rect.size
        
        return !(rect.position.x > bounds.max.x ||
                rectMax.x < bounds.min.x ||
                rect.position.y > bounds.max.y ||
                rectMax.y < bounds.min.y)
    }
}

// MARK: - Matrix Helpers

extension float4x4 {
    init(orthographicProjection left: Float, right: Float, bottom: Float, top: Float, near: Float, far: Float) {
        let sx = 2 / (right - left)
        let sy = 2 / (top - bottom)
        let sz = 1 / (far - near)
        let tx = (left + right) / (left - right)
        let ty = (top + bottom) / (bottom - top)
        let tz = near / (near - far)
        
        self.init(columns: (
            SIMD4<Float>(sx, 0, 0, 0),
            SIMD4<Float>(0, sy, 0, 0),
            SIMD4<Float>(0, 0, sz, 0),
            SIMD4<Float>(tx, ty, tz, 1)
        ))
    }
    
    init(scale: SIMD3<Float>) {
        self.init(columns: (
            SIMD4<Float>(scale.x, 0, 0, 0),
            SIMD4<Float>(0, scale.y, 0, 0),
            SIMD4<Float>(0, 0, scale.z, 0),
            SIMD4<Float>(0, 0, 0, 1)
        ))
    }
    
    init(translation: SIMD3<Float>) {
        self.init(columns: (
            SIMD4<Float>(1, 0, 0, 0),
            SIMD4<Float>(0, 1, 0, 0),
            SIMD4<Float>(0, 0, 1, 0),
            SIMD4<Float>(translation.x, translation.y, translation.z, 1)
        ))
    }
}
