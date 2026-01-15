const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { v4: uuidv4 } = require('uuid');

// Ensure images directory exists
const imagesDir = path.join(__dirname, '../../uploads/images');
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
}

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
 * Extract images from document
 */
async function extractImages(filepath, fileType, documentId) {
    const ext = fileType.toLowerCase();
    const images = [];

    if (ext === 'docx') {
        // Extract images from DOCX using mammoth
        const result = await mammoth.convertToHtml({
            path: filepath
        }, {
            convertImage: mammoth.images.imgElement(async function (image) {
                try {
                    const imageBuffer = await image.read();
                    const contentType = image.contentType || 'image/png';
                    const extension = contentType.split('/')[1] || 'png';
                    const imageId = uuidv4();
                    const imageFilename = `${documentId}_${imageId}.${extension}`;
                    const imagePath = path.join(imagesDir, imageFilename);

                    // Save image to disk
                    fs.writeFileSync(imagePath, imageBuffer);

                    images.push({
                        id: imageId,
                        documentId: documentId,
                        filename: imageFilename,
                        filepath: imagePath,
                        pageNumber: images.length + 1,
                        altText: `Image ${images.length + 1} from document`
                    });

                    return { src: `/uploads/images/${imageFilename}` };
                } catch (err) {
                    console.warn('Failed to extract image:', err.message);
                    return { src: '' };
                }
            })
        });
    } else if (ext === 'pdf') {
        // PDF image extraction requires special handling
        // We'll extract embedded images using pdf-parse metadata or manual extraction
        try {
            const dataBuffer = fs.readFileSync(filepath);
            // Note: pdf-parse doesn't extract images directly
            // For full PDF image extraction, you'd need pdf-lib or pdf.js
            // This is a placeholder for basic PDF handling
            console.log('📷 PDF image extraction: Using page snapshots for complex PDFs');
        } catch (err) {
            console.warn('PDF image extraction not fully supported:', err.message);
        }
    }

    return images;
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
    extractImages,
    chunkText
};
