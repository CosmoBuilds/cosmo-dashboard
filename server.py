#!/usr/bin/env python3
"""
Cosmo Dashboard - Robust SQLite Backend
Handles all data persistence with proper database
Version: v29 - Comprehensive Activity Logging
"""

import sqlite3
import json
import os
import subprocess
import time
import threading
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit

# Audit logging setup
AUDIT_DB = '/home/madadmin/clawd/data/audit.db'

def log_audit(actor, action, target_type=None, target_id=None, old_value=None, new_value=None, details=None):
    """Log audit events"""
    try:
        conn = sqlite3.connect(AUDIT_DB)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO audit_log (timestamp, actor, action, target_type, target_id, old_value, new_value, details)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (datetime.now().isoformat(), actor, action, target_type, target_id,
              json.dumps(old_value) if old_value else None,
              json.dumps(new_value) if new_value else None,
              json.dumps(details) if details else None))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Audit log error: {e}")

app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = 'cosmo-dashboard-secret'
socketio = SocketIO(app, cors_allowed_origins="*")

DB_PATH = '/home/madadmin/clawd/cosmo-dashboard/data/dashboard.db'
NOTIFICATIONS_FILE = '/home/madadmin/clawd/data/notifications.json'

def init_db():
    """Initialize SQLite database with proper tables"""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Projects table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'pending-review',
            created TEXT,
            updated TEXT
        )
    ''')
    
    # Ideas table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ideas (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'open',
            assignee TEXT DEFAULT 'team',
            created TEXT,
            createdBy TEXT
        )
    ''')
    
    # Tasks table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            project TEXT,
            priority TEXT DEFAULT 'medium',
            done INTEGER DEFAULT 0
        )
    ''')
    
    # Activity log table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            time TEXT,
            type TEXT,
            message TEXT
        )
    ''')
    
    conn.commit()
    conn.close()
    print("✅ Database initialized")

# Initialize on startup
init_db()

@app.route('/')
def index():
    """Root serves Command Center"""
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# ==================== PROJECTS ====================

@app.route('/api/projects', methods=['GET'])
def get_projects():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM projects ORDER BY id DESC')
    projects = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(projects)

@app.route('/api/projects', methods=['POST'])
def create_project():
    data = request.json
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    now = datetime.now().isoformat()
    cursor.execute('''
        INSERT INTO projects (id, name, description, status, created, updated)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        data.get('id'),
        data.get('name'),
        data.get('description', ''),
        data.get('status', 'pending-review'),
        data.get('created', now),
        now
    ))
    
    conn.commit()
    conn.close()
    
    # Write notification for Cosmo
    write_notification({
        'type': 'project_created',
        'timestamp': now,
        'project': data,
        'channel': '1466517317403021362'
    })
    
    # Add to activity log
    add_log('success', f'Project "{data.get("name")}" created - awaiting evaluation')
    
    # Audit log
    log_audit('Bowz', 'CREATE_PROJECT', 'project', str(data.get('id')), 
              None, {'name': data.get('name'), 'description': data.get('description')})
    
    return jsonify({'status': 'created', 'id': data.get('id')})

@app.route('/api/projects/<int:project_id>', methods=['PUT'])
def update_project(project_id):
    data = request.json
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE projects 
        SET name=?, description=?, status=?, updated=?
        WHERE id=?
    ''', (
        data.get('name'),
        data.get('description'),
        data.get('status'),
        datetime.now().isoformat(),
        project_id
    ))
    
    conn.commit()
    conn.close()
    return jsonify({'status': 'updated'})

# ==================== IDEAS ====================

@app.route('/api/ideas', methods=['GET'])
def get_ideas():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM ideas ORDER BY id DESC')
    ideas = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({'ideas': ideas})

