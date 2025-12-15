import Metal
import MetalKit
import simd

/// GPU-accelerated renderer using Metal
/// Designed for 120Hz ProMotion on M3 Max
/// Aesthetic: De Palma high contrast + Sneakers phosphor glow
class MetalRenderer: NSObject, MTKViewDelegate {
    
    // MARK: - Metal Objects
    
    private let device: MTLDevice
    private let commandQueue: MTLCommandQueue
    
    // Pipeline states
    private var nodePipelineState: MTLRenderPipelineState!
    private var connectionPipelineState: MTLRenderPipelineState!
    private var gridPipelineState: MTLRenderPipelineState!
    private var portPipelineState: MTLRenderPipelineState!
    private var selectionBoxPipelineState: MTLRenderPipelineState!
    
    // Buffers
    private var uniformBuffer: MTLBuffer!
    private var nodeInstanceBuffer: MTLBuffer!
    private var connectionBuffer: MTLBuffer!
    private var portBuffer: MTLBuffer!
    
    // MARK: - State
    
    let viewport = Viewport()
    var model: GraphModel?
    
    private var startTime: CFAbsoluteTime = CFAbsoluteTimeGetCurrent()
    private var lastFrameTime: CFAbsoluteTime = CFAbsoluteTimeGetCurrent()
    
    // Connection preview for drag-to-connect
    var connectionPreview: (from: SIMD2<Float>, to: SIMD2<Float>)?
    
    // Selection box for marquee selection
    var selectionBox: (start: SIMD2<Float>, end: SIMD2<Float>)?
    
    // Hovered port for visual feedback
    var hoveredPort: (nodeId: UUID, portType: PortType, index: Int)?
    
    // MARK: - Uniforms Structure (must match shader)
    
    struct Uniforms {
        var viewProjection: float4x4
        var viewportSize: SIMD2<Float>
        var time: Float
        var scanlineOpacity: Float
        var scanlineFrequency: Float
        var padding1: Float
        var padding2: Float
        var padding3: Float
    }
    
    struct NodeInstance {
        var position: SIMD2<Float>
        var size: SIMD2<Float>
        var color: SIMD4<Float>
        var glowColor: SIMD4<Float>
        var cornerRadius: Float
        var glowIntensity: Float
        var isSelected: Float
        var isHovered: Float
    }
    
    // MARK: - Initialization
    
    init?(mtkView: MTKView) {
        guard let device = MTLCreateSystemDefaultDevice() else {
            print("Metal is not supported on this device")
            return nil
        }
        
        self.device = device
        
        guard let queue = device.makeCommandQueue() else {
            print("Failed to create command queue")
            return nil
        }
        self.commandQueue = queue
        
        super.init()
        
        mtkView.device = device
        mtkView.delegate = self
        mtkView.colorPixelFormat = .bgra8Unorm
        mtkView.clearColor = MTLClearColor(red: 0.04, green: 0.04, blue: 0.06, alpha: 1.0)
        mtkView.preferredFramesPerSecond = 120 // ProMotion!
        mtkView.enableSetNeedsDisplay = false
        mtkView.isPaused = false
        
        setupPipelines(mtkView: mtkView)
        setupBuffers()
    }
    
    // MARK: - Pipeline Setup
    
