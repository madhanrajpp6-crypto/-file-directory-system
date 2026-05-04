let currentPath = [];
let createType = 'folder'; 
let currentEditFile = null;
let currentRenameItem = null;

// DOM Elements
const grid = document.getElementById('file-grid');
const breadcrumb = document.getElementById('breadcrumb');
const modal = document.getElementById('modal');
const inputName = document.getElementById('itemName');
const modalTitle = document.getElementById('modal-title');
const editorModal = document.getElementById('editor-modal');
const editorTitle = document.getElementById('editor-title');
const fileContentInput = document.getElementById('fileContent');
const renameModal = document.getElementById('rename-modal');
const renameTitle = document.getElementById('rename-title');
const renameInput = document.getElementById('renameName');
const searchInput = document.getElementById('searchInput');
const toastContainer = document.getElementById('toastContainer');

// Initialize
loadCurrentDirectory();

// Toast System
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function getPathQuery() {
    return encodeURIComponent(JSON.stringify(currentPath));
}

function loadCurrentDirectory() {
    fetch(`/api/ls?path=${getPathQuery()}`)
        .then(res => {
            if (!res.ok) throw new Error("Path not found");
            return res.json();
        })
        .then(data => {
            renderGrid(data.children);
            renderBreadcrumb();
        })
        .catch(err => {
            showToast("Error loading directory: " + err.message, 'error');
            currentPath = [];
            loadCurrentDirectory();
        });
}

function renderGrid(items) {
    grid.innerHTML = '';
    
    if (items.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 5rem 0; opacity: 0.3;">
                <i class="fas fa-folder-open" style="font-size: 4rem; margin-bottom: 1.5rem; display: block;"></i>
                <p style="font-size: 1.1rem;">This folder is empty</p>
            </div>`;
        return;
    }

    const sorted = [...items].sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'folder' ? -1 : 1;
    });

    sorted.forEach((item, index) => {
        const el = document.createElement('div');
        el.className = 'file-item';
        el.style.animationDelay = `${index * 0.05}s`;
        
        const isFolder = item.type === 'folder';
        
        const iconDiv = document.createElement('div');
        iconDiv.className = 'icon';
        const iconClass = isFolder ? 'fa-folder' : getFileIcon(item.name);
        iconDiv.innerHTML = `<i class="fas ${iconClass}" style="color: ${isFolder ? '#fbbf24' : '#38bdf8'}"></i>`;
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'name';
        nameDiv.innerHTML = `
            <div style="font-weight: 600;">${item.name}</div>
            <div style="font-size: 0.7rem; opacity: 0.5; margin-top: 0.3rem;">
                ${isFolder ? '' : formatSize(item.size || 0)} ${item.modifiedAt ? '• ' + formatDate(item.modifiedAt) : ''}
            </div>
        `;
        
        el.appendChild(iconDiv);
        el.appendChild(nameDiv);
        
        el.onclick = () => isFolder ? enterFolder(item.name) : openFileEditor(item.name);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'item-actions';

        let actionHtml = `
            <button class="action-btn" title="Rename" onclick="event.stopPropagation(); openRenameModal('${item.name}', ${isFolder})">
                <i class="fas fa-pen"></i>
            </button>
        `;

        if (!isFolder) {
            actionHtml += `
                <button class="action-btn" title="Download" onclick="event.stopPropagation(); downloadFile('${item.name}')">
                    <i class="fas fa-download"></i>
                </button>
            `;
        }

        actionHtml += `
            <button class="action-btn delete" title="Delete" onclick="event.stopPropagation(); deleteItem('${item.name}')">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        actionsDiv.innerHTML = actionHtml;
        el.appendChild(actionsDiv);
        grid.appendChild(el);
    });
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    switch(ext) {
        case 'txt': return 'fa-file-alt';
        case 'js': return 'fa-file-code';
        case 'html': return 'fa-file-code';
        case 'css': return 'fa-file-code';
        case 'jpg': case 'jpeg': case 'png': return 'fa-file-image';
        case 'pdf': return 'fa-file-pdf';
        default: return 'fa-file';
    }
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

let searchTimeout = null;
function handleSearch() {
    const term = searchInput.value.trim().toLowerCase();
    if (!term) {
        loadCurrentDirectory();
        return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        fetch(`/api/search?q=${encodeURIComponent(term)}`)
            .then(res => res.json())
            .then(results => {
                renderSearchResults(results);
            })
            .catch(err => showToast(err.message, 'error'));
    }, 300);
}

function renderSearchResults(results) {
    grid.innerHTML = '';
    if (results.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 5rem 0; opacity: 0.5;"><p>No results found</p></div>';
        return;
    }

    results.forEach((item, index) => {
        const el = document.createElement('div');
        el.className = 'file-item';
        el.style.animationDelay = `${index * 0.05}s`;
        
        const isFolder = item.type === 'folder';
        const iconDiv = document.createElement('div');
        iconDiv.className = 'icon';
        const iconClass = isFolder ? 'fa-folder' : getFileIcon(item.name);
        iconDiv.innerHTML = `<i class="fas ${iconClass}" style="color: ${isFolder ? '#fbbf24' : '#38bdf8'}"></i>`;
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'name';
        nameDiv.innerHTML = `<div style="font-weight: 600;">${item.name}</div><div style="font-size: 0.7rem; opacity: 0.6; margin-top: 0.2rem;">in ${item.path.length ? item.path.join('/') : 'Home'}</div>`;
        
        el.appendChild(iconDiv);
        el.appendChild(nameDiv);
        
        el.onclick = () => {
            currentPath = item.path;
            if (isFolder) {
                enterFolder(item.name);
            } else {
                loadCurrentDirectory();
                setTimeout(() => openFileEditor(item.name), 100);
            }
            searchInput.value = '';
        };

        grid.appendChild(el);
    });
}

