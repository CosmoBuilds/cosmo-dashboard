// Cosmo Command Center - Main Application

// State
const state = {
    projects: [],
    tasks: [],
    logs: [],
    systemStatus: {}
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    updateTime();
    setInterval(updateTime, 1000);
    loadData();
    fetchSystemStatus();
    setInterval(fetchSystemStatus, 30000); // Update every 30s
});

// Navigation
function initNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchView(view);
            
            // Update active state
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
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'America/New_York'
    };
    document.getElementById('current-time').textContent = now.toLocaleString('en-US', options) + ' EST';
}

// Data Management
async function loadData() {
    try {
        const res = await fetch('/api/data');
        const data = await res.json();
        state.projects = data.projects || [];
        state.tasks = data.tasks || [];
        state.logs = data.logs || [];
        renderAll();
    } catch (e) {
        console.log('Loading default data...');
        loadDefaultData();
    }
}

function loadDefaultData() {
    state.projects = [
        {
            id: 1,
            name: 'Stock Tracker',
            description: 'Real-time stock monitoring dashboard',
            status: 'complete',
            created: '2026-01-26'
        },
        {
            id: 2,
            name: 'Influencer Dashboard',
            description: 'Crypto influencer tracking system',
            status: 'complete',
            created: '2026-01-26'
        },
        {
            id: 3,
            name: 'Server Migration',
            description: 'AWS to madserver migration',
            status: 'complete',
            created: '2026-01-27'
        },
        {
            id: 4,
            name: 'Cosmo Dashboard',
            description: 'Project management command center',
            status: 'in-progress',
            created: '2026-01-27'
        },
        {
            id: 5,
            name: 'Email Integration',
            description: 'Gmail monitoring and automation',
            status: 'planning',
            created: '2026-01-27'
        }
    ];
    
    state.tasks = [
        { id: 1, title: 'Set up Gmail API', project: 'Email Integration', priority: 'high', done: false },
        { id: 2, title: 'Add ChatGPT/Codex integration', project: 'Cosmo Dashboard', priority: 'medium', done: false },
        { id: 3, title: 'Deploy agent workforce', project: 'Cosmo Dashboard', priority: 'medium', done: false },
        { id: 4, title: 'Security audit complete', project: 'Server Migration', priority: 'high', done: true },
        { id: 5, title: 'Move Docker to /mnt/data', project: 'Server Migration', priority: 'high', done: true }
    ];
    
    state.logs = [
        { time: new Date(), type: 'success', message: 'Dashboard initialized' },
        { time: new Date(Date.now() - 3600000), type: 'success', message: 'Server migration complete' },
        { time: new Date(Date.now() - 3700000), type: 'info', message: 'AMP data moved to /mnt/data' },
        { time: new Date(Date.now() - 3800000), type: 'info', message: 'Docker data moved to /mnt/data' },
        { time: new Date(Date.now() - 7200000), type: 'success', message: 'Security hardening complete' }
    ];
    
    renderAll();
}

function renderAll() {
    renderProjectsPreview();
    renderTasksPreview();
    renderProjectsBoard();
    renderTasks();
    renderLogs();
    updateStats();
}

function updateStats() {
    document.getElementById('active-projects').textContent = 
        state.projects.filter(p => p.status !== 'complete').length;
    document.getElementById('tasks-today').textContent = 
        state.tasks.filter(t => !t.done).length;
}

// Projects
function renderProjectsPreview() {
    const container = document.getElementById('projects-preview-list');
    const activeProjects = state.projects.filter(p => p.status !== 'complete').slice(0, 3);
    
    container.innerHTML = activeProjects.map(p => `
        <div class="project-card-mini">
            <h4>${p.name}</h4>
            <p>${p.description}</p>
        </div>
    `).join('') || '<p style="color: var(--text-secondary)">No active projects</p>';
}

function renderProjectsBoard() {
    const columns = ['planning', 'in-progress', 'review', 'complete'];
    
    columns.forEach(status => {
        const container = document.getElementById(`col-${status}`);
        const projects = state.projects.filter(p => p.status === status);
        
        container.innerHTML = projects.map(p => `
            <div class="project-card-mini" onclick="viewProject(${p.id})">
                <h4>${p.name}</h4>
                <p>${p.description}</p>
            </div>
        `).join('');
    });
}

