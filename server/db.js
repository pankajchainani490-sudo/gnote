import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const dataDir = process.env.DATA_DIR || './data';
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const getFilePath = (table) => path.join(dataDir, `${table}.json`);

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
  
  insertOrReplace(table, item) {
    const items = readTable(table);
    const index = items.findIndex(x => x.id === item.id);
    if (index >= 0) {
      items[index] = { ...items[index], ...item };
    } else {
      items.push(item);
    }
    writeTable(table, items);
    return item;
  },
  
  delete(table, id) {
    let items = readTable(table);
    const initialLength = items.length;
    items = items.filter(x => x.id !== id);
    writeTable(table, items);
    
    const deletedCount = initialLength - items.length;
    if (deletedCount > 0 && table !== 'deleted_records') {
      // Record deletion for syncing clients
      const typeMap = {
        'notes': 'note',
        'tasks': 'task',
        'milestones': 'milestone'
      };
      this.insertOrReplace('deleted_records', {
        id,
        type: typeMap[table] || table,
        deletedAt: new Date().toISOString()
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
      const deletedAt = new Date().toISOString();
      itemsToDelete.forEach(item => {
        this.insertOrReplace('deleted_records', {
          id: item.id,
          type: typeMap[table] || table,
          deletedAt
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
        count++;
      }
    });
    if (count > 0) {
      writeTable(table, items);
    }
    return count;
  }
};

export default db;
