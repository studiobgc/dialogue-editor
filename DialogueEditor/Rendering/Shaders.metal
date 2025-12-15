#include <metal_stdlib>
using namespace metal;

// MARK: - Vertex Structures

struct NodeVertex {
    float2 position [[attribute(0)]];
    float2 texCoord [[attribute(1)]];
};

struct NodeInstance {
    float2 position;
    float2 size;
    float4 color;
    float4 glowColor;
    float cornerRadius;
    float glowIntensity;
    float isSelected;
    float isHovered;
};

struct ConnectionVertex {
    float2 position [[attribute(0)]];
    float progress [[attribute(1)]]; // 0-1 along the curve
};

struct ConnectionInstance {
    float4 color;
    float width;
    float glowIntensity;
    float isSelected;
    float padding;
};

// MARK: - Fragment Output

struct FragmentOutput {
    float4 color [[color(0)]];
};

// MARK: - Uniforms

struct Uniforms {
    float4x4 viewProjection;
    float2 viewportSize;
    float time;
    float scanlineOpacity;
    float scanlineFrequency;
    float padding1;
    float padding2;
    float padding3;
};

// MARK: - Node Vertex Shader

struct NodeVertexOut {
    float4 position [[position]];
    float2 texCoord;
    float4 color;
    float4 glowColor;
    float cornerRadius;
    float glowIntensity;
    float isSelected;
    float isHovered;
    float2 nodeSize;
    float2 localPos;
};

vertex NodeVertexOut node_vertex(
    uint vertexId [[vertex_id]],
    uint instanceId [[instance_id]],
    constant Uniforms& uniforms [[buffer(0)]],
    constant NodeInstance* instances [[buffer(1)]]
) {
    // Quad vertices (two triangles)
    float2 quadVerts[6] = {
        float2(0, 0), float2(1, 0), float2(0, 1),
        float2(1, 0), float2(1, 1), float2(0, 1)
    };
    
    NodeInstance instance = instances[instanceId];
    float2 localPos = quadVerts[vertexId];
    float2 worldPos = instance.position + localPos * instance.size;
    
    NodeVertexOut out;
    out.position = uniforms.viewProjection * float4(worldPos, 0, 1);
    out.texCoord = localPos;
    out.color = instance.color;
    out.glowColor = instance.glowColor;
    out.cornerRadius = instance.cornerRadius;
    out.glowIntensity = instance.glowIntensity;
    out.isSelected = instance.isSelected;
    out.isHovered = instance.isHovered;
    out.nodeSize = instance.size;
    out.localPos = localPos * instance.size;
    
    return out;
}

// MARK: - Node Fragment Shader (De Palma high contrast with Sneakers glow)

