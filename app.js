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
