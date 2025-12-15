/**
 * Viewport manages the canvas coordinate system with pan and zoom
 * Features: cursor-anchored zoom, inertia scrolling, animated transitions, zoom snapping
 */

import { Position } from '../types/graph';

// Common zoom levels for snapping (Figma-style)
const ZOOM_LEVELS = [0.02, 0.03, 0.05, 0.1, 0.125, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8, 16, 32, 64, 128, 256];

// Easing functions
const easeOutExpo = (t: number): number => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

interface AnimationState {
  startTime: number;
  duration: number;
  startZoom: number;
  targetZoom: number;
  startOffsetX: number;
  startOffsetY: number;
  targetOffsetX: number;
  targetOffsetY: number;
  anchorX?: number;
  anchorY?: number;
}

interface InertiaState {
  velocityX: number;
  velocityY: number;
  lastTime: number;
  active: boolean;
}

export class Viewport {
  private offsetX = 0;
  private offsetY = 0;
  private zoom = 1;
  private minZoom = 0.015; // 1.5% - Figma's lower limit
  private maxZoom = 256;   // 25600% - Figma's upper limit
  private width = 0;
  private height = 0;
  
  // Animation state
  private animation: AnimationState | null = null;
  private animationFrame: number | null = null;
  private onAnimationUpdate: (() => void) | null = null;
  
  // Inertia state for momentum scrolling
  private inertia: InertiaState = {
    velocityX: 0,
    velocityY: 0,
    lastTime: 0,
    active: false
  };
  private inertiaFrame: number | null = null;
  
  // Pan velocity tracking for inertia
  private panHistory: Array<{ x: number; y: number; time: number }> = [];
  private readonly INERTIA_FRICTION = 0.92; // Decay factor per frame
  private readonly INERTIA_MIN_VELOCITY = 0.5; // Stop threshold
  private readonly PAN_HISTORY_SIZE = 5;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /**
   * Set callback for animation/inertia updates (to trigger re-render)
   */
  setAnimationCallback(callback: () => void): void {
    this.onAnimationUpdate = callback;
  }

  /**
   * Update viewport dimensions
   */
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /**
   * Get viewport dimensions
   */
  getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /**
   * Get current zoom level
   */
  getZoom(): number {
    return this.zoom;
  }

  /**
   * Get zoom as percentage string
   */
  getZoomPercent(): string {
    return `${Math.round(this.zoom * 100)}%`;
  }

  /**
   * Set zoom level, optionally anchored to a screen point (cursor position)
   * Uses the correct mathematical formula to keep the world point under
   * the cursor stationary during zoom.
   */
  setZoom(newZoom: number, anchorScreenX?: number, anchorScreenY?: number): void {
    const clampedZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
    
    if (anchorScreenX !== undefined && anchorScreenY !== undefined) {
      // Cursor-anchored zoom:
      // 1. Find the world point currently under the cursor
      // 2. After zoom, that same world point should still be under the cursor
      // 
      // Before: worldPoint = (screenPos - offset) / oldZoom
      // After:  screenPos = worldPoint * newZoom + newOffset
      // Therefore: newOffset = screenPos - worldPoint * newZoom
      
      const worldX = (anchorScreenX - this.offsetX) / this.zoom;
      const worldY = (anchorScreenY - this.offsetY) / this.zoom;
      
      this.zoom = clampedZoom;
      
      this.offsetX = anchorScreenX - worldX * this.zoom;
      this.offsetY = anchorScreenY - worldY * this.zoom;
    } else {
      // Zoom to center of viewport
      const centerX = this.width / 2;
      const centerY = this.height / 2;
      
      const worldX = (centerX - this.offsetX) / this.zoom;
      const worldY = (centerY - this.offsetY) / this.zoom;
      
      this.zoom = clampedZoom;
      
      this.offsetX = centerX - worldX * this.zoom;
      this.offsetY = centerY - worldY * this.zoom;
    }
  }

