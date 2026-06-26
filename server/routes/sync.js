import express from 'express';
import db from '../db.js';

const router = express.Router();

router.post('/', (req, res) => {
  try {
    const { clientRevision, changes } = req.body;
    const baseRevision = typeof clientRevision === 'number' ? clientRevision : 0;

    // 1. Apply client changes to server
    if (changes) {
      // Process Notes
      if (Array.isArray(changes.notes)) {
        changes.notes.forEach(change => {
          if (change.action === 'upsert' && change.data) {
            const clientItem = change.data;
            const existing = db.getById('notes', clientItem.id);
            // Accept client write if item doesn't exist on server,
            // or if client's updatedAt is newer (true LWW with strict >)
            if (!existing || new Date(clientItem.updatedAt) > new Date(existing.updatedAt || '1970-01-01')) {
              db.insertOrReplace('notes', clientItem);
              db.delete('deleted_records', clientItem.id);
            }
          } else if (change.action === 'delete') {
            db.deleteWhere('tasks', task => task.noteId === change.id);
            db.delete('notes', change.id);
          }
        });
      }

      // Process Tasks
      if (Array.isArray(changes.tasks)) {
        changes.tasks.forEach(change => {
          if (change.action === 'upsert' && change.data) {
            const clientItem = change.data;
            const existing = db.getById('tasks', clientItem.id);
            if (!existing || new Date(clientItem.updatedAt) > new Date(existing.updatedAt || '1970-01-01')) {
              db.insertOrReplace('tasks', clientItem);
              db.delete('deleted_records', clientItem.id);
            }
          } else if (change.action === 'delete') {
            db.delete('tasks', change.id);
          }
        });
      }

      // Process Milestones
      if (Array.isArray(changes.milestones)) {
        changes.milestones.forEach(change => {
          if (change.action === 'upsert' && change.data) {
            const clientItem = change.data;
            const existing = db.getById('milestones', clientItem.id);
            const clientTs = clientItem.updatedAt || clientItem.createdAt || new Date().toISOString();
            const serverTs = existing ? (existing.updatedAt || existing.createdAt || '1970-01-01') : '1970-01-01';
            if (!existing || new Date(clientTs) > new Date(serverTs)) {
              db.insertOrReplace('milestones', { ...clientItem, updatedAt: clientTs });
              db.delete('deleted_records', clientItem.id);
            }
          } else if (change.action === 'delete') {
            const now = new Date().toISOString();
            db.updateWhere('tasks', task => task.milestoneId === change.id, task => {
              task.milestoneId = '';
              task.updatedAt = now;
            });
            db.delete('milestones', change.id);
          }
        });
      }
    }

    // 2. Return all changes since client's last known revision
    const serverRevision = db.getCurrentRevision();
    const serverChanges = db.getChangesSince(baseRevision);

    res.json({
      serverRevision,
      changes: serverChanges
    });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
