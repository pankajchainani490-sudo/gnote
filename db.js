// db.js - LocalStorage Database for NoteFlow (WYSIWYG Rich Text Version)

const DB_KEY_NOTES = 'noteflow_notes_v4';
const DB_KEY_TASKS = 'noteflow_tasks_v4';
const DB_KEY_MILESTONES = 'noteflow_milestones_v4';

let changeListener = null;

// Helper to generate UUIDs
function generateId() {
  return 'id_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
}

// Initial Sample Data in Rich HTML format
const SAMPLE_MILESTONES = [
  {
    id: 'm_1',
    title: '极简版 v1.0 发布',
    description: '完成基本富文本记录与任务同步，完成核心看板功能。',
    startDate: '2026-06-20',
    dueDate: '2026-07-10',
    status: 'active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'm_2',
    title: '视觉设计迭代与移动端优化',
    description: '升级整体 UI 动效，适配移动端浏览器，增加深色模式。',
    startDate: '2026-07-11',
    dueDate: '2026-07-25',
    status: 'active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'm_3',
    title: '数据洞察与自动化周报',
    description: '设计更精美的数据折线图和工作热力图，支持周报一键导出。',
    startDate: '2026-07-26',
    dueDate: '2026-08-15',
    status: 'pending',
    createdAt: new Date().toISOString()
  }
];

const SAMPLE_NOTES = [
  {
    id: 'n_1',
    title: 'NoteFlow 产品灵感与设计原则',
    content: `<h1>NoteFlow 产品灵感与设计原则</h1>
<p>这是我们在 2026 年夏天开启的项目。我们希望它足够轻量，但又能真正连接“输入”与“产出”。</p>
<h2>核心设计哲学</h2>
<blockquote><strong>白色极简</strong>：不要刺眼的五彩斑斓，只要精致的排版和清爽的呼吸感。<br><strong>无感同步</strong>：在笔记里随手写下的待办，就应该是系统的任务，不需要再手动去建任务卡片。</blockquote>
<h2>待办清单</h2>
<div class="editor-task-line task-completed" data-id="t_init_1">
  <input type="checkbox" class="editor-task-checkbox" data-id="t_init_1" checked="checked">
  <span class="editor-task-text" data-id="t_init_1">设计极简白色风格的主界面</span>
</div>
<div class="editor-task-line task-doing" data-id="t_init_2">
  <input type="checkbox" class="editor-task-checkbox" data-id="t_init_2">
  <span class="editor-task-text" data-id="t_init_2">实现笔记与任务的双向同步机制</span>
</div>
<div class="editor-task-line" data-id="t_init_3">
  <input type="checkbox" class="editor-task-checkbox" data-id="t_init_3">
  <span class="editor-task-text" data-id="t_init_3">编写原生 SVG 动效与洞察图表</span>
</div>
<div class="editor-task-line" data-id="t_init_4">
  <input type="checkbox" class="editor-task-checkbox" data-id="t_init_4">
  <span class="editor-task-text" data-id="t_init_4">设计精美的里程碑时间线组件</span>
</div>
<p>每一个小小的勾选，都会实时反映在我们的数据大盘上。</p>`,
    tags: ['产品', '灵感'],
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'n_2',
    title: '个人周记：2026-W26',
    content: `<h1>个人周记：2026-W26</h1>
<p>本周重点是完成 NoteFlow 的核心概念验证。</p>
<h2>工作总结</h2>
<ul>
  <li>本周主要在梳理产品规划书，并在实现计划中设计了极简的视觉方案。</li>
  <li>LocalStorage 作为第一版的底层存储方案，对用户数据隐私友好。</li>
</ul>
<h2>下周工作计划</h2>
<div class="editor-task-line" data-id="t_init_5">
  <input type="checkbox" class="editor-task-checkbox" data-id="t_init_5">
  <span class="editor-task-text" data-id="t_init_5">部署静态原型到本地服务进行全功能测试</span>
</div>
<div class="editor-task-line" data-id="t_init_6">
  <input type="checkbox" class="editor-task-checkbox" data-id="t_init_6">
  <span class="editor-task-text" data-id="t_init_6">邀请两位朋友进行可用性测试</span>
</div>
<div class="editor-task-line" data-id="t_init_7">
  <input type="checkbox" class="editor-task-checkbox" data-id="t_init_7">
  <span class="editor-task-text" data-id="t_init_7">修复可能存在的 Markdown 解析边缘情况</span>
</div>`,
    tags: ['生活', '周记'],
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  }
];

