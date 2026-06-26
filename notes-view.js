// notes-view.js - WYSIWYG Rich Text Editor View with Real-time Todo Sync & Floating Toolbar

let currentDb = null;
let activeNoteId = null;
let saveTimeout = null;

export const NotesView = {
  init(dbInstance) {
    currentDb = dbInstance;

    // Bind floating toolbar buttons
    const floatingButtons = document.querySelectorAll('.floating-toolbar .toolbar-btn[data-cmd]');
    floatingButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const cmd = btn.dataset.cmd;
        const val = btn.dataset.val || null;
        
        if (cmd === 'fontSize') {
          // Double click / 二次点击撤销字号: if current size is same as clicked size, restore to normal (size 3)
          const currentSize = document.queryCommandValue('fontSize');
          if (currentSize === val) {
            document.execCommand('fontSize', false, '3');
          } else {
            document.execCommand('fontSize', false, '5'); // Default large mapping
            document.execCommand('fontSize', false, val);
          }
        } else if (cmd === 'justifyCenter' || cmd === 'justifyRight') {
          // Double click / 二次点击对齐: if already centered or right aligned, restore to left alignment
          const isActive = document.queryCommandState(cmd);
          if (isActive) {
            document.execCommand('justifyLeft', false, null);
          } else {
            document.execCommand(cmd, false, null);
          }
        } else {
          // Bold, italic, underline, strikeThrough, insertUnorderedList natively toggle on/off
          document.execCommand(cmd, false, val);
        }
        
        // Restore focus to editor
        document.getElementById('rich-editor').focus();
        this.saveCurrentNote();
        
        // Hide toolbar after formatting
        document.getElementById('floating-toolbar').classList.add('hidden');
      });
    });

    // Bind custom todo button in floating toolbar (supports toggle restore)
    document.getElementById('btn-toolbar-todo').addEventListener('click', (e) => {
      e.preventDefault();
      this.insertTodoBlock();
    });

    // Selection monitoring to pop up floating toolbar
    document.addEventListener('selectionchange', () => this.handleSelectionChange());

    // Hide toolbar when clicking outside editor
    const editor = document.getElementById('rich-editor');
    document.addEventListener('mousedown', (e) => {
      const toolbar = document.getElementById('floating-toolbar');
      if (!toolbar.contains(e.target) && !editor.contains(e.target)) {
        toolbar.classList.add('hidden');
      }
    });

    // Hide toolbar when scrolling editor container
    const editorWrapper = document.querySelector('.rich-editor-wrapper');
    if (editorWrapper) {
      editorWrapper.addEventListener('scroll', () => {
        document.getElementById('floating-toolbar').classList.add('hidden');
      });
    }

    // Bind Note buttons
    document.getElementById('btn-new-note').addEventListener('click', () => this.createNewNote());
    document.getElementById('btn-create-first-note').addEventListener('click', () => this.createNewNote());
    document.getElementById('btn-delete-note').addEventListener('click', () => this.deleteCurrentNote());
    document.getElementById('search-notes').addEventListener('input', (e) => this.renderList(e.target.value));

    // Editor Auto-save on Input
    editor.addEventListener('input', () => {
      this.showSaveStatus('修改中...');
      
      // Auto-save debounce (1s)
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        this.saveCurrentNote();
      }, 1000);
    });

    // Handle clicks inside contenteditable (checking task boxes)
    editor.addEventListener('click', (e) => {
      if (e.target.classList.contains('editor-task-checkbox')) {
        const checkbox = e.target;
        const taskLine = checkbox.closest('.editor-task-line');
        if (taskLine) {
          taskLine.classList.toggle('task-completed', checkbox.checked);
          if (checkbox.checked) {
            checkbox.setAttribute('checked', 'checked');
          } else {
            checkbox.removeAttribute('checked');
          }
          this.saveCurrentNote();
        }
      }
    });

    // Save on title changes
    document.getElementById('note-title').addEventListener('input', () => {
      this.showSaveStatus('修改中...');
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        this.saveCurrentNote();
      }, 1000);
    });

    // Tag adding
    const tagInput = document.getElementById('add-tag-input');
    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && tagInput.value.trim()) {
        this.addTag(tagInput.value.trim());
        tagInput.value = '';
      }
    });

    // --- BIND COLLAPSIBLE EDGE HANDLERS ---

    // 1. Notes List Sidebar Edge Handle (Vertical center 60%, handles collapse & expand)
    document.getElementById('handle-toggle-notes').addEventListener('click', () => {
      const notesSidebar = document.getElementById('notes-list-sidebar');
      notesSidebar.classList.toggle('collapsed');
      const isCollapsed = notesSidebar.classList.contains('collapsed');
      document.querySelector('#handle-toggle-notes .handle-arrow').innerText = isCollapsed ? '▶' : '◀';
    });

    // 3. Today's Focus collapse
    document.getElementById('btn-toggle-today').addEventListener('click', () => {
      const todayCard = document.getElementById('today-focus-card');
      todayCard.classList.toggle('collapsed');
      const isCollapsed = todayCard.classList.contains('collapsed');
      document.getElementById('btn-toggle-today').innerText = isCollapsed ? '▼' : '◀';
    });

    // 4. Gantt Timeline collapse
    document.getElementById('btn-toggle-gantt').addEventListener('click', () => {
      const ganttSection = document.querySelector('.gantt-section');
      ganttSection.classList.toggle('collapsed');
      const isCollapsed = ganttSection.classList.contains('collapsed');
      document.getElementById('btn-toggle-gantt').innerText = isCollapsed ? '▼' : '◀';
    });

    this.renderList();
  },

  handleSelectionChange() {
    const selection = window.getSelection();
    const toolbar = document.getElementById('floating-toolbar');
    const editor = document.getElementById('rich-editor');

    if (!activeNoteId || selection.isCollapsed) {
      toolbar.classList.add('hidden');
      return;
    }

    // Check if selection is within the rich editor boundaries
    let node = selection.anchorNode;
    let isInsideEditor = false;
    while (node) {
      if (node === editor) {
        isInsideEditor = true;
        break;
      }
      node = node.parentNode;
    }

    if (!isInsideEditor) {
      toolbar.classList.add('hidden');
      return;
    }

    // Position the toolbar
    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      if (rect.width === 0 || rect.height === 0) {
        toolbar.classList.add('hidden');
        return;
      }

      // Show toolbar first to get offsetHeight correctly computed by browser
      toolbar.classList.remove('hidden');
      const toolbarHeight = toolbar.offsetHeight || 38;
      
      toolbar.style.top = `${rect.top - toolbarHeight}px`;
      toolbar.style.left = `${rect.left + rect.width / 2}px`;
    } catch (e) {
      toolbar.classList.add('hidden');
    }
  },

  renderList(searchQuery = '') {
    const notes = currentDb.getNotes();
    const container = document.getElementById('notes-list-container');
    container.innerHTML = '';

    const filtered = notes.filter(note => {
      const query = searchQuery.toLowerCase();
      const matchTitle = note.title.toLowerCase().includes(query);
      const matchContent = note.content.toLowerCase().includes(query);
      const matchTags = note.tags.some(tag => tag.toLowerCase().includes(query));
      return matchTitle || matchContent || matchTags;
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">无符合条件的笔记</div>`;
      return;
    }

    filtered.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    filtered.forEach(note => {
      const item = document.createElement('div');
      item.className = `note-item ${note.id === activeNoteId ? 'active' : ''}`;
      
      const cleanExcerpt = note.content
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const date = new Date(note.updatedAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
      const tagBadges = note.tags.map(tag => `<span class="tag-badge">${tag}</span>`).join('');

      item.innerHTML = `
        <div class="note-item-title">${note.title || '无标题笔记'}</div>
        <div class="note-item-excerpt">${cleanExcerpt || '还没有内容...'}</div>
        <div class="note-item-meta">
          <span>${date}</span>
          <div class="note-item-tags">${tagBadges}</div>
        </div>
      `;

      item.addEventListener('click', () => this.loadNote(note.id));
      container.appendChild(item);
    });
  },

  loadNote(id) {
    activeNoteId = id;
    const note = currentDb.getNote(id);
    if (!note) return;

    document.getElementById('editor-empty-state').classList.add('hidden');
    document.getElementById('editor-active-state').classList.remove('hidden');

    document.getElementById('note-title').value = note.title;
    document.getElementById('rich-editor').innerHTML = note.content;
    
    this.renderTags(note.tags);
    this.showSaveStatus('已保存');

    const items = document.querySelectorAll('.note-item');
    items.forEach(item => item.classList.remove('active'));
    this.renderList(document.getElementById('search-notes').value);
  },

  createNewNote() {
    const newNote = {
      title: '无标题',
      content: '',
      tags: []
    };
    const saved = currentDb.saveNote(newNote);
    this.loadNote(saved.id);
  },

  deleteCurrentNote() {
    if (!activeNoteId) return;
    if (confirm('确认删除此笔记吗？这也会删除笔记中关联的全部任务。')) {
      currentDb.deleteNote(activeNoteId);
      activeNoteId = null;
      document.getElementById('editor-active-state').classList.add('hidden');
      document.getElementById('editor-empty-state').classList.remove('hidden');
      this.renderList();
      window.dispatchEvent(new Event('data-updated'));
    }
  },

  saveCurrentNote() {
    if (!activeNoteId) return;
    const title = document.getElementById('note-title').value.trim() || '无标题笔记';
    
    let content = document.getElementById('rich-editor').innerHTML;
    content = this._formatWikiLinks(content);
    
    const note = currentDb.getNote(activeNoteId);
    note.title = title;
    note.content = content;
    
    const saved = currentDb.saveNote(note);
    
    if (document.getElementById('rich-editor').innerHTML !== saved.content) {
      const selection = window.getSelection();
      let savedRange = null;
      if (selection.rangeCount > 0) {
        savedRange = selection.getRangeAt(0).cloneRange();
      }
      
      document.getElementById('rich-editor').innerHTML = saved.content;
      
      if (savedRange) {
        try {
          selection.removeAllRanges();
          selection.addRange(savedRange);
        } catch(e) {}
      }
    }
    
    this.showSaveStatus('已保存');
    this.renderList(document.getElementById('search-notes').value);
    window.dispatchEvent(new Event('data-updated'));
  },

  insertTodoBlock() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    let node = range.commonAncestorContainer;
    let taskLine = null;

    // Check if selection is already inside an editor-task-line
    while (node) {
      if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('editor-task-line')) {
        taskLine = node;
        break;
      }
      node = node.parentNode;
    }

    if (taskLine) {
      // Second click / 二次点击撤销待办任务: Revert task line to a normal paragraph element
      const textSpan = taskLine.querySelector('.editor-task-text');
      const text = textSpan ? textSpan.innerText.trim() : taskLine.innerText.trim();
      
      const p = document.createElement('p');
      p.innerHTML = text || '<br>';
      
      const taskId = taskLine.dataset.id;
      if (taskId) {
        currentDb.deleteTask(taskId);
      }
      
      taskLine.parentNode.replaceChild(p, taskLine);
      document.getElementById('floating-toolbar').classList.add('hidden');
      this.saveCurrentNote();
      window.dispatchEvent(new Event('data-updated'));
      return;
    }

    // First click: Create a task line wrapping selected text
    const selectedText = selection.toString().trim() || '待办任务';
    const id = 't_' + Math.random().toString(36).substr(2, 5) + '_' + Date.now().toString(36).substr(-4);
    
    const taskHtml = `
      <div class="editor-task-line" data-id="${id}">
        <input type="checkbox" class="editor-task-checkbox" data-id="${id}">
        <span class="editor-task-text" data-id="${id}">${selectedText}</span>
      </div>
      <p><br></p>
    `;
    
    document.getElementById('rich-editor').focus();
    document.execCommand('insertHTML', false, taskHtml);
    
    document.getElementById('floating-toolbar').classList.add('hidden');
    this.saveCurrentNote();
  },

  renderTags(tags = []) {
    const list = document.getElementById('note-tags-list');
    list.innerHTML = '';
    tags.forEach(tag => {
      const badge = document.createElement('span');
      badge.className = 'tag-badge-closable';
      badge.innerHTML = `${tag} <button class="btn-remove-tag">&times;</button>`;
      badge.querySelector('.btn-remove-tag').addEventListener('click', () => this.removeTag(tag));
      list.appendChild(badge);
    });
  },

  addTag(tag) {
    if (!activeNoteId) return;
    const note = currentDb.getNote(activeNoteId);
    if (!note.tags.includes(tag)) {
      note.tags.push(tag);
      currentDb.saveNote(note);
      this.renderTags(note.tags);
      this.renderList();
    }
  },

  removeTag(tag) {
    if (!activeNoteId) return;
    const note = currentDb.getNote(activeNoteId);
    note.tags = note.tags.filter(t => t !== tag);
    currentDb.saveNote(note);
    this.renderTags(note.tags);
    this.renderList();
  },

  showSaveStatus(status) {
    document.getElementById('save-status').innerText = status;
  },

  _formatWikiLinks(html) {
    const wikiRegex = /\[\[(.*?)\]\]/g;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const walkNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue;
        if (wikiRegex.test(text)) {
          const span = document.createElement('span');
          span.innerHTML = text.replace(wikiRegex, (match, noteTitle) => {
            const notes = currentDb.getNotes();
            const linkedNote = notes.find(n => n.title.toLowerCase() === noteTitle.toLowerCase().trim());
            if (linkedNote) {
              return `<a href="#notes" class="wikilink-exist" onclick="window.loadNoteById('${linkedNote.id}')">${noteTitle}</a>`;
            } else {
              return `<span class="wikilink-broken" title="未找到此笔记">${noteTitle}</span>`;
            }
          });
          node.parentNode.replaceChild(span, node);
        }
      } else {
        if (node.nodeName !== 'A') {
          Array.from(node.childNodes).forEach(walkNode);
        }
      }
    };
    
    Array.from(doc.body.childNodes).forEach(walkNode);
    return doc.body.innerHTML;
  }
};
