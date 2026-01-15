const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Parse document based on file type
 */
async function parseDocument(filepath, fileType) {
    const ext = fileType.toLowerCase();

    if (ext === 'pdf') {
        return await parsePDF(filepath);
    } else if (ext === 'docx' || ext === 'doc') {
        return await parseDocx(filepath);
    } else if (ext === 'txt' || ext === 'md') {
        return await parseText(filepath);
    } else {
        throw new Error(`Unsupported file type: ${ext}`);
    }
}

/**
 * Parse PDF file
 */
async function parsePDF(filepath) {
    const dataBuffer = fs.readFileSync(filepath);
    const data = await pdfParse(dataBuffer);
    return data.text;
}

/**
 * Parse DOCX file
 */
async function parseDocx(filepath) {
    const result = await mammoth.extractRawText({ path: filepath });
    return result.value;
}

/**
 * Parse plain text file
 */
async function parseText(filepath) {
    return fs.readFileSync(filepath, 'utf-8');
}

/**
 * Split text into overlapping chunks
 */
function chunkText(text, chunkSize = 500, overlap = 50) {
    const chunks = [];

    // Clean the text
    const cleanText = text
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    if (cleanText.length <= chunkSize) {
        return [cleanText];
    }

    let start = 0;
    while (start < cleanText.length) {
        let end = start + chunkSize;

        // Try to end at a sentence boundary
        if (end < cleanText.length) {
            const lastPeriod = cleanText.lastIndexOf('.', end);
            const lastNewline = cleanText.lastIndexOf('\n', end);
            const lastSpace = cleanText.lastIndexOf(' ', end);

            // Find the best break point
            if (lastPeriod > start + chunkSize / 2) {
                end = lastPeriod + 1;
            } else if (lastNewline > start + chunkSize / 2) {
                end = lastNewline + 1;
            } else if (lastSpace > start + chunkSize / 2) {
                end = lastSpace + 1;
            }
        }

        const chunk = cleanText.slice(start, end).trim();
        if (chunk.length > 0) {
            chunks.push(chunk);
        }

        start = end - overlap;
        if (start >= cleanText.length) break;
    }

    return chunks;
}

module.exports = {
    parseDocument,
    chunkText
};
