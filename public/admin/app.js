// State
let authToken = localStorage.getItem('adminToken');
let deleteDocId = null;

// DOM Elements
const loginSection = document.getElementById('loginSection');
const adminDashboard = document.getElementById('adminDashboard');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadProgress = document.getElementById('uploadProgress');
const uploadFileName = document.getElementById('uploadFileName');
const uploadStatus = document.getElementById('uploadStatus');
const progressFill = document.getElementById('progressFill');
const documentsGrid = document.getElementById('documentsGrid');
const emptyState = document.getElementById('emptyState');
const refreshBtn = document.getElementById('refreshBtn');
const deleteModal = document.getElementById('deleteModal');
const deleteDocName = document.getElementById('deleteDocName');
const cancelDelete = document.getElementById('cancelDelete');
const confirmDelete = document.getElementById('confirmDelete');

// Initialize
checkAuth();

// Check authentication
function checkAuth() {
    if (authToken) {
        showDashboard();
        loadDocuments();
    } else {
        showLogin();
    }
}

function showLogin() {
    loginSection.classList.remove('hidden');
    adminDashboard.classList.add('hidden');
    logoutBtn.classList.add('hidden');
}

function showDashboard() {
    loginSection.classList.add('hidden');
    adminDashboard.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
}

// Login
loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (data.success) {
            authToken = data.token;
            localStorage.setItem('adminToken', authToken);
            loginError.classList.add('hidden');
            showDashboard();
            loadDocuments();
        } else {
            loginError.textContent = data.error || 'เข้าสู่ระบบไม่สำเร็จ';
            loginError.classList.remove('hidden');
        }
    } catch (error) {
        loginError.textContent = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์';
        loginError.classList.remove('hidden');
    }
});

// Logout
logoutBtn.addEventListener('click', function () {
    authToken = null;
    localStorage.removeItem('adminToken');
    showLogin();
});

// File Upload - Drag & Drop
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        uploadFiles(files);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        uploadFiles(e.target.files);
    }
});

// Upload files
async function uploadFiles(files) {
    for (const file of files) {
        await uploadFile(file);
    }
    loadDocuments();
}

async function uploadFile(file) {
    uploadProgress.classList.remove('hidden');
    uploadFileName.textContent = file.name;
    uploadStatus.textContent = 'กำลังอัพโหลด...';
    progressFill.style.width = '0%';

    const formData = new FormData();
    formData.append('file', file);

    try {
        // Simulate progress
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 10;
            if (progress <= 90) {
                progressFill.style.width = progress + '%';
            }
        }, 100);

        const response = await fetch('/api/admin/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });

        clearInterval(progressInterval);

        const data = await response.json();

        if (data.success) {
            progressFill.style.width = '100%';
            uploadStatus.textContent = 'อัพโหลดสำเร็จ!';

            setTimeout(() => {
                uploadProgress.classList.add('hidden');
            }, 2000);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        uploadStatus.textContent = 'อัพโหลดไม่สำเร็จ: ' + error.message;
        progressFill.style.width = '0%';
        progressFill.style.background = 'var(--error)';
    }
}

// Load documents
async function loadDocuments() {
    try {
        const response = await fetch('/api/admin/documents', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.status === 401) {
            authToken = null;
            localStorage.removeItem('adminToken');
            showLogin();
            return;
        }

        const documents = await response.json();

        if (documents.length === 0) {
            documentsGrid.innerHTML = '';
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            renderDocuments(documents);
        }
    } catch (error) {
        console.error('Failed to load documents:', error);
    }
}

// Render documents
function renderDocuments(documents) {
    documentsGrid.innerHTML = documents.map(doc => {
        const size = formatFileSize(doc.file_size);
        const date = new Date(doc.created_at).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        return `
            <div class="document-card">
                <div class="document-header">
                    <div class="document-icon ${doc.file_type}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                    </div>
                    <div class="document-info">
                        <div class="document-name" title="${escapeHtml(doc.original_name)}">${escapeHtml(doc.original_name)}</div>
                        <div class="document-meta">${size} • ${date}</div>
                    </div>
                </div>
                <div class="document-actions">
                    <button class="action-btn" onclick="viewDocument('${doc.id}')" title="ดูเอกสาร">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                    <button class="action-btn delete" onclick="showDeleteModal('${doc.id}', '${escapeHtml(doc.original_name)}')" title="ลบเอกสาร">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// View document
function viewDocument(docId) {
    window.open(`/api/documents/${docId}/download`, '_blank');
}

// Delete document
function showDeleteModal(docId, docName) {
    deleteDocId = docId;
    deleteDocName.textContent = docName;
    deleteModal.classList.remove('hidden');
}

cancelDelete.addEventListener('click', () => {
    deleteModal.classList.add('hidden');
    deleteDocId = null;
});

document.querySelector('#deleteModal .modal-overlay').addEventListener('click', () => {
    deleteModal.classList.add('hidden');
    deleteDocId = null;
});

confirmDelete.addEventListener('click', async () => {
    if (!deleteDocId) return;

    try {
        const response = await fetch(`/api/admin/documents/${deleteDocId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();

        if (data.success) {
            deleteModal.classList.add('hidden');
            deleteDocId = null;
            loadDocuments();
        } else {
            alert(data.error || 'ลบเอกสารไม่สำเร็จ');
        }
    } catch (error) {
        alert('ไม่สามารถลบเอกสารได้');
    }
});

// Refresh
refreshBtn.addEventListener('click', loadDocuments);

// Helpers
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
