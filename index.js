
const express = require('express');
const multer = require('multer');
const bcrypt = require('bcrypt');
const moment = require('moment-timezone');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5000;

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create uploads directory if it doesn't exist
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Hardcoded user credentials
const USER_DATA = {
    username: 'SarkerUtsab',
    password: 'SahaPritha@20.04.2005',
    email: 'info@sarkerdrive.com',
    voicePassword: 'Hello World'
};

// In-memory storage for files and folders
let uploadedFiles = [];
let folders = [{ id: 'root', name: 'Root', parentId: null }];

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Authentication endpoint
app.post('/authenticate', (req, res) => {
    const { username, email, password, voicePassword, authCode, captcha } = req.body;
    
    // Get current date in Bangladesh timezone
    const bangladeshDate = moment().tz('Asia/Dhaka').format('DDMMYYYY');
    
    // Simple validation
    if (username === USER_DATA.username &&
        email === USER_DATA.email &&
        password === USER_DATA.password &&
        voicePassword === USER_DATA.voicePassword &&
        authCode === bangladeshDate &&
        captcha === 'human') {
        
        res.json({ success: true, message: 'Login successful!' });
    } else {
        res.json({ success: false, message: 'Invalid credentials. Please try again.' });
    }
});

// File upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.json({ success: false, message: 'No file uploaded' });
    }
    
    const fileInfo = {
        id: Date.now(),
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        uploadDate: new Date(),
        type: req.file.mimetype,
        folderId: req.body.folderId || 'root'
    };
    
    uploadedFiles.push(fileInfo);
    res.json({ success: true, file: fileInfo });
});

// Get files endpoint
app.get('/api/files', (req, res) => {
    const sortBy = req.query.sort || 'date';
    const folderId = req.query.folderId || 'root';
    
    // Filter files by folder
    let filteredFiles = uploadedFiles.filter(file => file.folderId === folderId);
    
    if (sortBy === 'name') {
        filteredFiles.sort((a, b) => a.originalName.localeCompare(b.originalName));
    } else {
        filteredFiles.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    }
    
    res.json(filteredFiles);
});

// Serve uploaded files
app.get('/uploads/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'uploads', filename);
    res.sendFile(filePath);
});

// Delete file endpoint
app.delete('/api/files/:id', (req, res) => {
    const fileId = parseInt(req.params.id);
    const fileIndex = uploadedFiles.findIndex(file => file.id === fileId);
    
    if (fileIndex === -1) {
        return res.json({ success: false, message: 'File not found' });
    }
    
    const file = uploadedFiles[fileIndex];
    const filePath = path.join(__dirname, 'uploads', file.filename);
    
    // Delete file from filesystem
    fs.unlink(filePath, (err) => {
        if (err) {
            console.error('Error deleting file:', err);
            return res.json({ success: false, message: 'Error deleting file' });
        }
        
        // Remove from array
        uploadedFiles.splice(fileIndex, 1);
        res.json({ success: true, message: 'File deleted successfully' });
    });
});

// Get storage info with real calculations
app.get('/api/storage', (req, res) => {
    const storage = {
        videos: 0,
        audio: 0,
        photos: 0,
        pdf: 0,
        other: 0
    };
    
    uploadedFiles.forEach(file => {
        if (file.type.startsWith('video/')) {
            storage.videos += file.size;
        } else if (file.type.startsWith('audio/')) {
            storage.audio += file.size;
        } else if (file.type.startsWith('image/')) {
            storage.photos += file.size;
        } else if (file.type.includes('pdf')) {
            storage.pdf += file.size;
        } else {
            storage.other += file.size;
        }
    });
    
    // Convert to readable format
    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    
    const storageInfo = {
        videos: formatBytes(storage.videos),
        audio: formatBytes(storage.audio),
        photos: formatBytes(storage.photos),
        pdf: formatBytes(storage.pdf),
        other: formatBytes(storage.other),
        total: formatBytes(storage.videos + storage.audio + storage.photos + storage.pdf + storage.other)
    };
    
    res.json(storageInfo);
});

// Get folders endpoint
app.get('/api/folders', (req, res) => {
    res.json(folders);
});

// Create folder endpoint
app.post('/api/folder', (req, res) => {
    const { folderName, parentId } = req.body;
    
    if (!folderName || folderName.trim() === '') {
        return res.json({ success: false, message: 'Folder name is required' });
    }
    
    const newFolder = {
        id: Date.now().toString(),
        name: folderName.trim(),
        parentId: parentId || 'root',
        createdDate: new Date()
    };
    
    folders.push(newFolder);
    res.json({ success: true, folder: newFolder, message: `Folder "${folderName}" created successfully` });
});

// Move file endpoint
app.post('/api/files/:id/move', (req, res) => {
    const fileId = parseInt(req.params.id);
    const { folderId } = req.body;
    
    const fileIndex = uploadedFiles.findIndex(file => file.id === fileId);
    if (fileIndex === -1) {
        return res.json({ success: false, message: 'File not found' });
    }
    
    // Check if folder exists
    const folderExists = folders.some(folder => folder.id === folderId);
    if (!folderExists && folderId !== 'root') {
        return res.json({ success: false, message: 'Destination folder not found' });
    }
    
    uploadedFiles[fileIndex].folderId = folderId;
    res.json({ success: true, message: 'File moved successfully' });
});

// Delete folder endpoint
app.delete('/api/folders/:id', (req, res) => {
    const folderId = req.params.id;
    
    if (folderId === 'root') {
        return res.json({ success: false, message: 'Cannot delete root folder' });
    }
    
    // Check if folder has files
    const filesInFolder = uploadedFiles.filter(file => file.folderId === folderId);
    if (filesInFolder.length > 0) {
        return res.json({ success: false, message: 'Cannot delete folder that contains files' });
    }
    
    // Check if folder has subfolders
    const subfolders = folders.filter(folder => folder.parentId === folderId);
    if (subfolders.length > 0) {
        return res.json({ success: false, message: 'Cannot delete folder that contains subfolders' });
    }
    
    const folderIndex = folders.findIndex(folder => folder.id === folderId);
    if (folderIndex === -1) {
        return res.json({ success: false, message: 'Folder not found' });
    }
    
    folders.splice(folderIndex, 1);
    res.json({ success: true, message: 'Folder deleted successfully' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`UTSAB's Personal Drive running on port ${PORT}`);
});
