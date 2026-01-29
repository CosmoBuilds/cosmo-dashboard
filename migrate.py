#!/usr/bin/env python3
"""
Migrate old JSON data to SQLite database
"""

import json
import sqlite3
import os

DB_PATH = '/home/madadmin/clawd/cosmo-dashboard/data/dashboard.db'
OLD_DATA_FILE = '/home/madadmin/clawd/cosmo-dashboard/data/dashboard-data.json'
OLD_IDEAS_FILE = '/home/madadmin/clawd/cosmo-dashboard/data/ideas.json'

def migrate_data():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("🔄 Migrating data to SQLite...")
    
    # Migrate projects
    if os.path.exists(OLD_DATA_FILE):
        with open(OLD_DATA_FILE) as f:
            old_data = json.load(f)
        
        projects = old_data.get('projects', [])
        for p in projects:
            cursor.execute('''
                INSERT OR REPLACE INTO projects (id, name, description, status, created, updated)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                p.get('id'),
                p.get('name'),
                p.get('description', ''),
                p.get('status', 'pending-review'),
                p.get('created', ''),
                p.get('created', '')
            ))
        print(f"✅ Migrated {len(projects)} projects")
        
        # Migrate tasks
        tasks = old_data.get('tasks', [])
        for t in tasks:
            cursor.execute('''
                INSERT OR REPLACE INTO tasks (id, title, project, priority, done)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                t.get('id'),
                t.get('title'),
                t.get('project', 'General'),
                t.get('priority', 'medium'),
                1 if t.get('done') else 0
            ))
        print(f"✅ Migrated {len(tasks)} tasks")
        
        # Migrate activity log
        logs = old_data.get('logs', [])
        for log in logs:
            cursor.execute('''
                INSERT INTO activity_log (time, type, message)
                VALUES (?, ?, ?)
            ''', (
                log.get('time', ''),
                log.get('type', 'info'),
                log.get('message', '')
            ))
        print(f"✅ Migrated {len(logs)} log entries")
    
    # Migrate ideas
    if os.path.exists(OLD_IDEAS_FILE):
        with open(OLD_IDEAS_FILE) as f:
            ideas_data = json.load(f)
        
        ideas = ideas_data.get('ideas', [])
        for i in ideas:
            cursor.execute('''
                INSERT OR REPLACE INTO ideas (id, title, description, priority, status, assignee, created, createdBy)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                i.get('id'),
                i.get('title'),
                i.get('description', ''),
                i.get('priority', 'medium'),
                i.get('status', 'open'),
                i.get('assignee', 'team'),
                i.get('created', ''),
                i.get('createdBy', 'Cosmo')
            ))
        print(f"✅ Migrated {len(ideas)} ideas")
    
    conn.commit()
    conn.close()
    print("\n🎉 Migration complete!")
    
    # Show summary
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('SELECT COUNT(*) FROM projects')
    project_count = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM ideas')
    idea_count = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM tasks')
    task_count = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM activity_log')
    log_count = cursor.fetchone()[0]
    
    conn.close()
    
    print(f"\n📊 Database now contains:")
    print(f"   Projects: {project_count}")
    print(f"   Ideas: {idea_count}")
    print(f"   Tasks: {task_count}")
    print(f"   Log entries: {log_count}")

if __name__ == '__main__':
    migrate_data()
