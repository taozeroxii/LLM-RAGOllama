const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { parseDocument, chunkText } = require('../services/documentProcessor');
const { generateEmbeddings } = require('../services/embeddingService');
const { insertDocument, insertChunks, getDocuments, deleteDocument, getDocumentById } = require('../database');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.docx', '.doc', '.txt', '.md'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`ไม่รองรับไฟล์ประเภท ${ext}`));
        }
    }
});

// Simple auth middleware
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (!authHeader || authHeader !== `Bearer ${adminPassword}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// Login endpoint
router.post('/login', (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (password === adminPassword) {
        res.json({ success: true, token: adminPassword });
    } else {
        res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
    }
});

// Upload document
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'กรุณาเลือกไฟล์' });
        }

        const file = req.file;
        // Fix Thai filename encoding: multer reads as latin1, need to convert to UTF-8
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const fileType = path.extname(originalName).slice(1).toLowerCase();
        const docId = uuidv4();

        // Save document info to database
        insertDocument({
            id: docId,
            filename: file.filename,
            originalName: originalName,
            filepath: file.path,
            fileType: fileType,
            fileSize: file.size
        });

        // Process document in background (don't block response)
        processDocument(docId, file.path, fileType).catch(err => {
            console.error('Document processing error:', err);
        });

        res.json({
            success: true,
            message: 'อัพโหลดสำเร็จ กำลังประมวลผลเอกสาร...',
            document: {
                id: docId,
                name: originalName,
                size: file.size
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'อัพโหลดไม่สำเร็จ: ' + error.message });
    }
});

// Process document: parse, chunk, and generate embeddings
async function processDocument(docId, filepath, fileType) {
    console.log(`📄 Processing document: ${docId}`);

    // Parse document
    const text = await parseDocument(filepath, fileType);
    console.log(`   Parsed ${text.length} characters`);

    // Chunk text
    const chunks = chunkText(text, 500, 50);
    console.log(`   Created ${chunks.length} chunks`);

    // Generate embeddings
    const embeddings = await generateEmbeddings(chunks);
    console.log(`   Generated ${embeddings.length} embeddings`);

    // Save chunks with embeddings
    const chunkRecords = chunks.map((content, index) => ({
        id: uuidv4(),
        documentId: docId,
        content: content,
        chunkIndex: index,
        embedding: JSON.stringify(embeddings[index])
    }));

    insertChunks(chunkRecords);
    console.log(`✅ Document processed: ${docId}`);
}

// Get all documents
router.get('/documents', authMiddleware, (req, res) => {
    try {
        const documents = getDocuments();
        res.json(documents);
    } catch (error) {
        res.status(500).json({ error: 'ไม่สามารถโหลดรายการเอกสารได้' });
    }
});

// Delete document
router.delete('/documents/:id', authMiddleware, (req, res) => {
    try {
        const doc = getDocumentById(req.params.id);
        if (!doc) {
            return res.status(404).json({ error: 'ไม่พบเอกสาร' });
        }

        // Delete file
        if (fs.existsSync(doc.filepath)) {
            fs.unlinkSync(doc.filepath);
        }

        // Delete from database
        deleteDocument(req.params.id);

        res.json({ success: true, message: 'ลบเอกสารสำเร็จ' });
    } catch (error) {
        res.status(500).json({ error: 'ลบเอกสารไม่สำเร็จ' });
    }
});

module.exports = router;
