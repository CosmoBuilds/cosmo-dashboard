#!/usr/bin/env python3
"""
AgentMail.to Integration for Cosmo
Lightweight client using urllib (no external deps)
"""

import os
import json
import urllib.request
import urllib.error
from datetime import datetime

# Load API key
ENV_FILE = '/home/madadmin/clawd/.env.agentmail'
API_KEY = None
BASE_URL = 'https://api.agentmail.to/v0'

def load_credentials():
    """Load API credentials from env file"""
    global API_KEY
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE, 'r') as f:
            for line in f:
                if line.startswith('AGENTMAIL_API_KEY='):
                    API_KEY = line.strip().split('=', 1)[1]
                    break

load_credentials()

def api_request(endpoint, method='GET', data=None):
    """Make API request to AgentMail"""
    url = f"{BASE_URL}{endpoint}"
    headers = {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    }
    
    try:
        if data:
            data = json.dumps(data).encode('utf-8')
        
        req = urllib.request.Request(
            url,
            data=data,
            headers=headers,
            method=method
        )
        
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode('utf-8'))
    
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"HTTP Error {e.code}: {error_body}")
        return None
    except Exception as e:
        print(f"Error: {e}")
        return None

def list_inboxes():
    """List all inboxes"""
    return api_request('/inboxes')

def create_inbox(domain=None):
    """Create a new inbox"""
    data = {'domain': domain} if domain else {}
    return api_request('/inboxes', method='POST', data=data)

def list_messages(inbox_id, limit=10):
    """List messages in an inbox"""
    return api_request(f'/inboxes/{inbox_id}/messages?limit={limit}')

def get_message(inbox_id, message_id):
    """Get specific message"""
    return api_request(f'/inboxes/{inbox_id}/messages/{message_id}')

def send_message(inbox_id, to, subject, text, html=None):
    """Send a message"""
    data = {
        'to': to,
        'subject': subject,
        'text': text
    }
    if html:
        data['html'] = html
    
    return api_request(f'/inboxes/{inbox_id}/messages/send', method='POST', data=data)

def mark_as_read(inbox_id, message_id):
    """Mark message as read"""
    return api_request(f'/inboxes/{inbox_id}/messages/{message_id}/read', method='POST')

if __name__ == '__main__':
    print("🚀 AgentMail Integration Test (v0 API)")
    print(f"API Key: {API_KEY[:20]}..." if API_KEY else "❌ No API key found")
    print("")
    
    if not API_KEY:
        print("❌ API key not loaded. Check .env.agentmail file.")
        exit(1)
    
    # Test: List inboxes
    print("📬 Listing inboxes...")
    inboxes = list_inboxes()
    if inboxes and 'data' in inboxes:
        print(f"✅ Found {len(inboxes['data'])} inboxes")
        for inbox in inboxes['data']:
            print(f"  - {inbox.get('email_address')} (ID: {inbox.get('id')})")
            
            # Check for messages
            messages = list_messages(inbox.get('id'), limit=3)
            if messages and 'data' in messages and messages['data']:
                print(f"    📧 {len(messages['data'])} messages")
                for msg in messages['data'][:2]:
                    print(f"      - {msg.get('subject')} from {msg.get('from_address')}")
    else:
        print("ℹ️ No inboxes found (creating one...)")
        new_inbox = create_inbox()
        if new_inbox:
            print(f"✅ Created inbox: {new_inbox.get('email_address')}")
        else:
            print("❌ Failed to create inbox")
    
    print("")
    print("✅ AgentMail integration ready!")
