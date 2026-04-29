let currentPath = [];
let createType = 'folder'; // 'folder' or 'file'

// DOM Elements
const grid = document.getElementById('file-grid');
const breadcrumb = document.getElementById('breadcrumb');
const modal = document.getElementById('modal');
const inputName = document.getElementById('itemName');
const modalTitle = document.getElementById('modal-title');

// Initialize
loadCurrentDirectory();

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
            alert("Error loading directory: " + err.message);
            // Fallback to root
            currentPath = [];
            loadCurrentDirectory();
        });
}

function renderGrid(items) {
    grid.innerHTML = '';
    
    if (items.length === 0) {
        grid.innerHTML = `<div class="empty-state">
            <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
            <p>This folder is empty</p>
        </div>`;
        return;
    }

    // Sort folders first, then files
    const sorted = [...items].sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'folder' ? -1 : 1;
    });

    sorted.forEach(item => {
        const el = document.createElement('div');
        el.className = 'file-item';
        
        const isFolder = item.type === 'folder';
        
        const iconDiv = document.createElement('div');
        iconDiv.className = 'icon';
        iconDiv.textContent = isFolder ? '📁' : '📄';
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'name';
        nameDiv.textContent = item.name;
        nameDiv.title = item.name;
        
        el.appendChild(iconDiv);
        el.appendChild(nameDiv);
        
        if (isFolder) {
            el.onclick = () => enterFolder(item.name);
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Delete';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteItem(item.name);
        };
        el.appendChild(deleteBtn);
        
        grid.appendChild(el);
    });
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
    .then(msg => {
        loadCurrentDirectory();
    })
    .catch(err => alert("Error: " + err.message));
}

function renderBreadcrumb() {
    breadcrumb.innerHTML = '';
    
    const home = document.createElement('span');
    home.className = `crumb ${currentPath.length === 0 ? 'active-crumb' : ''}`;
    home.textContent = 'Home';
    home.onclick = () => navigateTo(-1);
    breadcrumb.appendChild(home);
    
    currentPath.forEach((folder, index) => {
        const sep = document.createElement('span');
        sep.className = 'separator';
        sep.textContent = '/';
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
    if (index === -1) {
        currentPath = [];
    } else {
        currentPath = currentPath.slice(0, index + 1);
    }
    loadCurrentDirectory();
}

// Modal handling
function openModal(type) {
    createType = type;
    modalTitle.innerText = type === 'folder' ? 'Create New Folder' : 'Create New File';
    inputName.value = '';
    inputName.placeholder = type === 'folder' ? 'Folder name...' : 'File name...';
    modal.style.display = 'flex';
    inputName.focus();
}

function closeModal() {
    modal.style.display = 'none';
}

function createItem() {
    const name = inputName.value.trim();
    if (!name) return alert("Name cannot be empty");
    
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
    .then(msg => {
        closeModal();
        loadCurrentDirectory();
    })
    .catch(err => alert("Error: " + err.message));
}

// Handle Enter key in modal
inputName.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        createItem();
    }
});
