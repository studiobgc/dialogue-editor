import Foundation
import simd

/// Handles bezier curve generation for connections
class ConnectionRenderer {
    
    /// Generate bezier curve points for a connection
    static func generateCurvePoints(
        from start: SIMD2<Float>,
        to end: SIMD2<Float>,
        segments: Int = 24
    ) -> [SIMD2<Float>] {
        
        // Calculate control points for smooth S-curve
        let dx = abs(end.x - start.x)
        let controlOffset = max(dx * 0.5, 50)
        
        let cp1 = SIMD2<Float>(start.x + controlOffset, start.y)
        let cp2 = SIMD2<Float>(end.x - controlOffset, end.y)
        
        var points: [SIMD2<Float>] = []
        
        for i in 0...segments {
            let t = Float(i) / Float(segments)
            let point = cubicBezier(start, cp1, cp2, end, t)
            points.append(point)
        }
        
        return points
    }
    
    /// Cubic bezier interpolation
    private static func cubicBezier(
        _ p0: SIMD2<Float>,
        _ p1: SIMD2<Float>,
        _ p2: SIMD2<Float>,
        _ p3: SIMD2<Float>,
        _ t: Float
    ) -> SIMD2<Float> {
        let mt = 1 - t
        let mt2 = mt * mt
        let mt3 = mt2 * mt
        let t2 = t * t
        let t3 = t2 * t
        
        return p0 * mt3 + p1 * 3 * mt2 * t + p2 * 3 * mt * t2 + p3 * t3
    }
    
    /// Hit test a point against a bezier curve
    static func hitTest(
        point: SIMD2<Float>,
        from start: SIMD2<Float>,
        to end: SIMD2<Float>,
        threshold: Float = 8.0
    ) -> Bool {
        let points = generateCurvePoints(from: start, to: end, segments: 20)
        
        for i in 0..<(points.count - 1) {
            let distance = distanceToSegment(point: point, segStart: points[i], segEnd: points[i + 1])
            if distance < threshold {
                return true
            }
        }
        
        return false
    }
    
    /// Distance from point to line segment
    private static func distanceToSegment(
        point: SIMD2<Float>,
        segStart: SIMD2<Float>,
        segEnd: SIMD2<Float>
    ) -> Float {
        let v = segEnd - segStart
        let w = point - segStart
        
        let c1 = simd_dot(w, v)
        if c1 <= 0 {
            return simd_length(point - segStart)
        }
        
        let c2 = simd_dot(v, v)
        if c2 <= c1 {
            return simd_length(point - segEnd)
        }
        
        let b = c1 / c2
        let pb = segStart + b * v
        return simd_length(point - pb)
    }
}
