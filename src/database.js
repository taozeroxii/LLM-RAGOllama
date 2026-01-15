const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'rag.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

async function initDatabase() {
    // Create documents table
    db.exec(`
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            original_name TEXT NOT NULL,
            filepath TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create chunks table with embedding stored as JSON
    db.exec(`
        CREATE TABLE IF NOT EXISTS chunks (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL,
            content TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            embedding TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        )
    `);

    // Create index for faster lookups
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id)
    `);

    console.log('✅ Database initialized');
}

// Document operations
function insertDocument(doc) {
    const stmt = db.prepare(`
        INSERT INTO documents (id, filename, original_name, filepath, file_type, file_size)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(doc.id, doc.filename, doc.originalName, doc.filepath, doc.fileType, doc.fileSize);
}

function getDocuments() {
    return db.prepare('SELECT * FROM documents ORDER BY created_at DESC').all();
}

function getDocumentById(id) {
    return db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
}

function deleteDocument(id) {
    // Chunks will be deleted automatically due to CASCADE
    db.prepare('DELETE FROM documents WHERE id = ?').run(id);
}

// Chunk operations
function insertChunk(chunk) {
    const stmt = db.prepare(`
        INSERT INTO chunks (id, document_id, content, chunk_index, embedding)
        VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(chunk.id, chunk.documentId, chunk.content, chunk.chunkIndex, chunk.embedding);
}

function insertChunks(chunks) {
    const stmt = db.prepare(`
        INSERT INTO chunks (id, document_id, content, chunk_index, embedding)
        VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items) => {
        for (const chunk of items) {
            stmt.run(chunk.id, chunk.documentId, chunk.content, chunk.chunkIndex, chunk.embedding);
        }
    });

    insertMany(chunks);
}

function getChunksByDocumentId(documentId) {
    return db.prepare('SELECT * FROM chunks WHERE document_id = ? ORDER BY chunk_index').all(documentId);
}

function getAllChunksWithEmbeddings() {
    return db.prepare('SELECT c.*, d.original_name as document_name FROM chunks c JOIN documents d ON c.document_id = d.id WHERE c.embedding IS NOT NULL').all();
}

// Cosine similarity calculation
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Search for similar chunks using cosine similarity
function searchSimilarChunks(queryEmbedding, topK = 5) {
    const chunks = getAllChunksWithEmbeddings();

    const scoredChunks = chunks.map(chunk => {
        const embedding = JSON.parse(chunk.embedding);
        const similarity = cosineSimilarity(queryEmbedding, embedding);
        return { ...chunk, similarity };
    });

    // Sort by similarity descending and return top K
    return scoredChunks
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK)
        .filter(chunk => chunk.similarity > 0.3); // Only return if similarity > 0.3
}

module.exports = {
    db,
    initDatabase,
    insertDocument,
    getDocuments,
    getDocumentById,
    deleteDocument,
    insertChunk,
    insertChunks,
    getChunksByDocumentId,
    getAllChunksWithEmbeddings,
    searchSimilarChunks
};
