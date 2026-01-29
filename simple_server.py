#!/usr/bin/env python3
"""
Simple HTTP server for Cosmo Dashboard
Serves static files from the current directory
"""

import http.server
import socketserver
import os
import sys
import json
from datetime import datetime

PORT = 8095
DIRECTORY = "."

# Try to import psutil, fallback to /proc reading
try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False
    print("⚠️ psutil not available, using /proc fallback")


def get_system_stats():
    """Get CPU, memory, and disk usage percentages"""
    stats = {"cpu": 0, "memory": 0, "disk": 0}
    
    if HAS_PSUTIL:
        # Use psutil for cross-platform compatibility
        stats["cpu"] = psutil.cpu_percent(interval=0.1)
        stats["memory"] = psutil.virtual_memory().percent
        stats["disk"] = psutil.disk_usage('/').percent
    else:
        # Fallback to reading from /proc filesystem (Linux only)
        try:
            # CPU usage - calculate from /proc/stat
            with open('/proc/stat', 'r') as f:
                line = f.readline()
                fields = line.split()
                if fields[0] == 'cpu':
                    user = int(fields[1])
                    nice = int(fields[2])
                    system = int(fields[3])
                    idle = int(fields[4])
                    total = user + nice + system + idle
                    used = user + nice + system
                    stats["cpu"] = round((used / total) * 100, 1) if total > 0 else 0
            
            # Memory usage from /proc/meminfo
            with open('/proc/meminfo', 'r') as f:
                meminfo = f.read()
                mem_total = 0
                mem_available = 0
                for line in meminfo.split('\n'):
                    if line.startswith('MemTotal:'):
                        mem_total = int(line.split()[1]) * 1024
                    elif line.startswith('MemAvailable:'):
                        mem_available = int(line.split()[1]) * 1024
                if mem_total > 0:
                    stats["memory"] = round(((mem_total - mem_available) / mem_total) * 100, 1)
            
            # Disk usage using os.statvfs
            statvfs = os.statvfs('/')
            total_blocks = statvfs.f_blocks
            free_blocks = statvfs.f_bfree
            block_size = statvfs.f_frsize
            total_size = total_blocks * block_size
            free_size = free_blocks * block_size
            if total_size > 0:
                stats["disk"] = round(((total_size - free_size) / total_size) * 100, 1)
                
        except Exception as e:
            print(f"Error reading /proc stats: {e}")
    
    return stats


