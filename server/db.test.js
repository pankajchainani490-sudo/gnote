import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import db from './db.js';

test('JSON File DB Tests', async (t) => {
  // Use a temporary test directory for database files
  const testDataDir = './test-data';
  process.env.DATA_DIR = testDataDir;

  await t.test('Insert and Get Note', () => {
    const note = {
      id: 'test_n1',
      title: 'Test Note',
      content: '<p>Hello</p>',
      tags: ['test'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    db.insertOrReplace('notes', note);
    const retrieved = db.getById('notes', 'test_n1');
    assert.deepEqual(retrieved, note);
  });

  await t.test('Update Note', () => {
    const updated = {
      id: 'test_n1',
      title: 'Updated Test Note',
      content: '<p>Hello World</p>',
      tags: ['test', 'updated'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    db.insertOrReplace('notes', updated);
    const retrieved = db.getById('notes', 'test_n1');
    assert.equal(retrieved.title, 'Updated Test Note');
    assert.equal(retrieved.content, '<p>Hello World</p>');
    assert.deepEqual(retrieved.tags, ['test', 'updated']);
  });

  await t.test('Delete Note and cascade delete tasks', () => {
    // Add a task
    const task = {
      id: 'test_t1',
      noteId: 'test_n1',
      text: 'Test task',
      status: 'todo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.insertOrReplace('tasks', task);
    
    // Delete note and associated tasks (replicate notes route delete logic)
    db.deleteWhere('tasks', t => t.noteId === 'test_n1');
    db.delete('notes', 'test_n1');
    
    const retrievedNote = db.getById('notes', 'test_n1');
    const retrievedTask = db.getById('tasks', 'test_t1');
    
    assert.equal(retrievedNote, undefined);
    assert.equal(retrievedTask, undefined);
    
    // Check deleted_records
    const deletedRecords = db.getAll('deleted_records');
    const noteDeleted = deletedRecords.some(r => r.id === 'test_n1' && r.type === 'note');
    const taskDeleted = deletedRecords.some(r => r.id === 'test_t1' && r.type === 'task');
    
    assert.ok(noteDeleted);
    assert.ok(taskDeleted);
  });

  // Cleanup test-data directory
  try {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  } catch (e) {
    console.error('Failed to cleanup test data:', e);
  }
});
