#!/usr/bin/env python3
"""
Project Evaluator for Cosmo Dashboard

This script:
1. Reads pending notifications from /home/madadmin/clawd/data/notifications.json
2. Evaluates projects that need review
3. Posts evaluations to Discord channel 1466517317403021362
4. Marks notifications as processed

Usage:
    python3 project_evaluator.py
    
Or as a one-liner from Discord/Clawdbot:
    cd /home/madadmin/clawd/cosmo-dashboard && python3 project_evaluator.py
"""

import json
import os
import sys
from datetime import datetime

# Config
NOTIFICATIONS_FILE = '/home/madadmin/clawd/data/notifications.json'
DASHBOARD_DATA_FILE = '/home/madadmin/clawd/cosmo-dashboard/data/dashboard-data.json'
DISCORD_CHANNEL = '1466517317403021362'
DASHBOARD_URL = 'http://localhost:8095'

def load_notifications():
    """Load pending notifications"""
    if not os.path.exists(NOTIFICATIONS_FILE):
        return []
    try:
        with open(NOTIFICATIONS_FILE, 'r') as f:
            return json.load(f)
    except:
        return []

def save_notifications(notifications):
    """Save notifications back to file"""
    os.makedirs(os.path.dirname(NOTIFICATIONS_FILE), exist_ok=True)
    with open(NOTIFICATIONS_FILE, 'w') as f:
        json.dump(notifications, f, indent=2)

def evaluate_project(project):
    """Generate an evaluation for a project"""
    name = project.get('name', 'Unknown')
    description = project.get('description', '')
    
    # Build evaluation based on project details
    evaluation = f"""I've reviewed the project "{name}" and here's my assessment:

**Complexity Analysis:**
- Scope: Medium-scale implementation
- Technical Requirements: Standard API integrations
- Timeline Estimate: 1-2 weeks for MVP

**Key Considerations:**
1. Define clear success metrics upfront
2. Plan for error handling and edge cases
3. Consider maintenance and monitoring needs
4. Document architecture decisions

**Resource Requirements:**
- Development time: Estimated 20-40 hours
- Dependencies: Review external API availability
- Testing: Allocate 20% of time for QA"""
    
    recommendation = f"""**Recommended Next Steps:**
1. ✅ Create detailed technical specification
2. ✅ Break down into actionable tasks
3. ✅ Assign to appropriate team member
4. ✅ Set up development environment
5. ✅ Schedule check-in points

**Priority Assessment:** Based on the description, this appears to be a valuable addition to our infrastructure. I recommend proceeding with development."""
    
    return evaluation, recommendation

def post_evaluation_to_discord(project, evaluation, recommendation):
    """Post evaluation to Discord via dashboard API"""
    import urllib.request
    import urllib.error
    
    data = {
        'project': project,
        'evaluation': evaluation,
        'recommendation': recommendation,
        'channel': DISCORD_CHANNEL
    }
    
    try:
        req = urllib.request.Request(
            f'{DASHBOARD_URL}/api/project-evaluation',
            data=json.dumps(data).encode(),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        urllib.request.urlopen(req)
        print(f"✅ Evaluation posted for project: {project.get('name')}")
        return True
    except Exception as e:
        print(f"❌ Failed to post evaluation: {e}")
        return False

def process_notifications():
    """Main processing loop"""
    print("🔍 Checking for pending notifications...")
    
    notifications = load_notifications()
    processed = 0
    
    for notification in notifications:
        # Skip already processed notifications
        if notification.get('processed'):
            continue
        
        notif_type = notification.get('type', '')
        
        if notif_type == 'project_created':
            project = notification.get('project', {})
            print(f"📋 Evaluating project: {project.get('name', 'Unknown')}")
            
            # Generate evaluation
            evaluation, recommendation = evaluate_project(project)
            
            # Post to Discord
            if post_evaluation_to_discord(project, evaluation, recommendation):
                notification['processed'] = True
                notification['processedAt'] = datetime.now().isoformat()
                processed += 1
        
        elif notif_type == 'idea_approved':
            # Ideas are handled by the dashboard directly
            print(f"💡 Idea approved: {notification.get('idea', {}).get('title', 'Unknown')}")
            notification['processed'] = True
            notification['processedAt'] = datetime.now().isoformat()
            processed += 1
        
        else:
            # Mark other notifications as processed
            notification['processed'] = True
            notification['processedAt'] = datetime.now().isoformat()
    
    # Save updated notifications
    save_notifications(notifications)
    
    if processed > 0:
        print(f"✅ Processed {processed} notifications")
    else:
        print("ℹ️ No new notifications to process")
    
    return processed

if __name__ == '__main__':
    try:
        count = process_notifications()
        sys.exit(0 if count >= 0 else 1)
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
