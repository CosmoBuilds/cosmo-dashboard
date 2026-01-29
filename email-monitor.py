#!/usr/bin/env python3
"""
Cosmo Email Monitor
Checks cosmo@agentmail.to for new emails every 30 seconds
Auto-replies and logs to dashboard
"""

import os
import json
import urllib.request
import time
from datetime import datetime

# Load credentials
ENV_FILE = '/home/madadmin/clawd/.env.agentmail'
API_KEY = None
INBOX_ID = None

def load_credentials():
    global API_KEY, INBOX_ID
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE, 'r') as f:
            for line in f:
                if line.startswith('AGENTMAIL_API_KEY='):
                    API_KEY = line.strip().split('=', 1)[1]
                elif line.startswith('AGENTMAIL_INBOX_ID='):
                    INBOX_ID = line.strip().split('=', 1)[1]

load_credentials()
BASE_URL = 'https://api.agentmail.to/v0'
STATE_FILE = '/tmp/cosmo-email-state.json'

def load_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return {'processed_ids': [], 'last_check': None}

def save_state(state):
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f)

def api_request(endpoint, method='GET', data=None):
    url = f"{BASE_URL}{endpoint}"
    headers = {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    }
    
    try:
        if data:
            data = json.dumps(data).encode()
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"API error: {e}")
        return None

def get_messages(limit=20):
    return api_request(f'/inboxes/{INBOX_ID}/messages?limit={limit}')

def get_message(message_id):
    return api_request(f'/inboxes/{INBOX_ID}/messages/{message_id}')

def send_reply(to, subject, body):
    data = {
        'to': to,
        'subject': f"Re: {subject}",
        'text': body
    }
    return api_request(f'/inboxes/{INBOX_ID}/messages/send', method='POST', data=data)

def mark_read(message_id):
    return api_request(f'/inboxes/{INBOX_ID}/messages/{message_id}/read', method='POST')

def process_email(msg):
    """Process a new email"""
    msg_id = msg.get('message_id')
    from_addr = msg.get('from_address')
    subject = msg.get('subject', '(no subject)')
    body = msg.get('text', '')
    
    print(f"\n📨 New email from {from_addr}")
    print(f"   Subject: {subject}")
    print(f"   Preview: {body[:100]}...")
    
    # Auto-reply logic
    reply_body = f"""Hey!

Thanks for emailing me at cosmo@agentmail.to!

I received your message about: "{subject}"

I'm currently in training mode but I'll get back to you soon. For urgent matters, ping Bowz on Discord.

- Cosmo 🤖

---
This is an automated response. Your message has been logged.
"""
    
    # Send auto-reply (except to ourselves)
    if 'cosmo@agentmail.to' not in from_addr:
        send_reply(from_addr, subject, reply_body)
        print(f"   ✅ Auto-reply sent")
    
    # Mark as read
    mark_read(msg_id)
    
    # Log to dashboard notification file
    notification = {
        'type': 'email_received',
        'timestamp': datetime.now().isoformat(),
        'from': from_addr,
        'subject': subject,
        'message': f"📨 Email from {from_addr}: {subject}"
    }
    
    NOTIF_FILE = '/home/madadmin/clawd/data/pending-notification.json'
    notifications = []
    if os.path.exists(NOTIF_FILE):
        try:
            with open(NOTIF_FILE, 'r') as f:
                notifications = json.load(f)
        except:
            notifications = []
    if not isinstance(notifications, list):
        notifications = []
    notifications.append(notification)
    with open(NOTIF_FILE, 'w') as f:
        json.dump(notifications, f, indent=2)
    
    return msg_id

def check_emails():
    state = load_state()
    
    messages = get_messages(limit=10)
    if not messages or 'data' not in messages:
        return
    
    new_count = 0
    for msg in messages['data']:
        msg_id = msg.get('message_id')
        
        # Skip already processed
        if msg_id in state['processed_ids']:
            continue
        
        # Skip our own sent emails
        if msg.get('folder') == 'sent':
            state['processed_ids'].append(msg_id)
            continue
        
        # Process new email
        process_email(msg)
        state['processed_ids'].append(msg_id)
        new_count += 1
    
    state['last_check'] = datetime.now().isoformat()
    save_state(state)
    
    if new_count > 0:
        print(f"\n✅ Processed {new_count} new email(s)")

if __name__ == '__main__':
    print("🚀 Cosmo Email Monitor Started")
    print(f"📧 Monitoring: {INBOX_ID}")
    print("⏰ Checking every 30 seconds...")
    print("")
    
    # Initial check
    check_emails()
    
    # Loop
    while True:
        time.sleep(30)
        check_emails()
