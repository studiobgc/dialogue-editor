/**
 * Offscreen canvas caching for node rendering
 * Nodes are rendered to offscreen canvases and cached for fast blitting
 */

import { Node } from '../types/graph';

interface CachedNode {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  width: number;
  height: number;
  scale: number;
  version: number;
  lastUsed: number;
}

export class NodeCache {
  private cache: Map<string, CachedNode> = new Map();
  private nodeVersions: Map<string, number> = new Map();
  private maxCacheSize: number = 200;
  private padding: number = 20; // Extra space for shadows/glows
  private useOffscreen: boolean;

  constructor() {
    // Check if OffscreenCanvas is available
    this.useOffscreen = typeof OffscreenCanvas !== 'undefined';
  }

  /**
   * Mark a node as dirty (needs re-render)
   */
  invalidate(nodeId: string): void {
    const version = this.nodeVersions.get(nodeId) || 0;
    this.nodeVersions.set(nodeId, version + 1);
  }

  /**
   * Invalidate all cached nodes
   */
  invalidateAll(): void {
    for (const nodeId of this.cache.keys()) {
      this.invalidate(nodeId);
    }
  }

  /**
   * Get or create a cached canvas for a node
   */
  getOrCreate(
    node: Node,
    scale: number,
    renderFn: (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, node: Node) => void
  ): CachedNode {
    const currentVersion = this.nodeVersions.get(node.id) || 0;
    const cached = this.cache.get(node.id);

    // Check if cache is valid
    if (cached && cached.version === currentVersion && Math.abs(cached.scale - scale) < 0.01) {
      cached.lastUsed = performance.now();
      return cached;
    }

    // Create new cached canvas
    const width = Math.ceil((node.size.width + this.padding * 2) * scale);
    const height = Math.ceil((node.size.height + this.padding * 2) * scale);

    let canvas: OffscreenCanvas | HTMLCanvasElement;
    let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;

    if (this.useOffscreen) {
      canvas = new OffscreenCanvas(width, height);
      ctx = canvas.getContext('2d');
    } else {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      ctx = canvas.getContext('2d');
    }

    if (!ctx) {
      throw new Error('Failed to create canvas context');
    }

    // Scale and translate for padding
    ctx.scale(scale, scale);
    ctx.translate(this.padding, this.padding);

    // Render the node
    renderFn(ctx, node);

    const cachedNode: CachedNode = {
      canvas,
      ctx,
      width,
      height,
      scale,
      version: currentVersion,
      lastUsed: performance.now()
    };

    this.cache.set(node.id, cachedNode);
    this.evictIfNeeded();

    return cachedNode;
  }

  /**
   * Draw a cached node to the main canvas
   */
  draw(
    mainCtx: CanvasRenderingContext2D,
    node: Node,
    cached: CachedNode
  ): void {
    const x = node.position.x - this.padding;
    const y = node.position.y - this.padding;
    
    mainCtx.drawImage(
      cached.canvas as CanvasImageSource,
      x,
      y,
      cached.width / cached.scale,
      cached.height / cached.scale
    );
  }

  /**
   * Remove a node from cache
   */
  remove(nodeId: string): void {
    this.cache.delete(nodeId);
    this.nodeVersions.delete(nodeId);
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
    this.nodeVersions.clear();
  }

  /**
   * Evict least recently used entries if cache is too large
   */
  private evictIfNeeded(): void {
    if (this.cache.size <= this.maxCacheSize) return;

    // Sort by last used time
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);

    // Remove oldest entries
    const toRemove = entries.slice(0, this.cache.size - this.maxCacheSize);
    for (const [nodeId] of toRemove) {
      this.cache.delete(nodeId);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; memoryEstimate: number } {
    let memoryEstimate = 0;
    for (const cached of this.cache.values()) {
      // Estimate 4 bytes per pixel (RGBA)
      memoryEstimate += cached.width * cached.height * 4;
    }
    return {
      size: this.cache.size,
      memoryEstimate
    };
  }
}
