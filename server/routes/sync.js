import express from 'express';
import db from '../db.js';

const router = express.Router();

router.post('/', (req, res) => {
  try {
    const { lastSyncAt, changes } = req.body;
    
    // 1. Process client changes
    if (changes) {
      // Process Notes
      if (Array.isArray(changes.notes)) {
        changes.notes.forEach(change => {
          if (change.action === 'upsert') {
            const clientNote = change.data;
            const existingNote = db.getById('notes', clientNote.id);
            if (!existingNote || new Date(clientNote.updatedAt) >= new Date(existingNote.updatedAt)) {
              db.insertOrReplace('notes', clientNote);
              db.delete('deleted_records', clientNote.id); // Remove from deleted list if resurrected
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
          if (change.action === 'upsert') {
            const clientTask = change.data;
            const existingTask = db.getById('tasks', clientTask.id);
            if (!existingTask || new Date(clientTask.updatedAt) >= new Date(existingTask.updatedAt)) {
              db.insertOrReplace('tasks', clientTask);
              db.delete('deleted_records', clientTask.id); // Remove from deleted list if resurrected
            }
          } else if (change.action === 'delete') {
            db.delete('tasks', change.id);
          }
        });
      }

      // Process Milestones
      if (Array.isArray(changes.milestones)) {
        changes.milestones.forEach(change => {
          if (change.action === 'upsert') {
            const clientMilestone = change.data;
            const existingMilestone = db.getById('milestones', clientMilestone.id);
            const clientUpdatedAt = clientMilestone.updatedAt || clientMilestone.createdAt || new Date().toISOString();
            const existingUpdatedAt = existingMilestone ? (existingMilestone.updatedAt || existingMilestone.createdAt || '1970-01-01T00:00:00.000Z') : '1970-01-01T00:00:00.000Z';
            
            if (!existingMilestone || new Date(clientUpdatedAt) >= new Date(existingUpdatedAt)) {
              db.insertOrReplace('milestones', {
                ...clientMilestone,
                updatedAt: clientUpdatedAt
              });
              db.delete('deleted_records', clientMilestone.id); // Remove from deleted list if resurrected
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

    // 2. Fetch server changes since lastSyncAt
    const lastSyncDate = lastSyncAt ? new Date(lastSyncAt) : new Date(0);
    const syncTime = new Date().toISOString();

    const notes = db.getAll('notes').filter(item => new Date(item.updatedAt || item.createdAt) > lastSyncDate);
    const tasks = db.getAll('tasks').filter(item => new Date(item.updatedAt || item.createdAt) > lastSyncDate);
    const milestones = db.getAll('milestones').filter(item => new Date(item.updatedAt || item.createdAt || 0) > lastSyncDate);
    const deleted = db.getAll('deleted_records').filter(item => new Date(item.deletedAt) > lastSyncDate);

    res.json({
      syncAt: syncTime,
      changes: {
        notes,
        tasks,
        milestones,
        deleted
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
