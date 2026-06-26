import express from 'express';
import db from '../db.js';

const router = express.Router();

// GET /api/milestones
router.get('/', (req, res) => {
  try {
    const milestones = db.getAll('milestones');
    res.json(milestones);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/milestones/:id
router.get('/:id', (req, res) => {
  try {
    const milestone = db.getById('milestones', req.params.id);
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });
    res.json(milestone);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/milestones
router.post('/', (req, res) => {
  try {
    const { id, title, description, startDate, dueDate, status, createdAt, updatedAt } = req.body;
    if (!id) return res.status(400).json({ error: 'ID is required' });
    const now = new Date().toISOString();
    
    const newMilestone = {
      id,
      title: title || '',
      description: description || '',
      startDate: startDate || '',
      dueDate: dueDate || '',
      status: status || 'pending',
      createdAt: createdAt || now,
      updatedAt: updatedAt || now
    };
    
    db.insertOrReplace('milestones', newMilestone);
    res.status(201).json(newMilestone);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/milestones/:id
router.put('/:id', (req, res) => {
  try {
    const { title, description, startDate, dueDate, status, updatedAt } = req.body;
    const milestone = db.getById('milestones', req.params.id);
    if (!milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }
    
    const updatedMilestone = {
      ...milestone,
      title: title !== undefined ? title : milestone.title,
      description: description !== undefined ? description : milestone.description,
      startDate: startDate !== undefined ? startDate : milestone.startDate,
      dueDate: dueDate !== undefined ? dueDate : milestone.dueDate,
      status: status !== undefined ? status : milestone.status,
      updatedAt: updatedAt || new Date().toISOString()
    };
    
    db.insertOrReplace('milestones', updatedMilestone);
    res.json(updatedMilestone);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/milestones/:id
router.delete('/:id', (req, res) => {
  try {
    const milestoneId = req.params.id;
    const milestone = db.getById('milestones', milestoneId);
    if (!milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }
    
    const now = new Date().toISOString();
    
    // Unlink associated tasks and set their updatedAt
    db.updateWhere('tasks', task => task.milestoneId === milestoneId, task => {
      task.milestoneId = '';
      task.updatedAt = now;
    });
    
    // Delete milestone
    db.delete('milestones', milestoneId);
    
    res.json({ message: 'Milestone deleted successfully and tasks unlinked' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
