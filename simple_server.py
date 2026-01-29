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
        
        # Default: serve static files
        super().do_GET()


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