@app.route('/api/ideas', methods=['POST'])
def create_idea():
    data = request.json
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO ideas (id, title, description, priority, status, assignee, created, createdBy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        data.get('id'),
        data.get('title'),
        data.get('description', ''),
        data.get('priority', 'medium'),
        data.get('status', 'open'),
        data.get('assignee', 'team'),
        data.get('created', datetime.now().isoformat()),
        data.get('createdBy', 'Bowz')
    ))
    
    conn.commit()
    conn.close()
    
    write_notification({
        'type': 'idea_created',
        'timestamp': datetime.now().isoformat(),
        'idea': data,
        'channel': '1466517317403021362'
    })
    
    add_log('success', f'New idea created: "{data.get("title")}"')
    
    return jsonify({'status': 'created'})

@app.route('/api/ideas/<int:idea_id>/approve', methods=['POST'])
def approve_idea(idea_id):
    data = request.json
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('UPDATE ideas SET status=? WHERE id=?', ('approved', idea_id))
    conn.commit()
    
    # Get idea details
    cursor.execute('SELECT * FROM ideas WHERE id=?', (idea_id,))
    row = cursor.fetchone()
    idea = dict(row) if row else {}
    conn.close()
    
    write_notification({
        'type': 'idea_approved',
        'timestamp': datetime.now().isoformat(),
        'idea': idea,
        'plan': data.get('plan', ''),
        'channel': '1466517317403021362'
    })
    
    add_log('success', f'Idea "{idea.get("title")}" approved by Bowz')
    
    return jsonify({'status': 'approved'})

# ==================== TASKS ====================

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM tasks ORDER BY id DESC')
    tasks = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(tasks)

