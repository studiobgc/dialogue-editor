/**
 * Layout Utilities - Smart positioning and auto-layout for nodes
 * 
 * Prevents node overlap and provides intelligent positioning
 */

import { Node, Position } from '../types/graph';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;
const NODE_PADDING = 40; // Min space between nodes
const GRID_SIZE = 20;

/**
 * Find a non-overlapping position for a new node
 */
export function findNonOverlappingPosition(
  nodes: Node[],
  targetPos: Position,
  nodeWidth: number = NODE_WIDTH,
  nodeHeight: number = NODE_HEIGHT
): Position {
  // Snap to grid first
  let x = Math.round(targetPos.x / GRID_SIZE) * GRID_SIZE;
  let y = Math.round(targetPos.y / GRID_SIZE) * GRID_SIZE;

  // Check if position overlaps with any existing node
  let attempts = 0;
  const maxAttempts = 50;
  
  while (attempts < maxAttempts && hasOverlap(nodes, { x, y }, nodeWidth, nodeHeight)) {
    // Try positions in a spiral pattern
    const spiralOffset = getSpiralOffset(attempts);
    x = Math.round((targetPos.x + spiralOffset.x) / GRID_SIZE) * GRID_SIZE;
    y = Math.round((targetPos.y + spiralOffset.y) / GRID_SIZE) * GRID_SIZE;
    attempts++;
  }

  return { x, y };
}

/**
 * Check if a position would overlap with existing nodes
 */
function hasOverlap(
  nodes: Node[],
  pos: Position,
  width: number,
  height: number
): boolean {
  const padding = NODE_PADDING;
  
  for (const node of nodes) {
    const nodeWidth = node.size?.width || NODE_WIDTH;
    const nodeHeight = node.size?.height || NODE_HEIGHT;
    
    // Check bounding box overlap with padding
    const overlapsX = 
      pos.x < node.position.x + nodeWidth + padding &&
      pos.x + width + padding > node.position.x;
    const overlapsY = 
      pos.y < node.position.y + nodeHeight + padding &&
      pos.y + height + padding > node.position.y;
      
    if (overlapsX && overlapsY) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get offset for spiral search pattern
 */
function getSpiralOffset(index: number): Position {
  if (index === 0) return { x: 0, y: 0 };
  
  // Spiral outward: right, down, left, up, repeat with increasing distance
  const layer = Math.ceil(Math.sqrt(index));
  const step = (NODE_WIDTH + NODE_PADDING) * layer;
  const direction = index % 4;
  
  switch (direction) {
    case 0: return { x: step, y: 0 };         // Right
    case 1: return { x: 0, y: step };         // Down
    case 2: return { x: -step, y: 0 };        // Left
    case 3: return { x: 0, y: -step };        // Up
    default: return { x: step, y: step };
  }
}

/**
 * Find position for a node that should appear after another node (connected)
 */
export function findPositionAfterNode(
  nodes: Node[],
  sourceNode: Node,
  direction: 'right' | 'below' = 'right'
): Position {
  const sourceWidth = sourceNode.size?.width || NODE_WIDTH;
  const sourceHeight = sourceNode.size?.height || NODE_HEIGHT;
  
  let targetPos: Position;
  
  if (direction === 'right') {
    targetPos = {
      x: sourceNode.position.x + sourceWidth + NODE_PADDING * 2,
      y: sourceNode.position.y
    };
  } else {
    targetPos = {
      x: sourceNode.position.x,
      y: sourceNode.position.y + sourceHeight + NODE_PADDING * 2
    };
  }
  
  return findNonOverlappingPosition(nodes, targetPos);
}

/**
 * Find position for a branch node (offset down from source)
 */
export function findBranchPosition(
  nodes: Node[],
  sourceNode: Node,
  branchIndex: number = 0
): Position {
  const sourceWidth = sourceNode.size?.width || NODE_WIDTH;
  const sourceHeight = sourceNode.size?.height || NODE_HEIGHT;
  
  const targetPos = {
    x: sourceNode.position.x + sourceWidth + NODE_PADDING * 2,
    y: sourceNode.position.y + (NODE_HEIGHT + NODE_PADDING) * branchIndex
  };
  
  return findNonOverlappingPosition(nodes, targetPos);
}

/**
 * Auto-layout nodes in a tree structure from a root node
 */
export function autoLayoutFromNode(
  nodes: Node[],
  connections: { sourceId: string; targetId: string }[],
  rootNodeId: string
): Map<string, Position> {
  const positions = new Map<string, Position>();
  const visited = new Set<string>();
  
  const rootNode = nodes.find(n => n.id === rootNodeId);
  if (!rootNode) return positions;
  
  // BFS to layout nodes
  const queue: { nodeId: string; depth: number; index: number }[] = [
    { nodeId: rootNodeId, depth: 0, index: 0 }
  ];
  
  const depthCounts: number[] = [];
  
  while (queue.length > 0) {
    const { nodeId, depth, index } = queue.shift()!;
    
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) continue;
    
    // Calculate position based on depth and index
    const x = rootNode.position.x + depth * (NODE_WIDTH + NODE_PADDING * 3);
    const y = rootNode.position.y + index * (NODE_HEIGHT + NODE_PADDING);
    
    positions.set(nodeId, { x, y });
    
    // Find children
    const children = connections
      .filter(c => c.sourceId === nodeId)
      .map(c => c.targetId)
      .filter(id => !visited.has(id));
    
    // Track depth count for next level indexing
    if (!depthCounts[depth + 1]) depthCounts[depth + 1] = 0;
    
    children.forEach(childId => {
      queue.push({ 
        nodeId: childId, 
        depth: depth + 1, 
        index: depthCounts[depth + 1]++ 
      });
    });
  }
  
  return positions;
}
