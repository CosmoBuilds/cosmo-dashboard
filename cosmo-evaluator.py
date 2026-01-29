#!/usr/bin/env python3
"""
Cosmo's Project/Idea/Task Evaluator
Reads notifications and sends Discord messages with my thoughts
"""

import json
import os
import time
import urllib.request
from datetime import datetime

NOTIFICATIONS_FILE = '/home/madadmin/clawd/data/pending-notification.json'
PROCESSED_FILE = '/tmp/cosmo-processed-notifications.json'
DISCORD_CHANNEL = '1466517317403021362'

def load_processed():
    """Load already processed notification IDs"""
    if os.path.exists(PROCESSED_FILE):
        try:
            with open(PROCESSED_FILE, 'r') as f:
                return json.load(f)
        except:
            return []
    return []

def save_processed(processed):
    """Save processed notification IDs"""
    with open(PROCESSED_FILE, 'w') as f:
        json.dump(processed, f)

def send_discord_message(message):
    """Send message to Discord via Clawdbot Gateway"""
    try:
        # Use Clawdbot's message tool via API
        import subprocess
        
        # Create a temporary script to send the message
        script = f'''
import sys
sys.path.insert(0, '/home/madadmin/.clawdbot')

# Simple Discord webhook approach
import urllib.request
import json

webhook_url = "https://discord.com/api/v10/channels/{DISCORD_CHANNEL}/messages"

# Get bot token from clawdbot config
import json
with open('/home/madadmin/.clawdbot/clawdbot.json') as f:
    config = json.load(f)
token = config.get('channels', {{}}).get('discord', {{}}).get('token', '')

if token:
    data = json.dumps({{"content": {repr(message)}}}).encode()
    req = urllib.request.Request(
        webhook_url,
        data=data,
        headers={{
            'Content-Type': 'application/json',
            'Authorization': f'Bot {{token}}'
        }},
        method='POST'
    )
    urllib.request.urlopen(req)
    print("Sent!")
else:
    print("No token found")
'''
        
        result = subprocess.run(['python3', '-c', script], 
                              capture_output=True, text=True, timeout=10)
        return result.returncode == 0
    except Exception as e:
        print(f"Error sending Discord: {e}")
        return False

def evaluate_project(project):
    """Generate my evaluation of a project"""
    name = project.get('name', 'Unnamed Project')
    desc = project.get('description', '')
    
    # Simple keyword-based analysis
    desc_lower = desc.lower()
    
    complexity = 'low'
    priority = 'low'
    opinion = ''
    
    # Analyze complexity
    if any(word in desc_lower for word in ['ai', 'ml', 'machine learning', 'neural', 'model']):
        complexity = 'high'
        opinion = "🧠 This involves AI/ML - complex implementation requiring expertise and compute resources."
    elif any(word in desc_lower for word in ['automation', 'bot', 'script', 'cron', 'monitor']):
        complexity = 'low'
        opinion = "🤖 Automation task - straightforward to implement with existing tools and scripts."
    elif any(word in desc_lower for word in ['integration', 'api', 'webhook', 'discord', 'slack']):
        complexity = 'medium'
        opinion = "🔌 Integration work - need to handle auth, rate limits, and error handling."
    elif any(word in desc_lower for word in ['ui', 'frontend', 'design', 'css', 'react']):
        complexity = 'medium'
        opinion = "🎨 Frontend work - requires attention to UX, responsive design, and browser compatibility."
    elif 'youtube' in desc_lower or 'automation' in desc_lower:
        complexity = 'medium'
        opinion = "📺 YouTube automation - solid business model with proven passive income potential."
    else:
        opinion = "📋 Standard development task - manageable with current stack and expertise."
    
    # Analyze priority
    if any(word in desc_lower for word in ['urgent', 'critical', 'asap', 'security', 'bug', 'broken']):
        priority = 'high'
    elif any(word in desc_lower for word in ['revenue', 'money', 'income', 'business', 'automation']):
        priority = 'medium'
    
    return complexity, priority, opinion

