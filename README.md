# Cosmo Dashboard - Developer Documentation

## Overview
The Cosmo Dashboard is a project management command center for the AI agent workforce. It provides:
- Project tracking with kanban-style board
- Task management
- Ideas/tickets system
- AI workforce monitoring
- System uptime monitoring
- Token usage tracking

## Architecture

### Frontend
- **File**: `index.html` + `js/app.js`
- **CSS**: `css/styles.css`
- **Port**: 8095

### Backend
- **File**: `simple_server.py`
- **Type**: Python HTTP server with custom request handlers
- **Data Storage**: JSON files in `data/` directory

### Data Files
| File | Purpose |
|------|---------|
| `data/dashboard-data.json` | Projects, tasks, logs |
| `data/ideas.json` | Ideas and tickets |
| `/home/madadmin/clawd/data/notifications.json` | Pending notifications for Cosmo |

## API Endpoints

### GET Endpoints
- `GET /api/data` - Load dashboard data (projects, tasks, logs)
- `GET /api/ideas` - Load ideas
- `GET /api/system` - System stats (CPU, memory, disk)
- `GET /api/tokens` - Token usage stats
- `GET /api/uptime` - Uptime monitoring data

### POST Endpoints
- `POST /api/data` - Save dashboard data
- `POST /api/ideas` - Save ideas
- `POST /api/notify` - Queue notification for Cosmo
- `POST /api/notify-discord` - Send Discord notification
- `POST /api/project-evaluation` - Post project evaluation to Discord

## Notification System

### Flow
1. User creates project → Dashboard saves to `dashboard-data.json`
2. Dashboard writes notification to `notifications.json`
3. Dashboard sends immediate Discord notification
4. Cosmo (or evaluator) processes notifications via `project_evaluator.py`
5. Evaluator posts detailed evaluation to Discord

### Processing Notifications
```bash
# Run the evaluator manually
cd /home/madadmin/clawd/cosmo-dashboard && python3 project_evaluator.py
```

### Discord Channel
All notifications go to: `1466517317403021362`

## Key Features

### Project Creation
1. User clicks "+ New Project"
2. Project saved with status `pending-review`
3. Discord notification sent immediately
4. Notification queued for Cosmo evaluation
5. Cosmo evaluates and posts recommendations

### Idea Approval
1. User clicks "✅ Approve" on an idea
2. Idea status changed to `approved`
3. Plan of attack generated
4. Discord notification sent
5. Project can be created from idea

### Data Persistence
- All data auto-saves to JSON files
- Server reloads data on restart
- No database required

## Maintenance

### Restart Server
```bash
fuser -k 8095/tcp 2>/dev/null
sleep 1
cd /home/madadmin/clawd/cosmo-dashboard
nohup python3 simple_server.py > /tmp/dashboard_server.log 2>&1 &
```

### Check Server Status
```bash
curl -s http://localhost:8095/api/system
```

### View Logs
```bash
tail -f /tmp/dashboard_server.log
```

## Troubleshooting

### Discord notifications not sending
- Check server logs for Discord API errors
- Verify bot token is valid
- Check channel ID is correct

### Data not saving
- Verify `data/` directory exists and is writable
- Check server logs for file permission errors

### Notifications not being processed
- Run `project_evaluator.py` manually
- Check `notifications.json` for unprocessed items
- Verify server is running

## Files

### Core Files
- `simple_server.py` - Backend server
- `index.html` - Main UI
- `js/app.js` - Frontend logic
- `project_evaluator.py` - Notification processor

### Data Files
- `data/dashboard-data.json` - Main data store
- `data/ideas.json` - Ideas store
- `/home/madadmin/clawd/data/notifications.json` - Notification queue

## Development

### Adding New Endpoints
1. Add route handler in `do_GET()` or `do_POST()`
2. Implement the handler method
3. Update CORS headers if needed
4. Test with curl

### Modifying Frontend
1. Edit `js/app.js`
2. Update version query param in `index.html` (e.g., `?v=10`)
3. Hard refresh browser

## Security Notes
- CORS is enabled for all origins (`*`)
- No authentication on endpoints (internal use only)
- Discord token stored in `~/.clawdbot/`
