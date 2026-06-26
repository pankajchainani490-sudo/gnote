import express from 'express';
import db from '../db.js';

const router = express.Router();

// GET /api/notes
router.get('/', (req, res) => {
  try {
    const notes = db.getAll('notes');
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notes/:id
router.get('/:id', (req, res) => {
  try {
    const note = db.getById('notes', req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notes
router.post('/', (req, res) => {
  try {
    const { id, title, content, tags, createdAt, updatedAt } = req.body;
    if (!id) return res.status(400).json({ error: 'ID is required' });
    const now = new Date().toISOString();
    
    const newNote = {
      id,
      title: title || '',
      content: content || '',
      tags: tags || [],
      createdAt: createdAt || now,
      updatedAt: updatedAt || now
    };
    
    db.insertOrReplace('notes', newNote);
    res.status(201).json(newNote);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notes/:id
router.put('/:id', (req, res) => {
  try {
    const { title, content, tags, updatedAt } = req.body;
    const note = db.getById('notes', req.params.id);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    const updatedNote = {
      ...note,
      title: title !== undefined ? title : note.title,
      content: content !== undefined ? content : note.content,
      tags: tags !== undefined ? tags : note.tags,
      updatedAt: updatedAt || new Date().toISOString()
    };
    
    db.insertOrReplace('notes', updatedNote);
    res.json(updatedNote);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notes/:id
router.delete('/:id', (req, res) => {
  try {
    const noteId = req.params.id;
    const note = db.getById('notes', noteId);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    // Delete associated tasks
    db.deleteWhere('tasks', task => task.noteId === noteId);
    
    // Delete note
    db.delete('notes', noteId);
    
    res.json({ message: 'Note and its tasks deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
