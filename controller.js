let isLocked = false;
let managedWindows = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Event Listeners
    document.getElementById('magnetBtn').addEventListener('click', () => snapWindows({ force: true }));
    document.getElementById('muteBtn').addEventListener('click', toggleMuteAll);
    document.getElementById('closeAllBtn').addEventListener('click', closeAll);

    const lockCheck = document.getElementById('lockLayoutFn');
    lockCheck.addEventListener('change', (e) => {
        isLocked = e.target.checked;
        if (isLocked) snapWindows();
    });

    // Initial Load
    await updateWindowList();

    // Poll for title updates every few seconds to keep list fresh
    setInterval(updateWindowList, 3000);
});

// Lock Logic: Revert moves immediately
chrome.windows.onBoundsChanged.addListener((win) => {
    if (isLocked && managedWindows.includes(win.id)) {
        setTimeout(() => snapWindows({ specificWinId: win.id }), 100);
    }
});

async function getManagedWindows() {
    const { activeCommandWindows = [] } = await chrome.storage.local.get('activeCommandWindows');
    managedWindows = activeCommandWindows;
    return activeCommandWindows;
}

// ---------------------------
// 🔇 Mute Logic (Fixed)
// ---------------------------
async function toggleMuteAll() {
    const ids = await getManagedWindows();
    let anyAudible = false;

    // Check current state
    for (const winId of ids) {
        try {
            const tabs = await chrome.tabs.query({ windowId: winId });
            if (tabs.some(t => !t.mutedInfo.muted)) {
                anyAudible = true;
                break;
            }
        } catch (e) { }
    }

    // New State: If anything is noisy, Mute All. If quiet, Unmute All.
    const shouldMute = anyAudible;

    for (const winId of ids) {
        try {
            const tabs = await chrome.tabs.query({ windowId: winId });
            for (const tab of tabs) {
                chrome.tabs.update(tab.id, { muted: shouldMute });
            }
        } catch (e) { }
    }

    updateMuteUI(shouldMute);
}

function updateMuteUI(isMuted) {
    const btn = document.getElementById('muteBtn');
    if (isMuted) {
        btn.innerHTML = `<span>🔇</span> All Muted`;
        btn.style.borderColor = '#f87171';
        btn.style.color = '#f87171';
    } else {
        btn.innerHTML = `<span>🔊</span> Sound On`;
        btn.style.borderColor = 'rgba(255,255,255,0.1)';
        btn.style.color = 'white';
    }
}

// ---------------------------
// 🌟 Hero Mode Logic (Universal)
// ---------------------------
async function updateWindowList() {
    const ids = await getManagedWindows();
    const list = document.getElementById('windowList');

    // Clear list but don't cause flicker if possible
    const newContent = document.createElement('div');

    for (let i = 0; i < ids.length; i++) {
        try {
            const tabs = await chrome.tabs.query({ windowId: ids[i], active: true });
            if (!tabs.length) continue;

            const title = tabs[0].title || `Window ${i + 1}`;
            const favicon = tabs[0].favIconUrl || '';
            const isHero = (i === 0); // Window 0 is always top-left/main

            const row = document.createElement('div');
            row.className = 'hero-row';
            row.innerHTML = `
                <img src="${favicon}" style="width:14px;height:14px;border-radius:2px;object-fit:cover;">
                <div style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#cbd5e1;">${title}</div>
                ${!isHero ? `<button class="hero-btn" data-idx="${i}">Hero</button>` : '<span style="font-size:10px;color:#fbbf24;">★</span>'}
            `;
            newContent.appendChild(row);
        } catch (e) { }
    }

    list.innerHTML = '';
    list.appendChild(newContent);

    // Bind clicks
    list.querySelectorAll('.hero-btn').forEach(btn => {
        btn.addEventListener('click', () => swapHero(parseInt(btn.dataset.idx)));
    });
}

async function swapHero(targetIndex) {
    const ids = await getManagedWindows();
    if (!ids[targetIndex]) return;

    // Swap ID in array
    [ids[0], ids[targetIndex]] = [ids[targetIndex], ids[0]];

    // Save new order
    await chrome.storage.local.set({ activeCommandWindows: ids });

    // Force re-snap to apply new positions
    await snapWindows({ force: true });

    // Update UI
    await updateWindowList();
}

// ---------------------------
// 🧲 Magnet Logic
// ---------------------------
async function snapWindows({ force = false, specificWinId = null } = {}) {
    const ids = await getManagedWindows();
    const count = ids.length;
    const screenW = window.screen.availWidth;
    const screenH = window.screen.availHeight;

    // Define Layouts
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
        layouts = [
            { left: 0, top: 0, width: halfW, height: halfH },
            { left: halfW, top: 0, width: halfW, height: halfH },
            { left: 0, top: halfH, width: halfW, height: halfH },
            { left: halfW, top: halfH, width: halfW, height: halfH }
        ];
    }

    // Apply
    for (let i = 0; i < count; i++) {
        const winId = ids[i];
        if (!winId || !layouts[i]) continue;
        if (specificWinId && winId !== specificWinId) continue;

        try {
            const info = {
                left: layouts[i].left,
                top: layouts[i].top,
                width: layouts[i].width,
                height: layouts[i].height,
                state: 'normal'
            };
            if (force) info.focused = true;
            await chrome.windows.update(winId, info);
        } catch (e) { }
    }
}

async function closeAll() {
    const ids = await getManagedWindows();
    for (const winId of ids) {
        try { await chrome.windows.remove(winId); } catch (e) { }
    }
    window.close();
}
