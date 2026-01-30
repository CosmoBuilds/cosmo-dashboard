#!/usr/bin/env python3
"""
Cosmo File Transfer Server
Dedicated server for file uploads/downloads
Port: 9091
"""

import os
import json
import uuid
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = '/home/madadmin/.clawdbot/media/inbound'
NOTIFICATIONS_FILE = '/home/madadmin/clawd/data/notifications.json'

ALLOWED_EXTENSIONS = {
    'pdf', 'png', 'jpg', 'jpeg', 'gif', 'txt', 'md', 'json', 'csv', 
    'zip', 'py', 'js', 'html', 'css', 'mp3', 'wav', 'ogg', 'm4a'
}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def write_notification(notification):
    """Write notification to file for Cosmo to pick up"""
    os.makedirs(os.path.dirname(NOTIFICATIONS_FILE), exist_ok=True)
    notifications = []
    if os.path.exists(NOTIFICATIONS_FILE):
        try:
            with open(NOTIFICATIONS_FILE, 'r') as f:
                notifications = json.load(f)
        except:
            notifications = []
    notifications.append(notification)
    with open(NOTIFICATIONS_FILE, 'w') as f:
        json.dump(notifications, f, indent=2)

from flask import make_response

@app.route('/')
def index():
    """Root serves file upload page"""
    response = make_response(send_from_directory('.', 'upload.html'))
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/upload.html')
def upload_page():
    response = make_response(send_from_directory('.', 'upload.html'))
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/css/<path:path>')
def serve_css(path):
    response = make_response(send_from_directory('css', path))
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return response

@app.route('/js/<path:path>')
def serve_js(path):
    response = make_response(send_from_directory('js', path))
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return response

