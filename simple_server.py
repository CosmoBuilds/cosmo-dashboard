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
    
    def do_POST(self):
        # Handle Discord notification endpoint
        if self.path == '/api/notify-discord':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data)
                idea = data.get('idea', {})
                plan = data.get('plan', '')
                channel = data.get('channel', '')
                
                # Send notification via Discord webhook or bot
                self.send_discord_notification(idea, plan, channel)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "sent"}).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return
        
        self.send_response(404)
        self.end_headers()
    
    def send_discord_notification(self, idea, plan, channel):
        """Send notification to Discord using subprocess to call Clawdbot"""
        import subprocess
        
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
        
        # Use subprocess to send Discord message
        try:
            subprocess.run([
                'python3', '-c',
                f"""
import json
import urllib.request

webhook_data = {{
    "content": {repr(message)}
}}

req = urllib.request.Request(
    'https://discord.com/api/v10/channels/{channel}/messages',
    data=json.dumps(webhook_data).encode(),
    headers={{
        'Content-Type': 'application/json',
        'Authorization': 'Bot ' + open('/home/madadmin/.clawdbot/discord_token.txt').read().strip()
    }},
    method='POST'
)

try:
    urllib.request.urlopen(req)
    print('Discord notification sent!')
except Exception as e:
    print(f'Error: {{e}}')
"""
            ], timeout=10)
        except Exception as e:
            print(f"Failed to send Discord notification: {e}")
            # Fallback: write to a file for pickup
            with open('/tmp/discord_notification.json', 'w') as f:
                json.dump({
                    'channel': channel,
                    'message': message
                }, f)


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
