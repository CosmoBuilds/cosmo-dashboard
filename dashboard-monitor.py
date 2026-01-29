#!/usr/bin/env python3
"""
Lightweight database monitor for Cosmo Dashboard
Checks for new projects/tasks/ideas every 30 seconds
"""

import sqlite3
import json
import os
import time
from datetime import datetime

DB_PATH = '/home/madadmin/clawd/cosmo-dashboard/data/dashboard.db'
STATE_FILE = '/tmp/dashboard-monitor-state.json'
NOTIFICATIONS_FILE = '/home/madadmin/clawd/data/pending-notification.json'

def load_state():
    """Load last known state"""
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return {'last_project_id': 0, 'last_task_id': 0, 'last_idea_id': 0}

def save_state(state):
    """Save current state"""
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f)

def write_notification(notification):
    """Write notification for Cosmo to pick up"""
    notifications = []
    if os.path.exists(NOTIFICATIONS_FILE):
        try:
            with open(NOTIFICATIONS_FILE, 'r') as f:
                notifications = json.load(f)
        except:
            notifications = []
    
    # Ensure it's a list
    if not isinstance(notifications, list):
        notifications = []
    
    notifications.append(notification)
    
    os.makedirs(os.path.dirname(NOTIFICATIONS_FILE), exist_ok=True)
    with open(NOTIFICATIONS_FILE, 'w') as f:
        json.dump(notifications, f, indent=2)

def check_database():
    """Check database for new entries"""
    state = load_state()
    
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Check for new projects
        cursor.execute('SELECT * FROM projects WHERE id > ? ORDER BY id DESC', (state['last_project_id'],))
        new_projects = cursor.fetchall()
        
        for project in new_projects:
            print(f"🔔 New project detected: {project['name']}")
            write_notification({
                'type': 'new_project',
                'timestamp': datetime.now().isoformat(),
                'project': {
                    'id': project['id'],
                    'name': project['name'],
                    'description': project['description'],
                    'status': project['status']
                },
                'message': f"📁 New project created: **{project['name']}**\nStatus: {project['status']}\nCheck dashboard to evaluate!"
            })
            state['last_project_id'] = max(state['last_project_id'], project['id'])
        
        # Check for new tasks
        cursor.execute('SELECT * FROM tasks WHERE id > ? ORDER BY id DESC', (state['last_task_id'],))
        new_tasks = cursor.fetchall()
        
        for task in new_tasks:
            print(f"🔔 New task detected: {task['title']}")
            write_notification({
                'type': 'new_task',
                'timestamp': datetime.now().isoformat(),
                'task': {
                    'id': task['id'],
                    'title': task['title'],
                    'project': task['project'],
                    'priority': task['priority']
                },
                'message': f"✅ New task created: **{task['title']}**\nProject: {task['project']}\nPriority: {task['priority']}"
            })
            state['last_task_id'] = max(state['last_task_id'], task['id'])
        
        # Check for new ideas
        cursor.execute('SELECT * FROM ideas WHERE id > ? ORDER BY id DESC', (state['last_idea_id'],))
        new_ideas = cursor.fetchall()
        
        for idea in new_ideas:
            print(f"🔔 New idea detected: {idea['title']}")
            write_notification({
                'type': 'new_idea',
                'timestamp': datetime.now().isoformat(),
                'idea': {
                    'id': idea['id'],
                    'title': idea['title'],
                    'priority': idea['priority']
                },
                'message': f"💡 New idea: **{idea['title']}**\nPriority: {idea['priority']}"
            })
            state['last_idea_id'] = max(state['last_idea_id'], idea['id'])
        
        conn.close()
        save_state(state)
        
        total_new = len(new_projects) + len(new_tasks) + len(new_ideas)
        if total_new > 0:
            print(f"✅ Found {total_new} new items")
        
    except Exception as e:
        print(f"❌ Error checking database: {e}")

if __name__ == '__main__':
    print("🚀 Dashboard Monitor Started")
    print(f"📊 Watching: {DB_PATH}")
    print(f"🔔 Notifications: {NOTIFICATIONS_FILE}")
    print("⏰ Checking every 30 seconds...")
    print("")
    
    # Initial check
    check_database()
    
    # Loop forever
    while True:
        time.sleep(30)
        check_database()