@app.route('/images/<path:path>')
def serve_images(path):
    return send_from_directory('images', path)

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Handle file uploads"""
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No file selected'}), 400
    
    if file and allowed_file(file.filename):
        ext = file.filename.rsplit('.', 1)[1].lower()
        unique_name = f"{uuid.uuid4()}.{ext}"
        filepath = os.path.join(UPLOAD_FOLDER, unique_name)
        
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        file.save(filepath)
        
        write_notification({
            'type': 'file_uploaded',
            'timestamp': datetime.now().isoformat(),
            'filename': file.filename,
            'path': filepath,
            'size': os.path.getsize(filepath),
            'channel': '1466517317403021362'
        })
        
        return jsonify({
            'success': True,
            'filename': file.filename,
            'path': filepath,
            'message': 'File uploaded successfully'
        })
    else:
        return jsonify({'success': False, 'error': 'File type not allowed'}), 400

@app.route('/api/uploads/recent', methods=['GET'])
def get_recent_uploads():
    """Get list of recent uploads"""
    try:
        files = []
        if os.path.exists(UPLOAD_FOLDER):
            for f in os.listdir(UPLOAD_FOLDER):
                filepath = os.path.join(UPLOAD_FOLDER, f)
                if os.path.isfile(filepath):
                    stat = os.stat(filepath)
                    files.append({
                        'name': f,
                        'size': format_file_size(stat.st_size),
                        'path': filepath,
                        'time': datetime.fromtimestamp(stat.st_mtime).isoformat()
                    })
        files.sort(key=lambda x: x['time'], reverse=True)
        return jsonify(files[:10])
    except Exception as e:
        return jsonify([])

@app.route('/api/download/<filename>')
def download_file(filename):
    """Download a file from the upload folder"""
    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=True)

@app.route('/api/files')
def list_files():
    """List all files (for 2-way transfer)"""
    try:
        files = []
        if os.path.exists(UPLOAD_FOLDER):
            for f in os.listdir(UPLOAD_FOLDER):
                filepath = os.path.join(UPLOAD_FOLDER, f)
                if os.path.isfile(filepath):
                    stat = os.stat(filepath)
                    files.append({
                        'name': f,
                        'original_name': f,  # Could store original name in DB
                        'size': stat.st_size,
                        'size_formatted': format_file_size(stat.st_size),
                        'uploaded_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        'download_url': f'/api/download/{f}'
                    })
        files.sort(key=lambda x: x['uploaded_at'], reverse=True)
        return jsonify({'files': files})
    except Exception as e:
        return jsonify({'files': [], 'error': str(e)})

def format_file_size(size):
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024.0:
            return f"{size:.1f} {unit}"
        size /= 1024.0
    return f"{size:.1f} TB"

@app.route('/api/backups')
def list_backups():
    """List available backup files for Bowz and Nebula"""
    try:
        backups = []
        
        # Full system backups (tar.gz archives)
        full_backup_dir = '/home/madadmin/clawd/backups'
        if os.path.exists(full_backup_dir):
            for f in os.listdir(full_backup_dir):
                if f.endswith('.tar.gz') and os.path.isfile(os.path.join(full_backup_dir, f)):
                    filepath = os.path.join(full_backup_dir, f)
                    stat = os.stat(filepath)
                    backups.append({
                        'name': f,
                        'type': 'full_backup',
                        'size': stat.st_size,
                        'size_formatted': format_file_size(stat.st_size),
                        'created_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        'download_url': f'/api/download-full-backup/{f}'
                    })
        
        # Code backups (versioned files)
        backup_dir = '/home/madadmin/clawd/cosmo-dashboard'
        for f in os.listdir(backup_dir):
            if '.v' in f and os.path.isfile(os.path.join(backup_dir, f)):
                filepath = os.path.join(backup_dir, f)
                stat = os.stat(filepath)
                backups.append({
                    'name': f,
                    'type': 'code_backup',
                    'size': stat.st_size,
                    'size_formatted': format_file_size(stat.st_size),
                    'created_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    'download_url': f'/api/download-backup/{f}'
                })
        
        # Database backup
        db_path = '/home/madadmin/clawd/cosmo-dashboard/data/dashboard.db'
        if os.path.exists(db_path):
            stat = os.stat(db_path)
            backups.append({
                'name': 'dashboard.db',
                'type': 'database',
                'size': stat.st_size,
                'size_formatted': format_file_size(stat.st_size),
                'created_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                'download_url': '/api/download-backup/dashboard.db'
            })
        
        backups.sort(key=lambda x: x['created_at'], reverse=True)
        return jsonify({'backups': backups})
    except Exception as e:
        return jsonify({'backups': [], 'error': str(e)})

@app.route('/api/download-backup/<filename>')
def download_backup(filename):
    """Download backup files (restricted to safe paths)"""
    try:
        # Security: only allow specific backup files
        allowed_files = ['dashboard.db']
        allowed_patterns = ['.v']
        
        is_allowed = filename in allowed_files or any(pattern in filename for pattern in allowed_patterns)
        
        if not is_allowed:
            return jsonify({'error': 'File not allowed'}), 403
        
        # Determine the correct path
        if filename == 'dashboard.db':
            filepath = os.path.join('/home/madadmin/clawd/cosmo-dashboard/data', filename)
        else:
            filepath = os.path.join('/home/madadmin/clawd/cosmo-dashboard', filename)
        
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404
        
        return send_from_directory(os.path.dirname(filepath), os.path.basename(filepath), as_attachment=True)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download-full-backup/<filename>')
def download_full_backup(filename):
    """Download full system backup archives"""
    try:
        # Security: only allow .tar.gz files from backups folder
        if not filename.endswith('.tar.gz'):
            return jsonify({'error': 'Invalid file type'}), 403
        
        backup_dir = '/home/madadmin/clawd/backups'
        filepath = os.path.join(backup_dir, filename)
        
        # Security check: ensure file is within backups directory
        real_path = os.path.realpath(filepath)
        real_backup_dir = os.path.realpath(backup_dir)
        if not real_path.startswith(real_backup_dir):
            return jsonify({'error': 'Access denied'}), 403
        
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404
        
        return send_from_directory(backup_dir, filename, as_attachment=True)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("🚀 Starting Cosmo File Transfer Server...")
    print(f"📁 Upload folder: {UPLOAD_FOLDER}")
    print(f"🌐 Port: 9091")
    app.run(host='0.0.0.0', port=9091, debug=False)
