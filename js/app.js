// Cosmo Dashboard - Main Application with SQLite Backend

// State
const state = {
    projects: [],
    ideas: [],
    tasks: [],
    logs: [],
    systemStatus: {}
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    updateTime();
    setInterval(updateTime, 1000);
    loadAllData();
    fetchSystemStatus();
    setInterval(fetchSystemStatus, 30000);
    refreshUptime(); // Load uptime data on startup
});

// Navigation
function initNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchView(view);
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`${viewName}-view`).classList.add('active');
}

// Time - EST timezone
function updateTime() {
    const now = new Date();
    const options = { 
        weekday: 'short', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZone: 'America/New_York'
    };
    document.getElementById('current-time').textContent = 
        now.toLocaleString('en-US', options) + ' EST';
}

// ==================== DATA LOADING ====================

async function loadAllData() {
    try {
        // Load projects
        const projectsRes = await fetch('/api/projects');
        state.projects = await projectsRes.json();
        
        // Load ideas
        const ideasRes = await fetch('/api/ideas');
        const ideasData = await ideasRes.json();
        state.ideas = ideasData.ideas || [];
        
        // Load tasks
        const tasksRes = await fetch('/api/tasks');
        state.tasks = await tasksRes.json();
        
        // Load logs
        const logsRes = await fetch('/api/logs');
        state.logs = await logsRes.json();
        
        renderAll();
        console.log('✅ All data loaded from SQLite');
    } catch (e) {
        console.error('Failed to load data:', e);
    }
}

function renderAll() {
    renderProjectsPreview();
    renderProjectsBoard();
    renderIdeas();
    renderTasks();
    renderTasksPreview();
    renderLogs();
    updateStats();
}

function updateStats() {
    document.getElementById('active-projects').textContent = 
        state.projects.filter(p => p.status !== 'complete').length;
    document.getElementById('tasks-today').textContent = 
        state.tasks.filter(t => !t.done).length;
}

// ==================== PROJECTS ====================

function renderProjectsPreview() {
    const container = document.getElementById('projects-preview-list');
    const activeProjects = state.projects.filter(p => p.status !== 'complete').slice(0, 3);
    
    container.innerHTML = activeProjects.map(p => `
        <div class="project-card-mini">
            <h4>${p.name}</h4>
            <p>${p.description || ''}</p>
        </div>
    `).join('') || '<p style="color: var(--text-secondary)">No active projects</p>';
}

function renderProjectsBoard() {
    const columns = ['pending-review', 'planning', 'in-progress', 'review', 'complete'];
    
    columns.forEach(status => {
        const container = document.getElementById(`col-${status}`);
        if (!container) return;
        
        const projects = state.projects.filter(p => p.status === status);
        
        container.innerHTML = projects.map(p => `
            <div class="project-card-mini" onclick="viewProject(${p.id})">
                <h4>${p.name}</h4>
                <p>${p.description || ''}</p>
            </div>
        `).join('') || '<p style="color: var(--text-secondary); font-size: 0.8rem;">No projects</p>';
    });
}

async function createProject() {
    openModal('New Project', `
        <form onsubmit="submitProject(event)">
            <div class="form-group">
                <label>Project Name</label>
                <input type="text" id="project-name" required>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="project-desc" rows="3"></textarea>
            </div>
            <button type="submit" class="btn-primary" style="width: 100%; margin-top: 1rem;">
                Create Project
            </button>
        </form>
    `);
}

async function submitProject(e) {
    e.preventDefault();
    
    const project = {
        id: Date.now(),
        name: document.getElementById('project-name').value,
        description: document.getElementById('project-desc').value,
        status: 'pending-review',
        created: new Date().toISOString().split('T')[0]
    };
    
    try {
        const response = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(project)
        });
        
        if (response.ok) {
            state.projects.unshift(project);
            closeModal();
            renderAll();
            console.log('✅ Project saved to SQLite');
        } else {
            console.error('Failed to save project');
        }
    } catch (err) {
        console.error('Error saving project:', err);
    }
}

// ==================== IDEAS ====================

function renderIdeas() {
    const container = document.getElementById('ideas-list');
    if (!container) return;
    
    const filter = document.getElementById('ideas-filter')?.value || 'all';
    let ideas = state.ideas;
    
    if (filter !== 'all') {
        ideas = ideas.filter(i => i.status === filter);
    }
    
    container.innerHTML = ideas.map(idea => `
        <div class="idea-card priority-${idea.priority}">
            <div class="idea-header">
                <span class="idea-title">${idea.title}</span>
                <span class="idea-status ${idea.status}">${idea.status}</span>
            </div>
            <p class="idea-desc">${idea.description || ''}</p>
            <div class="idea-meta">
                <span>👤 ${idea.assignee || 'team'}</span>
            </div>
            <div class="idea-actions">
                ${idea.status !== 'approved' && idea.status !== 'done' ? 
                    `<button class="btn-small btn-approve" onclick="approveIdea(${idea.id})">✅ Approve</button>` : ''}
            </div>
        </div>
    `).join('') || '<div class="no-ideas">No ideas found</div>';
}

async function showNewIdeaForm() {
    openModal('New Idea', `
        <form onsubmit="submitIdea(event)">
            <div class="form-group">
                <label>Title</label>
                <input type="text" id="idea-title" required>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="idea-desc" rows="3"></textarea>
            </div>
            <div class="form-group">
                <label>Priority</label>
                <select id="idea-priority">
                    <option value="low">Low</option>
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                </select>
            </div>
            <button type="submit" class="btn-primary" style="width: 100%; margin-top: 1rem;">
                Create Idea
            </button>
        </form>
    `);
}

