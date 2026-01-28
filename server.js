// Cosmo Command Center - Server
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 8095;
const DATA_FILE = path.join(__dirname, 'data', 'dashboard-data.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// API Routes

// Get dashboard data
app.get('/api/data', (req, res) => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            res.json(data);
        } else {
            res.json({ projects: [], tasks: [], logs: [] });
        }
    } catch (e) {
        res.json({ projects: [], tasks: [], logs: [] });
    }
});

// Save dashboard data
app.post('/api/data', (req, res) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// System status
app.get('/api/system', (req, res) => {
    try {
        // Get CPU usage
        const cpuInfo = execSync("top -bn1 | grep 'Cpu(s)' | awk '{print int($2)}'", { encoding: 'utf8' }).trim();
        
        // Get memory usage
        const memInfo = execSync("free | grep Mem | awk '{printf \"%.0f\", $3/$2 * 100}'", { encoding: 'utf8' }).trim();
        
        // Get disk usage
        const diskInfo = execSync("df -h / | tail -1 | awk '{print int($5)}'", { encoding: 'utf8' }).trim();
        
        res.json({
            cpu: parseInt(cpuInfo) || 0,
            memory: parseInt(memInfo) || 0,
            disk: parseInt(diskInfo) || 0,
            hostname: 'madserver',
            status: 'online'
        });
    } catch (e) {
        res.json({
            cpu: 0,
            memory: 0,
            disk: 0,
            hostname: 'madserver',
            status: 'unknown',
            error: e.message
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        service: 'cosmo-dashboard',
        timestamp: new Date().toISOString()
    });
});

// Projects API
app.get('/api/projects', (req, res) => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            res.json(data.projects || []);
        } else {
            res.json([]);
        }
    } catch (e) {
        res.json([]);
    }
});

// Tasks API
app.get('/api/tasks', (req, res) => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            res.json(data.tasks || []);
        } else {
            res.json([]);
        }
    } catch (e) {
        res.json([]);
    }
});

// Start server
app.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 Cosmo Command Center running on http://127.0.0.1:${PORT}`);
    console.log(`📊 Dashboard: http://127.0.0.1:${PORT}`);
    console.log(`🔧 API: http://127.0.0.1:${PORT}/api`);
});
