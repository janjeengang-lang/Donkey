let editingIndex = -1; // -1 means new profile

document.addEventListener('DOMContentLoaded', () => {
    loadProfiles();
    setupEventListeners();
});

function setupEventListeners() {
    // Modal Controls
    const modal = document.getElementById('createModal');
    const createBtn = document.getElementById('createProfileBtn');
    const closeBtns = document.querySelectorAll('.close-modal');

    createBtn.addEventListener('click', () => {
        editingIndex = -1; // Reset to create mode
        resetModal();
        document.querySelector('.modal-header h2').textContent = 'Create Workspace Profile';
        modal.classList.remove('hidden');
    });

    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    });

    // Save Profile
    document.getElementById('saveProfileBtn').addEventListener('click', saveNewProfile);
}

async function loadProfiles() {
    const { commandProfiles = [] } = await chrome.storage.local.get('commandProfiles');
    const grid = document.getElementById('profileGrid');
    grid.innerHTML = '';

    if (commandProfiles.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: #94a3b8; padding: 40px;">
                <div style="font-size: 40px; margin-bottom: 10px;">⚡</div>
                <h3>No workspace profiles yet</h3>
                <p>Create one to start multitasking like a pro.</p>
            </div>
        `;
        return;
    }

    commandProfiles.forEach((profile, index) => {
        grid.appendChild(createProfileCard(profile, index));
    });
}

function createProfileCard(profile, index) {
    const wrapper = document.createElement('div');
    wrapper.className = 'folder-wrapper';

    // SVG for folder icon
    const folderSvg = `
    <svg width="24" height="24" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg" class="folder-icon">
      <path d="M16.2 1.75H8.1L6.3 0H1.8C0.81 0 0 0.7875 0 1.75V12.25C0 13.2125 0.81 14 1.8 14H15.165L18 9.1875V3.5C18 2.5375 17.19 1.75 16.2 1.75Z" fill="currentColor" fill-opacity="0.8"></path>
      <path d="M16.2 2H1.8C0.81 2 0 2.77143 0 3.71429V12.2857C0 13.2286 0.81 14 1.8 14H16.2C17.19 14 18 13.2286 18 12.2857V3.71429C18 2.77143 17.19 2 16.2 2Z" fill="currentColor"></path>
    </svg>`;

    // Generate Site List for Dropdown
    const siteListHtml = profile.sites.map(site => `
        <li class="site-item">
            <img src="https://www.google.com/s2/favicons?domain=${new URL(site.url).hostname}&sz=32" class="site-favicon" alt="icon">
            <span class="site-name">${extractHostname(site.url)}</span>
        </li>
    `).join('');

    wrapper.innerHTML = `
        <div class="folder-trigger">
            ${folderSvg}
            <p class="folder-label">${profile.name}</p>
        </div>

        <div class="folder-dropdown">
            <ul class="site-list">
                ${siteListHtml}
            </ul>
            <div class="folder-actions">
                <button class="launch-btn" data-index="${index}">🚀 Launch</button>
                <button class="edit-btn" data-index="${index}" style="margin:0 8px; background:none; border:none; cursor:pointer;" title="Edit">✏️</button>
                <button class="delete-btn" data-index="${index}" title="Delete">🗑️</button>
            </div>
        </div>
    `;

    // Bind events
    wrapper.querySelector('.launch-btn').addEventListener('click', () => launchProfile(profile));
    wrapper.querySelector('.edit-btn').addEventListener('click', () => editProfile(index));
    wrapper.querySelector('.delete-btn').addEventListener('click', () => deleteProfile(index));

    return wrapper;
}

function extractHostname(url) {
    try {
        let hostname = new URL(url).hostname;
        return hostname.replace('www.', '');
    } catch {
        return url;
    }
}

async function saveNewProfile() {
    const name = document.getElementById('profileName').value.trim();
    if (!name) return alert('Please enter a profile name');

    const inputs = document.querySelectorAll('.url-input');
    const sites = [];

    inputs.forEach(input => {
        const url = input.value.trim();
        if (url) {
            let validUrl = url;
            if (!url.startsWith('http')) validUrl = 'https://' + url;
            sites.push({ url: validUrl });
        }
    });

    if (sites.length === 0) return alert('Please add at least one website');

    const isIncognito = document.getElementById('incognitoMode').checked;

    const newProfile = {
        id: Date.now(),
        name,
        sites,
        incognito: isIncognito
    };

    const { commandProfiles = [] } = await chrome.storage.local.get('commandProfiles');

    if (editingIndex >= 0) {
        // Update existing
        const existing = commandProfiles[editingIndex];
        newProfile.id = existing.id; // Preserve ID
        commandProfiles[editingIndex] = newProfile;
    } else {
        // Create new
        commandProfiles.push(newProfile);
    }

    await chrome.storage.local.set({ commandProfiles });

    // Reset and close
    resetModal();
    document.getElementById('createModal').classList.add('hidden');
    loadProfiles();
}

function resetModal() {
    document.getElementById('profileName').value = '';
    document.querySelectorAll('.url-input').forEach(i => i.value = '');
    document.getElementById('incognitoMode').checked = false;
}

async function editProfile(index) {
    const { commandProfiles = [] } = await chrome.storage.local.get('commandProfiles');
    const profile = commandProfiles[index];
    if (!profile) return;

    editingIndex = index;

    document.getElementById('profileName').value = profile.name;
    const inputs = document.querySelectorAll('.url-input');
    inputs.forEach(i => i.value = ''); // Clear first

    profile.sites.forEach((site, i) => {
        if (inputs[i]) inputs[i].value = site.url;
    });

    document.getElementById('incognitoMode').checked = !!profile.incognito;

    document.querySelector('.modal-header h2').textContent = 'Edit Workspace Profile';
    document.getElementById('createModal').classList.remove('hidden');
}

async function deleteProfile(index) {
    if (!confirm('Delete this workspace?')) return;
    const { commandProfiles = [] } = await chrome.storage.local.get('commandProfiles');
    commandProfiles.splice(index, 1);
    await chrome.storage.local.set({ commandProfiles });
    loadProfiles();
}

// --- TILING ENGINE ---
async function launchProfile(profile) {
    const sites = profile.sites;
    const count = sites.length;
    const incognito = profile.incognito || false;

    // Get Screen Dimensions (assuming maximizing on primary display)
    const screenW = window.screen.availWidth;
    const screenH = window.screen.availHeight;

    const windows = [];

    // Calculate Coordinates based on count
    let layouts = [];

    if (count === 1) {
        layouts = [{ left: 0, top: 0, width: screenW, height: screenH }];
    } else if (count === 2) {
        layouts = [
            { left: 0, top: 0, width: Math.floor(screenW / 2), height: screenH },
            { left: Math.floor(screenW / 2), top: 0, width: Math.floor(screenW / 2), height: screenH }
        ];
    } else if (count === 3) {
        const halfW = Math.floor(screenW / 2);
        const halfH = Math.floor(screenH / 2);
        layouts = [
            { left: 0, top: 0, width: halfW, height: screenH },
            { left: halfW, top: 0, width: halfW, height: halfH },
            { left: halfW, top: halfH, width: halfW, height: halfH }
        ];
    } else if (count >= 4) {
        const halfW = Math.floor(screenW / 2);
        const halfH = Math.floor(screenH / 2);
        layouts = [ // 2x2
            { left: 0, top: 0, width: halfW, height: halfH },
            { left: halfW, top: 0, width: halfW, height: halfH },
            { left: 0, top: halfH, width: halfW, height: halfH },
            { left: halfW, top: halfH, width: halfW, height: halfH }
        ];
    }

    // Open Windows
    for (let i = 0; i < count; i++) {
        const layout = layouts[i];
        const site = sites[i];

        const win = await chrome.windows.create({
            url: site.url,
            focused: true,
            type: 'popup',
            incognito: incognito,
            left: layout.left,
            top: layout.top,
            width: layout.width,
            height: layout.height
        });
        windows.push(win.id);
    }

    // Launch Controller Window
    await launchController(windows);
}

async function launchController(managedWindowIds) {
    await chrome.storage.local.set({ 'activeCommandWindows': managedWindowIds });

    const width = 260; // Slightly wider for Hero names
    const height = 300; // Taller for lists
    const left = window.screen.availWidth - width - 20;
    const top = window.screen.availHeight - height - 60;

    await chrome.windows.create({
        url: 'controller.html',
        type: 'popup',
        width: width,
        height: height,
        left: left,
        top: top,
        focused: true
    });
}
