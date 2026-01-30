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

@app.route('/')
def index():
    """Root serves file upload page"""
    return send_from_directory('.', 'upload.html')

@app.route('/upload.html')
def upload_page():
    return send_from_directory('.', 'upload.html')

@app.route('/css/<path:path>')
def serve_css(path):
    return send_from_directory('css', path)

@app.route('/js/<path:path>')
def serve_js(path):
    return send_from_directory('js', path)

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

if __name__ == '__main__':
    print("🚀 Starting Cosmo File Transfer Server...")
    print(f"📁 Upload folder: {UPLOAD_FOLDER}")
    print(f"🌐 Port: 9091")
    app.run(host='0.0.0.0', port=9091, debug=False)
