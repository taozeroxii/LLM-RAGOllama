const { GoogleGenerativeAI } = require('@google/generative-ai');
const { generateEmbedding } = require('./embeddingService');
const { searchSimilarChunks, getDocumentById, getAllChunksWithEmbeddings, getImagesByDocumentId } = require('../database');

let genAI = null;

function getGenAI() {
    if (!genAI && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return genAI;
}

/**
 * Generate response using Gemini
 */
async function generateResponseGemini(prompt, context, sources) {
    const ai = getGenAI();
    if (!ai) {
        throw new Error('Gemini API key not configured');
    }

    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const systemPrompt = `คุณเป็น AI ผู้ช่วยที่เชี่ยวชาญในการตอบคำถามจากเอกสารองค์กร คุณต้องตอบเป็นภาษาไทยเสมอ

## หลักการตอบคำถาม:
1. **ตอบจากเอกสารเท่านั้น** - ห้ามเดาหรือใช้ความรู้ภายนอก
2. **อ้างอิงแหล่งที่มา** - ระบุชื่อเอกสารที่ใช้ในการตอบ
3. **ตอบตรงประเด็น** - กระชับ ชัดเจน ครบถ้วน
4. **ยอมรับเมื่อไม่พบ** - หากไม่มีข้อมูล ให้บอกว่าไม่พบในเอกสาร

## รูปแบบการตอบ:
- ใช้ภาษาที่เป็นทางการและสุภาพ
- จัดลำดับข้อมูลให้เข้าใจง่าย
- หากมีรายการหลายข้อ ใช้เลขกำกับ
- อ้างอิงเอกสารด้วยรูปแบบ [ชื่อเอกสาร]

## เอกสารอ้างอิง:
${context}

## คำถามจากผู้ใช้:
${prompt}

## คำตอบ (ตอบเป็นภาษาไทย ตรงประเด็น อ้างอิงแหล่งที่มา):`;

    const result = await model.generateContent(systemPrompt);

    return result.response.text();
}

/**
 * Generate response using Ollama (fallback)
 */
async function generateResponseOllama(prompt, context) {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || 'llama3.2';

    const systemPrompt = `คุณเป็น AI ผู้ช่วยที่เชี่ยวชาญในการตอบคำถามจากเอกสารองค์กร คุณต้องตอบเป็นภาษาไทยเสมอ

## หลักการตอบคำถาม:
1. ตอบจากเอกสารเท่านั้น - ห้ามเดาหรือใช้ความรู้ภายนอก
2. อ้างอิงแหล่งที่มา - ระบุชื่อเอกสารที่ใช้ในการตอบ
3. ตอบตรงประเด็น - กระชับ ชัดเจน ครบถ้วน
4. ยอมรับเมื่อไม่พบ - หากไม่มีข้อมูล ให้บอกว่าไม่พบในเอกสาร

## เอกสารอ้างอิง:
${context}

## คำถามจากผู้ใช้:
${prompt}

## คำตอบ (ตอบเป็นภาษาไทย ตรงประเด็น อ้างอิงแหล่งที่มา):`;

    const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            prompt: systemPrompt,
            stream: false,
            options: {
                temperature: 0.3,  // Lower temperature for more accurate responses
                num_ctx: 4096      // Larger context window
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Ollama generate failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
}

/**
 * Generate response with fallback
 */
async function generateResponse(prompt, context) {
    const provider = process.env.LLM_PROVIDER || 'auto';

    if (provider === 'gemini' || provider === 'auto') {
        try {
            return await generateResponseGemini(prompt, context);
        } catch (error) {
            console.warn('Gemini generate failed:', error.message);
            if (provider === 'auto') {
                console.log('Falling back to Ollama for generation...');
                try {
                    return await generateResponseOllama(prompt, context);
                } catch (ollamaError) {
                    console.warn('Ollama also failed:', ollamaError.message);
                    // Return a basic response with the context
                    return generateBasicResponse(prompt, context);
                }
            }
            throw error;
        }
    } else if (provider === 'ollama') {
        try {
            return await generateResponseOllama(prompt, context);
        } catch (error) {
            console.warn('Ollama generate failed:', error.message);
            return generateBasicResponse(prompt, context);
        }
    }

    throw new Error(`Unknown LLM provider: ${provider}`);
}

/**
 * Generate a basic response when LLM is unavailable
 */
function generateBasicResponse(prompt, context) {
    return `📌 **ระบบ AI ไม่พร้อมใช้งานชั่วคราว** (API quota หมดหรือ Ollama ไม่ทำงาน)

อย่างไรก็ตาม พบข้อมูลที่เกี่ยวข้องในเอกสาร:

---
${context.substring(0, 1500)}${context.length > 1500 ? '...' : ''}
---

💡 **วิธีแก้ไข:**
- ตรวจสอบ Gemini API quota ที่ https://ai.google.dev/
- หรือติดตั้ง Ollama: https://ollama.ai/ แล้วรัน: ollama pull llama3.2`;
}

/**
 * Search chunks using keyword matching as fallback
 */
function searchChunksByKeyword(question, limit = 5) {
    const chunks = getAllChunksWithEmbeddings();
    const keywords = question.toLowerCase().split(/\s+/).filter(k => k.length > 2);

    const scoredChunks = chunks.map(chunk => {
        const content = chunk.content.toLowerCase();
        let score = 0;
        for (const keyword of keywords) {
            if (content.includes(keyword)) {
                score += 1;
            }
        }
        return { ...chunk, similarity: score / Math.max(keywords.length, 1) };
    });

    return scoredChunks
        .filter(c => c.similarity > 0)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
}

/**
 * Main RAG pipeline - retrieve relevant chunks and generate answer
 */
async function ragQuery(question) {
    let similarChunks = [];
    let useKeywordFallback = false;

    // 1. Try to generate embedding for the question
    try {
        const queryEmbedding = await generateEmbedding(question);
        similarChunks = searchSimilarChunks(queryEmbedding, 5);
    } catch (embeddingError) {
        console.warn('Embedding failed, using keyword search:', embeddingError.message);
        useKeywordFallback = true;
        similarChunks = searchChunksByKeyword(question, 5);
    }

    // 2. If no results with embedding, try keyword search
    if (similarChunks.length === 0 && !useKeywordFallback) {
        console.log('No embedding results, trying keyword search...');
        similarChunks = searchChunksByKeyword(question, 5);
    }

    if (similarChunks.length === 0) {
        return {
            answer: 'ไม่พบข้อมูลที่เกี่ยวข้องในเอกสาร กรุณาลองถามคำถามอื่น หรือตรวจสอบว่ามีเอกสารที่เกี่ยวข้องได้ถูกอัพโหลดแล้ว',
            sources: []
        };
    }

    // 3. Build context from chunks
    const contextParts = similarChunks.map((chunk, index) => {
        return `[เอกสาร ${index + 1}: ${chunk.document_name}]\n${chunk.content}`;
    });
    const context = contextParts.join('\n\n---\n\n');

    // 4. Generate response (with fallback)
    const answer = await generateResponse(question, context);

    // 5. Prepare sources with document info and images
    const sourceDocIds = [...new Set(similarChunks.map(c => c.document_id))];
    const sources = sourceDocIds.map(docId => {
        const doc = getDocumentById(docId);
        const relevantChunks = similarChunks.filter(c => c.document_id === docId);
        const maxSimilarity = Math.max(...relevantChunks.map(c => c.similarity));

        // Get images for this document
        const docImages = getImagesByDocumentId(docId);
        const images = docImages.map(img => ({
            id: img.id,
            url: `/uploads/images/${img.filename}`,
            alt: img.alt_text || `Image from ${doc?.original_name || 'document'}`
        }));

        return {
            documentId: docId,
            documentName: doc?.original_name || 'Unknown',
            relevance: Math.round(maxSimilarity * 100),
            preview: relevantChunks[0]?.content.substring(0, 150) + '...',
            images: images
        };
    });

    // Collect all images from all sources
    const allImages = sources.flatMap(s => s.images || []);

    return {
        answer,
        sources,
        images: allImages.slice(0, 5) // Limit to 5 images max
    };
}

module.exports = {
    ragQuery,
    generateResponse
};