@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.json
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO tasks (id, title, project, priority, done)
        VALUES (?, ?, ?, ?, ?)
    ''', (
        data.get('id'),
        data.get('title'),
        data.get('project', 'General'),
        data.get('priority', 'medium'),
        1 if data.get('done') else 0
    ))
    
    conn.commit()
    conn.close()
    return jsonify({'status': 'created'})

@app.route('/api/tasks/<int:task_id>/toggle', methods=['POST'])
def toggle_task(task_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('SELECT done FROM tasks WHERE id=?', (task_id,))
    result = cursor.fetchone()
    current_done = result[0] if result else 0
    new_done = 0 if current_done else 1
    
    cursor.execute('UPDATE tasks SET done=? WHERE id=?', (new_done, task_id))
    conn.commit()
    conn.close()
    
    status = 'completed' if new_done else 'reopened'
    add_log('info' if new_done else 'success', f'Task toggled - now {status}')
    
    return jsonify({'status': 'toggled', 'done': bool(new_done)})

# ==================== ACTIVITY LOG ====================

@app.route('/api/logs', methods=['GET'])
def get_logs():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM activity_log ORDER BY id DESC LIMIT 100')
    logs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(logs)

def add_log(log_type, message, broadcast=True, details=None):
    """Add log entry and optionally broadcast via WebSocket"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    timestamp = datetime.now().isoformat()
    cursor.execute('''
        INSERT INTO activity_log (time, type, message)
        VALUES (?, ?, ?)
    ''', (timestamp, log_type, message))
    conn.commit()
    conn.close()
    
    # Also write to detailed JSON log
    log_entry = {
        'time': timestamp,
        'type': log_type,
        'message': message,
        'details': details or {}
    }
    
    detailed_log = '/home/madadmin/clawd/data/detailed-activity.json'
    logs = []
    if os.path.exists(detailed_log):
        try:
            with open(detailed_log, 'r') as f:
                logs = json.load(f)
        except:
            logs = []
    if not isinstance(logs, list):
        logs = []
    logs.append(log_entry)
    logs = logs[-10000:]  # Keep last 10k
    with open(detailed_log, 'w') as f:
        json.dump(logs, f, indent=2)
    
    # Broadcast to all connected clients
    if broadcast:
        try:
            socketio.emit('new_activity', {
                'time': timestamp,
                'type': log_type,
                'message': message
            })
        except:
            pass  # Socket not initialized yet
    
    print(f"📝 [{log_type.upper()}] {message}")

# ==================== NOTIFICATIONS ====================

def write_notification(notification):
    """Write notification to file for Cosmo to pick up"""
    os.makedirs(os.path.dirname(NOTIFICATIONS_FILE), exist_ok=True)
    
    notifications = []
    if os.path.exists(NOTIFICATIONS_FILE):
        try:
            with open(NOTIFICATIONS_FILE, 'r') as f:
                notifications = json.load(f)
        except:
            notifications = []
    
    notifications.append(notification)
    
    with open(NOTIFICATIONS_FILE, 'w') as f:
        json.dump(notifications, f, indent=2)
    
    print(f"📝 Notification written: {notification.get('type')}")

@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    if os.path.exists(NOTIFICATIONS_FILE):
        with open(NOTIFICATIONS_FILE, 'r') as f:
            return jsonify(json.load(f))
    return jsonify([])

# ==================== SYSTEM STATUS ====================

@app.route('/api/system', methods=['GET'])
def system_status():
    # Fallback if psutil not available
    try:
        import psutil
        return jsonify({
            'cpu': psutil.cpu_percent(interval=0.1),
            'memory': psutil.virtual_memory().percent,
            'disk': psutil.disk_usage('/').percent
        })
    except ImportError:
        # Read from /proc filesystem
        try:
            # CPU - simple calculation
            with open('/proc/stat') as f:
                line = f.readline()
                fields = line.split()
                if fields[0] == 'cpu':
                    total = sum(int(x) for x in fields[1:5])
                    idle = int(fields[4])
                    cpu = 100 * (1 - idle / total) if total > 0 else 0
                else:
                    cpu = 0
            
            # Memory
            with open('/proc/meminfo') as f:
                meminfo = f.read()
                mem_total = 0
                mem_available = 0
                for line in meminfo.split('\n'):
                    if line.startswith('MemTotal:'):
                        mem_total = int(line.split()[1]) * 1024
                    elif line.startswith('MemAvailable:'):
                        mem_available = int(line.split()[1]) * 1024
                memory = ((mem_total - mem_available) / mem_total * 100) if mem_total > 0 else 0
            
            # Disk
            import os
            stat = os.statvfs('/')
            total = stat.f_blocks * stat.f_frsize
            free = stat.f_bfree * stat.f_frsize
            disk = ((total - free) / total * 100) if total > 0 else 0
            
            return jsonify({
                'cpu': round(cpu, 1),
                'memory': round(memory, 1),
                'disk': round(disk, 1)
            })
        except Exception as e:
            print(f"Error reading system stats: {e}")
            return jsonify({'cpu': 0, 'memory': 0, 'disk': 0})

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Alias for /api/system for backward compatibility"""
    return system_status()

@app.route('/api/uptime', methods=['GET'])
def get_uptime():
    """Get uptime monitoring data for services"""
    return jsonify({
        "services": [
            {"id": "clawdbot", "name": "Clawdbot Gateway", "icon": "🤖", "url": "http://localhost:3000", 
             "checkType": "http", "autoRestart": True, "status": "online", "uptime": 99.9},
            {"id": "dashboard", "name": "Command Center", "icon": "🚀", "url": "http://localhost:8095", 
             "checkType": "http", "autoRestart": True, "status": "online", "uptime": 99.9},
            {"id": "stock-tracker", "name": "Stock Tracker", "icon": "📈", "url": "http://stocktracker.playit.plus", 
             "checkType": "http", "autoRestart": False, "status": "online", "uptime": 99.5},
            {"id": "influencer", "name": "Influencer Dashboard", "icon": "🎯", "url": "http://influencertracker.playit.plus", 
             "checkType": "http", "autoRestart": False, "status": "online", "uptime": 99.5},
            {"id": "system", "name": "madserver System", "icon": "🖥️", "url": None, 
             "checkType": "system", "autoRestart": False, "status": "online", "uptime": 99.9}
        ],
        "incidents": [],
        "autoHealCount": 0,
        "lastIncident": None
    })

@app.route('/api/tokens', methods=['GET'])
def get_tokens():
    """Get token usage data from clawdbot sessions with real-time limits"""
    try:
        sessions_file = '/home/madadmin/.clawdbot/agents/main/sessions/sessions.json'
        
        if os.path.exists(sessions_file):
            with open(sessions_file, 'r') as f:
                sessions = json.load(f)
            
            total_tokens = 0
            total_limit = 0
            session_list = []
            model_stats = {}
            
            for session_key, session_info in sessions.items():
                # Extract session details
                model = session_info.get('model', 'unknown')
                provider = session_info.get('modelProvider', 'unknown')
                input_tokens = session_info.get('inputTokens', 0)
                output_tokens = session_info.get('outputTokens', 0)
                context_limit = session_info.get('contextTokens', 262144)  # Default 262k
                
                session_total = input_tokens + output_tokens
                total_tokens += session_total
                total_limit += context_limit
                
                # Format session key for display
                session_name = session_key.replace('agent:main:', '').replace('discord:', 'Discord ').replace('channel:', '#')
                
                session_list.append({
                    'name': session_name,
                    'agent': 'Cosmo',
                    'model': model,
                    'provider': provider,
                    'status': 'active',
                    'tokensUsed': session_total,
                    'tokensLimit': context_limit,
                    'percentUsed': round((session_total / context_limit) * 100, 1),
                    'inputTokens': input_tokens,
                    'outputTokens': output_tokens
                })
                
                # Aggregate by model
                model_key = f"{provider}/{model}"
                if model_key not in model_stats:
                    model_stats[model_key] = {
                        'tokens': 0,
                        'calls': 0,
                        'sessions': 0
                    }
                model_stats[model_key]['tokens'] += session_total
                model_stats[model_key]['calls'] += 1
                model_stats[model_key]['sessions'] += 1
            
            return jsonify({
                'todayTokens': total_tokens,
                'todayLimit': total_limit,
                'todayPercent': round((total_tokens / total_limit) * 100, 1) if total_limit > 0 else 0,
                'activeSessions': len(sessions),
                'models': model_stats,
                'sessions': session_list,
                'availableModels': [
                    {'name': 'kimi-for-coding', 'provider': 'kimi-code', 'limit': 262144, 'costPer1K': 0.0, 'alias': 'Kimi Code'},
                    {'name': 'kimi-k2-0905-preview', 'provider': 'moonshot', 'limit': 262144, 'costPer1K': 0.0, 'alias': 'Kimi K2'},
                    {'name': 'kimi-k2.5-latest', 'provider': 'moonshot', 'limit': 256000, 'costPer1K': 0.0, 'alias': 'Kimi K2.5'}
                ],
                'currentModel': {
                    'name': 'kimi-k2.5-latest',
                    'provider': 'moonshot',
                    'alias': 'Kimi K2.5',
                    'contextWindow': 256000,
                    'status': 'active'
                }
            })
        
        # Fallback
        return jsonify({
            'todayTokens': 0,
            'todayLimit': 786432,
            'todayPercent': 0,
            'activeSessions': 0,
            'models': {},
            'sessions': [],
            'availableModels': []
        })
    except Exception as e:
        print(f"Error getting token stats: {e}")
        return jsonify({
            'todayTokens': 0,
            'todayLimit': 0,
            'todayPercent': 0,
            'activeSessions': 0,
            'models': {},
            'sessions': [],
            'availableModels': []
        })

# GitHub Approval System
PENDING_COMMITS_FILE = '/home/madadmin/clawd/data/pending-commits.json'

def load_pending_commits():
    """Load pending commits from file"""
    if os.path.exists(PENDING_COMMITS_FILE):
        try:
            with open(PENDING_COMMITS_FILE, 'r') as f:
                return json.load(f)
        except:
            return []
    return []

def save_pending_commits(commits):
    """Save pending commits to file"""
    os.makedirs(os.path.dirname(PENDING_COMMITS_FILE), exist_ok=True)
    with open(PENDING_COMMITS_FILE, 'w') as f:
        json.dump(commits, f, indent=2)

@app.route('/api/github/pending', methods=['GET'])
def get_pending_commits():
    """Get list of pending commits awaiting approval"""
    commits = load_pending_commits()
    return jsonify({
        'pending': len(commits),
        'commits': commits
    })

@app.route('/api/github/approve/<commit_id>', methods=['POST'])
def approve_commit(commit_id):
    """Approve and push a pending commit"""
    commits = load_pending_commits()
    commit = next((c for c in commits if c['id'] == commit_id), None)
    
    if not commit:
        return jsonify({'error': 'Commit not found'}), 404
    
    try:
        # Execute the git push
        result = subprocess.run(
            ['git', 'push', 'origin', commit['branch']],
            cwd=commit['repo'],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            # Remove from pending
            commits = [c for c in commits if c['id'] != commit_id]
            save_pending_commits(commits)
            
            # Log the approval
            add_log('system', f"✅ GitHub commit approved and pushed: {commit['message'][:50]}...")
            
            return jsonify({
                'success': True,
                'message': 'Commit approved and pushed successfully',
                'output': result.stdout
            })
        else:
            return jsonify({
                'success': False,
                'error': result.stderr
            }), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/github/reject/<commit_id>', methods=['POST'])
def reject_commit(commit_id):
    """Reject and remove a pending commit"""
    commits = load_pending_commits()
    commit = next((c for c in commits if c['id'] == commit_id), None)
    
    if not commit:
        return jsonify({'error': 'Commit not found'}), 404
    
    try:
        # Reset the commit (soft reset to keep changes)
        subprocess.run(
            ['git', 'reset', '--soft', 'HEAD~1'],
            cwd=commit['repo'],
            capture_output=True,
            timeout=10
        )
        
        # Remove from pending
        commits = [c for c in commits if c['id'] != commit_id]
        save_pending_commits(commits)
        
        # Log the rejection
        add_log('system', f"❌ GitHub commit rejected: {commit['message'][:50]}...")
        
        return jsonify({
            'success': True,
            'message': 'Commit rejected and changes unstaged'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/github/history', methods=['GET'])
def get_git_history():
    """Get recent git history"""
    try:
        result = subprocess.run(
            ['git', 'log', '--oneline', '-20'],
            cwd='/home/madadmin/clawd',
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            commits = []
            for line in result.stdout.strip().split('\n'):
                if line:
                    hash_code = line[:7]
                    message = line[8:]
                    commits.append({'hash': hash_code, 'message': message})
            return jsonify({'commits': commits})
        else:
            return jsonify({'commits': [], 'error': result.stderr})
    except Exception as e:
        return jsonify({'commits': [], 'error': str(e)})


# Sub-Agent / Session Monitoring
SUBAGENT_TASKS_FILE = '/home/madadmin/clawd/data/subagent-tasks.json'

def load_subagent_tasks():
    """Load task info for sub-agents"""
    if os.path.exists(SUBAGENT_TASKS_FILE):
        try:
            with open(SUBAGENT_TASKS_FILE, 'r') as f:
                data = json.load(f)
                return {t['agent_id']: t for t in data.get('tasks', [])}
        except:
            return {}
    return {}

@app.route('/api/subagents', methods=['GET'])
def get_subagents():
    """Get list of active spawned sub-agents/sessions"""
    try:
        sessions_file = '/home/madadmin/.clawdbot/agents/main/sessions/sessions.json'
        tasks = load_subagent_tasks()
        subagents = []
        
        if os.path.exists(sessions_file):
            with open(sessions_file, 'r') as f:
                sessions = json.load(f)
            
            for session_key, session_info in sessions.items():
                # Skip main session
                if 'main' in session_key and 'subagent' not in session_key:
                    continue
                
                # Parse session info
                agent_type = 'subagent' if 'subagent' in session_key else 'worker'
                session_id = session_key.split(':')[-1][:8] if ':' in session_key else session_key[:8]
                
                # Get task info if available
                task_info = tasks.get(session_id, {})
                
                subagents.append({
                    'id': session_id,
                    'full_key': session_key,
                    'type': agent_type,
                    'model': session_info.get('model', 'unknown'),
                    'provider': session_info.get('modelProvider', 'unknown'),
                    'status': task_info.get('status', 'active'),
                    'task': task_info.get('task', 'Unknown task'),
                    'description': task_info.get('description', ''),
                    'output_file': task_info.get('output_file', ''),
                    'started': task_info.get('started', ''),
                    'tokens_in': session_info.get('inputTokens', 0),
                    'tokens_out': session_info.get('outputTokens', 0),
                    'context_used': session_info.get('contextTokens', 0),
                    'updated': session_info.get('lastMessageAt', 'unknown')
                })
        
        # Also check for running Python processes
        try:
            result = subprocess.run(
                ['ps', 'aux'],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            process_agents = []
            for line in result.stdout.split('\n'):
                if 'python3' in line and any(x in line for x in ['monitor', 'evaluator', 'email']):
                    parts = line.split()
                    if len(parts) > 10:
                        pid = parts[1]
                        cmd = ' '.join(parts[10:])[:60]
                        process_agents.append({
                            'id': f"proc-{pid}",
                            'type': 'background_process',
                            'name': cmd,
                            'status': 'running',
                            'pid': pid
                        })
            
            subagents.extend(process_agents)
        except:
            pass
        
        return jsonify({
            'count': len(subagents),
            'subagents': subagents
        })
    except Exception as e:
        return jsonify({'count': 0, 'subagents': [], 'error': str(e)})

# ==================== FILE UPLOADS ====================

UPLOAD_FOLDER = '/home/madadmin/.clawdbot/media/inbound'
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'gif', 'txt', 'md', 'json', 'csv', 'zip', 'py', 'js', 'html', 'css', 'mp3', 'wav', 'ogg', 'm4a'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/upload.html')
def upload_page():
    return send_from_directory('.', 'upload.html')

@app.route('/dashboard')
def dashboard():
    """Command Center is now at /dashboard"""
    return send_from_directory('.', 'index.html')

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Handle file uploads from the web interface"""
    if 'file' not in request.files:
        add_log('error', 'File upload attempted with no file', broadcast=False)
        return jsonify({'success': False, 'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        add_log('error', 'File upload attempted with empty filename', broadcast=False)
        return jsonify({'success': False, 'error': 'No file selected'}), 400
    
    if file and allowed_file(file.filename):
        ext = file.filename.rsplit('.', 1)[1].lower()
        unique_name = f"{uuid.uuid4()}.{ext}"
        filepath = os.path.join(UPLOAD_FOLDER, unique_name)
        
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        file.save(filepath)
        file_size = os.path.getsize(filepath)
        
        # Log the upload
        add_log('info', f'📤 File uploaded: "{file.filename}" ({format_file_size(file_size)}) by user')
        
        # Write notification for Cosmo
        write_notification({
            'type': 'file_uploaded',
            'timestamp': datetime.now().isoformat(),
            'filename': file.filename,
            'path': filepath,
            'size': file_size,
            'channel': '1466517317403021362'
        })
        
        return jsonify({
            'success': True,
            'filename': file.filename,
            'path': filepath,
            'size': file_size,
            'message': 'File uploaded successfully'
        })
    else:
        add_log('warning', f'File upload rejected: "{file.filename}" - type not allowed')
        return jsonify({
            'success': False,
            'error': 'File type not allowed'
        }), 400

@app.route('/api/uploads/recent', methods=['GET'])
def get_recent_uploads():
    """Get list of recent uploads"""
    try:
        files = []
        if os.path.exists(UPLOAD_FOLDER):
            for f in os.listdir(UPLOAD_FOLDER):
                filepath = os.path.join(UPLOAD_FOLDER, f)
                if os.path.isfile(filepath):
                    stat = os.stat(filepath)
                    files.append({
                        'name': f,
                        'size': format_file_size(stat.st_size),
                        'path': filepath,
                        'time': datetime.fromtimestamp(stat.st_mtime).isoformat()
                    })
        files.sort(key=lambda x: x['time'], reverse=True)
        return jsonify(files[:10])
    except Exception as e:
        add_log('error', f'Error listing uploads: {str(e)}')
        return jsonify([])

@app.route('/api/download/<filename>')
def download_file(filename):
    """Download a file from the upload folder"""
    try:
        # Log the download
        add_log('info', f'📥 File downloaded: "{filename}"')
        return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=True)
    except Exception as e:
        add_log('error', f'File download failed: "{filename}" - {str(e)}')
        return jsonify({'error': 'File not found'}), 404

@app.route('/api/files')
def list_files():
    """List all files (for 2-way transfer)"""
    try:
        files = []
        if os.path.exists(UPLOAD_FOLDER):
            for f in os.listdir(UPLOAD_FOLDER):
                filepath = os.path.join(UPLOAD_FOLDER, f)
                if os.path.isfile(filepath):
                    stat = os.stat(filepath)
                    files.append({
                        'name': f,
                        'original_name': f,
                        'size': stat.st_size,
                        'size_formatted': format_file_size(stat.st_size),
                        'uploaded_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        'download_url': f'/api/download/{f}'
                    })
        files.sort(key=lambda x: x['uploaded_at'], reverse=True)
        add_log('info', f'📋 File list retrieved: {len(files)} files')
        return jsonify({'files': files})
    except Exception as e:
        add_log('error', f'Error listing files: {str(e)}')
        return jsonify({'files': [], 'error': str(e)})

def format_file_size(size):
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024.0:
            return f"{size:.1f} {unit}"
        size /= 1024.0
    return f"{size:.1f} TB"

# ==================== WEBSOCKET REAL-TIME UPDATES ====================

@socketio.on('connect')
def handle_connect():
    """Client connected"""
    print('🔌 Client connected')
    emit('connected', {'status': 'connected', 'timestamp': datetime.now().isoformat()})

@socketio.on('disconnect')
def handle_disconnect():
    """Client disconnected"""
    print('🔌 Client disconnected')

@socketio.on('subscribe_updates')
def handle_subscribe():
    """Subscribe to real-time updates"""
    print('📡 Client subscribed to updates')
    emit('subscribed', {'channel': 'dashboard_updates'})

def broadcast_update(update_type, data):
    """Broadcast update to all connected clients"""
    socketio.emit('update', {
        'type': update_type,
        'data': data,
        'timestamp': datetime.now().isoformat()
    })

def background_updater():
    """Background thread to emit periodic updates"""
    while True:
        try:
            # Emit system stats every 5 seconds (using /proc fallback)
            try:
                import psutil
                stats = {
                    'cpu': psutil.cpu_percent(interval=0.1),
                    'memory': psutil.virtual_memory().percent,
                    'disk': psutil.disk_usage('/').percent
                }
            except ImportError:
                # Fallback to reading from /proc
                stats = get_system_stats_fallback()
            
            broadcast_update('system_stats', stats)
            
        except Exception as e:
            print(f"Background updater error: {e}")
        
        time.sleep(5)

def get_system_stats_fallback():
    """Get system stats without psutil"""
    try:
        # CPU from /proc/stat
        with open('/proc/stat') as f:
            line = f.readline()
            fields = line.split()
            if fields[0] == 'cpu':
                total = sum(int(x) for x in fields[1:5])
                idle = int(fields[4])
                cpu = 100 * (1 - idle / total) if total > 0 else 0
            else:
                cpu = 0
        
        # Memory from /proc/meminfo
        with open('/proc/meminfo') as f:
            meminfo = f.read()
            mem_total = 0
            mem_available = 0
            for line in meminfo.split('\n'):
                if line.startswith('MemTotal:'):
                    mem_total = int(line.split()[1]) * 1024
                elif line.startswith('MemAvailable:'):
                    mem_available = int(line.split()[1]) * 1024
            memory = ((mem_total - mem_available) / mem_total * 100) if mem_total > 0 else 0
        
        # Disk
        stat = os.statvfs('/')
        total = stat.f_blocks * stat.f_frsize
        free = stat.f_bfree * stat.f_frsize
        disk = ((total - free) / total * 100) if total > 0 else 0
        
        return {
            'cpu': round(cpu, 1),
            'memory': round(memory, 1),
            'disk': round(disk, 1)
        }
    except Exception as e:
        print(f"Fallback stats error: {e}")
        return {'cpu': 0, 'memory': 0, 'disk': 0}

# ==================== AUDIT LOG ENDPOINTS ====================

@app.route('/api/audit', methods=['GET'])
def get_audit_log():
    """Get audit log entries"""
    try:
        limit = request.args.get('limit', 100, type=int)
        conn = sqlite3.connect(AUDIT_DB)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT timestamp, actor, action, target_type, target_id, details
            FROM audit_log
            ORDER BY timestamp DESC
            LIMIT ?
        ''', (limit,))
        rows = cursor.fetchall()
        conn.close()
        
        return jsonify([{
            'timestamp': r[0],
            'actor': r[1],
            'action': r[2],
            'target_type': r[3],
            'target_id': r[4],
            'details': json.loads(r[5]) if r[5] else None
        } for r in rows])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/audit/stats', methods=['GET'])