const SAMPLE_TASKS = [
  {
    id: 't_init_1',
    noteId: 'n_1',
    text: '设计极简白色风格的主界面',
    status: 'done',
    priority: 'P0',
    dueDate: '2026-06-24',
    milestoneId: 'm_1',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 't_init_2',
    noteId: 'n_1',
    text: '实现笔记与任务的双向同步机制',
    status: 'doing',
    priority: 'P0',
    dueDate: '2026-06-27',
    milestoneId: 'm_1',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 't_init_3',
    noteId: 'n_1',
    text: '编写原生 SVG 动效与洞察图表',
    status: 'todo',
    priority: 'P1',
    dueDate: '2026-06-30',
    milestoneId: 'm_1',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 't_init_4',
    noteId: 'n_1',
    text: '设计精美的里程碑时间线组件',
    status: 'todo',
    priority: 'P2',
    dueDate: '2026-07-05',
    milestoneId: 'm_1',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 't_init_5',
    noteId: 'n_2',
    text: '部署静态原型到本地服务进行全功能测试',
    status: 'todo',
    priority: 'P1',
    dueDate: '2026-06-29',
    milestoneId: 'm_2',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 't_init_6',
    noteId: 'n_2',
    text: '邀请两位朋友进行可用性测试',
    status: 'todo',
    priority: 'P3',
    dueDate: '2026-07-03',
    milestoneId: 'm_2',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 't_init_7',
    noteId: 'n_2',
    text: '修复可能存在的 Markdown 解析边缘情况',
    status: 'todo',
    priority: 'P2',
    dueDate: '2026-07-01',
    milestoneId: 'm_2',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Helper to load/save
function load(key, defaultValue) {
  const data = localStorage.getItem(key);
  if (!data) {
    // Attempt migration from v3 keys
    const v3Key = key.replace('_v4', '_v3');
    const v3Data = localStorage.getItem(v3Key);
    if (v3Data) {
      console.log(`Migrating data from ${v3Key} to ${key}`);
      localStorage.setItem(key, v3Data);
      try {
        return JSON.parse(v3Data);
      } catch (e) {
        return defaultValue;
      }
    }
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to parse storage key: ' + key, e);
    return defaultValue;
  }
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

export const db = {
  setChangeListener(listener) {
    changeListener = listener;
  },

  replaceAll(notes, tasks, milestones) {
    save(DB_KEY_NOTES, notes);
    save(DB_KEY_TASKS, tasks);
    save(DB_KEY_MILESTONES, milestones);
  },

  // --- NOTES API ---
  getNotes() {
    return load(DB_KEY_NOTES, SAMPLE_NOTES);
  },

  getNote(id) {
    return this.getNotes().find(n => n.id === id);
  },

  saveNote(note) {
    const notes = this.getNotes();
    const index = notes.findIndex(n => n.id === note.id);
    const now = new Date().toISOString();
    
    // Process HTML content to extract and synchronize tasks
    const { updatedContent, extractedTasks } = this._parseAndSyncNoteTasks(note.id, note.content);
    note.content = updatedContent;
    
    if (index >= 0) {
      notes[index] = { ...notes[index], ...note, updatedAt: now };
      note = notes[index];
    } else {
      note.id = note.id || generateId();
      note.createdAt = now;
      note.updatedAt = now;
      notes.push(note);
    }
    
    save(DB_KEY_NOTES, notes);
    this._saveSyncedTasks(note.id, extractedTasks);
    
    if (changeListener) {
      changeListener('notes', 'upsert', note);
    }
    
    return note;
  },

  deleteNote(id) {
    let notes = this.getNotes();
    notes = notes.filter(n => n.id !== id);
    save(DB_KEY_NOTES, notes);
    
    if (changeListener) {
      changeListener('notes', 'delete', id);
    }
    
    // Delete associated tasks
    let tasks = this.getTasks();
    tasks = tasks.filter(t => {
      if (t.noteId === id) {
        if (changeListener) changeListener('tasks', 'delete', t.id);
        return false;
      }
      return true;
    });
    save(DB_KEY_TASKS, tasks);
  },

  // --- TASKS API ---
  getTasks() {
    return load(DB_KEY_TASKS, SAMPLE_TASKS);
  },

  getTask(id) {
    return this.getTasks().find(t => t.id === id);
  },

  saveTask(task) {
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === task.id);
    const now = new Date().toISOString();
    
    if (index >= 0) {
      const oldTask = tasks[index];
      tasks[index] = { ...oldTask, ...task, updatedAt: now };
      task = tasks[index];
      
      // If task status or text changed, sync it back to the Note content!
      if (oldTask.status !== task.status || oldTask.text !== task.text) {
        this._syncTaskToNote(tasks[index]);
      }
    } else {
      task.id = task.id || generateId();
      task.createdAt = now;
      task.updatedAt = now;
      tasks.push(task);
    }
    
    save(DB_KEY_TASKS, tasks);
    
    if (changeListener) {
      changeListener('tasks', 'upsert', task);
    }
    
    return task;
  },

  deleteTask(id) {
    let tasks = this.getTasks();
    const taskToDelete = tasks.find(t => t.id === id);
    tasks = tasks.filter(t => t.id !== id);
    save(DB_KEY_TASKS, tasks);

    if (changeListener) {
      changeListener('tasks', 'delete', id);
    }

    // Remove task from corresponding note content
    if (taskToDelete && taskToDelete.noteId) {
      this._removeTaskFromNoteContent(taskToDelete.noteId, id);
    }
  },

  // --- MILESTONES API ---
  getMilestones() {
    return load(DB_KEY_MILESTONES, SAMPLE_MILESTONES);
  },

  getMilestone(id) {
    return this.getMilestones().find(m => m.id === id);
  },

  saveMilestone(milestone) {
    const milestones = this.getMilestones();
    const index = milestones.findIndex(m => m.id === milestone.id);
    const now = new Date().toISOString();
    
    if (index >= 0) {
      milestones[index] = { ...milestones[index], ...milestone, updatedAt: now };
      milestone = milestones[index];
    } else {
      milestone.id = milestone.id || 'm_' + generateId();
      milestone.createdAt = now;
      milestone.updatedAt = now;
      milestones.push(milestone);
    }
    
    save(DB_KEY_MILESTONES, milestones);
    
    if (changeListener) {
      changeListener('milestones', 'upsert', milestone);
    }
    
    return milestone;
  },

  deleteMilestone(id) {
    let milestones = this.getMilestones();
    milestones = milestones.filter(m => m.id !== id);
    save(DB_KEY_MILESTONES, milestones);

    if (changeListener) {
      changeListener('milestones', 'delete', id);
    }

    // Disassociate tasks
    const tasks = this.getTasks();
    tasks.forEach(t => {
      if (t.milestoneId === id) {
        t.milestoneId = '';
        this.saveTask(t);
      }
    });
  },

  // --- PRIVATE TASK ENGINE LOGIC (WYSIWYG VERSION) ---

  // Parse HTML string, sync task element IDs, extract tasks list
  _parseAndSyncNoteTasks(noteId, htmlContent) {
    if (!htmlContent) return { updatedContent: '', extractedTasks: [] };
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const taskLines = doc.querySelectorAll('.editor-task-line');
    const extractedTasks = [];

    taskLines.forEach(line => {
      let id = line.getAttribute('data-id');
      const checkbox = line.querySelector('.editor-task-checkbox');
      const textSpan = line.querySelector('.editor-task-text');

      if (!id) {
        id = 't_' + Math.random().toString(36).substr(2, 5) + '_' + Date.now().toString(36).substr(-4);
        line.setAttribute('data-id', id);
      }

      if (checkbox) {
        checkbox.setAttribute('data-id', id);
      }
      if (textSpan) {
        textSpan.setAttribute('data-id', id);
      }

      const text = textSpan ? textSpan.innerText.trim() : line.innerText.replace(/☑️|☐|\[\s*\]/g, '').trim();
      const isChecked = checkbox ? checkbox.checked : line.classList.contains('task-completed');
      
      let status = isChecked ? 'done' : 'todo';
      if (line.classList.contains('task-doing')) status = 'doing';
      else if (line.classList.contains('task-abandoned')) status = 'abandoned';

      extractedTasks.push({
        id,
        noteId,
        text: text || '待办任务',
        status
      });
    });

    return {
      updatedContent: doc.body.innerHTML,
      extractedTasks
    };
  },

  // Save extracted tasks, remove those deleted from editor HTML
  _saveSyncedTasks(noteId, currentExtractedTasks) {
    let allTasks = this.getTasks();
    const currentMap = new Map(currentExtractedTasks.map(t => [t.id, t]));

    // Filter out deleted tasks and log deletions
    allTasks = allTasks.filter(t => {
      if (t.noteId !== noteId) return true;
      const isKept = currentMap.has(t.id);
      if (!isKept) {
        if (changeListener) changeListener('tasks', 'delete', t.id);
      }
      return isKept;
    });

    currentExtractedTasks.forEach(extracted => {
      const existingIdx = allTasks.findIndex(t => t.id === extracted.id);
      if (existingIdx >= 0) {
        const updatedTask = {
          ...allTasks[existingIdx],
          text: extracted.text,
          status: extracted.status,
          updatedAt: new Date().toISOString()
        };
        allTasks[existingIdx] = updatedTask;
        if (changeListener) changeListener('tasks', 'upsert', updatedTask);
      } else {
        const newTask = {
          ...extracted,
          priority: 'P2',
          dueDate: '',
          milestoneId: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        allTasks.push(newTask);
        if (changeListener) changeListener('tasks', 'upsert', newTask);
      }
    });

    save(DB_KEY_TASKS, allTasks);
  },

  // Sync state back to HTML content of the Note
  _syncTaskToNote(task) {
    if (!task.noteId) return;

    const notes = this.getNotes();
    const noteIdx = notes.findIndex(n => n.id === task.noteId);
    if (noteIdx < 0) return;

    const note = notes[noteIdx];
    const parser = new DOMParser();
    const doc = parser.parseFromString(note.content, 'text/html');
    const taskLine = doc.querySelector(`.editor-task-line[data-id="${task.id}"]`);

    if (taskLine) {
      const checkbox = taskLine.querySelector('.editor-task-checkbox');
      const textSpan = taskLine.querySelector('.editor-task-text');

      if (checkbox) {
        checkbox.checked = task.status === 'done';
        if (task.status === 'done') {
          checkbox.setAttribute('checked', 'checked');
        } else {
          checkbox.removeAttribute('checked');
        }
      }

      if (textSpan) {
        textSpan.innerText = task.text;
      }

      taskLine.classList.remove('task-completed', 'task-doing', 'task-abandoned');
      if (task.status === 'done') {
        taskLine.classList.add('task-completed');
      } else if (task.status === 'doing') {
        taskLine.classList.add('task-doing');
      } else if (task.status === 'abandoned') {
        taskLine.classList.add('task-abandoned');
      }

      note.content = doc.body.innerHTML;
      note.updatedAt = new Date().toISOString();
      notes[noteIdx] = note;
      save(DB_KEY_NOTES, notes);
    }
  },

  // Remove task DOM node from Note content
  _removeTaskFromNoteContent(noteId, taskId) {
    const notes = this.getNotes();
    const noteIdx = notes.findIndex(n => n.id === noteId);
    if (noteIdx < 0) return;

    const note = notes[noteIdx];
    const parser = new DOMParser();
    const doc = parser.parseFromString(note.content, 'text/html');
    const taskLine = doc.querySelector(`.editor-task-line[data-id="${taskId}"]`);

    if (taskLine) {
      taskLine.remove();
      note.content = doc.body.innerHTML;
      note.updatedAt = new Date().toISOString();
      notes[noteIdx] = note;
      save(DB_KEY_NOTES, notes);
    }
  }
};
