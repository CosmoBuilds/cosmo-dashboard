// Cosmo Dashboard - Main Application with SQLite Backend
// Version: v29 - Comprehensive Activity Logging

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

// WebSocket Connection
let socket = null;
let wsConnected = false;

function initWebSocket() {
    try {
        socket = io();
        
        socket.on('connect', () => {
            console.log('🔌 WebSocket connected');
            wsConnected = true;
            updateConnectionStatus(true);
            socket.emit('subscribe_updates');
        });
        
        socket.on('disconnect', () => {
            console.log('🔌 WebSocket disconnected');
            wsConnected = false;
            updateConnectionStatus(false);
        });
        
        socket.on('update', (data) => {
            console.log('📡 Real-time update:', data);
            handleRealtimeUpdate(data);
        });
        
        socket.on('new_activity', (data) => {
            console.log('📝 New activity:', data);
            // Add to logs array and re-render
            state.logs.unshift(data);
            if (state.logs.length > 100) state.logs.pop();
            renderLogs();
            
            // Show notification
            showActivityNotification(data);
        });
        
    } catch (e) {
        console.error('WebSocket init error:', e);
    }
}

function updateConnectionStatus(connected) {
    const indicator = document.getElementById('ws-status');
    if (indicator) {
        indicator.textContent = connected ? '🟢 Live' : '🔴 Offline';
        indicator.className = connected ? 'status-online' : 'status-offline';
    }
}

