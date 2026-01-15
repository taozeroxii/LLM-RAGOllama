const express = require('express');
const { ragQuery } = require('../services/ragService');

const router = express.Router();

// Chat endpoint
router.post('/', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message || message.trim().length === 0) {
            return res.status(400).json({ error: 'กรุณาพิมพ์ข้อความ' });
        }

        console.log(`💬 Question: ${message}`);

        // Run RAG query
        const result = await ragQuery(message);

        console.log(`✅ Answer generated with ${result.sources.length} sources`);

        res.json({
            success: true,
            answer: result.answer,
            sources: result.sources
        });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({
            error: 'ไม่สามารถตอบคำถามได้ในขณะนี้',
            details: error.message
        });
    }
});

module.exports = router;