  /**
   * Animate zoom to a target level with easing
   */
  animateZoomTo(
    targetZoom: number, 
    anchorScreenX?: number, 
    anchorScreenY?: number,
    duration = 200
  ): void {
    this.stopAnimation();
    
    const clampedTarget = Math.max(this.minZoom, Math.min(this.maxZoom, targetZoom));
    
    // Calculate target offset to maintain anchor point
    const anchorX = anchorScreenX ?? this.width / 2;
    const anchorY = anchorScreenY ?? this.height / 2;
    
    const worldX = (anchorX - this.offsetX) / this.zoom;
    const worldY = (anchorY - this.offsetY) / this.zoom;
    
    const targetOffsetX = anchorX - worldX * clampedTarget;
    const targetOffsetY = anchorY - worldY * clampedTarget;
    
    this.animation = {
      startTime: performance.now(),
      duration,
      startZoom: this.zoom,
      targetZoom: clampedTarget,
      startOffsetX: this.offsetX,
      startOffsetY: this.offsetY,
      targetOffsetX,
      targetOffsetY,
      anchorX,
      anchorY
    };
    
    this.runAnimation();
  }

  /**
   * Zoom in to next zoom level (with animation)
   */
  zoomIn(anchorScreenX?: number, anchorScreenY?: number): void {
    const nextLevel = this.getNextZoomLevel(1);
    this.animateZoomTo(nextLevel, anchorScreenX, anchorScreenY);
  }

  /**
   * Zoom out to previous zoom level (with animation)
   */
  zoomOut(anchorScreenX?: number, anchorScreenY?: number): void {
    const prevLevel = this.getNextZoomLevel(-1);
    this.animateZoomTo(prevLevel, anchorScreenX, anchorScreenY);
  }

  /**
   * Zoom to 100% (with animation)
   */
  zoomToActual(anchorScreenX?: number, anchorScreenY?: number): void {
    this.animateZoomTo(1, anchorScreenX, anchorScreenY);
  }

  /**
   * Zoom to fit content (with animation)
   */
  animateFitBounds(minX: number, minY: number, maxX: number, maxY: number, padding = 50): void {
    this.stopAnimation();
    
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    if (contentWidth <= 0 || contentHeight <= 0) return;
    
    const scaleX = (this.width - padding * 2) / contentWidth;
    const scaleY = (this.height - padding * 2) / contentHeight;
    const targetZoom = Math.min(scaleX, scaleY, 1);
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    const targetOffsetX = this.width / 2 - centerX * targetZoom;
    const targetOffsetY = this.height / 2 - centerY * targetZoom;
    
    this.animation = {
      startTime: performance.now(),
      duration: 300,
      startZoom: this.zoom,
      targetZoom,
      startOffsetX: this.offsetX,
      startOffsetY: this.offsetY,
      targetOffsetX,
      targetOffsetY
    };
    
    this.runAnimation();
  }

  /**
   * Get the next zoom level in direction (-1 = out, 1 = in)
   */
  private getNextZoomLevel(direction: number): number {
    const current = this.zoom;
    
    if (direction > 0) {
      // Zoom in: find next level greater than current
      for (const level of ZOOM_LEVELS) {
        if (level > current * 1.01) return level;
      }
      return ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
    } else {
      // Zoom out: find previous level less than current
      for (let i = ZOOM_LEVELS.length - 1; i >= 0; i--) {
        if (ZOOM_LEVELS[i] < current * 0.99) return ZOOM_LEVELS[i];
      }
      return ZOOM_LEVELS[0];
    }
  }

  /**
   * Snap to nearest zoom level if close
   */
  snapToZoomLevel(threshold = 0.03): boolean {
    for (const level of ZOOM_LEVELS) {
      if (Math.abs(this.zoom - level) / level < threshold) {
        this.zoom = level;
        return true;
      }
    }
    return false;
  }

  private runAnimation(): void {
    const animate = () => {
      if (!this.animation) return;
      
      const elapsed = performance.now() - this.animation.startTime;
      const progress = Math.min(1, elapsed / this.animation.duration);
      const eased = easeOutExpo(progress);
      
      this.zoom = this.animation.startZoom + 
        (this.animation.targetZoom - this.animation.startZoom) * eased;
      this.offsetX = this.animation.startOffsetX + 
        (this.animation.targetOffsetX - this.animation.startOffsetX) * eased;
      this.offsetY = this.animation.startOffsetY + 
        (this.animation.targetOffsetY - this.animation.startOffsetY) * eased;
      
      this.onAnimationUpdate?.();
      
      if (progress < 1) {
        this.animationFrame = requestAnimationFrame(animate);
      } else {
        this.animation = null;
        this.animationFrame = null;
      }
    };
    
    this.animationFrame = requestAnimationFrame(animate);
  }

  private stopAnimation(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.animation = null;
  }

