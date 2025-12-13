/**
 * Viewport manages the canvas coordinate system with pan and zoom
 */

import { Position } from '../types/graph';

export class Viewport {
  private offsetX = 0;
  private offsetY = 0;
  private zoom = 1;
  private minZoom = 0.1;
  private maxZoom = 3;
  private width = 0;
  private height = 0;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * Update viewport dimensions
   */
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /**
   * Get current zoom level
   */
  getZoom(): number {
    return this.zoom;
  }

  /**
   * Set zoom level
   */
  setZoom(zoom: number, centerX?: number, centerY?: number): void {
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    
    if (centerX !== undefined && centerY !== undefined) {
      // Zoom towards the specified point
      const worldBefore = this.toWorldCoords({ x: centerX, y: centerY });
      this.zoom = newZoom;
      const worldAfter = this.toWorldCoords({ x: centerX, y: centerY });
      
      this.offsetX += (worldAfter.x - worldBefore.x) * this.zoom;
      this.offsetY += (worldAfter.y - worldBefore.y) * this.zoom;
    } else {
      this.zoom = newZoom;
    }
  }

  /**
   * Get current offset
   */
  getOffset(): Position {
    return { x: this.offsetX, y: this.offsetY };
  }

  /**
   * Get current pan (alias for getOffset)
   */
  getPan(): Position {
    return { x: this.offsetX, y: this.offsetY };
  }

  /**
   * Set offset
   */
  setOffset(x: number, y: number): void {
    this.offsetX = x;
    this.offsetY = y;
  }

  /**
   * Set pan (alias for setOffset)
   */
  setPan(x: number, y: number): void {
    this.offsetX = x;
    this.offsetY = y;
  }

  /**
   * Pan the viewport
   */
  pan(deltaX: number, deltaY: number): void {
    this.offsetX += deltaX;
    this.offsetY += deltaY;
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  toWorldCoords(screenPos: Position): Position {
    return {
      x: (screenPos.x - this.offsetX) / this.zoom,
      y: (screenPos.y - this.offsetY) / this.zoom
    };
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  toScreenCoords(worldPos: Position): Position {
    return {
      x: worldPos.x * this.zoom + this.offsetX,
      y: worldPos.y * this.zoom + this.offsetY
    };
  }

  /**
   * Get the visible world bounds
   */
  getVisibleBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    const topLeft = this.toWorldCoords({ x: 0, y: 0 });
    const bottomRight = this.toWorldCoords({ x: this.width, y: this.height });
    
    return {
      minX: topLeft.x,
      minY: topLeft.y,
      maxX: bottomRight.x,
      maxY: bottomRight.y
    };
  }

  /**
   * Check if a rectangle is visible in the viewport
   */
  isRectVisible(x: number, y: number, width: number, height: number): boolean {
    const bounds = this.getVisibleBounds();
    return !(x + width < bounds.minX || 
             x > bounds.maxX || 
             y + height < bounds.minY || 
             y > bounds.maxY);
  }

  /**
   * Center the viewport on a position
   */
  centerOn(worldPos: Position): void {
    this.offsetX = this.width / 2 - worldPos.x * this.zoom;
    this.offsetY = this.height / 2 - worldPos.y * this.zoom;
  }

  /**
   * Fit all content in the viewport
   */
  fitBounds(minX: number, minY: number, maxX: number, maxY: number, padding = 50): void {
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    if (contentWidth <= 0 || contentHeight <= 0) return;
    
    const scaleX = (this.width - padding * 2) / contentWidth;
    const scaleY = (this.height - padding * 2) / contentHeight;
    
    this.zoom = Math.min(scaleX, scaleY, 1);
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    this.centerOn({ x: centerX, y: centerY });
  }

  /**
   * Reset viewport to default
   */
  reset(): void {
    this.offsetX = 0;
    this.offsetY = 0;
    this.zoom = 1;
  }

  /**
   * Apply the viewport transform to a canvas context
   */
  applyTransform(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(this.zoom, 0, 0, this.zoom, this.offsetX, this.offsetY);
  }

  /**
   * Reset the canvas transform
   */
  resetTransform(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
