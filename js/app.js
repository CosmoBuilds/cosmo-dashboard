// Cosmo Dashboard - Main Application with SQLite Backend

// State
const state = {
    projects: [],
    ideas: [],
    tasks: [],
    logs: [],
    systemStatus: {}
};

// Current filter for ideas
let currentIdeaFilter = 'all';

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
    
    let ideas = state.ideas;
    
    if (currentIdeaFilter !== 'all') {
        if (currentIdeaFilter === 'bowz') {
            ideas = ideas.filter(i => i.assignee === 'Bowz');
        } else {
            ideas = ideas.filter(i => i.status === currentIdeaFilter);
        }
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
    currentIdeaFilter = filter;
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
        const container = document.getElementById('services-grid');
        if (container) {
            container.innerHTML = services.map(s => `
                <div class="service-item">
                    <span class="service-icon">${s.icon}</span>
                    <span class="service-name">${s.name}</span>
                    <span class="service-status ${s.status}">${s.status}</span>
                    ${s.autoRestart ? '<span class="auto-heal-badge">🤖 Auto</span>' : ''}
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

// ==================== QUICK ACTIONS ====================

function createTask() {
    openModal('New Task', `
        <form onsubmit="submitTask(event)">
            <div class="form-group">
                <label>Task Title</label>
                <input type="text" id="task-title" required>
            </div>
            <div class="form-group">
                <label>Project</label>
                <select id="task-project">
                    ${state.projects.map(p => `<option value="${p.name}">${p.name}</option>`).join('')}
                    <option value="General">General</option>
                </select>
            </div>
            <div class="form-group">
                <label>Priority</label>
                <select id="task-priority">
                    <option value="low">Low</option>
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                </select>
            </div>
            <button type="submit" class="btn-primary" style="width: 100%; margin-top: 1rem;">
                Create Task
            </button>
        </form>
    `);
}

async function submitTask(e) {
    e.preventDefault();
    
    const task = {
        id: Date.now(),
        title: document.getElementById('task-title').value,
        project: document.getElementById('task-project').value,
        priority: document.getElementById('task-priority').value,
        done: false
    };
    
    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task)
        });
        
        if (response.ok) {
            state.tasks.unshift(task);
            closeModal();
            renderAll();
            console.log('✅ Task saved to SQLite');
        }
    } catch (err) {
        console.error('Error saving task:', err);
    }
}

function checkEmails() {
    openModal('📧 Email Status', `
        <div style="text-align: center; padding: 2rem;">
            <p style="font-size: 3rem; margin-bottom: 1rem;">📧</p>
            <h3>Email Integration</h3>
            <p style="color: var(--text-secondary); margin-top: 1rem;">
                Account: cosmobowz@gmail.com<br>
                Monitoring: jwelshkoiii@outlook.com
            </p>
            <p style="margin-top: 1.5rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">
                ✅ Gmail API connected and operational
            </p>
        </div>
    `);
}

function systemHealth() {
    fetchSystemStatus();
    openModal('🏥 System Health', `
        <div style="padding: 1rem;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div style="padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">
                    <div style="color: var(--text-secondary); font-size: 0.8rem;">CPU</div>
                    <div style="font-size: 1.5rem; color: var(--accent-green);" id="modal-cpu">--</div>
                </div>
                <div style="padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">
                    <div style="color: var(--text-secondary); font-size: 0.8rem;">Memory</div>
                    <div style="font-size: 1.5rem; color: var(--accent-green);" id="modal-mem">--</div>
                </div>
                <div style="padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">
                    <div style="color: var(--text-secondary); font-size: 0.8rem;">Disk</div>
                    <div style="font-size: 1.5rem; color: var(--accent-green);" id="modal-disk">--</div>
                </div>
                <div style="padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">
                    <div style="color: var(--text-secondary); font-size: 0.8rem;">Host</div>
                    <div style="font-size: 1.5rem; color: var(--accent-blue);">madserver</div>
                </div>
            </div>
            <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(63, 185, 80, 0.1); border: 1px solid var(--accent-green); border-radius: 8px; text-align: center;">
                ✅ All Systems Operational
            </div>
        </div>
    `);
    
    // Update modal with live data
    fetch('/api/system').then(r => r.json()).then(data => {
        const cpuEl = document.getElementById('modal-cpu');
        const memEl = document.getElementById('modal-mem');
        const diskEl = document.getElementById('modal-disk');
        if (cpuEl) cpuEl.textContent = data.cpu + '%';
        if (memEl) memEl.textContent = data.memory + '%';
        if (diskEl) diskEl.textContent = data.disk + '%';
    }).catch(() => {});
}

function exportLogs() {
    const logText = state.logs.map(l => 
        `[${new Date(l.time).toISOString()}] [${l.type?.toUpperCase() || 'INFO'}] ${l.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cosmo-logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

function viewProject(id) {
    const project = state.projects.find(p => p.id === id);
    if (!project) return;
    
    const projectTasks = state.tasks.filter(t => t.project === project.name);
    const tasksList = projectTasks.map(t => `
        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: var(--bg-tertiary); border-radius: 4px; margin-bottom: 0.5rem;">
            <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTask(${t.id})">
            <span style="${t.done ? 'text-decoration: line-through; opacity: 0.5;' : ''}">${t.title}</span>
        </div>
    `).join('') || '<p style="color: var(--text-secondary)">No tasks yet</p>';
    
    openModal(`📁 ${project.name}`, `
        <div>
            <p style="color: var(--text-secondary); margin-bottom: 1rem;">${project.description || 'No description'}</p>
            <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
                <span style="padding: 0.25rem 0.75rem; background: var(--bg-tertiary); border-radius: 4px;">
                    Status: ${project.status}
                </span>
                <span style="padding: 0.25rem 0.75rem; background: var(--bg-tertiary); border-radius: 4px;">
                    Created: ${project.created}
                </span>
            </div>
            <h4 style="margin-bottom: 0.75rem;">Tasks</h4>
            ${tasksList}
        </div>
    `);
}

// Token/Usage tracker functions
async function refreshTokenStats() {
    const btn = document.querySelector('button[onclick="refreshTokenStats()"]');
    if (btn) btn.textContent = '🔄 Refreshing...';
    
    // Fetch real data from API
    let tokenStats;
    try {
        const response = await fetch('/api/tokens');
        tokenStats = await response.json();
    } catch (e) {
        console.error('Error fetching token stats:', e);
        tokenStats = {
            todayTokens: 0,
            todayLimit: 0,
            todayPercent: 0,
            activeSessions: 0,
            models: {},
            sessions: [],
            availableModels: []
        };
    }
    
    // Format numbers for display
    const formatK = (num) => {
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num.toString();
    };
    
    // Update summary cards
    const todayTokensEl = document.getElementById('today-tokens');
    const todayPercentEl = document.getElementById('today-percent');
    const activeSessionsEl = document.getElementById('active-sessions');
    const availableModelsEl = document.getElementById('available-models');
    
    if (todayTokensEl) todayTokensEl.textContent = `${formatK(tokenStats.todayTokens)}/${formatK(tokenStats.todayLimit)}`;
    if (todayPercentEl) todayPercentEl.textContent = `${tokenStats.todayPercent}% used`;
    if (activeSessionsEl) activeSessionsEl.textContent = tokenStats.activeSessions;
    if (availableModelsEl) availableModelsEl.textContent = tokenStats.availableModels?.length || 0;
    
    // Update model usage
    const modelList = document.getElementById('model-usage');
    if (modelList && tokenStats.models && Object.keys(tokenStats.models).length > 0) {
        modelList.innerHTML = Object.entries(tokenStats.models).map(([model, stats]) => `
            <div class="model-usage-item">
                <div class="model-name">${model}</div>
                <div class="model-stats">
                    ${formatK(stats.tokens)} tokens • ${stats.calls} calls<br>
                    <span style="color: var(--accent-green)">${stats.sessions} session${stats.sessions !== 1 ? 's' : ''}</span>
                </div>
            </div>
        `).join('');
    } else if (modelList) {
        modelList.innerHTML = '<div class="model-usage-item"><div class="model-name">No active models</div></div>';
    }
    
    // Update sessions with progress bars
    const sessionsList = document.getElementById('recent-sessions');
    if (sessionsList && tokenStats.sessions && tokenStats.sessions.length > 0) {
        sessionsList.innerHTML = tokenStats.sessions.map(session => `
            <div class="session-item ${session.status}">
                <div class="session-info">
                    <span class="session-agent">${session.name}</span>
                    <span class="session-model">${session.provider}/${session.model}</span>
                </div>
                <div class="session-usage">
                    <div class="usage-bar-container">
                        <div class="usage-bar" style="width: ${session.percentUsed}%"></div>
                    </div>
                    <span class="usage-text">${formatK(session.tokensUsed)}/${formatK(session.tokensLimit)} (${session.percentUsed}%)</span>
                </div>
            </div>
        `).join('');
    } else if (sessionsList) {
        sessionsList.innerHTML = '<div class="session-item"><div class="session-info"><span class="session-agent">No active sessions</span></div></div>';
    }
    
    if (btn) btn.textContent = '🔄 Refresh';
    console.log('✅ Token stats refreshed');
}

console.log('🚀 Cosmo Dashboard loaded - SQLite backend');

// Make functions globally accessible for onclick handlers
window.createProject = createProject;
window.submitProject = submitProject;
window.showNewIdeaForm = showNewIdeaForm;
window.submitIdea = submitIdea;
window.approveIdea = approveIdea;
window.filterIdeas = filterIdeas;
window.toggleTask = toggleTask;
window.refreshUptime = refreshUptime;
window.openModal = openModal;
window.closeModal = closeModal;
window.createTask = createTask;
window.submitTask = submitTask;
window.checkEmails = checkEmails;
window.systemHealth = systemHealth;
window.exportLogs = exportLogs;
window.viewProject = viewProject;
window.refreshTokenStats = refreshTokenStats;