  /**
   * Check if currently animating
   */
  isAnimating(): boolean {
    return this.animation !== null || this.inertia.active;
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
   * Pan the viewport and track velocity for inertia
   */
  pan(deltaX: number, deltaY: number): void {
    this.stopInertia();
    
    this.offsetX += deltaX;
    this.offsetY += deltaY;
    
    // Track pan history for velocity calculation
    const now = performance.now();
    this.panHistory.push({ x: deltaX, y: deltaY, time: now });
    
    // Keep only recent history
    while (this.panHistory.length > this.PAN_HISTORY_SIZE) {
      this.panHistory.shift();
    }
  }

  /**
   * Start inertia based on recent pan velocity
   */
  startInertia(): void {
    if (this.panHistory.length < 2) {
      this.panHistory = [];
      return;
    }
    
    // Calculate average velocity from recent pan events
    const now = performance.now();
    let totalDx = 0;
    let totalDy = 0;
    let count = 0;
    
    for (const entry of this.panHistory) {
      // Only consider recent entries (last 100ms)
      if (now - entry.time < 100) {
        totalDx += entry.x;
        totalDy += entry.y;
        count++;
      }
    }
    
    this.panHistory = [];
    
    if (count === 0) return;
    
    // Calculate velocity (pixels per frame at 60fps)
    const velocityX = (totalDx / count) * 0.8;
    const velocityY = (totalDy / count) * 0.8;
    
    // Only start inertia if velocity is significant
    const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    if (speed < this.INERTIA_MIN_VELOCITY * 2) return;
    
    this.inertia = {
      velocityX,
      velocityY,
      lastTime: now,
      active: true
    };
    
    this.runInertia();
  }

  private runInertia(): void {
    const animate = () => {
      if (!this.inertia.active) return;
      
      // Apply velocity
      this.offsetX += this.inertia.velocityX;
      this.offsetY += this.inertia.velocityY;
      
      // Apply friction
      this.inertia.velocityX *= this.INERTIA_FRICTION;
      this.inertia.velocityY *= this.INERTIA_FRICTION;
      
      // Check if we should stop
      const speed = Math.sqrt(
        this.inertia.velocityX * this.inertia.velocityX + 
        this.inertia.velocityY * this.inertia.velocityY
      );
      
      this.onAnimationUpdate?.();
      
      if (speed > this.INERTIA_MIN_VELOCITY) {
        this.inertiaFrame = requestAnimationFrame(animate);
      } else {
        this.stopInertia();
      }
    };
    
    this.inertiaFrame = requestAnimationFrame(animate);
  }

  /**
   * Stop inertia scrolling
   */
  stopInertia(): void {
    this.inertia.active = false;
    if (this.inertiaFrame) {
      cancelAnimationFrame(this.inertiaFrame);
      this.inertiaFrame = null;
    }
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
   * Animate centering on a position
   */
  animateCenterOn(worldPos: Position, duration = 300): void {
    this.stopAnimation();
    
    const targetOffsetX = this.width / 2 - worldPos.x * this.zoom;
    const targetOffsetY = this.height / 2 - worldPos.y * this.zoom;
    
    this.animation = {
      startTime: performance.now(),
      duration,
      startZoom: this.zoom,
      targetZoom: this.zoom,
      startOffsetX: this.offsetX,
      startOffsetY: this.offsetY,
      targetOffsetX,
      targetOffsetY
    };
    
    this.runAnimation();
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
   * Reset viewport to default - center on origin
   */
  reset(): void {
    this.zoom = 1;
    // Center the viewport so origin (0,0) is visible in the middle-left area
    this.offsetX = this.width * 0.3;
    this.offsetY = this.height * 0.3;
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

  /**
   * Snap a world coordinate to the nearest pixel at current zoom level
   * Helps avoid subpixel jitter at extreme zoom levels
   */
  snapToPixel(worldCoord: number): number {
    // Convert to screen, round, convert back
    const screenCoord = worldCoord * this.zoom + this.offsetX;
    const snappedScreen = Math.round(screenCoord);
    return (snappedScreen - this.offsetX) / this.zoom;
  }

  /**
   * Snap a position to the nearest pixel at current zoom level
   */
  snapPositionToPixel(pos: Position): Position {
    return {
      x: this.snapToPixel(pos.x),
      y: this.snapToPixel(pos.y)
    };
  }

  /**
   * Get the minimum movement threshold at current zoom level
   * Used to prevent micro-movements from causing jitter
   */
  getMinMovementThreshold(): number {
    return 1 / this.zoom;
  }
}
