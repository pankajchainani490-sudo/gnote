import express from 'express';
import db from '../db.js';

const router = express.Router();

// GET /api/tasks
router.get('/', (req, res) => {
  try {
    const tasks = db.getAll('tasks');
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/:id
router.get('/:id', (req, res) => {
  try {
    const task = db.getById('tasks', req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks
router.post('/', (req, res) => {
  try {
    const { id, noteId, text, status, priority, dueDate, milestoneId, createdAt, updatedAt } = req.body;
    if (!id) return res.status(400).json({ error: 'ID is required' });
    const now = new Date().toISOString();
    
    const newTask = {
      id,
      noteId: noteId || '',
      text: text || '',
      status: status || 'todo',
      priority: priority || 'P2',
      dueDate: dueDate || '',
      milestoneId: milestoneId || '',
      createdAt: createdAt || now,
      updatedAt: updatedAt || now
    };
    
    db.insertOrReplace('tasks', newTask);
    res.status(201).json(newTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tasks/:id
router.put('/:id', (req, res) => {
  try {
    const { noteId, text, status, priority, dueDate, milestoneId, updatedAt } = req.body;
    const task = db.getById('tasks', req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const updatedTask = {
      ...task,
      noteId: noteId !== undefined ? noteId : task.noteId,
      text: text !== undefined ? text : task.text,
      status: status !== undefined ? status : task.status,
      priority: priority !== undefined ? priority : task.priority,
      dueDate: dueDate !== undefined ? dueDate : task.dueDate,
      milestoneId: milestoneId !== undefined ? milestoneId : task.milestoneId,
      updatedAt: updatedAt || new Date().toISOString()
    };
    
    db.insertOrReplace('tasks', updatedTask);
    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', (req, res) => {
  try {
    const taskId = req.params.id;
    const task = db.getById('tasks', taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    db.delete('tasks', taskId);
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
