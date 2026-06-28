// sync-engine.js - Event-driven push sync engine for GNote
// Architecture: Write-after-push with server revision numbers

import { apiClient } from './api-client.js';
import { db } from './db.js';

let isSyncing = false;
let pendingSync = false; // True if new changes arrived during an active sync
let heartbeatIntervalId = null;
let debounceTimerId = null;
let changelogSeq = 0; // Auto-incrementing sequence number for changelog entries

const DEBOUNCE_MS = 1000;   // Push changes 1 second after last write
const HEARTBEAT_MS = 60000; // Fallback pull every 60 seconds

export const SyncEngine = {
  start() {
    if (heartbeatIntervalId) return;

    // Restore seq counter from stored changelog
    const existing = this.getChangelog();
    if (existing.length > 0) {
      changelogSeq = Math.max(...existing.map(e => e.seq || 0));
    }

    // Initial sync on startup
    this.sync();

    // Heartbeat: pull remote changes periodically as fallback
    heartbeatIntervalId = setInterval(() => {
      this.sync();
    }, HEARTBEAT_MS);

    console.log('SyncEngine started (event-driven push + 60s heartbeat).');
  },

  stop() {
    if (heartbeatIntervalId) {
      clearInterval(heartbeatIntervalId);
      heartbeatIntervalId = null;
    }
    if (debounceTimerId) {
      clearTimeout(debounceTimerId);
      debounceTimerId = null;
    }
    console.log('SyncEngine stopped.');
  },

  // Record a local write/delete and trigger debounced push
  recordChange(type, action, dataOrId) {
    const changelog = this.getChangelog();
    const id = action === 'delete' ? dataOrId : dataOrId.id;
    const now = new Date().toISOString();
    changelogSeq++;

    const existingIndex = changelog.findIndex(entry => entry.id === id && entry.type === type);

    if (existingIndex >= 0) {
      const existing = changelog[existingIndex];

      if (action === 'delete') {
        if (existing.action === 'upsert' && existing.isNewOffline) {
          // Created and deleted offline — never needs to sync
          changelog.splice(existingIndex, 1);
        } else {
          changelog[existingIndex] = {
            id,
            type,
            action: 'delete',
            timestamp: now,
            seq: changelogSeq
          };
        }
      } else {
        // Upsert: update existing entry with new data and new seq
        changelog[existingIndex] = {
          ...existing,
          action: 'upsert',
          data: dataOrId,
          timestamp: now,
          seq: changelogSeq
        };
      }
    } else {
      changelog.push({
        id,
        type,
        action,
        data: action === 'upsert' ? dataOrId : null,
        timestamp: now,
        seq: changelogSeq,
        isNewOffline: action === 'upsert' && !this.getServerRevision() && !localStorage.getItem('gnote_last_sync_at')
      });
    }

    this.saveChangelog(changelog);

    // Trigger debounced push — immediate responsiveness
    this.debouncedSync();
  },

  // Debounce: wait 1 second after last change before syncing
  debouncedSync() {
    if (debounceTimerId) {
      clearTimeout(debounceTimerId);
    }
    debounceTimerId = setTimeout(() => {
      debounceTimerId = null;
      this.sync();
    }, DEBOUNCE_MS);
  },

  getChangelog() {
    try {
      return JSON.parse(localStorage.getItem('gnote_changelog')) || [];
    } catch (e) {
      return [];
    }
  },

  saveChangelog(changelog) {
    localStorage.setItem('gnote_changelog', JSON.stringify(changelog));
  },

  getServerRevision() {
    const val = localStorage.getItem('gnote_server_revision');
    return val ? parseInt(val, 10) : 0;
  },

  setServerRevision(revision) {
    localStorage.setItem('gnote_server_revision', String(revision));
  },

  // Seed local data as offline changes on first server connection
  seedLocalDataAsChanges() {
    console.log('Seeding existing local data to changelog for initial sync...');
    const notes = db.getNotes() || [];
    const tasks = db.getTasks() || [];
    const milestones = db.getMilestones() || [];

    notes.forEach(note => this.recordChange('notes', 'upsert', note));
    tasks.forEach(task => this.recordChange('tasks', 'upsert', task));
    milestones.forEach(milestone => this.recordChange('milestones', 'upsert', milestone));
  },

  async sync() {
    if (isSyncing) {
      // Mark that a re-sync is needed after current one finishes
      pendingSync = true;
      return;
    }
    isSyncing = true;

    window.dispatchEvent(new CustomEvent('sync-status-changed', { detail: 'syncing' }));

    try {
      let clientRevision = this.getServerRevision();
      let lastSyncAt = localStorage.getItem('gnote_last_sync_at') || '';

      // First-time sync: seed all local data only if we have NEVER synced before
      if (!clientRevision && !lastSyncAt) {
        this.seedLocalDataAsChanges();
        clientRevision = 0;
        lastSyncAt = '1970-01-01T00:00:00.000Z';
      }

      // Snapshot the changelog and record the max seq in the snapshot
      const changelogSnapshot = this.getChangelog();
      const snapshotMaxSeq = changelogSnapshot.length > 0
        ? Math.max(...changelogSnapshot.map(e => e.seq || 0))
        : 0;

      // Build changes payload
      const changes = { notes: [], tasks: [], milestones: [] };
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

      console.log(`Sync: pushing ${changelogSnapshot.length} changes, clientRevision=${clientRevision}, lastSyncAt=${lastSyncAt}`);
      const response = await apiClient.sync(clientRevision, lastSyncAt, changes);

      if (response && (typeof response.serverRevision === 'number' || typeof response.syncAt === 'string')) {
        // Apply server changes to local storage
        this.applyServerChanges(response.changes);

        if (typeof response.serverRevision === 'number') {
          this.setServerRevision(response.serverRevision);
          if (response.syncAt) {
            localStorage.setItem('gnote_last_sync_at', response.syncAt);
          }
        } else {
          // Old server fallback: save syncAt and remove server revision
          localStorage.setItem('gnote_last_sync_at', response.syncAt);
          localStorage.removeItem('gnote_server_revision');
        }

        // Only remove changelog entries with seq <= snapshotMaxSeq
        // This preserves any changes that arrived DURING the network request
        const currentChangelog = this.getChangelog();
        const remainingChangelog = currentChangelog.filter(e => (e.seq || 0) > snapshotMaxSeq);
        this.saveChangelog(remainingChangelog);

        console.log(`Sync complete. remaining changelog=${remainingChangelog.length}`);
        window.dispatchEvent(new CustomEvent('sync-status-changed', { detail: 'success' }));

        // Re-render all views
        window.dispatchEvent(new Event('data-updated'));
      } else {
        console.warn('Sync failed: invalid response from server.');
        window.dispatchEvent(new CustomEvent('sync-status-changed', { detail: 'error' }));
      }
    } catch (err) {
      console.error('Error during synchronization:', err);
      window.dispatchEvent(new CustomEvent('sync-status-changed', { detail: 'error' }));
    } finally {
      isSyncing = false;

      // If new changes arrived during sync, immediately trigger another sync
      if (pendingSync) {
        pendingSync = false;
        this.debouncedSync();
      }
    }
  },

  applyServerChanges(serverChanges) {
    if (!serverChanges) return;

    let localNotes = db.getNotes() || [];
    let localTasks = db.getTasks() || [];
    let localMilestones = db.getMilestones() || [];
    let dataChanged = false;

    // Helper: merge a server item into a local list using LWW
    const mergeItem = (localList, serverItem, type) => {
      const idx = localList.findIndex(item => item.id === serverItem.id);
      const serverTs = serverItem.updatedAt || serverItem.createdAt || new Date().toISOString();

      if (idx >= 0) {
        const localItem = localList[idx];
        const localTs = localItem.updatedAt || localItem.createdAt || '1970-01-01T00:00:00.000Z';

        // Server wins if its timestamp is strictly newer
        if (new Date(serverTs) > new Date(localTs)) {
          localList[idx] = { ...localItem, ...serverItem };
          dataChanged = true;
        }
      } else {
        localList.push(serverItem);
        dataChanged = true;
      }
    };

    // Process upserts
    if (Array.isArray(serverChanges.notes)) {
      serverChanges.notes.forEach(note => mergeItem(localNotes, note, 'note'));
    }
    if (Array.isArray(serverChanges.tasks)) {
      serverChanges.tasks.forEach(task => mergeItem(localTasks, task, 'task'));
    }
    if (Array.isArray(serverChanges.milestones)) {
      serverChanges.milestones.forEach(ms => mergeItem(localMilestones, ms, 'milestone'));
    }

    // Process deletions
    if (Array.isArray(serverChanges.deleted)) {
      serverChanges.deleted.forEach(del => {
        if (del.type === 'note') {
          const len = localNotes.length;
          localNotes = localNotes.filter(n => n.id !== del.id);
          localTasks = localTasks.filter(t => t.noteId !== del.id);
          if (localNotes.length !== len) dataChanged = true;
        } else if (del.type === 'task') {
          const len = localTasks.length;
          localTasks = localTasks.filter(t => t.id !== del.id);
          if (localTasks.length !== len) dataChanged = true;
        } else if (del.type === 'milestone') {
          const len = localMilestones.length;
          localMilestones = localMilestones.filter(m => m.id !== del.id);
          if (localMilestones.length !== len) dataChanged = true;
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

    if (dataChanged) {
      db.replaceAll(localNotes, localTasks, localMilestones);
    }
  },

  async forceSync() {
    if (isSyncing) return;
    await this.sync();
  }
};