// Tasks
function renderTasksPreview() {
    const container = document.getElementById('tasks-preview-list');
    const pendingTasks = state.tasks.filter(t => !t.done).slice(0, 4);
    
    container.innerHTML = pendingTasks.map(t => `
        <div class="task-item" style="padding: 0.5rem;">
            <input type="checkbox" class="task-checkbox" onchange="toggleTask(${t.id})" ${t.done ? 'checked' : ''}>
            <span class="task-title">${t.title}</span>
            <span class="task-priority ${t.priority}">${t.priority}</span>
        </div>
    `).join('') || '<p style="color: var(--text-secondary)">All tasks complete!</p>';
}

function renderTasks() {
    const container = document.getElementById('tasks-container');
    
    container.innerHTML = state.tasks.map(t => `
        <div class="task-item">
            <input type="checkbox" class="task-checkbox" onchange="toggleTask(${t.id})" ${t.done ? 'checked' : ''}>
            <div class="task-content">
                <div class="task-title" style="${t.done ? 'text-decoration: line-through; opacity: 0.5;' : ''}">${t.title}</div>
                <div class="task-meta">Project: ${t.project}</div>
            </div>
            <span class="task-priority ${t.priority}">${t.priority}</span>
        </div>
    `).join('');
}

function toggleTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (task) {
        task.done = !task.done;
        renderAll();
        saveData();
        addLog(task.done ? 'success' : 'info', `Task "${task.title}" ${task.done ? 'completed' : 'reopened'}`);
    }
}

// Logs - EST timezone
function renderLogs() {
    const container = document.getElementById('logs-container');
    
    container.innerHTML = state.logs.map(log => {
        const time = new Date(log.time).toLocaleTimeString('en-US', { 
            timeZone: 'America/New_York',
            hour: '2-digit',
            minute: '2-digit'
        });
        return `
            <div class="log-entry">
                <span class="log-time">${time}</span>
                <span class="log-type ${log.type}">${log.type.toUpperCase()}</span>
                <span>${log.message}</span>
            </div>
        `;
    }).join('');
}

function addLog(type, message) {
    state.logs.unshift({ time: new Date(), type, message });
    if (state.logs.length > 100) state.logs.pop();
    renderLogs();
}

// System Status
async function fetchSystemStatus() {
    try {
        const res = await fetch('/api/system');
        const data = await res.json();
        document.getElementById('sys-cpu').textContent = data.cpu + '%';
        document.getElementById('sys-mem').textContent = data.memory + '%';
        document.getElementById('sys-disk').textContent = data.disk + '%';
        document.getElementById('system-status').textContent = '●';
        document.getElementById('system-status').style.color = '#3fb950';
    } catch (e) {
        document.getElementById('system-status').textContent = '●';
        document.getElementById('system-status').style.color = '#f85149';
    }
}

// Modals
function openModal(title, content) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = content;
    document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
}

// Actions
function createProject() {
    openModal('New Project', `
        <form onsubmit="submitProject(event)">
            <div class="form-group">
                <label>Project Name</label>
                <input type="text" id="project-name" required>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="project-desc"></textarea>
            </div>
            <div class="form-group">
                <label>Status</label>
                <select id="project-status">
                    <option value="planning">Planning</option>
                    <option value="in-progress">In Progress</option>
                    <option value="review">Review</option>
                </select>
            </div>
            <button type="submit" class="btn-primary" style="width: 100%; margin-top: 1rem;">Create Project</button>
        </form>
    `);
}

function submitProject(e) {
    e.preventDefault();
    const project = {
        id: Date.now(),
        name: document.getElementById('project-name').value,
        description: document.getElementById('project-desc').value,
        status: document.getElementById('project-status').value,
        created: new Date().toISOString().split('T')[0]
    };
    state.projects.push(project);
    closeModal();
    renderAll();
    saveData();
    addLog('success', `Project "${project.name}" created`);
}

function createTask() {
    const projectOptions = state.projects.map(p => 
        `<option value="${p.name}">${p.name}</option>`
    ).join('');
    
    openModal('New Task', `
        <form onsubmit="submitTask(event)">
            <div class="form-group">
                <label>Task Title</label>
                <input type="text" id="task-title" required>
            </div>
            <div class="form-group">
                <label>Project</label>
                <select id="task-project">
                    ${projectOptions}
                    <option value="General">General</option>
                </select>
            </div>
            <div class="form-group">
                <label>Priority</label>
                <select id="task-priority">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                </select>
            </div>
            <button type="submit" class="btn-primary" style="width: 100%; margin-top: 1rem;">Create Task</button>
        </form>
    `);
}