def evaluate_idea(idea):
    """Generate my evaluation of an idea"""
    title = idea.get('title', 'Unnamed Idea')
    desc = idea.get('description', '')
    priority = idea.get('priority', 'medium')
    
    return priority, f"💡 Idea with {priority} priority. Review and approve to create implementation plan."

def evaluate_task(task):
    """Generate my evaluation of a task"""
    title = task.get('title', 'Unnamed Task')
    project = task.get('project', 'General')
    priority = task.get('priority', 'medium')
    
    return priority, f"✅ Task for {project} project. {priority.upper()} priority."

def process_notifications():
    """Process pending notifications"""
    if not os.path.exists(NOTIFICATIONS_FILE):
        return
    
    try:
        with open(NOTIFICATIONS_FILE, 'r') as f:
            notifications = json.load(f)
    except:
        return
    
    if not isinstance(notifications, list):
        return
    
    processed = load_processed()
    new_processed = []
    
    for notif in notifications:
        # Create unique ID for this notification
        notif_id = f"{notif.get('type')}_{notif.get('timestamp')}"
        
        if notif_id in processed:
            continue
        
        notif_type = notif.get('type', '')
        message = ''
        
        if notif_type == 'new_project':
            project = notif.get('project', {})
            complexity, priority, opinion = evaluate_project(project)
            
            message = f"""📁 **NEW PROJECT FOR REVIEW** <@370334885652463626>

**{project.get('name', 'Unnamed')}**
Status: {project.get('status', 'pending')}

**Cosmo's Evaluation:**
{opinion}

**Complexity:** {complexity.upper()}
**Priority:** {priority.upper()}

Reply "go" to start or suggest changes!"""
        
        elif notif_type == 'new_idea':
            idea = notif.get('idea', {})
            priority, opinion = evaluate_idea(idea)
            
            message = f"""💡 **NEW IDEA SUBMITTED** <@370334885652463626>

**{idea.get('title', 'Unnamed')}**
Priority: {priority.upper()}

{opinion}

Click "Approve" in dashboard to add to roadmap!"""
        
        elif notif_type == 'new_task':
            task = notif.get('task', {})
            priority, opinion = evaluate_task(task)
            
            message = f"""✅ **NEW TASK CREATED** <@370334885652463626>

**{task.get('title', 'Unnamed')}**
Project: {task.get('project', 'General')}
Priority: {priority.upper()}

{opinion}"""
        
        if message:
            print(f"📝 Sending evaluation for {notif_type}...")
            # For now, just print it (Discord sending needs proper integration)
            print(message[:200] + "...")
            
            # Try to send via Clawdbot
            # send_discord_message(message)
            
            # Write to a file that Cosmo can read
            alert_file = '/home/madadmin/clawd/data/cosmo-alerts.json'
            alerts = []
            if os.path.exists(alert_file):
                try:
                    with open(alert_file, 'r') as f:
                        alerts = json.load(f)
                except:
                    alerts = []
            
            if not isinstance(alerts, list):
                alerts = []
            
            alerts.append({
                'type': notif_type,
                'timestamp': datetime.now().isoformat(),
                'message': message,
                'channel': DISCORD_CHANNEL
            })
            
            with open(alert_file, 'w') as f:
                json.dump(alerts, f, indent=2)
            
            print(f"✅ Alert saved for {notif_type}")
        
        new_processed.append(notif_id)
    
    # Save processed IDs
    processed.extend(new_processed)
    save_processed(processed)

if __name__ == '__main__':
    print("🚀 Cosmo Evaluator Started")
    print("⏰ Checking every 30 seconds...")
    print("")
    
    # Initial check
    process_notifications()
    
    # Loop
    while True:
        time.sleep(30)
        process_notifications()