class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()
    
    def do_GET(self):
        # Handle /api/system endpoint
        if self.path == '/api/system':
            stats = get_system_stats()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(stats).encode())
            return
        
        # Handle /api/tokens endpoint
        if self.path == '/api/tokens':
            token_stats = self.get_token_stats()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(token_stats).encode())
            return
        
        # Handle /api/uptime endpoint
        if self.path == '/api/uptime':
            uptime_data = self.get_uptime_data()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(uptime_data).encode())
            return
        
        # Handle GET /api/data - load saved dashboard data
        if self.path == '/api/data':
            try:
                data_file = 'data/dashboard-data.json'
                if os.path.exists(data_file):
                    with open(data_file) as f:
                        data = json.load(f)
                else:
                    data = {"projects": [], "tasks": [], "logs": []}
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(data).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return
        
        # Handle GET /api/ideas - load saved ideas
        if self.path == '/api/ideas':
            try:
                ideas_file = 'data/ideas.json'
                if os.path.exists(ideas_file):
                    with open(ideas_file) as f:
                        data = json.load(f)
                else:
                    data = {"ideas": []}
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(data).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return
        
        # Default: serve static files
        super().do_GET()
    
    def get_token_stats(self):
        """Get token usage statistics"""
        # Try to read from session tracking files
        stats = {
            "todayCost": 0.0,
            "todayTokens": 0,
            "activeSessions": 0,
            "monthCost": 0.0,
            "models": {},
            "sessions": []
        }
        
        # Check for session files in workspace
        try:
            import glob
            import os
            
            # Look for session tracking files
            session_files = glob.glob('/home/madadmin/clawd/memory/sessions/*.json')
            
            for session_file in session_files[-10:]:  # Last 10 sessions
                try:
                    with open(session_file) as f:
                        session = json.load(f)
                        stats["sessions"].append({
                            "agent": session.get("agent", "Unknown"),
                            "model": session.get("model", "Unknown"),
                            "status": session.get("status", "idle"),
                            "cost": session.get("cost", 0.0),
                            "duration": session.get("duration", "0m")
                        })
                        stats["todayCost"] += session.get("cost", 0.0)
                        stats["todayTokens"] += session.get("tokens", 0)
                        
                        # Track per-model stats
                        model = session.get("model", "Unknown")
                        if model not in stats["models"]:
                            stats["models"][model] = {"tokens": 0, "cost": 0.0, "calls": 0}
                        stats["models"][model]["tokens"] += session.get("tokens", 0)
                        stats["models"][model]["cost"] += session.get("cost", 0.0)
                        stats["models"][model]["calls"] += 1
                        
                        if session.get("status") == "active":
                            stats["activeSessions"] += 1
                except:
                    pass
            
            # If no session files, use mock data for demo
            if not stats["sessions"]:
                stats = {
                    "todayCost": 0.0234,
                    "todayTokens": 15420,
                    "activeSessions": 3,
                    "monthCost": 0.89,
                    "models": {
                        "Claude Opus": {"tokens": 8200, "cost": 0.0123, "calls": 12},
                        "GPT-4o-mini": {"tokens": 4500, "cost": 0.0027, "calls": 28},
                        "Llama 3.1 8B": {"tokens": 1500, "cost": 0.0000, "calls": 8},
                        "Mistral 7B": {"tokens": 1220, "cost": 0.0000, "calls": 5}
                    },
                    "sessions": [
                        {"agent": "Cosmo", "model": "Claude Opus", "status": "active", "cost": 0.0089, "duration": "45m"},
                        {"agent": "Dash", "model": "GPT-4o-mini", "status": "active", "cost": 0.0012, "duration": "12m"},
                        {"agent": "Lumina", "model": "Llama 3.1 8B", "status": "idle", "cost": 0.0000, "duration": "2h 30m"}
                    ]
                }
        except Exception as e:
            print(f"Error getting token stats: {e}")
        
        return stats
    
    def get_uptime_data(self):
        """Get uptime monitoring data"""
        return {
            "services": [
                {"id": "clawdbot", "name": "Clawdbot Gateway", "icon": "🤖", "url": "http://localhost:3000", 
                 "checkType": "http", "autoRestart": True, "status": "online", "uptime": 99.9},
                {"id": "dashboard", "name": "Command Center", "icon": "🚀", "url": "http://localhost:8095", 
                 "checkType": "http", "autoRestart": True, "status": "online", "uptime": 99.9},
                {"id": "stock-tracker", "name": "Stock Tracker", "icon": "📈", "url": "http://stocktracker.playit.plus", 
                 "checkType": "http", "autoRestart": False, "status": "online", "uptime": 99.5},
                {"id": "influencer", "name": "Influencer Dashboard", "icon": "🎯", "url": "http://influencertracker.playit.plus:12648", 
                 "checkType": "http", "autoRestart": False, "status": "online", "uptime": 99.5},
                {"id": "system", "name": "madserver System", "icon": "🖥️", "url": None, 
                 "checkType": "system", "autoRestart": False, "status": "online", "uptime": 99.9}
            ],
            "incidents": [],
            "autoHealCount": 0,
            "lastIncident": None
        }
    
    def do_POST(self):
        # Handle CORS preflight
        if self.headers.get('Origin'):
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
            return
            
        # Handle Discord notification endpoint
        if self.path == '/api/notify-discord':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data)
                notification_type = data.get('type', 'idea_approved')
                channel = data.get('channel', '1466517317403021362')
                
                success = False
                
                if notification_type == 'project_pending_review':
                    # New project created, pending review
                    project = data.get('project', {})
                    success = self.send_project_notification(project, channel)
                elif notification_type == 'idea_approved':
                    # Idea approved
                    idea = data.get('idea', {})
                    plan = data.get('plan', '')
                    success = self.send_discord_notification(idea, plan, channel)
                else:
                    # Default: idea approval
                    idea = data.get('idea', {})
                    plan = data.get('plan', '')
                    success = self.send_discord_notification(idea, plan, channel)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                if success:
                    self.wfile.write(json.dumps({"status": "sent", "type": notification_type}).encode())
                else:
                    self.wfile.write(json.dumps({"status": "failed", "error": "Discord send failed"}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return
        
        # Handle project evaluation endpoint (for Cosmo to post evaluations)
        if self.path == '/api/project-evaluation':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data)
                project = data.get('project', {})
                evaluation = data.get('evaluation', '')
                recommendation = data.get('recommendation', '')
                channel = data.get('channel', '1466517317403021362')
                
                # Build evaluation message
                name = project.get('name', 'Unknown')
                description = project.get('description', '')
                
                message = f"""🧠 **PROJECT EVALUATION** <@370334885652463626>

**Project:** {name}
{description}

**Evaluation:**
{evaluation}

**Recommendation:**
{recommendation}

Reply with "go" to approve and start work!"""
                
                success = self.send_discord_message(channel, message, mentions=["370334885652463626"])
                
                # Also update the project's status to "evaluated" in the data file
                try:
                    data_file = 'data/dashboard-data.json'
                    if os.path.exists(data_file):
                        with open(data_file, 'r') as f:
                            dashboard_data = json.load(f)
                        
                        # Find and update the project
                        for p in dashboard_data.get('projects', []):
                            if p.get('id') == project.get('id'):
                                p['status'] = 'planning'  # Move to planning after evaluation
                                p['evaluation'] = evaluation
                                p['evaluatedAt'] = datetime.now().isoformat()
                                break
                        
                        with open(data_file, 'w') as f:
                            json.dump(dashboard_data, f, indent=2)
                except Exception as e:
                    print(f"Could not update project status: {e}")
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "sent" if success else "failed",
                    "type": "project_evaluation"
                }).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return
        
        # Handle saving ideas
        if self.path == '/api/ideas':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                ideas_data = json.loads(post_data)
                with open('data/ideas.json', 'w') as f:
                    json.dump(ideas_data, f, indent=2)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "saved"}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return
        
        # Handle saving dashboard data (tasks, projects, logs)
        if self.path == '/api/data':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data)
                print(f"Saving data: {len(data.get('projects', []))} projects, {len(data.get('tasks', []))} tasks")
                
                # Use absolute path to avoid working directory issues
                import os
                data_file = os.path.join(os.path.dirname(__file__), 'data', 'dashboard-data.json')
                print(f"Writing to: {data_file}")
                
                with open(data_file, 'w') as f:
                    json.dump(data, f, indent=2)
                
                print(f"Data saved successfully to {data_file}")
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                try:
                    self.wfile.write(json.dumps({"status": "saved"}).encode())
                except:
                    pass
            except Exception as e:
                print(f"Error saving data: {e}")
                import traceback
                traceback.print_exc()
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                try:
                    self.wfile.write(json.dumps({"error": str(e)}).encode())
                except:
                    pass
            return
        
        # Handle notification queue for Cosmo
        if self.path == '/api/notify':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                notification = json.loads(post_data)
                print(f"Received notification: {notification.get('type', 'unknown')}")
                
                # Write to notifications file for Cosmo to pick up
                notifications_file = '/home/madadmin/clawd/data/notifications.json'
                
                # Read existing notifications
                notifications = []
                if os.path.exists(notifications_file):
                    try:
                        with open(notifications_file) as f:
                            notifications = json.load(f)
                        print(f"Read {len(notifications)} existing notifications")
                    except Exception as read_err:
                        print(f"Error reading notifications: {read_err}")
                        notifications = []
                
                # Add new notification
                notifications.append(notification)
                print(f"Added notification, total now: {len(notifications)}")
                
                # Save back
                try:
                    os.makedirs(os.path.dirname(notifications_file), exist_ok=True)
                    with open(notifications_file, 'w') as f:
                        json.dump(notifications, f, indent=2)
                    print(f"Saved notifications to {notifications_file}")
                except Exception as write_err:
                    print(f"Error writing notifications: {write_err}")
                    raise
                
                # Send response immediately
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                try:
                    self.wfile.write(json.dumps({"status": "queued"}).encode())
                except:
                    pass  # Client may have disconnected
            except Exception as e:
                print(f"Error in notify handler: {e}")
                import traceback
                traceback.print_exc()
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                try:
                    self.wfile.write(json.dumps({"error": str(e)}).encode())
                except:
                    pass
            return
        
        self.send_response(404)
        self.end_headers()
    
    def get_discord_token(self):
        """Get Discord bot token from config"""
        # Try clawdbot config first
        try:
            with open('/home/madadmin/.clawdbot/clawdbot.json') as f:
                config = json.load(f)
                token = config.get('channels', {}).get('discord', {}).get('token')
                if token:
                    return token
        except Exception as e:
            print(f"Could not read clawdbot config: {e}")
        
        # Fallback to token file
        try:
            with open('/home/madadmin/.clawdbot/discord_token.txt') as f:
                return f.read().strip()
        except Exception as e:
            print(f"Failed to read Discord token: {e}")
            return None
    
    def send_discord_message(self, channel_id, message, mentions=None):
        """Send a message to Discord channel"""
        import urllib.request
        import urllib.error
        
        token = self.get_discord_token()
        if not token:
            print("No Discord token available")
            return False
        
        try:
            webhook_data = {"content": message}
            if mentions:
                webhook_data["allowed_mentions"] = {"users": mentions}
            
            req = urllib.request.Request(
                f'https://discord.com/api/v10/channels/{channel_id}/messages',
                data=json.dumps(webhook_data).encode(),
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bot {token}'
                },
                method='POST'
            )
            urllib.request.urlopen(req)
            print(f'Discord message sent to channel {channel_id}')
            return True
        except urllib.error.HTTPError as e:
            print(f"Discord API error: {e.code} - {e.read().decode()}")
            return False
        except Exception as e:
            print(f"Failed to send Discord message: {e}")
            return False
    
    def send_discord_notification(self, idea, plan, channel):
        """Send notification to Discord for approved ideas"""
        title = idea.get('title', 'Unknown')
        description = idea.get('description', '')
        priority = idea.get('priority', 'medium')
        assignee = idea.get('assignee', 'team')
        
        # Build the message
        message = f"""💡 **IDEA APPROVED** <@370334885652463626>

**{title}**
{description}

**Priority:** {priority.upper()} | **Assigned to:** {assignee}

{plan}

Reply with "go" to proceed or suggest changes!"""
        
        return self.send_discord_message(channel, message, mentions=["370334885652463626"])
    
    def send_project_notification(self, project, channel):
        """Send notification about new project pending review"""
        name = project.get('name', 'Unknown')
        description = project.get('description', '')
        created = project.get('created', 'Unknown')
        
        message = f"""📋 **NEW PROJECT PENDING REVIEW** <@370334885652463626>

**{name}**
{description}

**Status:** ⏳ Pending Review
**Created:** {created}

Cosmo will evaluate and provide recommendations shortly."""
        
        return self.send_discord_message(channel, message, mentions=["370334885652463626"])


if __name__ == "__main__":
    os.chdir(DIRECTORY)
    
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        print(f"🚀 Dashboard server running at http://localhost:{PORT}")
        print(f"📁 Serving files from: {os.path.abspath(DIRECTORY)}")
        print("Press Ctrl+C to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Server stopped")
            sys.exit(0)