    private func setupPipelines(mtkView: MTKView) {
        guard let library = device.makeDefaultLibrary() else {
            fatalError("Failed to load shader library")
        }
        
        // Node pipeline
        let nodeVertexFunc = library.makeFunction(name: "node_vertex")
        let nodeFragmentFunc = library.makeFunction(name: "node_fragment")
        
        let nodePipelineDesc = MTLRenderPipelineDescriptor()
        nodePipelineDesc.vertexFunction = nodeVertexFunc
        nodePipelineDesc.fragmentFunction = nodeFragmentFunc
        nodePipelineDesc.colorAttachments[0].pixelFormat = mtkView.colorPixelFormat
        nodePipelineDesc.colorAttachments[0].isBlendingEnabled = true
        nodePipelineDesc.colorAttachments[0].sourceRGBBlendFactor = .sourceAlpha
        nodePipelineDesc.colorAttachments[0].destinationRGBBlendFactor = .oneMinusSourceAlpha
        nodePipelineDesc.colorAttachments[0].sourceAlphaBlendFactor = .one
        nodePipelineDesc.colorAttachments[0].destinationAlphaBlendFactor = .oneMinusSourceAlpha
        
        nodePipelineState = try? device.makeRenderPipelineState(descriptor: nodePipelineDesc)
        
        // Grid pipeline
        let gridVertexFunc = library.makeFunction(name: "grid_vertex")
        let gridFragmentFunc = library.makeFunction(name: "grid_fragment")
        
        let gridPipelineDesc = MTLRenderPipelineDescriptor()
        gridPipelineDesc.vertexFunction = gridVertexFunc
        gridPipelineDesc.fragmentFunction = gridFragmentFunc
        gridPipelineDesc.colorAttachments[0].pixelFormat = mtkView.colorPixelFormat
        
        gridPipelineState = try? device.makeRenderPipelineState(descriptor: gridPipelineDesc)
        
        // Port pipeline
        let portVertexFunc = library.makeFunction(name: "port_vertex")
        let portFragmentFunc = library.makeFunction(name: "port_fragment")
        
        let portPipelineDesc = MTLRenderPipelineDescriptor()
        portPipelineDesc.vertexFunction = portVertexFunc
        portPipelineDesc.fragmentFunction = portFragmentFunc
        portPipelineDesc.colorAttachments[0].pixelFormat = mtkView.colorPixelFormat
        portPipelineDesc.colorAttachments[0].isBlendingEnabled = true
        portPipelineDesc.colorAttachments[0].sourceRGBBlendFactor = .sourceAlpha
        portPipelineDesc.colorAttachments[0].destinationRGBBlendFactor = .oneMinusSourceAlpha
        
        portPipelineState = try? device.makeRenderPipelineState(descriptor: portPipelineDesc)
        
        // Selection box pipeline
        let selBoxVertexFunc = library.makeFunction(name: "selection_box_vertex")
        let selBoxFragmentFunc = library.makeFunction(name: "selection_box_fragment")
        
        let selBoxPipelineDesc = MTLRenderPipelineDescriptor()
        selBoxPipelineDesc.vertexFunction = selBoxVertexFunc
        selBoxPipelineDesc.fragmentFunction = selBoxFragmentFunc
        selBoxPipelineDesc.colorAttachments[0].pixelFormat = mtkView.colorPixelFormat
        selBoxPipelineDesc.colorAttachments[0].isBlendingEnabled = true
        selBoxPipelineDesc.colorAttachments[0].sourceRGBBlendFactor = .sourceAlpha
        selBoxPipelineDesc.colorAttachments[0].destinationRGBBlendFactor = .oneMinusSourceAlpha
        
        selectionBoxPipelineState = try? device.makeRenderPipelineState(descriptor: selBoxPipelineDesc)
    }
    
    private func setupBuffers() {
        // Uniform buffer
        uniformBuffer = device.makeBuffer(length: MemoryLayout<Uniforms>.size, options: .storageModeShared)
        
        // Instance buffers (pre-allocate for many nodes)
        let maxNodes = 1000
        nodeInstanceBuffer = device.makeBuffer(length: MemoryLayout<NodeInstance>.stride * maxNodes, options: .storageModeShared)
        
        // Port buffer
        let maxPorts = maxNodes * 10
        portBuffer = device.makeBuffer(length: MemoryLayout<SIMD4<Float>>.stride * maxPorts, options: .storageModeShared)
    }
    
    // MARK: - MTKViewDelegate
    
    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {
        viewport.setSize(width: size.width, height: size.height)
    }
    
    func draw(in view: MTKView) {
        let currentTime = CFAbsoluteTimeGetCurrent()
        let deltaTime = Float(currentTime - lastFrameTime)
        lastFrameTime = currentTime
        
        // Update viewport animations
        _ = viewport.update(deltaTime: deltaTime)
        
        // Update uniforms
        var uniforms = Uniforms(
            viewProjection: viewport.viewProjectionMatrix,
            viewportSize: viewport.size,
            time: Float(currentTime - startTime),
            scanlineOpacity: Theme.scanlineOpacity,
            scanlineFrequency: Theme.scanlineFrequency,
            padding1: 0,
            padding2: 0,
            padding3: 0
        )
        uniformBuffer.contents().copyMemory(from: &uniforms, byteCount: MemoryLayout<Uniforms>.size)
        
        guard let drawable = view.currentDrawable,
              let renderPassDesc = view.currentRenderPassDescriptor,
              let commandBuffer = commandQueue.makeCommandBuffer(),
              let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPassDesc) else {
            return
        }
        