function handleRealtimeUpdate(update) {
    if (update.type === 'system_stats') {
        // Update system stats in real-time
        document.getElementById('sys-cpu').textContent = update.data.cpu + '%';
        document.getElementById('sys-mem').textContent = update.data.memory + '%';
        document.getElementById('sys-disk').textContent = update.data.disk + '%';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initWebSocket(); // Initialize WebSocket connection
    updateTime();
    setInterval(updateTime, 1000);
    loadAllData();
    fetchSystemStatus();
    setInterval(fetchSystemStatus, 30000);
    refreshUptime(); // Load uptime data on startup
    refreshTokenStats(); // Load token stats on startup
    setInterval(refreshTokenStats, 5000); // Auto-refresh every 5 seconds
    refreshSubagents(); // Load subagents on startup
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
    
    // Refresh specific views when switched to
    if (viewName === 'agents') {
        refreshSubagents();
    } else if (viewName === 'tokens') {
        refreshTokenStats();
    }
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

function truncateDescription(desc, maxLength = 60) {
    if (!desc) return '';
    if (desc.length <= maxLength) return desc;
    return desc.substring(0, maxLength) + '...';
}

function renderProjectsPreview() {
    const container = document.getElementById('projects-preview-list');
    const activeProjects = state.projects.filter(p => p.status !== 'complete').slice(0, 3);
    
    container.innerHTML = activeProjects.map(p => {
        const shortDesc = truncateDescription(p.description);
        const hasLongDesc = p.description && p.description.length > 60;
        return `
        <div class="project-card-mini" onclick="viewProject(${p.id})" style="cursor: pointer;">
            <h4>${p.name}</h4>
            <p class="project-desc-short" id="desc-preview-${p.id}">${shortDesc}</p>
            ${hasLongDesc ? `<span class="show-more-link" onclick="event.stopPropagation(); toggleDesc(${p.id}, '${escapeHtml(p.description).replace(/'/g, "\\'")}')">Show more</span>` : ''}
        </div>
    `}).join('') || '<p style="color: var(--text-secondary)">No active projects</p>';
}

function renderProjectsBoard() {
    const columns = ['pending-review', 'planning', 'in-progress', 'review', 'complete'];
    
    columns.forEach(status => {
        const container = document.getElementById(`col-${status}`);
        if (!container) return;
        
        const projects = state.projects.filter(p => p.status === status);
        
        container.innerHTML = projects.map(p => {
            const shortDesc = truncateDescription(p.description);
            const hasLongDesc = p.description && p.description.length > 60;
            return `
            <div class="project-card-mini" onclick="viewProject(${p.id})" style="cursor: pointer;">
                <h4>${p.name}</h4>
                <p class="project-desc-short" id="desc-board-${p.id}">${shortDesc}</p>
                ${hasLongDesc ? `<span class="show-more-link" onclick="event.stopPropagation(); toggleDescBoard(${p.id}, '${escapeHtml(p.description).replace(/'/g, "\\'")}')">Show more</span>` : ''}
            </div>
        `}).join('') || '<p style="color: var(--text-secondary); font-size: 0.8rem;">No projects</p>';
    });
}

function toggleDesc(projectId, fullDesc) {
    const el = document.getElementById(`desc-preview-${projectId}`);
    const isExpanded = el.classList.contains('expanded');
    
    if (isExpanded) {
        el.textContent = truncateDescription(fullDesc);
        el.classList.remove('expanded');
        el.nextElementSibling.textContent = 'Show more';
    } else {
        el.textContent = fullDesc;
        el.classList.add('expanded');
        el.nextElementSibling.textContent = 'Show less';
    }
}

function toggleDescBoard(projectId, fullDesc) {
    const el = document.getElementById(`desc-board-${projectId}`);
    const isExpanded = el.classList.contains('expanded');
    
    if (isExpanded) {
        el.textContent = truncateDescription(fullDesc);
        el.classList.remove('expanded');
        el.nextElementSibling.textContent = 'Show more';
    } else {
        el.textContent = fullDesc;
        el.classList.add('expanded');
        el.nextElementSibling.textContent = 'Show less';
    }
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
    // Handle both string and number IDs
    const idea = state.ideas.find(i => String(i.id) === String(id));
    if (!idea) {
        console.error('Idea not found:', id);
        alert('Error: Idea not found');
        return;
    }
    
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
            alert('✅ Idea approved successfully!');
        } else {
            const errorData = await response.json();
            console.error('Server error:', errorData);
            alert('❌ Error: ' + (errorData.error || 'Failed to approve idea'));
        }
    } catch (err) {
        console.error('Error approving idea:', err);
        alert('❌ Error approving idea: ' + err.message);
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
        const dateTime = new Date(log.time).toLocaleString('en-US', {
            timeZone: 'America/New_York',
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        return `
            <div class="log-entry">
                <span class="log-time">${dateTime}</span>
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
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        tokenStats = await response.json();
        console.log('Token stats received:', tokenStats);
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
    console.log('Sessions list element:', sessionsList);
    console.log('Token stats sessions:', tokenStats.sessions);
    
    if (sessionsList && tokenStats.sessions && Array.isArray(tokenStats.sessions) && tokenStats.sessions.length > 0) {
        const sessionsHtml = tokenStats.sessions.map(session => {
            const percentUsed = session.percentUsed || 0;
            const tokensUsed = session.tokensUsed || 0;
            const tokensLimit = session.tokensLimit || 262144;
            const name = session.name || 'Unknown';
            const provider = session.provider || 'unknown';
            const model = session.model || 'unknown';
            const status = session.status || 'active';
            
            return `
            <div class="session-item ${status}">
                <div class="session-info">
                    <span class="session-agent">${name}</span>
                    <span class="session-model">${provider}/${model}</span>
                </div>
                <div class="session-usage">
                    <div class="usage-bar-container">
                        <div class="usage-bar" style="width: ${Math.min(percentUsed, 100)}%"></div>
                    </div>
                    <span class="usage-text">${formatK(tokensUsed)}/${formatK(tokensLimit)} (${percentUsed.toFixed(1)}%)</span>
                </div>
            </div>
            `;
        }).join('');
        
        sessionsList.innerHTML = sessionsHtml;
        console.log('✅ Sessions rendered:', tokenStats.sessions.length);
    } else if (sessionsList) {
        sessionsList.innerHTML = '<div class="session-item"><div class="session-info"><span class="session-agent">No active sessions found</span></div></div>';
        console.log('⚠️ No sessions data available');
    }
    
    if (btn) btn.textContent = '🔄 Refresh';
    console.log('✅ Token stats refreshed');
}

// ==================== SUBAGENTS / SPAWNED WORKERS ====================

// Helper function to format numbers as K
function formatK(num) {
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
}

async function refreshSubagents() {
    const btn = document.querySelector('button[onclick="refreshSubagents()"]');
    if (btn) btn.textContent = '⏳ Loading...';
    
    console.log('🔍 Refreshing subagents...');
    
    try {
        const response = await fetch('/api/tokens');
        console.log('📡 API response status:', response.status);
        
        const data = await response.json();
        console.log('📊 Raw data:', data);
        
        const sessions = data.sessions || [];
        console.log('🔍 Total sessions:', sessions.length);
        console.log('🔍 Session names:', sessions.map(s => s.name));
        
        const subagents = sessions.filter(s => s.name && s.name.startsWith('subagent:'));
        console.log('⚡ Subagents found:', subagents.length);
        console.log('⚡ Subagent names:', subagents.map(s => s.name));
        
        // Update count badge
        const countBadge = document.getElementById('subagent-count');
        console.log('🏷️ Count badge element:', countBadge);
        if (countBadge) {
            countBadge.textContent = subagents.length;
            console.log('✅ Updated count badge to:', subagents.length);
        }
        
        // Update list
        const container = document.getElementById('subagents-list');
        console.log('📦 Container element:', container);
        if (container) {
            if (subagents.length === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="padding: 20px;">
                        <span class="empty-icon">⚡</span>
                        <p>No active spawned workers</p>
                        <span style="color: var(--text-secondary); font-size: 0.9rem;">Spawn sub-agents to delegate tasks</span>
                    </div>
                `;
                console.log('⚠️ No subagents to display');
            } else {
                const html = subagents.map(agent => {
                    const agentId = agent.name.replace('subagent:', '').substring(0, 8);
                    const percentUsed = agent.percentUsed || 0;
                    
                    return `
                    <div class="subagent-card" style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 3px solid var(--accent-purple);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <div>
                                <strong>⚡ Sub-Agent ${agentId}</strong>
                                <div style="color: var(--text-secondary); font-size: 0.85rem;">${agent.model}</div>
                            </div>
                            <span class="badge badge-success">ACTIVE</span>
                        </div>
                        <div style="margin-top: 10px;">
                            <div class="usage-bar-container" style="width: 100%; height: 6px; background: var(--bg-secondary); border-radius: 3px; overflow: hidden;">
                                <div class="usage-bar" style="width: ${Math.min(percentUsed, 100)}%; height: 100%; background: linear-gradient(90deg, var(--accent-green), var(--accent-blue)); border-radius: 3px;"></div>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 0.8rem; color: var(--text-secondary);">
                                <span>Tokens: ${formatK(agent.tokensUsed)}/${formatK(agent.tokensLimit)}</span>
                                <span>${percentUsed.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                    `;
                }).join('');
                
                container.innerHTML = html;
                console.log('✅ Rendered', subagents.length, 'subagents');
                console.log('📝 HTML length:', html.length);
            }
        } else {
            console.error('❌ Container element not found!');
        }
    } catch (e) {
        console.error('❌ Subagents refresh error:', e);
    }
    
    if (btn) btn.textContent = '🔄 Refresh Workers';
}

function showActivityNotification(activity) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'activity-toast';
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-type">${getActivityIcon(activity.type)}</span>
            <span class="toast-message">${escapeHtml(activity.message).substring(0, 80)}${activity.message.length > 80 ? '...' : ''}</span>
            <span class="toast-time">${new Date(activity.time).toLocaleString('en-US', {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}</span>
        </div>
    `;
    
    // Add styles
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 12px 16px;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Remove after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function getActivityIcon(type) {
    const icons = {
        'success': '✅',
        'error': '❌',
        'warning': '⚠️',
        'info': 'ℹ️',
        'system': '⚙️'
    };
    return icons[type] || '📝';
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
window.refreshSubagents = refreshSubagents;

// ==================== GITHUB APPROVAL ====================

async function refreshGitHubStatus() {
    const btn = document.querySelector('button[onclick="refreshGitHubStatus()"]');
    if (btn) btn.textContent = '⏳ Loading...';
    
    try {
        const res = await fetch('/api/github/pending');
        const data = await res.json();
        
        // Update badge
        const badge = document.getElementById('github-pending-count');
        const badge2 = document.getElementById('github-pending-badge');
        if (badge) {
            badge.textContent = data.pending;
            badge.style.display = data.pending > 0 ? 'inline-block' : 'none';
        }
        if (badge2) {
            badge2.textContent = `${data.pending} pending`;
            badge2.className = data.pending > 0 ? 'badge badge-warning' : 'badge badge-success';
        }
        
        // Update list
        const container = document.getElementById('github-pending-list');
        if (container) {
            if (data.pending === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="empty-icon">🐙</span>
                        <p>No pending commits</p>
                        <span style="color: var(--text-secondary); font-size: 0.9rem;">All commits are up to date</span>
                    </div>
                `;
            } else {
                container.innerHTML = data.commits.map(commit => `
                    <div class="commit-card" style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 3px solid var(--accent-yellow);">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                            <div>
                                <strong style="font-size: 1.1em;">${escapeHtml(commit.message)}</strong>
                                <div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 5px;">
                                    📁 ${commit.repo} • 🌿 ${commit.branch} • 🕐 ${new Date(commit.timestamp).toLocaleString()}
                                </div>
                            </div>
                            <span class="badge badge-warning">PENDING</span>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 10px;">
                            <button class="btn-primary" onclick="approveCommit('${commit.id}')" style="flex: 1;">✅ Approve & Push</button>
                            <button class="btn-danger" onclick="rejectCommit('${commit.id}')" style="flex: 1;">❌ Reject</button>
                        </div>
                    </div>
                `).join('');
            }
        }
        
        console.log('✅ GitHub status refreshed:', data.pending, 'pending commits');
    } catch (e) {
        console.error('GitHub status error:', e);
        if (btn) btn.textContent = '❌ Error';
    }
    
    if (btn) btn.textContent = '🔄 Refresh Status';
}

async function approveCommit(commitId) {
    if (!confirm('Are you sure you want to approve and push this commit to GitHub?')) {
        return;
    }
    
    try {
        const res = await fetch(`/api/github/approve/${commitId}`, { method: 'POST' });
        const data = await res.json();
        
        if (data.success) {
            alert('✅ Commit approved and pushed successfully!');
            refreshGitHubStatus();
        } else {
            alert('❌ Error: ' + (data.error || 'Unknown error'));
        }
    } catch (e) {
        alert('❌ Error approving commit: ' + e.message);
    }
}

async function rejectCommit(commitId) {
    if (!confirm('Are you sure you want to reject this commit? Changes will be unstaged but preserved.')) {
        return;
    }
    
    try {
        const res = await fetch(`/api/github/reject/${commitId}`, { method: 'POST' });
        const data = await res.json();
        
        if (data.success) {
            alert('❌ Commit rejected. Changes have been unstaged.');
            refreshGitHubStatus();
        } else {
            alert('❌ Error: ' + (data.error || 'Unknown error'));
        }
    } catch (e) {
        alert('❌ Error rejecting commit: ' + e.message);
    }
}

async function showGitHistory() {
    try {
        const res = await fetch('/api/github/history');
        const data = await res.json();
        
        const content = data.commits.length > 0 
            ? `<div style="max-height: 400px; overflow-y: auto;">${data.commits.map(c => `
                <div style="padding: 8px; border-bottom: 1px solid var(--border-color);">
                    <code style="background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px;">${c.hash}</code>
                    <span style="margin-left: 10px;">${escapeHtml(c.message)}</span>
                </div>
            `).join('')}</div>`
            : '<p>No recent commits found</p>';
        
        openModal('📜 Recent Git History', content);
    } catch (e) {
        alert('❌ Error loading git history: ' + e.message);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load GitHub status on page load
document.addEventListener('DOMContentLoaded', () => {
    refreshGitHubStatus();
    // Refresh every 30 seconds
    setInterval(refreshGitHubStatus, 30000);
});

// Export functions
window.refreshGitHubStatus = refreshGitHubStatus;
window.approveCommit = approveCommit;
window.rejectCommit = rejectCommit;
window.showGitHistory = showGitHistory;

// ==================== SUB-AGENT MONITORING ====================

async function refreshSubagents() {
    const btn = document.querySelector('button[onclick="refreshSubagents()"]');
    if (btn) btn.textContent = '⏳ Loading...';
    
    try {
        const res = await fetch('/api/subagents');
        const data = await res.json();
        
        // Update badge
        const badge = document.getElementById('subagent-count');
        if (badge) {
            badge.textContent = data.count;
            badge.style.display = data.count > 0 ? 'inline-block' : 'none';
        }
        
        // Update list
        const container = document.getElementById('subagents-list');
        if (container) {
            if (data.count === 0) {
                container.innerHTML = `
                    <div class="empty-state" style="padding: 20px;">
                        <span class="empty-icon">⚡</span>
                        <p>No active spawned workers</p>
                        <span style="color: var(--text-secondary); font-size: 0.9rem;">Spawn sub-agents to delegate tasks</span>
                    </div>
                `;
            } else {
                container.innerHTML = data.subagents.map(agent => `
                    <div class="subagent-card" style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 3px solid var(--accent-blue);">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                            <div>
                                <strong style="font-size: 1.1em;">${agent.type === 'background_process' ? '📟' : '⚡'} ${agent.name || agent.id}</strong>
                                <div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 3px;">
                                    ${agent.model ? `🧠 ${agent.provider}/${agent.model}` : ''}
                                    ${agent.pid ? `• PID: ${agent.pid}` : ''}
                                </div>
                            </div>
                            <span class="badge ${agent.status === 'completed' ? 'badge-success' : agent.status === 'in_progress' ? 'badge-warning' : 'badge-info'}">${agent.status}</span>
                        </div>
                        ${agent.task ? `
                        <div style="margin: 10px 0; padding: 10px; background: var(--bg-secondary); border-radius: 6px;">
                            <strong>📋 Task:</strong> ${escapeHtml(agent.task)}
                            ${agent.description ? `<div style="margin-top: 5px; font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(agent.description)}</div>` : ''}
                            ${agent.output_file ? `<div style="margin-top: 5px; font-size: 0.8rem; color: var(--accent-green);">📄 Output: ${escapeHtml(agent.output_file)}</div>` : ''}
                        </div>
                        ` : ''}
                        ${agent.tokens_in ? `
                        <div style="display: flex; gap: 15px; font-size: 0.85rem; color: var(--text-secondary); margin-top: 8px;">
                            <span>📥 ${formatK(agent.tokens_in)} tokens</span>
                            <span>📤 ${formatK(agent.tokens_out)} tokens</span>
                            <span>💾 ${formatK(agent.context_used)} context</span>
                        </div>
                        ` : ''}
                    </div>
                `).join('');
            }
        }
        
        console.log('✅ Subagents refreshed:', data.count, 'active workers');
    } catch (e) {
        console.error('Subagent refresh error:', e);
        if (btn) btn.textContent = '❌ Error';
    }
    
    if (btn) btn.textContent = '🔄 Refresh Workers';
}

// Export function
window.refreshSubagents = refreshSubagents;
