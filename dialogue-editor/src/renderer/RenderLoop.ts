/**
 * High-performance render loop with frame budget management
 * Inspired by Figma's rendering architecture
 */

export interface RenderStats {
  fps: number;
  frameTime: number;
  renderTime: number;
  idleTime: number;
}

export type RenderCallback = (deltaTime: number) => void;

export class RenderLoop {
  private isRunning: boolean = false;
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fpsUpdateTime: number = 0;
  private currentFps: number = 60;
  
  // Frame budget management (target 60fps = 16.67ms per frame)
  private targetFrameTime: number = 1000 / 60;
  private frameTimeHistory: number[] = [];
  private maxHistoryLength: number = 60;
  
  // Render state
  private needsRender: boolean = true;
  private renderCallback: RenderCallback | null = null;
  private statsCallback: ((stats: RenderStats) => void) | null = null;
  
  // Priority queue for deferred work
  private deferredWork: Array<() => void> = [];
  private highPriorityWork: Array<() => void> = [];

  constructor() {
    this.lastFrameTime = performance.now();
    this.fpsUpdateTime = this.lastFrameTime;
  }

  start(renderCallback: RenderCallback): void {
    this.renderCallback = renderCallback;
    this.isRunning = true;
    this.scheduleFrame();
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  requestRender(): void {
    this.needsRender = true;
  }

  /**
   * Schedule high-priority work (runs before render)
   */
  scheduleHighPriority(work: () => void): void {
    this.highPriorityWork.push(work);
    this.needsRender = true;
  }

  /**
   * Schedule deferred work (runs if frame budget allows)
   */
  scheduleDeferred(work: () => void): void {
    this.deferredWork.push(work);
  }

  onStats(callback: (stats: RenderStats) => void): void {
    this.statsCallback = callback;
  }

  private scheduleFrame(): void {
    if (!this.isRunning) return;
    
    this.animationFrameId = requestAnimationFrame((timestamp) => {
      this.frame(timestamp);
    });
  }

  private frame(timestamp: number): void {
    const deltaTime = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;
    
    const frameStart = performance.now();
    
    // Process high-priority work first
    while (this.highPriorityWork.length > 0) {
      const work = this.highPriorityWork.shift();
      if (work) work();
    }
    
    // Render if needed
    let renderTime = 0;
    if (this.needsRender && this.renderCallback) {
      const renderStart = performance.now();
      this.renderCallback(deltaTime);
      renderTime = performance.now() - renderStart;
      this.needsRender = false;
    }
    
    const afterRender = performance.now();
    const timeSpent = afterRender - frameStart;
    const remainingBudget = this.targetFrameTime - timeSpent;
    
    // Process deferred work if we have budget
    if (remainingBudget > 2 && this.deferredWork.length > 0) {
      const workStart = performance.now();
      while (this.deferredWork.length > 0 && (performance.now() - workStart) < remainingBudget - 1) {
        const work = this.deferredWork.shift();
        if (work) work();
      }
    }
    
    // Update stats
    const frameEnd = performance.now();
    const frameTime = frameEnd - frameStart;
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > this.maxHistoryLength) {
      this.frameTimeHistory.shift();
    }
    
    // Update FPS every second
    this.frameCount++;
    if (timestamp - this.fpsUpdateTime >= 1000) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.fpsUpdateTime = timestamp;
      
      if (this.statsCallback) {
        const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;
        this.statsCallback({
          fps: this.currentFps,
          frameTime: avgFrameTime,
          renderTime,
          idleTime: Math.max(0, this.targetFrameTime - avgFrameTime)
        });
      }
    }
    
    // Schedule next frame
    this.scheduleFrame();
  }

  getFps(): number {
    return this.currentFps;
  }

  getAverageFrameTime(): number {
    if (this.frameTimeHistory.length === 0) return 0;
    return this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;
  }
}
