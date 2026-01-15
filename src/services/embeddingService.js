const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;

function getGenAI() {
    if (!genAI && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return genAI;
}

/**
 * Generate embeddings using Gemini text-embedding-004
 */
async function generateEmbeddingGemini(text) {
    const ai = getGenAI();
    if (!ai) {
        throw new Error('Gemini API key not configured');
    }

    const model = ai.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values;
}

/**
 * Generate embeddings using Ollama (fallback)
 * Uses nomic-embed-text model which is free and local
 */
async function generateEmbeddingOllama(text) {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

    const response = await fetch(`${baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'nomic-embed-text',
            prompt: text
        })
    });

    if (!response.ok) {
        throw new Error(`Ollama embedding failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding;
}

/**
 * Generate embedding with fallback
 */
async function generateEmbedding(text) {
    const provider = process.env.LLM_PROVIDER || 'auto';

    if (provider === 'gemini' || provider === 'auto') {
        try {
            return await generateEmbeddingGemini(text);
        } catch (error) {
            console.warn('Gemini embedding failed:', error.message);
            if (provider === 'auto') {
                console.log('Falling back to Ollama for embeddings...');
                return await generateEmbeddingOllama(text);
            }
            throw error;
        }
    } else if (provider === 'ollama') {
        return await generateEmbeddingOllama(text);
    }

    throw new Error(`Unknown LLM provider: ${provider}`);
}

/**
 * Generate embeddings for multiple texts (batch)
 */
async function generateEmbeddings(texts) {
    const embeddings = [];

    for (const text of texts) {
        const embedding = await generateEmbedding(text);
        embeddings.push(embedding);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return embeddings;
}

module.exports = {
    generateEmbedding,
    generateEmbeddings
};
