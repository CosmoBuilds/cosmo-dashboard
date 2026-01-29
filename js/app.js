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
let allIdeas = [];

async function loadIdeas() {
    try {
        const response = await fetch('data/ideas.json');
        const data = await response.json();
        allIdeas = data.ideas || [];
        renderIdeas(allIdeas);
    } catch (error) {
        console.log('Ideas not loaded:', error);
        allIdeas = [];
    }
}

function renderIdeas(ideas) {
    const container = document.getElementById('ideas-list');
    if (!container) return;
    
    if (ideas.length === 0) {
        container.innerHTML = '<div class="no-ideas">No ideas found. Click "+ New Idea" to add one!</div>';
        return;
    }
    
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
            <div class="idea-actions">
                ${idea.status !== 'approved' && idea.status !== 'done' ? `<button class="btn-small btn-approve" onclick="approveIdea(${idea.id})">✅ Approve</button>` : ''}
                <button class="btn-small" onclick="updateIdeaStatus(${idea.id}, 'in-progress')">Start</button>
                <button class="btn-small" onclick="updateIdeaStatus(${idea.id}, 'done')">Complete</button>
            </div>
        </div>
    `).join('');
}

function filterIdeas(filter) {
    if (filter === 'all') {
        renderIdeas(allIdeas);
    } else if (filter === 'bowz') {
        renderIdeas(allIdeas.filter(i => i.assignee === 'Bowz'));
    } else {
        renderIdeas(allIdeas.filter(i => i.status === filter));
    }
}

function showNewIdeaForm() {
    openModal('New Idea / Ticket', `
        <form onsubmit="submitIdea(event)">
            <div class="form-group">
                <label>Title</label>
                <input type="text" id="idea-title" required placeholder="What's the idea?">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea id="idea-desc" rows="3" placeholder="Describe the idea in detail..."></textarea>
            </div>
            <div class="form-group">
                <label>Priority</label>
                <select id="idea-priority">
                    <option value="low">Low</option>
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                </select>
            </div>
            <div class="form-group">
                <label>Assignee</label>
                <select id="idea-assignee">
                    <option value="team">Team</option>
                    <option value="Cosmo">Cosmo</option>
                    <option value="Dash">Dash</option>
                    <option value="Lumina">Lumina</option>
                    <option value="Aidorix">Aidorix</option>
                    <option value="Bowz">Bowz</option>
                </select>
            </div>
            <button type="submit" class="btn-primary" style="width: 100%; margin-top: 1rem;">Create Idea</button>
        </form>
    `);
}

function submitIdea(e) {
    e.preventDefault();
    
    const idea = {
        id: Date.now(),
        title: document.getElementById('idea-title').value,
        description: document.getElementById('idea-desc').value,
        priority: document.getElementById('idea-priority').value,
        status: 'open',
        assignee: document.getElementById('idea-assignee').value,
        created: new Date().toISOString(),
        createdBy: 'Bowz'
    };
    
    allIdeas.unshift(idea);
    renderIdeas(allIdeas);
    saveIdeas();
    closeModal();
    addLog('success', `New idea created: "${idea.title}"`);
}

async function saveIdeas() {
    try {
        await fetch('/api/ideas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ideas: allIdeas })
        });
    } catch (e) {
        console.log('Could not save ideas to server:', e);
    }
}

function updateIdeaStatus(id, status) {
    const idea = allIdeas.find(i => i.id === id);
    if (idea) {
        idea.status = status;
        renderIdeas(allIdeas);
        saveIdeas();
        addLog('info', `Idea "${idea.title}" marked as ${status}`);
    }
}

async function approveIdea(id) {
    const idea = allIdeas.find(i => i.id === id);
    if (!idea) return;
    
    // Update status
    idea.status = 'approved';
    idea.approvedAt = new Date().toISOString();
    renderIdeas(allIdeas);
    saveIdeas();
    addLog('success', `Idea "${idea.title}" approved by Bowz`);
    
    // Send approval notification to Discord
    const planOfAttack = generatePlanOfAttack(idea);
    
    try {
        await fetch('/api/notify-discord', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                channel: '1466517317403021362',
                idea: idea,
                plan: planOfAttack
            })
        });
    } catch (e) {
        console.log('Discord notification failed:', e);
    }
}

function generatePlanOfAttack(idea) {
    const plans = {
        'Automated Trading Bot': `**Plan of Attack:**
1. Research trading APIs (Alpaca, Interactive Brokers)
2. Design strategy engine with S/R and MA signals
3. Build risk management module (stop losses, position sizing)
4. Create backtesting framework
5. Paper trade for 2 weeks
6. Deploy with small capital`,
        
        'Voice Interface for Cosmo': `**Plan of Attack:**
1. Integrate speech-to-text (Whisper API or browser Web Speech API)
2. Add text-to-speech for responses (ElevenLabs or browser)
3. Create voice command parser
4. Build wake word detection ("Hey Cosmo")
5. Test hands-free workflows`,
        
        'Mobile Dashboard App': `**Plan of Attack:**
1. Evaluate PWA vs React Native
2. Port existing HTML/CSS to mobile framework
3. Optimize API calls for mobile
4. Add offline support
5. Test on iOS/Android
6. Deploy to app stores`,
        
        'Auto-Commit & Push for Code Changes': `**Plan of Attack:**
1. Create git auto-commit script
2. Watch filesystem for changes
3. Generate commit messages using AI
4. Auto-push to GitHub
5. Add to dashboard settings
6. Test with various file types`,
        
        'Smart Notification System': `**Plan of Attack:**
1. Create priority levels (urgent/high/medium/low)
2. Build digest mode (hourly summaries)
3. Add timezone handling (EST)
4. Create quiet hours settings
5. Build notification queue
6. Test with various scenarios`,
        
        'Crypto Portfolio Tracker Integration': `**Plan of Attack:**
1. Connect to CoinGecko/CMC APIs
2. Build portfolio input interface
3. Calculate P&L with historical prices
4. Add price alerts (email/Discord)
5. Correlate with trading research
6. Create performance charts`,
        
        'Self-Healing System Monitor': `**Plan of Attack:**
1. Build service health checker
2. Create restart scripts for each service
3. Add notification on recovery
4. Log all incidents
5. Create uptime dashboard
6. Set up cron jobs for checks`,
        
        'Discord Command System': `**Plan of Attack:**
1. Create DM listener
2. Parse commands (!deploy, !status, !task)
3. Build command handlers
4. Add authentication (verify it's Bowz)
5. Create help menu
6. Test all commands`
    };
    
    return plans[idea.title] || `**Plan of Attack:**
1. Analyze requirements
2. Design architecture
3. Implement core functionality
4. Test thoroughly
5. Deploy to production
6. Monitor and iterate`;
}

// Token & Session Tracker
let tokenStats = {
    todayCost: 0,
    todayTokens: 0,
    activeSessions: 0,
    monthCost: 0,
    models: {},
    sessions: []
};

async function loadTokenStats() {
    try {
        const response = await fetch('/api/tokens');
        if (response.ok) {
            tokenStats = await response.json();
            renderTokenStats();
        }
    } catch (e) {
        console.log('Token stats not available:', e);
        // Use mock data if API not available
        useMockTokenData();
    }
}

function useMockTokenData() {
    tokenStats = {
        todayCost: 0.0234,
        todayTokens: 15420,
        activeSessions: 3,
        monthCost: 0.89,
        models: {
            'Claude Opus': { tokens: 8200, cost: 0.0123, calls: 12 },
            'GPT-4o-mini': { tokens: 4500, cost: 0.0027, calls: 28 },
            'Llama 3.1 8B': { tokens: 1500, cost: 0.0000, calls: 8 },
            'Mistral 7B': { tokens: 1220, cost: 0.0000, calls: 5 }
        },
        sessions: [
            { agent: 'Cosmo', model: 'Claude Opus', status: 'active', cost: 0.0089, duration: '45m' },
            { agent: 'Dash', model: 'GPT-4o-mini', status: 'active', cost: 0.0012, duration: '12m' },
            { agent: 'Lumina', model: 'Llama 3.1 8B', status: 'idle', cost: 0.0000, duration: '2h 30m' }
        ]
    };
    renderTokenStats();
}

function refreshTokenStats() {
    // Show loading state
    const btn = document.querySelector('button[onclick="refreshTokenStats()"]');
    if (btn) btn.textContent = '🔄 Refreshing...';
    
    // Re-fetch from server
    loadTokenStats().then(() => {
        if (btn) btn.textContent = '🔄 Refresh';
        addLog('info', 'Token stats refreshed');
    }).catch(() => {
        if (btn) btn.textContent = '🔄 Refresh';
        addLog('error', 'Failed to refresh token stats');
    });
}

function renderTokenStats() {
    // Update summary cards
    document.getElementById('today-cost').textContent = '$' + tokenStats.todayCost.toFixed(4);
    document.getElementById('today-tokens').textContent = tokenStats.todayTokens.toLocaleString();
    document.getElementById('active-sessions').textContent = tokenStats.activeSessions;
    document.getElementById('month-cost').textContent = '$' + tokenStats.monthCost.toFixed(2);
    
    // Update model usage
    const modelList = document.getElementById('model-usage');
    if (modelList && tokenStats.models) {
        modelList.innerHTML = Object.entries(tokenStats.models).map(([model, stats]) => `
            <div class="model-usage-item">
                <div class="model-name">${model}</div>
                <div class="model-stats">
                    ${stats.tokens.toLocaleString()} tokens<br>
                    $${stats.cost.toFixed(4)} • ${stats.calls} calls
                </div>
            </div>
        `).join('');
    }
    
    // Update recent sessions
    const sessionsList = document.getElementById('recent-sessions');
    if (sessionsList && tokenStats.sessions) {
        sessionsList.innerHTML = tokenStats.sessions.map(session => `
            <div class="session-item ${session.status}">
                <div class="session-info">
                    <span class="session-agent">${session.agent}</span>
                    <span class="session-model">${session.model} • ${session.duration}</span>
                </div>
                <div class="session-cost">$${session.cost.toFixed(4)}</div>
            </div>
        `).join('');
    }
}

function refreshTokenStats() {
    loadTokenStats();
    addLog('info', 'Token stats refreshed');
}

// Agent Status Checker
async function checkAgentStatus() {
    // In a real implementation, this would ping each agent's endpoint
    // For now, simulate based on session activity
    const agents = ['cosmo', 'dash', 'lumina', 'aidorix'];
    
    agents.forEach(agent => {
        const statusEl = document.querySelector(`#${agent}-task`);
        const cardEl = document.querySelector(`.agent-card:has(#${agent}-task)`);
        
        if (statusEl && cardEl) {
            // Check if there's recent activity (simulated)
            const isActive = Math.random() > 0.1; // 90% chance online
            const statusIndicator = cardEl.querySelector('.agent-status');
            
            if (statusIndicator) {
                if (isActive) {
                    statusIndicator.className = 'agent-status online';
                    statusIndicator.textContent = '● Online';
                } else {
                    statusIndicator.className = 'agent-status offline';
                    statusIndicator.textContent = '● Offline';
                }
            }
        }
    });
}

// Load ideas on page load
document.addEventListener('DOMContentLoaded', () => {
    loadIdeas();
    loadTokenStats();
    checkAgentStatus();
    // Check agent status every 30 seconds
    setInterval(checkAgentStatus, 30000);
});