function submitTask(e) {
    e.preventDefault();
    const task = {
        id: Date.now(),
        title: document.getElementById('task-title').value,
        project: document.getElementById('task-project').value,
        priority: document.getElementById('task-priority').value,
        done: false
    };
    state.tasks.push(task);
    closeModal();
    renderAll();
    saveData();
    addLog('info', `Task "${task.title}" created`);
}

function checkEmails() {
    addLog('info', 'Checking emails...');
    openModal('📧 Email Status', `
        <div style="text-align: center; padding: 2rem;">
            <p style="font-size: 3rem; margin-bottom: 1rem;">📧</p>
            <h3>Email Integration</h3>
            <p style="color: var(--text-secondary); margin-top: 1rem;">
                Account: cosmobowz@gmail.com<br>
                Monitoring: jwelshkoiii@outlook.com
            </p>
            <p style="margin-top: 1.5rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">
                ⚠️ Gmail API setup required
            </p>
        </div>
    `);
}

function systemHealth() {
    fetchSystemStatus();
    addLog('info', 'System health check triggered');
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
        document.getElementById('modal-cpu').textContent = data.cpu + '%';
        document.getElementById('modal-mem').textContent = data.memory + '%';
        document.getElementById('modal-disk').textContent = data.disk + '%';
    }).catch(() => {});
}

function deployAgent() {
    openModal('🤖 Deploy AI Agent', `
        <div style="text-align: center; padding: 2rem;">
            <p style="font-size: 3rem; margin-bottom: 1rem;">🤖</p>
            <h3>AI Workforce Expansion</h3>
            <p style="color: var(--text-secondary); margin-top: 1rem;">
                Connect additional AI workers to delegate tasks
            </p>
            <div style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem;">
                <button class="btn-secondary" disabled>🧠 OpenAI GPT (Coming Soon)</button>
                <button class="btn-secondary" disabled>💻 Codex CLI (Coming Soon)</button>
                <button class="btn-secondary" disabled>🔧 Custom Agent (Coming Soon)</button>
            </div>
        </div>
    `);
}

function exportLogs() {
    const logText = state.logs.map(l => 
        `[${new Date(l.time).toISOString()}] [${l.type.toUpperCase()}] ${l.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cosmo-logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    addLog('info', 'Logs exported');
}

// Data Persistence
async function saveData() {
    try {
        await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projects: state.projects,
                tasks: state.tasks,
                logs: state.logs
            })
        });
    } catch (e) {
        console.log('Could not save to server, using local storage');
        localStorage.setItem('cosmo-data', JSON.stringify({
            projects: state.projects,
            tasks: state.tasks,
            logs: state.logs
        }));
    }
}

// Project View
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
            <p style="color: var(--text-secondary); margin-bottom: 1rem;">${project.description}</p>
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

// Ideas & Tickets
async function loadIdeas() {
    try {
        const response = await fetch('data/ideas.json');
        const data = await response.json();
        renderIdeas(data.ideas);
    } catch (error) {
        console.log('Ideas not loaded:', error);
    }
}

function renderIdeas(ideas) {
    const container = document.getElementById('ideas-list');
    if (!container) return;
    
    container.innerHTML = ideas.map(idea => `
        <div class="idea-card priority-${idea.priority}">
            <div class="idea-header">
                <span class="idea-title">${idea.title}</span>
                <span class="idea-status ${idea.status}">${idea.status}</span>
            </div>
            <p class="idea-desc">${idea.description}</p>
            <div class="idea-meta">
                <span>📅 ${new Date(idea.created).toLocaleDateString()}</span>
                <span class="idea-assignee">👤 ${idea.assignee}</span>
                <span>✍️ ${idea.createdBy}</span>
            </div>
        </div>
    `).join('');
}

function filterIdeas(filter) {
    // Implement filtering
    console.log('Filter:', filter);
}

function showNewIdeaForm() {
    alert('New idea form coming soon!');
}

// Load ideas on page load
document.addEventListener('DOMContentLoaded', loadIdeas);