async function submitIdea(e) {
    e.preventDefault();
    
    const idea = {
        id: Date.now(),
        title: document.getElementById('idea-title').value,
        description: document.getElementById('idea-desc').value,
        priority: document.getElementById('idea-priority').value,
        status: 'open',
        assignee: 'team',
        created: new Date().toISOString(),
        createdBy: 'Bowz'
    };
    
    try {
        const response = await fetch('/api/ideas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(idea)
        });
        
        if (response.ok) {
            state.ideas.unshift(idea);
            closeModal();
            renderIdeas();
            console.log('✅ Idea saved to SQLite');
        }
    } catch (err) {
        console.error('Error saving idea:', err);
    }
}

async function approveIdea(id) {
    const idea = state.ideas.find(i => i.id === id);
    if (!idea) return;
    
    const plan = generatePlan(idea);
    
    try {
        const response = await fetch(`/api/ideas/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan })
        });
        
        if (response.ok) {
            idea.status = 'approved';
            renderIdeas();
            console.log('✅ Idea approved and notification sent');
        }
    } catch (err) {
        console.error('Error approving idea:', err);
    }
}

function generatePlan(idea) {
    return `**Plan of Attack:**
1. Analyze requirements
2. Design architecture  
3. Implement core functionality
4. Test thoroughly
5. Deploy to production
6. Monitor and iterate`;
}

function filterIdeas(filter) {
    renderIdeas();
}

// ==================== TASKS ====================

function renderTasks() {
    const container = document.getElementById('tasks-container');
    if (!container) return;
    
    container.innerHTML = state.tasks.map(t => `
        <div class="task-item">
            <input type="checkbox" class="task-checkbox" 
                   onchange="toggleTask(${t.id})" ${t.done ? 'checked' : ''}>
            <div class="task-content">
                <div class="task-title" style="${t.done ? 'text-decoration: line-through; opacity: 0.5;' : ''}">
                    ${t.title}
                </div>
                <div class="task-meta">Project: ${t.project || 'General'}</div>
            </div>
            <span class="task-priority ${t.priority}">${t.priority}</span>
        </div>
    `).join('');
}

function renderTasksPreview() {
    const container = document.getElementById('tasks-preview-list');
    if (!container) return;
    
    const pendingTasks = state.tasks.filter(t => !t.done).slice(0, 4);
    
    container.innerHTML = pendingTasks.map(t => `
        <div class="task-item" style="padding: 0.5rem;">
            <input type="checkbox" class="task-checkbox" onchange="toggleTask(${t.id})" ${t.done ? 'checked' : ''}>
            <span class="task-title">${t.title}</span>
            <span class="task-priority ${t.priority}">${t.priority}</span>
        </div>
    `).join('') || '<p style="color: var(--text-secondary)">All tasks complete!</p>';
}

async function toggleTask(id) {
    try {
        const response = await fetch(`/api/tasks/${id}/toggle`, {
            method: 'POST'
        });
        
        if (response.ok) {
            const result = await response.json();
            const task = state.tasks.find(t => t.id === id);
            if (task) {
                task.done = result.done;
                renderAll();
            }
        }
    } catch (err) {
        console.error('Error toggling task:', err);
    }
}

// ==================== ACTIVITY LOG ====================

function renderLogs() {
    const container = document.getElementById('logs-container');
    if (!container) return;
    
    container.innerHTML = state.logs.map(log => {
        const time = new Date(log.time).toLocaleTimeString('en-US', {
            timeZone: 'America/New_York',
            hour: '2-digit', minute: '2-digit'
        });
        return `
            <div class="log-entry">
                <span class="log-time">${time}</span>
                <span class="log-type ${log.type}">${log.type.toUpperCase()}</span>
                <span>${log.message}</span>
            </div>
        `;
    }).join('') || '<p style="color: var(--text-secondary)">No activity yet</p>';
}

// ==================== SYSTEM STATUS ====================

async function fetchSystemStatus() {
    try {
        const res = await fetch('/api/system');
        const data = await res.json();
        document.getElementById('sys-cpu').textContent = data.cpu + '%';
        document.getElementById('sys-mem').textContent = data.memory + '%';
        document.getElementById('sys-disk').textContent = data.disk + '%';
    } catch (e) {
        console.log('System status error:', e);
    }
}

// ==================== UPTIME MONITORING ====================

async function refreshUptime() {
    try {
        const res = await fetch('/api/uptime');
        const data = await res.json();
        
        // Update services count
        const services = data.services || [];
        const onlineCount = services.filter(s => s.status === 'online').length;
        document.getElementById('services-online').textContent = `${onlineCount}/${services.length}`;
        
        // Update overall status
        const overallStatus = document.getElementById('overall-status');
        if (onlineCount === services.length) {
            overallStatus.textContent = '🟢';
            overallStatus.style.color = 'var(--accent-green)';
        } else {
            overallStatus.textContent = '🟡';
            overallStatus.style.color = 'var(--accent-yellow)';
        }
        
        // Render services list
        const container = document.getElementById('services-list');
        if (container) {
            container.innerHTML = services.map(s => `
                <div class="service-item">
                    <span class="service-icon">${s.icon}</span>
                    <span class="service-name">${s.name}</span>
                    <span class="service-status ${s.status}">${s.status}</span>
                </div>
            `).join('');
        }
        
        console.log('✅ Uptime data refreshed');
    } catch (e) {
        console.error('Uptime refresh error:', e);
    }
}

// ==================== MODALS ====================

function openModal(title, content) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = content;
    document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
}

// Close modal on outside click
document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
});

console.log('🚀 Cosmo Dashboard loaded - SQLite backend');
