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
    assert.equal(retrieved.id, note.id);
    assert.equal(retrieved.title, note.title);
    assert.equal(retrieved.content, note.content);
    assert.ok(typeof retrieved._rev === 'number', '_rev should be a number');
    assert.ok(retrieved._rev > 0, '_rev should be positive');
  });

  await t.test('Update Note increments revision', () => {
    const before = db.getById('notes', 'test_n1');
    const beforeRev = before._rev;

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
    assert.ok(retrieved._rev > beforeRev, 'revision should increment on update');
  });

  await t.test('getChangesSince returns only newer records', () => {
    const revBefore = db.getCurrentRevision();
    
    db.insertOrReplace('tasks', {
      id: 'test_t_new',
      text: 'A new task',
      status: 'todo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const changes = db.getChangesSince(revBefore);
    assert.ok(changes.tasks.length >= 1, 'should return newly inserted task');
    assert.ok(changes.tasks.some(t => t.id === 'test_t_new'));
    
    // Notes inserted before revBefore should not appear
    assert.equal(changes.notes.length, 0, 'notes inserted earlier should not appear');
    
    // Cleanup
    db.delete('tasks', 'test_t_new');
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
    
    // Check that deleted records also have _rev
    const noteDeletedRec = deletedRecords.find(r => r.id === 'test_n1');
    assert.ok(typeof noteDeletedRec._rev === 'number', 'deleted record should have _rev');
  });

  // Cleanup test-data directory
  try {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  } catch (e) {
    console.error('Failed to cleanup test data:', e);
  }
});
