import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const dataDir = process.env.DATA_DIR || './data';
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const getFilePath = (table) => path.join(dataDir, `${table}.json`);
const metaFilePath = path.join(dataDir, 'meta.json');

// --- Revision Counter ---
const loadMeta = () => {
  if (!fs.existsSync(metaFilePath)) {
    return { revision: 0 };
  }
  try {
    return JSON.parse(fs.readFileSync(metaFilePath, 'utf8'));
  } catch (err) {
    return { revision: 0 };
  }
};

const saveMeta = (meta) => {
  fs.writeFileSync(metaFilePath, JSON.stringify(meta, null, 2), 'utf8');
};

let meta = loadMeta();

const nextRevision = () => {
  meta.revision++;
  saveMeta(meta);
  return meta.revision;
};

const getCurrentRevision = () => {
  return meta.revision;
};

// --- Table Read/Write ---
const readTable = (table) => {
  const filePath = getFilePath(table);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`Error reading ${table} file, returning empty array:`, err);
    return [];
  }
};

const writeTable = (table, data) => {
  const filePath = getFilePath(table);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
};

export const db = {
  // Generic CRUD
  getAll(table) {
    return readTable(table);
  },
  
  getById(table, id) {
    return readTable(table).find(item => item.id === id);
  },
  
  getCurrentRevision() {
    return getCurrentRevision();
  },

  insertOrReplace(table, item) {
    const items = readTable(table);
    const rev = nextRevision();
    const index = items.findIndex(x => x.id === item.id);
    if (index >= 0) {
      items[index] = { ...items[index], ...item, _rev: rev };
    } else {
      items.push({ ...item, _rev: rev });
    }
    writeTable(table, items);
    return { ...item, _rev: rev };
  },
  
  delete(table, id) {
    let items = readTable(table);
    const initialLength = items.length;
    items = items.filter(x => x.id !== id);
    writeTable(table, items);
    
    const deletedCount = initialLength - items.length;
    if (deletedCount > 0 && table !== 'deleted_records') {
      // Record deletion for syncing clients, with revision
      const typeMap = {
        'notes': 'note',
        'tasks': 'task',
        'milestones': 'milestone'
      };
      const rev = nextRevision();
      this.insertOrReplace('deleted_records', {
        id,
        type: typeMap[table] || table,
        deletedAt: new Date().toISOString(),
        _rev: rev
      });
    }
    return deletedCount;
  },

  deleteWhere(table, predicate) {
    let items = readTable(table);
    const itemsToDelete = items.filter(predicate);
    if (itemsToDelete.length === 0) return 0;

    const remainingItems = items.filter(x => !predicate(x));
    writeTable(table, remainingItems);

    if (table !== 'deleted_records') {
      const typeMap = {
        'notes': 'note',
        'tasks': 'task',
        'milestones': 'milestone'
      };
      itemsToDelete.forEach(item => {
        const rev = nextRevision();
        this.insertOrReplace('deleted_records', {
          id: item.id,
          type: typeMap[table] || table,
          deletedAt: new Date().toISOString(),
          _rev: rev
        });
      });
    }
    return itemsToDelete.length;
  },

  updateWhere(table, predicate, updater) {
    const items = readTable(table);
    let count = 0;
    items.forEach(item => {
      if (predicate(item)) {
        updater(item);
        item._rev = nextRevision();
        count++;
      }
    });
    if (count > 0) {
      writeTable(table, items);
    }
    return count;
  },

  // Return all records with _rev > sinceRevision across all tables
  getChangesSince(sinceRevision) {
    const notes = readTable('notes').filter(item => (item._rev || 0) > sinceRevision);
    const tasks = readTable('tasks').filter(item => (item._rev || 0) > sinceRevision);
    const milestones = readTable('milestones').filter(item => (item._rev || 0) > sinceRevision);
    const deleted = readTable('deleted_records').filter(item => (item._rev || 0) > sinceRevision);
    return { notes, tasks, milestones, deleted };
  }
};

export default db;