        // Draw grid
        drawGrid(encoder: encoder)
        
        // Draw connections
        drawConnections(encoder: encoder)
        
        // Draw connection preview
        if let preview = connectionPreview {
            drawConnectionPreview(encoder: encoder, from: preview.from, to: preview.to)
        }
        
        // Draw nodes
        drawNodes(encoder: encoder)
        
        // Draw ports
        drawPorts(encoder: encoder)
        
        // Draw selection box
        if let box = selectionBox {
            drawSelectionBox(encoder: encoder, start: box.start, end: box.end)
        }
        
        encoder.endEncoding()
        commandBuffer.present(drawable)
        commandBuffer.commit()
    }
    
    // MARK: - Drawing Functions
    
    private func drawGrid(encoder: MTLRenderCommandEncoder) {
        guard let pipeline = gridPipelineState else { return }
        
        encoder.setRenderPipelineState(pipeline)
        encoder.setVertexBuffer(uniformBuffer, offset: 0, index: 0)
        
        // Visible bounds
        let bounds = viewport.visibleBounds
        var boundsData = SIMD4<Float>(bounds.min.x, bounds.min.y, bounds.max.x, bounds.max.y)
        encoder.setVertexBytes(&boundsData, length: MemoryLayout<SIMD4<Float>>.size, index: 1)
        
        // Grid sizes
        var gridSize = SIMD2<Float>(Float(Theme.gridMinorSize), Float(Theme.gridMajorSize))
        encoder.setFragmentBuffer(uniformBuffer, offset: 0, index: 0)
        encoder.setFragmentBytes(&gridSize, length: MemoryLayout<SIMD2<Float>>.size, index: 1)
        
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 6)
    }
    
    private func drawNodes(encoder: MTLRenderCommandEncoder) {
        guard let pipeline = nodePipelineState,
              let model = model else { return }
        
        let nodes = model.nodes
        guard !nodes.isEmpty else { return }
        
        // Build instance data
        var instances: [NodeInstance] = []
        
        for node in nodes {
            let instance = NodeInstance(
                position: node.position,
                size: node.size,
                color: node.nodeType.color,
                glowColor: node.nodeType.color * SIMD4<Float>(1, 1, 1, 0.5),
                cornerRadius: Float(Theme.nodeCornerRadius),
                glowIntensity: node.isSelected ? 1.0 : (node.isHovered ? 0.6 : 0.2),
                isSelected: node.isSelected ? 1.0 : 0.0,
                isHovered: node.isHovered ? 1.0 : 0.0
            )
            instances.append(instance)
        }
        
        // Update buffer
        nodeInstanceBuffer.contents().copyMemory(from: instances, byteCount: MemoryLayout<NodeInstance>.stride * instances.count)
        
        encoder.setRenderPipelineState(pipeline)
        encoder.setVertexBuffer(uniformBuffer, offset: 0, index: 0)
        encoder.setVertexBuffer(nodeInstanceBuffer, offset: 0, index: 1)
        encoder.setFragmentBuffer(uniformBuffer, offset: 0, index: 0)
        
        // Draw instanced quads (6 vertices per node)
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 6, instanceCount: instances.count)
    }
    
    private func drawPorts(encoder: MTLRenderCommandEncoder) {
        guard let pipeline = portPipelineState,
              let model = model else { return }
        
        var portData: [SIMD4<Float>] = []
        
        // Collect all port positions
        for node in model.nodes {
            // Input ports
            for (index, _) in node.inputPorts.enumerated() {
                let pos = node.inputPortPosition(at: index)
                let isConnected: Float = isPortConnected(nodeId: node.id, portType: .input, index: index) ? 1.0 : 0.0
                let isHovered: Float = (hoveredPort?.nodeId == node.id && hoveredPort?.portType == .input && hoveredPort?.index == index) ? 1.0 : 0.0
                portData.append(SIMD4<Float>(pos.x, pos.y, isConnected, isHovered))
            }
            
            // Output ports
            for (index, _) in node.outputPorts.enumerated() {
                let pos = node.outputPortPosition(at: index)
                let isConnected: Float = isPortConnected(nodeId: node.id, portType: .output, index: index) ? 1.0 : 0.0
                let isHovered: Float = (hoveredPort?.nodeId == node.id && hoveredPort?.portType == .output && hoveredPort?.index == index) ? 1.0 : 0.0
                portData.append(SIMD4<Float>(pos.x, pos.y, isConnected, isHovered))
            }
        }
        
        guard !portData.isEmpty else { return }
        
        portBuffer.contents().copyMemory(from: portData, byteCount: MemoryLayout<SIMD4<Float>>.stride * portData.count)
        
        encoder.setRenderPipelineState(pipeline)
        encoder.setVertexBuffer(uniformBuffer, offset: 0, index: 0)
        encoder.setVertexBuffer(portBuffer, offset: 0, index: 1)
        encoder.setFragmentBuffer(uniformBuffer, offset: 0, index: 0)
        
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 6, instanceCount: portData.count)
    }
    
    private func isPortConnected(nodeId: UUID, portType: PortType, index: Int) -> Bool {
        guard let model = model else { return false }
        
        return model.connections.contains { conn in
            if portType == .output {
                return conn.fromNodeId == nodeId && conn.fromPortIndex == index
            } else {
                return conn.toNodeId == nodeId && conn.toPortIndex == index
            }
        }
    }
    
    private func drawConnections(encoder: MTLRenderCommandEncoder) {
        guard let model = model else { return }
        
        // For now, draw connections as simple lines using the grid pipeline
        // TODO: Implement bezier curve rendering
        for connection in model.connections {
            guard let fromNode = model.getNode(id: connection.fromNodeId),
                  let toNode = model.getNode(id: connection.toNodeId) else { continue }
            
            let fromPos = fromNode.outputPortPosition(at: connection.fromPortIndex)
            let toPos = toNode.inputPortPosition(at: connection.toPortIndex)
            
            // Draw simple bezier approximation
            drawBezierConnection(encoder: encoder, from: fromPos, to: toPos, color: Theme.phosphor.simd)
        }
    }
    
    private func drawBezierConnection(encoder: MTLRenderCommandEncoder, from: SIMD2<Float>, to: SIMD2<Float>, color: SIMD4<Float>) {
        // Simple bezier curve rendered as line segments
        // Using quad strip approach
        let segments = 20
        var points: [SIMD2<Float>] = []
        
        let controlOffset = abs(to.x - from.x) * 0.5
        let cp1 = SIMD2<Float>(from.x + controlOffset, from.y)
        let cp2 = SIMD2<Float>(to.x - controlOffset, to.y)
        
        for i in 0...segments {
            let t = Float(i) / Float(segments)
            let point = cubicBezier(from, cp1, cp2, to, t)
            points.append(point)
        }
        
        // Draw as line strip using basic geometry
        // For simplicity, we skip this detailed implementation
        // The full version would use the connection pipeline
    }
    
    private func cubicBezier(_ p0: SIMD2<Float>, _ p1: SIMD2<Float>, _ p2: SIMD2<Float>, _ p3: SIMD2<Float>, _ t: Float) -> SIMD2<Float> {
        let mt = 1 - t
        let mt2 = mt * mt
        let mt3 = mt2 * mt
        let t2 = t * t
        let t3 = t2 * t
        
        return p0 * mt3 + p1 * 3 * mt2 * t + p2 * 3 * mt * t2 + p3 * t3
    }
    
    private func drawConnectionPreview(encoder: MTLRenderCommandEncoder, from: SIMD2<Float>, to: SIMD2<Float>) {
        // Draw preview connection during drag
        drawBezierConnection(encoder: encoder, from: from, to: to, color: Theme.cyan.simd * SIMD4<Float>(1, 1, 1, 0.7))
    }
    
    private func drawSelectionBox(encoder: MTLRenderCommandEncoder, start: SIMD2<Float>, end: SIMD2<Float>) {
        guard let pipeline = selectionBoxPipelineState else { return }
        
        let minX = min(start.x, end.x)
        let minY = min(start.y, end.y)
        let maxX = max(start.x, end.x)
        let maxY = max(start.y, end.y)
        
        var bounds = SIMD4<Float>(minX, minY, maxX, maxY)
        
        encoder.setRenderPipelineState(pipeline)
        encoder.setVertexBuffer(uniformBuffer, offset: 0, index: 0)
        encoder.setVertexBytes(&bounds, length: MemoryLayout<SIMD4<Float>>.size, index: 1)
        encoder.setFragmentBuffer(uniformBuffer, offset: 0, index: 0)
        
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 6)
    }
}
