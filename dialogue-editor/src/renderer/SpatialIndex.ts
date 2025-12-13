/**
 * Spatial indexing for efficient hit testing and culling
 * Uses a simple grid-based approach for O(1) lookups
 */

import { Node, Position } from '../types/graph';

interface GridCell {
  nodeIds: Set<string>;
}

export class SpatialIndex {
  private cellSize: number;
  private grid: Map<string, GridCell> = new Map();
  private nodePositions: Map<string, { x: number; y: number; width: number; height: number }> = new Map();

  constructor(cellSize: number = 200) {
    this.cellSize = cellSize;
  }

  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  private getCellsForRect(x: number, y: number, width: number, height: number): string[] {
    const cells: string[] = [];
    const startCellX = Math.floor(x / this.cellSize);
    const startCellY = Math.floor(y / this.cellSize);
    const endCellX = Math.floor((x + width) / this.cellSize);
    const endCellY = Math.floor((y + height) / this.cellSize);

    for (let cx = startCellX; cx <= endCellX; cx++) {
      for (let cy = startCellY; cy <= endCellY; cy++) {
        cells.push(`${cx},${cy}`);
      }
    }
    return cells;
  }

  clear(): void {
    this.grid.clear();
    this.nodePositions.clear();
  }

  insert(node: Node): void {
    const { x, y } = node.position;
    const { width, height } = node.size;

    // Remove from old position if exists
    this.remove(node.id);

    // Store position
    this.nodePositions.set(node.id, { x, y, width, height });

    // Insert into all overlapping cells
    const cells = this.getCellsForRect(x, y, width, height);
    for (const cellKey of cells) {
      let cell = this.grid.get(cellKey);
      if (!cell) {
        cell = { nodeIds: new Set() };
        this.grid.set(cellKey, cell);
      }
      cell.nodeIds.add(node.id);
    }
  }

  remove(nodeId: string): void {
    const pos = this.nodePositions.get(nodeId);
    if (!pos) return;

    const cells = this.getCellsForRect(pos.x, pos.y, pos.width, pos.height);
    for (const cellKey of cells) {
      const cell = this.grid.get(cellKey);
      if (cell) {
        cell.nodeIds.delete(nodeId);
        if (cell.nodeIds.size === 0) {
          this.grid.delete(cellKey);
        }
      }
    }
    this.nodePositions.delete(nodeId);
  }

  update(node: Node): void {
    this.insert(node); // insert handles removal of old position
  }

  /**
   * Get all node IDs that might be in the given rectangle
   */
  queryRect(x: number, y: number, width: number, height: number): Set<string> {
    const result = new Set<string>();
    const cells = this.getCellsForRect(x, y, width, height);
    
    for (const cellKey of cells) {
      const cell = this.grid.get(cellKey);
      if (cell) {
        for (const nodeId of cell.nodeIds) {
          result.add(nodeId);
        }
      }
    }
    return result;
  }

  /**
   * Get all node IDs near a point
   */
  queryPoint(x: number, y: number, radius: number = 0): Set<string> {
    return this.queryRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  /**
   * Rebuild the entire index from a list of nodes
   */
  rebuild(nodes: Node[]): void {
    this.clear();
    for (const node of nodes) {
      this.insert(node);
    }
  }
}
