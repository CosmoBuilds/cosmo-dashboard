#!/usr/bin/env python3
"""
Cosmo Dashboard - Robust SQLite Backend
Handles all data persistence with proper database
"""

import sqlite3
import json
import os
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

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
    cursor = conn.cursor()
    
    cursor.execute('UPDATE ideas SET status=? WHERE id=?', ('approved', idea_id))
    conn.commit()
    
    # Get idea details
    cursor.execute('SELECT * FROM ideas WHERE id=?', (idea_id,))
    idea = dict(cursor.fetchone())
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

def add_log(log_type, message):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO activity_log (time, type, message)
        VALUES (?, ?, ?)
    ''', (datetime.now().isoformat(), log_type, message))
    conn.commit()
    conn.close()

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
    import psutil
    return jsonify({
        'cpu': psutil.cpu_percent(interval=0.1),
        'memory': psutil.virtual_memory().percent,
        'disk': psutil.disk_usage('/').percent
    })

if __name__ == '__main__':
    print("🚀 Starting Cosmo Dashboard Server...")
    print(f"📊 Database: {DB_PATH}")
    print(f"🔔 Notifications: {NOTIFICATIONS_FILE}")
    app.run(host='0.0.0.0', port=8095, debug=False)
