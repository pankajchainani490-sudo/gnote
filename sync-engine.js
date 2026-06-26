// sync-engine.js - Background synchronization engine for NoteFlow

import { apiClient } from './api-client.js';
import { db } from './db.js';

let syncIntervalId = null;
let isSyncing = false;

export const SyncEngine = {
  start() {
    if (syncIntervalId) return;
    
    // Initial sync on startup
    this.sync();
    
    // Set up 30-second interval
    syncIntervalId = setInterval(() => {
      this.sync();
    }, 30000);
    
    console.log('SyncEngine started.');
  },

  stop() {
    if (syncIntervalId) {
      clearInterval(syncIntervalId);
      syncIntervalId = null;
      console.log('SyncEngine stopped.');
    }
  },

  // Record a local write/delete operation in the changelog queue
  recordChange(type, action, dataOrId) {
    const changelog = this.getChangelog();
    const id = action === 'delete' ? dataOrId : dataOrId.id;
    const now = new Date().toISOString();

    const existingIndex = changelog.findIndex(entry => entry.id === id && entry.type === type);
    
    if (existingIndex >= 0) {
      const existing = changelog[existingIndex];
      
      if (action === 'delete') {
        if (existing.action === 'upsert' && existing.isNewOffline) {
          // Optimization: If created offline and deleted offline, never sync to server
          changelog.splice(existingIndex, 1);
        } else {
          // Replace upsert with delete
          changelog[existingIndex] = {
            id,
            type,
            action: 'delete',
            timestamp: now
          };
        }
      } else {
        // action === 'upsert'
        changelog[existingIndex] = {
          ...existing,
          action: 'upsert',
          data: dataOrId,
          timestamp: now
        };
      }
    } else {
      // Add new entry
      changelog.push({
        id,
        type,
        action,
        data: action === 'upsert' ? dataOrId : null,
        timestamp: now,
        isNewOffline: action === 'upsert' && !this.getLastSyncAt() // Track if created before first sync
      });
    }

    this.saveChangelog(changelog);
  },

  getChangelog() {
    try {
      return JSON.parse(localStorage.getItem('noteflow_changelog')) || [];
    } catch (e) {
      return [];
    }
  },

  saveChangelog(changelog) {
    localStorage.setItem('noteflow_changelog', JSON.stringify(changelog));
  },

  getLastSyncAt() {
    return localStorage.getItem('noteflow_last_sync_at') || '';
  },

  setLastSyncAt(timestamp) {
    localStorage.setItem('noteflow_last_sync_at', timestamp);
  },

  // Seed local data as offline changes on first server connection
  seedLocalDataAsChanges() {
    console.log('Seeding existing local data to changelog for initial sync migration...');
    const notes = db.getNotes() || [];
    const tasks = db.getTasks() || [];
    const milestones = db.getMilestones() || [];

    notes.forEach(note => this.recordChange('notes', 'upsert', note));
    tasks.forEach(task => this.recordChange('tasks', 'upsert', task));
    milestones.forEach(milestone => this.recordChange('milestones', 'upsert', milestone));
  },

  async sync() {
    if (isSyncing || !apiClient.isConfigured()) return;
    isSyncing = true;
    
    // Set visual indicator on settings modal or dispatch status event
    window.dispatchEvent(new CustomEvent('sync-status-changed', { detail: 'syncing' }));

    try {
      let lastSyncAt = this.getLastSyncAt();
      
      // If we've never synced before, seed existing local storage data to the server
      if (!lastSyncAt) {
        this.seedLocalDataAsChanges();
        lastSyncAt = '1970-01-01T00:00:00.000Z'; // Sync everything
      }

      const changelogSnapshot = this.getChangelog();
      
      // Format changes payload for server /api/sync endpoint
      const changes = {
        notes: [],
        tasks: [],
        milestones: []
      };

      changelogSnapshot.forEach(entry => {
        const list = changes[entry.type];
        if (list) {
          list.push({
            action: entry.action,
            id: entry.id,
            data: entry.data
          });
        }
      });

      console.log(`Starting sync. Sending ${changelogSnapshot.length} local changes. Last synced at: ${lastSyncAt}`);
      const response = await apiClient.sync(lastSyncAt, changes);

      if (response && response.changes) {
        this.applyServerChanges(response.changes);
        this.setLastSyncAt(response.syncAt);
        
        // Remove processed entries from local changelog
        const currentChangelog = this.getChangelog();
        const snapshotIds = new Set(changelogSnapshot.map(e => `${e.type}_${e.id}`));
        const remainingChangelog = currentChangelog.filter(e => !snapshotIds.has(`${e.type}_${e.id}`));
        this.saveChangelog(remainingChangelog);

        console.log(`Sync completed successfully. Server sync time: ${response.syncAt}`);
        window.dispatchEvent(new CustomEvent('sync-status-changed', { detail: 'success' }));
        
        // Dispatch global data update to re-render all active UI views
        window.dispatchEvent(new Event('data-updated'));
      } else {
        console.warn('Sync failed: No response received from server.');
        window.dispatchEvent(new CustomEvent('sync-status-changed', { detail: 'error' }));
      }
    } catch (err) {
      console.error('Error during synchronization:', err);
      window.dispatchEvent(new CustomEvent('sync-status-changed', { detail: 'error' }));
    } finally {
      isSyncing = false;
    }
  },

  applyServerChanges(serverChanges) {
    let localNotes = db.getNotes() || [];
    let localTasks = db.getTasks() || [];
    let localMilestones = db.getMilestones() || [];
    let dataChanged = false;

    // Helper to merge items using Last-Write-Wins based on updatedAt
    const mergeItem = (localList, serverItem, type) => {
      const idx = localList.findIndex(item => item.id === serverItem.id);
      
      const serverUpdatedAt = serverItem.updatedAt || serverItem.createdAt || new Date().toISOString();
      
      if (idx >= 0) {
        const localItem = localList[idx];
        const localUpdatedAt = localItem.updatedAt || localItem.createdAt || '1970-01-01T00:00:00.000Z';
        
        if (new Date(serverUpdatedAt) > new Date(localUpdatedAt)) {
          localList[idx] = { ...localItem, ...serverItem };
          dataChanged = true;
          console.log(`Merged server update for ${type} ${serverItem.id}`);
        }
      } else {
        localList.push(serverItem);
        dataChanged = true;
        console.log(`Added server item for ${type} ${serverItem.id}`);
      }
    };

    // 1. Process server upserts
    if (Array.isArray(serverChanges.notes)) {
      serverChanges.notes.forEach(note => mergeItem(localNotes, note, 'note'));
    }
    if (Array.isArray(serverChanges.tasks)) {
      serverChanges.tasks.forEach(task => mergeItem(localTasks, task, 'task'));
    }
    if (Array.isArray(serverChanges.milestones)) {
      serverChanges.milestones.forEach(milestone => mergeItem(localMilestones, milestone, 'milestone'));
    }

    // 2. Process server deletions
    if (Array.isArray(serverChanges.deleted)) {
      serverChanges.deleted.forEach(del => {
        if (del.type === 'note') {
          const initialLen = localNotes.length;
          localNotes = localNotes.filter(n => n.id !== del.id);
          // Cascadingly remove tasks associated with deleted notes
          localTasks = localTasks.filter(t => t.noteId !== del.id);
          if (localNotes.length !== initialLen) dataChanged = true;
        } else if (del.type === 'task') {
          const initialLen = localTasks.length;
          localTasks = localTasks.filter(t => t.id !== del.id);
          if (localTasks.length !== initialLen) dataChanged = true;
        } else if (del.type === 'milestone') {
          const initialLen = localMilestones.length;
          localMilestones = localMilestones.filter(m => m.id !== del.id);
          if (localMilestones.length !== initialLen) dataChanged = true;
          // Unlink tasks associated with deleted milestones
          localTasks = localTasks.map(t => {
            if (t.milestoneId === del.id) {
              dataChanged = true;
              return { ...t, milestoneId: '' };
            }
            return t;
          });
        }
      });
    }

    // Save updated arrays back to localStorage (uses the replaceAll bypass method we will add)
    if (dataChanged) {
      db.replaceAll(localNotes, localTasks, localMilestones);
    }
  },

  async forceSync() {
    if (isSyncing) return;
    await this.sync();
  }
};
