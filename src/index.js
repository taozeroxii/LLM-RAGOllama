require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const adminRoutes = require('./routes/admin');
const chatRoutes = require('./routes/chat');
const documentsRoutes = require('./routes/documents');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/documents', documentsRoutes);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize database and start server
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Server running at http://localhost:${PORT}`);
        console.log(`📁 Admin panel: http://localhost:${PORT}/admin`);
        console.log(`💬 Chat: http://localhost:${PORT}`);
        console.log(`🤖 LLM Provider: ${process.env.LLM_PROVIDER || 'auto'}`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});