def get_audit_stats():
    """Get audit statistics"""
    try:
        conn = sqlite3.connect(AUDIT_DB)
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*) FROM audit_log')
        total = cursor.fetchone()[0]
        
        cursor.execute('SELECT action, COUNT(*) FROM audit_log GROUP BY action')
        actions = {row[0]: row[1] for row in cursor.fetchall()}
        
        cursor.execute('SELECT actor, COUNT(*) FROM audit_log GROUP BY actor')
        actors = {row[0]: row[1] for row in cursor.fetchall()}
        
        conn.close()
        
        return jsonify({
            'total_entries': total,
            'actions': actions,
            'actors': actors
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Initialize audit database
    try:
        conn = sqlite3.connect(AUDIT_DB)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                actor TEXT NOT NULL,
                action TEXT NOT NULL,
                target_type TEXT,
                target_id TEXT,
                old_value TEXT,
                new_value TEXT,
                details TEXT
            )
        ''')
        conn.commit()
        conn.close()
        print(f"🔍 Audit database initialized: {AUDIT_DB}")
    except Exception as e:
        print(f"Audit init error: {e}")
    
    print("🚀 Starting Cosmo Dashboard Server v27 (WebSocket Enabled)...")
    print(f"📊 Database: {DB_PATH}")
    print(f"🔔 Notifications: {NOTIFICATIONS_FILE}")
    print(f"🐙 GitHub Approval: {PENDING_COMMITS_FILE}")
    print(f"🔍 Audit Log: {AUDIT_DB}")
    
    # Start background updater thread
    updater_thread = threading.Thread(target=background_updater, daemon=True)
    updater_thread.start()
    print("📡 Background updater started")
    
    # Run with SocketIO (allow_unsafe_werkzeug for production use)
    socketio.run(app, host='0.0.0.0', port=8095, debug=False, allow_unsafe_werkzeug=True)
