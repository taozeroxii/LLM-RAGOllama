const express = require('express');
const path = require('path');
const fs = require('fs');
const { getDocumentById } = require('../database');

const router = express.Router();

// Get document info
router.get('/:id', (req, res) => {
    try {
        const doc = getDocumentById(req.params.id);
        if (!doc) {
            return res.status(404).json({ error: 'ไม่พบเอกสาร' });
        }

        res.json({
            id: doc.id,
            name: doc.original_name,
            type: doc.file_type,
            size: doc.file_size,
            createdAt: doc.created_at
        });
    } catch (error) {
        res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลเอกสารได้' });
    }
});

// Download/view document
router.get('/:id/download', (req, res) => {
    try {
        const doc = getDocumentById(req.params.id);
        if (!doc) {
            return res.status(404).json({ error: 'ไม่พบเอกสาร' });
        }

        if (!fs.existsSync(doc.filepath)) {
            return res.status(404).json({ error: 'ไฟล์ไม่พบในระบบ' });
        }

        // Set appropriate content type
        const contentTypes = {
            'pdf': 'application/pdf',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'doc': 'application/msword',
            'txt': 'text/plain; charset=utf-8',
            'md': 'text/markdown; charset=utf-8'
        };

        const contentType = contentTypes[doc.file_type] || 'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.original_name)}"`);

        const fileStream = fs.createReadStream(doc.filepath);
        fileStream.pipe(res);
    } catch (error) {
        res.status(500).json({ error: 'ไม่สามารถดาวน์โหลดเอกสารได้' });
    }
});

module.exports = router;