function downloadFile(name) {
    window.location.href = `/api/download?path=${getPathQuery()}&name=${encodeURIComponent(name)}`;
    showToast(`Downloading "${name}"...`);
}

function deleteItem(name) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    fetch('/delete', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: currentPath, name })
    })
    .then(res => {
        if (!res.ok) return res.text().then(err => { throw new Error(err) });
        return res.text();
    })
    .then(() => {
        showToast(`"${name}" deleted successfully`);
        loadCurrentDirectory();
    })
    .catch(err => showToast(err.message, 'error'));
}

function renderBreadcrumb() {
    breadcrumb.innerHTML = '';
    
    const home = document.createElement('span');
    home.className = `crumb ${currentPath.length === 0 ? 'active-crumb' : ''}`;
    home.innerHTML = '<i class="fas fa-home"></i> Home';
    home.onclick = () => navigateTo(-1);
    breadcrumb.appendChild(home);
    
    currentPath.forEach((folder, index) => {
        const sep = document.createElement('span');
        sep.className = 'separator';
        sep.innerHTML = '<i class="fas fa-chevron-right" style="font-size: 0.8rem; margin: 0 0.5rem; opacity: 0.5;"></i>';
        breadcrumb.appendChild(sep);
        
        const crumb = document.createElement('span');
        const isActive = index === currentPath.length - 1;
        crumb.className = `crumb ${isActive ? 'active-crumb' : ''}`;
        crumb.textContent = folder;
        crumb.onclick = () => navigateTo(index);
        breadcrumb.appendChild(crumb);
    });
}

function enterFolder(name) {
    currentPath.push(name);
    loadCurrentDirectory();
}

function navigateTo(index) {
    currentPath = index === -1 ? [] : currentPath.slice(0, index + 1);
    loadCurrentDirectory();
}

function navigateToHome() {
    currentPath = [];
    loadCurrentDirectory();
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    document.querySelector('.nav-item').classList.add('active');
}

function openModal(type) {
    createType = type;
    modalTitle.innerText = type === 'folder' ? 'Create New Folder' : 'Create New File';
    inputName.value = '';
    inputName.placeholder = type === 'folder' ? 'E.g. Projects' : 'E.g. index.html';
    modal.style.display = 'flex';
    inputName.focus();
}

function closeModal() {
    modal.style.display = 'none';
}

function createItem() {
    const name = inputName.value.trim();
    if (!name) return showToast("Name cannot be empty", 'error');
    
    const endpoint = createType === 'folder' ? '/mkdir' : '/touch';
    
    fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: currentPath, name })
    })
    .then(res => {
        if (!res.ok) return res.text().then(err => { throw new Error(err) });
        return res.text();
    })
    .then(() => {
        showToast(`${createType === 'folder' ? 'Folder' : 'File'} created successfully`);
        closeModal();
        loadCurrentDirectory();
    })
    .catch(err => showToast(err.message, 'error'));
}

function openFileEditor(name) {
    currentEditFile = name;
    editorTitle.innerHTML = `<i class="fas fa-file-code" style="color: #38bdf8; margin-right: 0.5rem;"></i> Editing ${name}`;
    fileContentInput.value = 'Loading...';
    fileContentInput.disabled = true;
    editorModal.style.display = 'flex';

    fetch(`/api/file?path=${getPathQuery()}&name=${encodeURIComponent(name)}`)
        .then(res => {
            if (!res.ok) throw new Error("Could not load file");
            return res.json();
        })
        .then(data => {
            fileContentInput.value = data.content;
            fileContentInput.disabled = false;
            fileContentInput.focus();
        })
        .catch(err => {
            showToast(err.message, 'error');
            closeEditorModal();
        });
}

function closeEditorModal() {
    editorModal.style.display = 'none';
    currentEditFile = null;
}

function saveFileContent() {
    if (!currentEditFile) return;

    fetch('/api/file', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: currentPath, name: currentEditFile, content: fileContentInput.value })
    })
    .then(res => {
        if (!res.ok) throw new Error("Could not save file");
        showToast("File saved successfully");
        closeEditorModal();
    })
    .catch(err => showToast(err.message, 'error'));
}

function openRenameModal(name, isFolder) {
    currentRenameItem = name;
    renameTitle.innerText = `Rename ${isFolder ? 'Folder' : 'File'}`;
    renameInput.value = name;
    renameModal.style.display = 'flex';
    renameInput.focus();
    renameInput.select();
}

function closeRenameModal() {
    renameModal.style.display = 'none';
    currentRenameItem = null;
}

function submitRename() {
    if (!currentRenameItem) return;
    const newName = renameInput.value.trim();
    if (!newName || newName === currentRenameItem) return closeRenameModal();

    fetch('/rename', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: currentPath, oldName: currentRenameItem, newName })
    })
    .then(res => {
        if (!res.ok) return res.text().then(err => { throw new Error(err) });
        return res.text();
    })
    .then(() => {
        showToast("Item renamed successfully");
        closeRenameModal();
        loadCurrentDirectory();
    })
    .catch(err => showToast(err.message, 'error'));
}

// Global Event Listeners
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        closeModal();
        closeEditorModal();
        closeRenameModal();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        closeEditorModal();
        closeRenameModal();
    }
});
