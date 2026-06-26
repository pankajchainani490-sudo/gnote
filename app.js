// app.js - Single Page Application Main Entry & Routing controller

import { db } from './db.js';
import { NotesView } from './notes-view.js';
import { TasksView } from './tasks-view.js';
import { MilestonesView } from './milestones-view.js';
import { InsightsView } from './insights-view.js';
import { SyncEngine } from './sync-engine.js';
import { DevSettings } from './dev-settings.js';
import { apiClient } from './api-client.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize DB and Views
  NotesView.init(db);
  TasksView.init(db);
  MilestonesView.init(db);
  InsightsView.init(db);

  // 1.5. Initialize Sync Engine and Developer Settings
  db.setChangeListener((type, action, data) => {
    SyncEngine.recordChange(type, action, data);
  });
  DevSettings.init();
  if (apiClient.isConfigured()) {
    SyncEngine.start();
  }

  // 2. Routing Setup
  window.addEventListener('hashchange', handleRoute);
  handleRoute(); // Execute initial route

  // 3. Quick Capture Event setup
  const btnQuickCapture = document.getElementById('btn-quick-capture');
  const modalQuickCapture = document.getElementById('modal-quick-capture');
  
  btnQuickCapture.addEventListener('click', () => {
    document.getElementById('quick-capture-title').value = '';
    document.getElementById('quick-capture-content').value = '';
    modalQuickCapture.classList.remove('hidden');
  });

  const closeQuickBtns = modalQuickCapture.querySelectorAll('.btn-close-modal');
  closeQuickBtns.forEach(btn => btn.addEventListener('click', () => {
    modalQuickCapture.classList.add('hidden');
  }));

  document.getElementById('btn-save-quick-capture').addEventListener('click', saveQuickCapture);

  // 4. Data Sync Event - update all other modules when data changes
  window.addEventListener('data-updated', () => {
    TasksView.renderBoard();
    TasksView.renderTodayFocus();
    TasksView.renderFilters();
    MilestonesView.render();
    InsightsView.render();
  });

  // 5. Active Sync Button for Mac (desktop)
  const btnSyncNow = document.getElementById('btn-sync-now');
  if (btnSyncNow) {
    btnSyncNow.addEventListener('click', async () => {
      if (!apiClient.isConfigured()) {
        alert('请先进入设置配置自托管服务器');
        return;
      }
      btnSyncNow.disabled = true;
      try {
        await SyncEngine.forceSync();
      } catch (err) {
        console.error(err);
      } finally {
        btnSyncNow.disabled = false;
      }
    });
  }

  // Monitor sync status and spin the icon
  window.addEventListener('sync-status-changed', (e) => {
    const status = e.detail;
    const syncSvg = document.querySelector('#btn-sync-now svg');
    if (syncSvg) {
      if (status === 'syncing') {
        syncSvg.classList.add('sync-spinning');
      } else {
        syncSvg.classList.remove('sync-spinning');
      }
    }
  });

  // 6. Pull to Refresh for Mobile (Android)
  let touchStartY = 0;
  let touchStartX = 0;
  let isPulling = false;
  let activeScrollContainer = null;

  document.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    touchStartY = touch.screenY;
    touchStartX = touch.screenX;
    
    // Find the closest scrollable container (.view-panel or sub-scrollables)
    let target = e.target;
    activeScrollContainer = null;
    while (target && target !== document.body) {
      const style = window.getComputedStyle(target);
      const overflowY = style.overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && target.scrollHeight > target.clientHeight) {
        activeScrollContainer = target;
        break;
      }
      target = target.parentNode;
    }
    
    if (!activeScrollContainer) {
      activeScrollContainer = document.querySelector('.view-panel:not(.hidden)');
    }
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!activeScrollContainer) return;
    
    const touch = e.touches[0];
    const deltaY = touch.screenY - touchStartY;
    const deltaX = touch.screenX - touchStartX;
    
    // Trigger pull-down only if we are at the top of scroll and dragging downwards
    if (activeScrollContainer.scrollTop <= 0 && deltaY > 70 && Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
      if (!isPulling) {
        isPulling = true;
        const ptr = document.getElementById('pull-to-refresh');
        if (ptr) {
          ptr.classList.remove('hidden');
          ptr.classList.add('visible');
          ptr.querySelector('span').innerText = '松开即可同步...';
        }
      }
    }
  }, { passive: true });

  document.addEventListener('touchend', async () => {
    if (isPulling) {
      isPulling = false;
      const ptr = document.getElementById('pull-to-refresh');
      if (ptr) {
        ptr.classList.add('refreshing');
        ptr.querySelector('span').innerText = '正在同步...';
        
        try {
          if (apiClient.isConfigured()) {
            await SyncEngine.forceSync();
          } else {
            ptr.querySelector('span').innerText = '自托管服务未配置';
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (err) {
          console.error(err);
        } finally {
          ptr.classList.remove('refreshing');
          ptr.classList.remove('visible');
          setTimeout(() => {
            ptr.classList.add('hidden');
          }, 200);
        }
      }
    }
  });
});

// Route handler
function handleRoute() {
  const hash = window.location.hash || '#notes';
  const viewName = hash.replace('#', '');
  
  // Update sidebar nav highlights
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  navItems.forEach(item => {
    if (item.getAttribute('data-view') === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Toggle active view panel
  const panels = document.querySelectorAll('.view-panel');
  panels.forEach(panel => {
    if (panel.id === `view-${viewName}`) {
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  });

  // Trigger view specific redraws if needed
  if (viewName === 'tasks') {
    TasksView.renderBoard();
    TasksView.renderTodayFocus();
  } else if (viewName === 'milestones') {
    MilestonesView.render();
  } else if (viewName === 'insights') {
    InsightsView.render();
  }
}

// Quick Capture Save Handler
function saveQuickCapture() {
  const title = document.getElementById('quick-capture-title').value.trim() || `闪念捕捉 (${new Date().toLocaleDateString('zh-CN')})`;
  const content = document.getElementById('quick-capture-content').value.trim();
  
  if (!content) {
    alert('记录内容不能为空');
    return;
  }

  const note = {
    title,
    content: `<h1>${title}</h1><p>${content.replace(/\n/g, '<br>')}</p>`,
    tags: ['闪念']
  };

  const savedNote = db.saveNote(note);
  document.getElementById('modal-quick-capture').classList.add('hidden');

  // Trigger data sync
  window.dispatchEvent(new Event('data-updated'));

  // Go to notes page and open this captured note
  window.location.hash = '#notes';
  window.loadNoteById(savedNote.id);
}

// Global hook to jump to a specific note (used by wiki links and source note links)
window.loadNoteById = (id) => {
  window.location.hash = '#notes';
  // Small delay to ensure view toggled before loading note
  setTimeout(() => {
    NotesView.loadNote(id);
  }, 50);
};
