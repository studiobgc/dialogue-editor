/**
 * Project Manager for handling multiple dialogue projects
 * Supports create, save, load, delete, and switch between projects
 */

export interface ProjectMetadata {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  nodeCount: number;
  characterCount: number;
  thumbnail?: string;
}

export interface ProjectData {
  metadata: ProjectMetadata;
  graphData: string; // JSON serialized graph
}

export type OnProjectChangeCallback = (projectId: string, graphData: string | null) => void;

const STORAGE_KEY = 'dialogue-editor-projects';
const CURRENT_PROJECT_KEY = 'dialogue-editor-current-project';

export class ProjectManager {
  private projects: Map<string, ProjectData> = new Map();
  private currentProjectId: string | null = null;
  private onProjectChange: OnProjectChangeCallback;
  private modalElement: HTMLElement | null = null;

  constructor(onProjectChange: OnProjectChangeCallback) {
    this.onProjectChange = onProjectChange;
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as ProjectData[];
        data.forEach(p => this.projects.set(p.metadata.id, p));
      }
      this.currentProjectId = localStorage.getItem(CURRENT_PROJECT_KEY);
    } catch (e) {
      console.warn('Failed to load projects from storage:', e);
    }
  }

  private saveToStorage(): void {
    try {
      const data = Array.from(this.projects.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      if (this.currentProjectId) {
        localStorage.setItem(CURRENT_PROJECT_KEY, this.currentProjectId);
      }
    } catch (e) {
      console.warn('Failed to save projects to storage:', e);
    }
  }

  getCurrentProject(): ProjectData | null {
    if (!this.currentProjectId) return null;
    return this.projects.get(this.currentProjectId) || null;
  }

  getCurrentProjectId(): string | null {
    return this.currentProjectId;
  }

  getAllProjects(): ProjectMetadata[] {
    return Array.from(this.projects.values())
      .map(p => p.metadata)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  createProject(name: string, description?: string): ProjectData {
    const id = `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    const project: ProjectData = {
      metadata: {
        id,
        name,
        description,
        createdAt: now,
        updatedAt: now,
        nodeCount: 0,
        characterCount: 0
      },
      graphData: ''
    };

    this.projects.set(id, project);
    this.currentProjectId = id;
    this.saveToStorage();
    this.onProjectChange(id, null);
    
    return project;
  }

  saveCurrentProject(graphData: string, nodeCount: number, characterCount: number): void {
    if (!this.currentProjectId) return;
    
    const project = this.projects.get(this.currentProjectId);
    if (!project) return;

    project.graphData = graphData;
    project.metadata.updatedAt = Date.now();
    project.metadata.nodeCount = nodeCount;
    project.metadata.characterCount = characterCount;
    
    this.saveToStorage();
  }

  switchProject(projectId: string): void {
    const project = this.projects.get(projectId);
    if (!project) return;

    this.currentProjectId = projectId;
    this.saveToStorage();
    this.onProjectChange(projectId, project.graphData);
  }

  deleteProject(projectId: string): void {
    this.projects.delete(projectId);
    
    if (this.currentProjectId === projectId) {
      const remaining = Array.from(this.projects.keys());
      this.currentProjectId = remaining.length > 0 ? remaining[0] : null;
      
      if (this.currentProjectId) {
        const project = this.projects.get(this.currentProjectId);
        this.onProjectChange(this.currentProjectId, project?.graphData || null);
      } else {
        this.onProjectChange('', null);
      }
    }
    
    this.saveToStorage();
  }

  renameProject(projectId: string, newName: string): void {
    const project = this.projects.get(projectId);
    if (!project) return;

    project.metadata.name = newName;
    project.metadata.updatedAt = Date.now();
    this.saveToStorage();
  }

  duplicateProject(projectId: string): ProjectData | null {
    const source = this.projects.get(projectId);
    if (!source) return null;

    const newProject = this.createProject(
      `${source.metadata.name} (Copy)`,
      source.metadata.description
    );
    
    newProject.graphData = source.graphData;
    newProject.metadata.nodeCount = source.metadata.nodeCount;
    newProject.metadata.characterCount = source.metadata.characterCount;
    
    this.saveToStorage();
    return newProject;
  }

  showProjectBrowser(): void {
    this.renderModal();
  }

  hideProjectBrowser(): void {
    if (this.modalElement) {
      this.modalElement.classList.add('fade-out');
      setTimeout(() => {
        this.modalElement?.remove();
        this.modalElement = null;
      }, 300);
    }
  }

  private renderModal(): void {
    if (this.modalElement) {
      this.modalElement.remove();
    }

    this.modalElement = document.createElement('div');
    this.modalElement.className = 'project-browser-overlay';
    this.modalElement.innerHTML = `
      <div class="project-browser-modal">
        <div class="project-browser-header">
          <h2>Projects</h2>
          <button class="project-browser-close" id="project-browser-close">×</button>
        </div>
        
        <div class="project-browser-actions">
          <button class="project-browser-new-btn" id="project-new">
            <span class="project-new-icon">+</span>
            <span>New Project</span>
          </button>
        </div>
        
        <div class="project-browser-list" id="project-list">
          ${this.renderProjectList()}
        </div>
      </div>
    `;

    document.body.appendChild(this.modalElement);
    
    requestAnimationFrame(() => {
      this.modalElement?.classList.add('visible');
    });

    this.setupModalEvents();
  }

  private renderProjectList(): string {
    const projects = this.getAllProjects();
    
    if (projects.length === 0) {
      return `
        <div class="project-browser-empty">
          <div class="project-browser-empty-icon">📁</div>
          <div class="project-browser-empty-text">No projects yet</div>
          <div class="project-browser-empty-hint">Create a new project to get started</div>
        </div>
      `;
    }

    return projects.map(p => `
      <div class="project-card ${p.id === this.currentProjectId ? 'active' : ''}" data-project-id="${p.id}">
        <div class="project-card-content">
          <div class="project-card-name">${this.escapeHtml(p.name)}</div>
          <div class="project-card-meta">
            ${p.nodeCount} nodes · ${p.characterCount} characters
          </div>
          <div class="project-card-date">
            Updated ${this.formatDate(p.updatedAt)}
          </div>
        </div>
        <div class="project-card-actions">
          <button class="project-card-btn" data-action="open" data-project-id="${p.id}" title="Open">
            📂
          </button>
          <button class="project-card-btn" data-action="duplicate" data-project-id="${p.id}" title="Duplicate">
            📋
          </button>
          <button class="project-card-btn danger" data-action="delete" data-project-id="${p.id}" title="Delete">
            🗑️
          </button>
        </div>
      </div>
    `).join('');
  }

  private setupModalEvents(): void {
    const closeBtn = document.getElementById('project-browser-close');
    const newBtn = document.getElementById('project-new');
    const projectList = document.getElementById('project-list');

    closeBtn?.addEventListener('click', () => this.hideProjectBrowser());
    
    this.modalElement?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('project-browser-overlay')) {
        this.hideProjectBrowser();
      }
    });

    newBtn?.addEventListener('click', () => {
      const name = prompt('Project name:', 'New Dialogue');
      if (name) {
        this.createProject(name);
        this.hideProjectBrowser();
      }
    });

    projectList?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action;
      const projectId = target.dataset.projectId;

      if (!projectId) {
        // Check if clicked on card itself
        const card = target.closest('.project-card') as HTMLElement;
        if (card?.dataset.projectId) {
          this.switchProject(card.dataset.projectId);
          this.hideProjectBrowser();
        }
        return;
      }

      switch (action) {
        case 'open':
          this.switchProject(projectId);
          this.hideProjectBrowser();
          break;
        case 'duplicate':
          this.duplicateProject(projectId);
          this.renderModalContent();
          break;
        case 'delete':
          if (confirm('Delete this project? This cannot be undone.')) {
            this.deleteProject(projectId);
            this.renderModalContent();
          }
          break;
      }
    });
  }

  private renderModalContent(): void {
    const projectList = document.getElementById('project-list');
    if (projectList) {
      projectList.innerHTML = this.renderProjectList();
    }
  }

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return date.toLocaleDateString();
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