float roundedBoxSDF(float2 p, float2 b, float r) {
    float2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

fragment FragmentOutput node_fragment(
    NodeVertexOut in [[stage_in]],
    constant Uniforms& uniforms [[buffer(0)]]
) {
    FragmentOutput out;
    
    // Calculate SDF for rounded rectangle
    float2 center = in.nodeSize * 0.5;
    float2 p = in.localPos - center;
    float d = roundedBoxSDF(p, center - 1.0, in.cornerRadius);
    
    // Base node color with slight gradient (De Palma lighting)
    float4 baseColor = in.color;
    float gradientFactor = 1.0 - in.texCoord.y * 0.15;
    baseColor.rgb *= gradientFactor;
    
    // Selection highlight - bright border glow
    float selectionGlow = 0.0;
    if (in.isSelected > 0.5) {
        selectionGlow = smoothstep(3.0, 0.0, abs(d)) * 0.8;
    }
    
    // Hover highlight - subtle glow
    float hoverGlow = 0.0;
    if (in.isHovered > 0.5 && in.isSelected < 0.5) {
        hoverGlow = smoothstep(2.0, 0.0, abs(d)) * 0.4;
    }
    
    // Outer glow (Sneakers phosphor aesthetic)
    float outerGlow = smoothstep(8.0, 0.0, d) * in.glowIntensity * 0.3;
    
    // Combine
    float4 glowColor = in.glowColor;
    float4 selectionColor = float4(0.95, 0.95, 0.95, 1.0);
    
    // Node fill
    float alpha = 1.0 - smoothstep(-1.0, 0.5, d);
    float4 color = baseColor;
    
    // Add border
    float borderD = abs(d + 1.0);
    float border = 1.0 - smoothstep(0.0, 1.5, borderD);
    float4 borderColor = float4(baseColor.rgb * 1.3, 1.0);
    color = mix(color, borderColor, border * 0.5);
    
    // Add glows
    color.rgb += glowColor.rgb * outerGlow;
    color.rgb += selectionColor.rgb * selectionGlow;
    color.rgb += glowColor.rgb * hoverGlow;
    
    // Scanline effect (subtle CRT aesthetic)
    float scanline = sin(in.position.y * uniforms.scanlineFrequency) * 0.5 + 0.5;
    color.rgb *= 1.0 - scanline * uniforms.scanlineOpacity;
    
    color.a = alpha + outerGlow * 0.5;
    
    out.color = color;
    return out;
}

// MARK: - Connection Vertex Shader

struct ConnectionVertexOut {
    float4 position [[position]];
    float4 color;
    float width;
    float progress;
    float glowIntensity;
    float isSelected;
};

vertex ConnectionVertexOut connection_vertex(
    uint vertexId [[vertex_id]],
    constant Uniforms& uniforms [[buffer(0)]],
    constant float2* points [[buffer(1)]],
    constant ConnectionInstance& instance [[buffer(2)]],
    constant uint& pointCount [[buffer(3)]]
) {
    // Each segment is a quad (4 vertices)
    uint segmentId = vertexId / 4;
    uint localVertId = vertexId % 4;
    
    // Clamp to valid segments
    uint idx0 = min(segmentId, pointCount - 2);
    uint idx1 = min(segmentId + 1, pointCount - 1);
    
    float2 p0 = points[idx0];
    float2 p1 = points[idx1];
    
    // Calculate perpendicular for width
    float2 dir = normalize(p1 - p0);
    float2 perp = float2(-dir.y, dir.x) * instance.width * 0.5;
    
    // Quad corners
    float2 positions[4] = {
        p0 - perp, p0 + perp,
        p1 - perp, p1 + perp
    };
    
    float2 worldPos = positions[localVertId];
    float progress = float(segmentId + (localVertId >= 2 ? 1 : 0)) / float(pointCount - 1);
    
    ConnectionVertexOut out;
    out.position = uniforms.viewProjection * float4(worldPos, 0, 1);
    out.color = instance.color;
    out.width = instance.width;
    out.progress = progress;
    out.glowIntensity = instance.glowIntensity;
    out.isSelected = instance.isSelected;
    
    return out;
}

// MARK: - Connection Fragment Shader

fragment FragmentOutput connection_fragment(
    ConnectionVertexOut in [[stage_in]],
    constant Uniforms& uniforms [[buffer(0)]]
) {
    FragmentOutput out;
    
    float4 color = in.color;
    
    // Animated pulse along the connection (Sneakers data flow)
    float pulse = sin(in.progress * 6.28318 * 2.0 - uniforms.time * 3.0) * 0.5 + 0.5;
    color.rgb += color.rgb * pulse * 0.2 * in.glowIntensity;
    
    // Selection glow
    if (in.isSelected > 0.5) {
        color.rgb *= 1.3;
    }
    
    out.color = color;
    return out;
}

// MARK: - Grid Vertex Shader

struct GridVertexOut {
    float4 position [[position]];
    float2 worldPos;
};

vertex GridVertexOut grid_vertex(
    uint vertexId [[vertex_id]],
    constant Uniforms& uniforms [[buffer(0)]],
    constant float4& bounds [[buffer(1)]] // minX, minY, maxX, maxY
) {
    // Full-screen quad
    float2 quadVerts[6] = {
        float2(0, 0), float2(1, 0), float2(0, 1),
        float2(1, 0), float2(1, 1), float2(0, 1)
    };
    
    float2 uv = quadVerts[vertexId];
    float2 worldPos = float2(
        mix(bounds.x, bounds.z, uv.x),
        mix(bounds.y, bounds.w, uv.y)
    );
    
    GridVertexOut out;
    out.position = uniforms.viewProjection * float4(worldPos, 0, 1);
    out.worldPos = worldPos;
    
    return out;
}

// MARK: - Grid Fragment Shader (Sneakers terminal grid)

fragment FragmentOutput grid_fragment(
    GridVertexOut in [[stage_in]],
    constant Uniforms& uniforms [[buffer(0)]],
    constant float2& gridSize [[buffer(1)]] // minor, major
) {
    FragmentOutput out;
    
    float2 pos = in.worldPos;
    
    // Minor grid (dots like Figma)
    float2 minorGrid = fract(pos / gridSize.x);
    float minorDot = 1.0 - smoothstep(0.02, 0.04, length(minorGrid - 0.5));
    
    // Major grid (lines)
    float2 majorGrid = fract(pos / gridSize.y);
    float majorLineX = 1.0 - smoothstep(0.005, 0.01, abs(majorGrid.x - 0.5) * 2.0);
    float majorLineY = 1.0 - smoothstep(0.005, 0.01, abs(majorGrid.y - 0.5) * 2.0);
    float majorLine = max(majorLineX, majorLineY);
    
    // Origin crosshair glow
    float originDist = length(pos);
    float originGlow = smoothstep(50.0, 0.0, originDist) * 0.3;
    float originCross = 0.0;
    if (abs(pos.x) < 30.0 && abs(pos.y) < 2.0) originCross = 0.5;
    if (abs(pos.y) < 30.0 && abs(pos.x) < 2.0) originCross = 0.5;
    
    // Combine (Sneakers green phosphor)
    float3 gridColor = float3(0.15, 0.18, 0.22);
    float3 dotColor = float3(0.22, 0.25, 0.30);
    float3 originColor = float3(0.49, 0.23, 0.93); // Purple accent
    
    float3 color = gridColor;
    color = mix(color, dotColor, minorDot * 0.4);
    color = mix(color, dotColor * 1.2, majorLine * 0.3);
    color = mix(color, originColor, (originGlow + originCross) * 0.6);
    
    out.color = float4(color, 1.0);
    return out;
}

// MARK: - Port Vertex Shader

struct PortVertexOut {
    float4 position [[position]];
    float2 localPos;
    float4 color;
    float isConnected;
    float isHovered;
};

vertex PortVertexOut port_vertex(
    uint vertexId [[vertex_id]],
    uint instanceId [[instance_id]],
    constant Uniforms& uniforms [[buffer(0)]],
    constant float4* portData [[buffer(1)]] // x, y, isConnected, isHovered per port
) {
    float2 quadVerts[6] = {
        float2(-1, -1), float2(1, -1), float2(-1, 1),
        float2(1, -1), float2(1, 1), float2(-1, 1)
    };
    
    float4 data = portData[instanceId];
    float2 center = data.xy;
    float radius = 6.0;
    
    float2 localPos = quadVerts[vertexId];
    float2 worldPos = center + localPos * radius;
    
    PortVertexOut out;
    out.position = uniforms.viewProjection * float4(worldPos, 0, 1);
    out.localPos = localPos;
    out.color = float4(0.3, 0.85, 0.5, 1.0); // Phosphor green
    out.isConnected = data.z;
    out.isHovered = data.w;
    
    return out;
}

// MARK: - Port Fragment Shader

fragment FragmentOutput port_fragment(
    PortVertexOut in [[stage_in]],
    constant Uniforms& uniforms [[buffer(0)]]
) {
    FragmentOutput out;
    
    float dist = length(in.localPos);
    
    // Circle with glow
    float circle = 1.0 - smoothstep(0.7, 0.9, dist);
    float glow = 1.0 - smoothstep(0.5, 1.5, dist);
    
    float4 color = in.color;
    
    // Hollow if not connected
    if (in.isConnected < 0.5) {
        float inner = smoothstep(0.4, 0.5, dist);
        circle *= inner;
    }
    
    // Hover highlight
    if (in.isHovered > 0.5) {
        color.rgb *= 1.5;
        glow *= 1.5;
    }
    
    color.a = circle + glow * 0.3;
    color.rgb *= circle + glow * 0.5;
    
    out.color = color;
    return out;
}

// MARK: - Selection Box Shader

struct SelectionBoxVertexOut {
    float4 position [[position]];
    float2 texCoord;
};

vertex SelectionBoxVertexOut selection_box_vertex(
    uint vertexId [[vertex_id]],
    constant Uniforms& uniforms [[buffer(0)]],
    constant float4& bounds [[buffer(1)]] // minX, minY, maxX, maxY
) {
    float2 quadVerts[6] = {
        float2(0, 0), float2(1, 0), float2(0, 1),
        float2(1, 0), float2(1, 1), float2(0, 1)
    };
    
    float2 uv = quadVerts[vertexId];
    float2 worldPos = float2(
        mix(bounds.x, bounds.z, uv.x),
        mix(bounds.y, bounds.w, uv.y)
    );
    
    SelectionBoxVertexOut out;
    out.position = uniforms.viewProjection * float4(worldPos, 0, 1);
    out.texCoord = uv * float2(bounds.z - bounds.x, bounds.w - bounds.y);
    
    return out;
}

fragment FragmentOutput selection_box_fragment(
    SelectionBoxVertexOut in [[stage_in]],
    constant Uniforms& uniforms [[buffer(0)]]
) {
    FragmentOutput out;
    
    // Dashed border effect
    float dashSize = 8.0;
    float2 pos = in.texCoord;
    
    // Edge detection
    float edgeX = min(pos.x, in.texCoord.x);
    float edgeY = min(pos.y, in.texCoord.y);
    
    // Animated dash pattern
    float dash = fract((pos.x + pos.y + uniforms.time * 20.0) / dashSize);
    dash = step(0.5, dash);
    
    // Fill with transparency
    float4 fillColor = float4(0.49, 0.23, 0.93, 0.1);
    float4 borderColor = float4(0.49, 0.23, 0.93, 0.8 * dash);
    
    // Simple fill
    out.color = fillColor;
    
    return out;
}
