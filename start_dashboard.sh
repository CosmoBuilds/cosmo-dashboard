#!/bin/bash
cd /home/madadmin/clawd/cosmo-dashboard

# Kill existing processes
pkill -f "python3 simple_server.py" 2>/dev/null
pkill cloudflared 2>/dev/null
sleep 2

# Start server
python3 simple_server.py > /tmp/dashboard.log 2>&1 &
echo "Server PID: $!"
sleep 3

# Start tunnel
cloudflared tunnel --url http://localhost:8095 > /tmp/tunnel.log 2>&1 &
echo "Tunnel PID: $!"

sleep 8

# Get URL
grep -o 'https://[^"]*\.trycloudflare\.com' /tmp/tunnel.log | tail -1
