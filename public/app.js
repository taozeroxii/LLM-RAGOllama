// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const documentModal = document.getElementById('documentModal');
const modalTitle = document.getElementById('modalTitle');
const documentFrame = document.getElementById('documentFrame');
const closeModal = document.getElementById('closeModal');

// Auto-resize textarea
messageInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 150) + 'px';
});

// Handle form submission
chatForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const message = messageInput.value.trim();
    if (!message) return;

    // Add user message to chat
    addMessage(message, 'user');

    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';

    // Disable send button
    sendButton.disabled = true;

    // Show typing indicator
    const typingId = showTypingIndicator();

    try {
        // Send message to API
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });

        const data = await response.json();

        // Remove typing indicator
        removeTypingIndicator(typingId);

        if (data.success) {
            addMessage(data.answer, 'assistant', data.sources);
        } else {
            addMessage(data.error || 'เกิดข้อผิดพลาดในการตอบคำถาม', 'assistant');
        }
    } catch (error) {
        removeTypingIndicator(typingId);
        addMessage('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้', 'assistant');
    }

    // Re-enable send button
    sendButton.disabled = false;
});

// Handle Enter key
messageInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
    }
});

// Add message to chat
function addMessage(content, type, sources = []) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;

    const avatarSvg = type === 'user'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>';

    let sourcesHtml = '';
    if (sources && sources.length > 0) {
        sourcesHtml = `
            <div class="message-sources">
                <div class="sources-title">📎 แหล่งอ้างอิง</div>
                ${sources.map(source => `
                    <div class="source-item" onclick="openDocument('${source.documentId}', '${escapeHtml(source.documentName)}')">
                        <svg class="source-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        <span class="source-name">${escapeHtml(source.documentName)}</span>
                        <span class="source-relevance">${source.relevance}%</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    messageDiv.innerHTML = `
        <div class="message-avatar">
            ${avatarSvg}
        </div>
        <div class="message-content">
            <p>${escapeHtml(content)}</p>
            ${sourcesHtml}
        </div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show typing indicator
function showTypingIndicator() {
    const id = 'typing-' + Date.now();
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant';
    typingDiv.id = id;

    typingDiv.innerHTML = `
        <div class="message-avatar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                <line x1="15" y1="9" x2="15.01" y2="9"></line>
            </svg>
        </div>
        <div class="message-content">
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;

    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return id;
}

// Remove typing indicator
function removeTypingIndicator(id) {
    const typing = document.getElementById(id);
    if (typing) {
        typing.remove();
    }
}

// Open document in modal
function openDocument(docId, docName) {
    modalTitle.textContent = docName;
    documentFrame.src = `/api/documents/${docId}/download`;
    documentModal.classList.remove('hidden');
}

// Close modal
closeModal.addEventListener('click', function () {
    documentModal.classList.add('hidden');
    documentFrame.src = '';
});

document.querySelector('.modal-overlay').addEventListener('click', function () {
    documentModal.classList.add('hidden');
    documentFrame.src = '';
});

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Handle Escape key to close modal
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        documentModal.classList.add('hidden');
        documentFrame.src = '';
    }
});
