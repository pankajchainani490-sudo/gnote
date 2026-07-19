// notes-view.js - WYSIWYG Rich Text Editor View with Real-time Todo Sync & Floating Toolbar

let currentDb = null;
let activeNoteId = null;
let saveTimeout = null;
let isComposing = false;

export const NotesView = {
  init(dbInstance) {
    currentDb = dbInstance;

    // Bind floating toolbar buttons
    const floatingButtons = document.querySelectorAll('.floating-toolbar .toolbar-btn[data-cmd]');
    floatingButtons.forEach(btn => {
      // Prevent selection from collapsing when button is pressed
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.isFormatting = true;
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
        
        setTimeout(() => {
          this.isFormatting = false;
        }, 150);
      });
    });

    // Bind custom todo button in floating toolbar (supports toggle restore)
    const btnTodo = document.getElementById('btn-toolbar-todo');
    btnTodo.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent selection collapse
    });
    btnTodo.addEventListener('click', (e) => {
      e.preventDefault();
      this.insertTodoBlock();
    });

    // Selection monitoring to pop up floating toolbar
    document.addEventListener('selectionchange', () => this.handleSelectionChange());

    // Hide toolbar when clicking outside the toolbar itself
    const editor = document.getElementById('rich-editor');
    document.addEventListener('mousedown', (e) => {
      const toolbar = document.getElementById('floating-toolbar');
      if (!toolbar.contains(e.target)) {
        toolbar.classList.add('hidden');
      }
    });

    // Reposition toolbar when scrolling editor container
    const editorWrapper = document.querySelector('.rich-editor-wrapper');
    if (editorWrapper) {
      editorWrapper.addEventListener('scroll', () => {
        this.handleSelectionChange();
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



    // Save on title changes & auto-clear default "无标题" or "无标题笔记"
    const titleInput = document.getElementById('note-title');
    titleInput.addEventListener('input', () => {
      this.showSaveStatus('修改中...');
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        this.saveCurrentNote();
      }, 1000);
    });
    titleInput.addEventListener('focus', () => {
      const val = titleInput.value.trim();
      if (val === '无标题' || val === '无标题笔记') {
        titleInput.value = '';
      }
    });
    titleInput.addEventListener('blur', () => {
      const val = titleInput.value.trim();
      if (!val) {
        titleInput.value = '无标题笔记';
        this.saveCurrentNote();
      }
    });

    // Tag adding (improved for Android/mobile keyboards and compositions)
    const tagInput = document.getElementById('add-tag-input');
    
    const tryAddTagFromInput = () => {
      const val = tagInput.value.trim();
      if (val) {
        // Remove trailing commas/spaces/semicolons that might have triggered this
        const cleaned = val.replace(/[,;，；\s]+$/, '');
        if (cleaned) {
          this.addTag(cleaned);
        }
        tagInput.value = '';
      }
    };

    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        tryAddTagFromInput();
      }
    });

    tagInput.addEventListener('input', (e) => {
      const val = tagInput.value;
      // If user typed a comma, space, semicolon, or Chinese equivalent, trigger tag addition
      if (/[ ,;，；]/.test(val)) {
        tryAddTagFromInput();
      }
    });

    tagInput.addEventListener('blur', () => {
      tryAddTagFromInput();
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

    // 5. Mobile Back to List Button
    const btnBack = document.getElementById('btn-back-to-list');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        const layout = document.querySelector('.notes-layout');
        if (layout) {
          layout.classList.remove('viewing-editor');
        }
        activeNoteId = null;
        // Deselect active list item
        const items = document.querySelectorAll('.note-item');
        items.forEach(item => item.classList.remove('active'));
        
        // After transition, restore display status
        setTimeout(() => {
          if (!activeNoteId) {
            document.getElementById('editor-active-state').classList.add('hidden');
            document.getElementById('editor-empty-state').classList.remove('hidden');
          }
        }, 300);
      });
    }

    // Track IME composition events to prevent Enter/Backspace handlers during Chinese input
    editor.addEventListener('compositionstart', () => {
      isComposing = true;
    });
    editor.addEventListener('compositionend', () => {
      isComposing = false;
    });

    // Handle Enter and Backspace keys inside tasks to support seamless transitions (Flat Paragraph Structure)
    editor.addEventListener('keydown', (e) => {
      // Hide toolbar if typing or navigating (unless pressing modifier/shortcut)
      if (!e.metaKey && !e.ctrlKey) {
        document.getElementById('floating-toolbar').classList.add('hidden');
      }

      if (e.isComposing || isComposing || e.keyCode === 229) {
        return;
      }

      if (e.key === 'Backspace') {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        let node = range.commonAncestorContainer;
        let taskLine = null;
        
        while (node && node !== editor) {
          if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('editor-task-line')) {
            taskLine = node;
            break;
          }
          node = node.parentNode;
        }
        
        if (taskLine) {
          let isAtStart = false;
          if (range.startOffset === 0) {
            if (range.startContainer === taskLine) {
              isAtStart = true;
            } else if (taskLine.contains(range.startContainer)) {
              let current = range.startContainer;
              isAtStart = true;
              while (current && current !== taskLine) {
                if (current.previousSibling) {
                  isAtStart = false;
                  break;
                }
                current = current.parentNode;
              }
            }
          }
          
          if (isAtStart) {
            e.preventDefault();
            const text = taskLine.innerText;
            const p = document.createElement('p');
            p.innerHTML = text.trim() || '<br>';
            
            const taskId = taskLine.dataset.id;
            if (taskId) {
              currentDb.deleteTask(taskId);
            }
            taskLine.parentNode.replaceChild(p, taskLine);
            
            const newRange = document.createRange();
            newRange.setStart(p, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            this.saveCurrentNote();
          }
        }
      }

      if (e.key === 'Enter') {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        let node = range.commonAncestorContainer;
        let taskLine = null;
        
        while (node && node !== editor) {
          if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('editor-task-line')) {
            taskLine = node;
            break;
          }
          node = node.parentNode;
        }
        
        if (taskLine) {
          e.preventDefault();
          const text = taskLine.innerText.trim();
          
          if (!text) {
            // Convert empty task line back to regular paragraph
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            const taskId = taskLine.dataset.id;
            if (taskId) {
              currentDb.deleteTask(taskId);
            }
            taskLine.parentNode.replaceChild(p, taskLine);
            
            const newRange = document.createRange();
            newRange.setStart(p, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            this.saveCurrentNote();
          } else {
            // Create a new flat task line below
            const newId = 't_' + Math.random().toString(36).substr(2, 5) + '_' + Date.now().toString(36).substr(-4);
            const newLine = document.createElement('p');
            newLine.className = 'editor-task-line';
            newLine.dataset.id = newId;
            newLine.innerHTML = '<br>';
            
            taskLine.parentNode.insertBefore(newLine, taskLine.nextSibling);
            
            const newRange = document.createRange();
            newRange.setStart(newLine, 0);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            this.saveCurrentNote();
          }
        }
      }
    });

    // Handle clicks inside editor (checkbox clicking via ::before, or blank space selection)
    editor.addEventListener('click', (e) => {
      const taskLine = e.target.closest('.editor-task-line');
      if (taskLine) {
        const rect = taskLine.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        // The checkbox ::before pseudo element is drawn within the left 28px
        if (clickX >= 0 && clickX <= 28) {
          e.preventDefault();
          taskLine.classList.toggle('task-completed');
          this.saveCurrentNote();
          return;
        }
      }

      if (e.target === editor) {
        editor.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    });

    // Make blank spaces clickable/selectable in the editor wrapper too
    if (editorWrapper) {
      editorWrapper.addEventListener('click', (e) => {
        if (e.target === editorWrapper) {
          editor.focus();
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      });
    }

    // Refresh note views on data update (from Kanban or server sync)
    window.addEventListener('data-updated', () => {
      const active = document.activeElement;
      const editor = document.getElementById('rich-editor');
      
      let hasSelection = false;
      let selDetails = 'No Selection';
      try {
        const selection = window.getSelection();
        if (selection) {
          selDetails = `rangeCount=${selection.rangeCount}, isCollapsed=${selection.isCollapsed}, anchorNode=${selection.anchorNode ? selection.anchorNode.nodeName || selection.anchorNode.tagName : 'null'}, focusNode=${selection.focusNode ? selection.focusNode.nodeName || selection.focusNode.tagName : 'null'}`;
          
          if (!selection.isCollapsed && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (editor && (
              editor.contains(range.startContainer) || 
              editor.contains(range.endContainer) || 
              editor.contains(selection.anchorNode) || 
              editor.contains(selection.focusNode)
            )) {
              hasSelection = true;
            }
          }
        }
      } catch (e) {
        selDetails = `Error: ${e.message}`;
      }
      
      const isEditing = active === editor || 
                        active === document.getElementById('note-title') ||
                        active === document.getElementById('add-tag-input') ||
                        hasSelection;
                        
      console.log('GNote data-updated triggered:', { 
        activeElement: active ? active.id || active.tagName : null, 
        isEditing, 
        hasSelection, 
        selectionDetails: selDetails,
        activeNoteId 
      });
                        
      if (activeNoteId && !isEditing) {
        const note = currentDb.getNote(activeNoteId);
        if (note) {
          const dbCleaned = this.cleanTaskHtml(note.content);
          const editorCleaned = this.cleanTaskHtml(editor.innerHTML);
          if (dbCleaned !== editorCleaned) {
            console.log('GNote reloading note content (user is idle and content changed)');
            this.loadNote(activeNoteId);
            return;
          }
        }
      }
      
      console.log('GNote skipping note reload (user is actively editing/selecting or content is identical)');
      const searchInput = document.getElementById('search-notes');
      this.renderList(searchInput ? searchInput.value : '');
    });

    this.renderList();
  },

  cleanTaskHtml(htmlContent) {
    if (!htmlContent) return '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const taskLines = doc.querySelectorAll('.editor-task-line');
    let modified = false;

    taskLines.forEach(line => {
      const checkbox = line.querySelector('.editor-task-checkbox');
      const textSpan = line.querySelector('.editor-task-text');
      
      if (checkbox || textSpan || line.tagName.toLowerCase() === 'div') {
        modified = true;
        const text = textSpan ? textSpan.innerText : line.innerText;
        const id = line.getAttribute('data-id') || 't_' + Math.random().toString(36).substr(2, 5) + '_' + Date.now().toString(36).substr(-4);
        const isCompleted = line.classList.contains('task-completed') || (checkbox && checkbox.checked);
        const isDoing = line.classList.contains('task-doing');
        const isAbandoned = line.classList.contains('task-abandoned');
        
        const newLine = doc.createElement('p');
        newLine.className = 'editor-task-line';
        newLine.setAttribute('data-id', id);
        
        if (isCompleted) newLine.classList.add('task-completed');
        if (isDoing) newLine.classList.add('task-doing');
        if (isAbandoned) newLine.classList.add('task-abandoned');
        
        newLine.innerHTML = text.trim() || '<br>';
        line.parentNode.replaceChild(newLine, line);
      }
    });

    return modified ? doc.body.innerHTML : htmlContent;
  },

  updateToolbarStates() {
    const toolbar = document.getElementById('floating-toolbar');
    if (!toolbar) return;
    
    const buttons = toolbar.querySelectorAll('.toolbar-btn[data-cmd]');
    buttons.forEach(btn => {
      const cmd = btn.dataset.cmd;
      const val = btn.dataset.val;
      
      let isActive = false;
      try {
        if (cmd === 'fontSize') {
          const currentSize = document.queryCommandValue('fontSize');
          isActive = String(currentSize) === String(val);
        } else if (cmd === 'justifyLeft' || cmd === 'justifyCenter' || cmd === 'justifyRight') {
          isActive = document.queryCommandState(cmd);
        } else {
          isActive = document.queryCommandState(cmd);
        }
      } catch (e) {}
      
      btn.classList.toggle('active', isActive);
    });

    // Sync "待办" button active class if selection is inside a todo line
    const btnTodo = document.getElementById('btn-toolbar-todo');
    if (btnTodo) {
      const selection = window.getSelection();
      let isTodo = false;
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        let node = range.commonAncestorContainer;
        const editor = document.getElementById('rich-editor');
        while (node && node !== editor) {
          if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('editor-task-line')) {
            isTodo = true;
            break;
          }
          node = node.parentNode;
        }
      }
      btnTodo.classList.toggle('active', isTodo);
    }
  },

  handleSelectionChange() {
    if (this.isFormatting) return;
    const selection = window.getSelection();
    const toolbar = document.getElementById('floating-toolbar');
    const editor = document.getElementById('rich-editor');

    // Update active states of formatting buttons unconditionally
    this.updateToolbarStates();

    if (!activeNoteId) {
      toolbar.classList.add('hidden');
      return;
    }

    // If selection is collapsed, do NOT hide the toolbar (let mousedown listener handle hiding)
    if (selection.isCollapsed) {
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
      return;
    }

    // Position the toolbar
    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      if (rect.width === 0 || rect.height === 0) {
        return;
      }

      // Show toolbar first to get offsetHeight correctly computed by browser
      toolbar.classList.remove('hidden');
      const toolbarHeight = toolbar.offsetHeight || 38;
      
      toolbar.style.top = `${rect.top - toolbarHeight}px`;
      toolbar.style.left = `${rect.left + rect.width / 2}px`;
    } catch (e) {
      // Ignore errors
    }
  },

  renderList(searchQuery = '') {
    // 1. Save current selection and active element before modifying DOM
    const selection = window.getSelection();
    let savedRange = null;
    if (selection && selection.rangeCount > 0) {
      try {
        savedRange = selection.getRangeAt(0).cloneRange();
      } catch (e) {}
    }
    const activeEl = document.activeElement;

    const notes = currentDb.getNotes();
    const container = document.getElementById('notes-list-container');
    if (!container) return;
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
    } else {
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
    }

    // 2. Restore active element and selection
    if (activeEl && typeof activeEl.focus === 'function' && document.body.contains(activeEl)) {
      try {
        activeEl.focus();
      } catch (e) {}
    }
    if (savedRange && selection) {
      try {
        selection.removeAllRanges();
        selection.addRange(savedRange);
      } catch (e) {}
    }
  },

  loadNote(id) {
    activeNoteId = id;
    const note = currentDb.getNote(id);
    if (!note) return;

    const layout = document.querySelector('.notes-layout');
    if (layout) {
      layout.classList.add('viewing-editor');
    }

    document.getElementById('editor-empty-state').classList.add('hidden');
    document.getElementById('editor-active-state').classList.remove('hidden');

    document.getElementById('note-title').value = note.title;
    
    // Automatically clean/migrate task line structure on note load
    const cleanedContent = this.cleanTaskHtml(note.content);
    document.getElementById('rich-editor').innerHTML = cleanedContent;
    
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
      
      const layout = document.querySelector('.notes-layout');
      if (layout) {
        layout.classList.remove('viewing-editor');
      }

      document.getElementById('editor-active-state').classList.add('hidden');
      document.getElementById('editor-empty-state').classList.remove('hidden');
      this.renderList();
      window.dispatchEvent(new Event('data-updated'));
    }
  },

  saveCurrentNote() {
    if (!activeNoteId) return;
    
    // Synchronize task IDs on live DOM elements BEFORE reading innerHTML
    const editor = document.getElementById('rich-editor');
    const taskLines = editor.querySelectorAll('.editor-task-line');
    taskLines.forEach(line => {
      let id = line.getAttribute('data-id');
      if (!id) {
        id = 't_' + Math.random().toString(36).substr(2, 5) + '_' + Date.now().toString(36).substr(-4);
        line.setAttribute('data-id', id);
      }
      // Supporting both old and new layouts during sync
      const checkbox = line.querySelector('.editor-task-checkbox');
      if (checkbox) {
        checkbox.setAttribute('data-id', id);
      }
      const textSpan = line.querySelector('.editor-task-text');
      if (textSpan) {
        textSpan.setAttribute('data-id', id);
      }
    });

    const title = document.getElementById('note-title').value.trim() || '无标题笔记';
    let content = editor.innerHTML;
    content = this.cleanTaskHtml(content); // Ensure HTML saved is clean and flat
    content = this._formatWikiLinks(content);
    
    const note = currentDb.getNote(activeNoteId);
    note.title = title;
    note.content = content;
    
    // Save to database
    currentDb.saveNote(note);
    
    this.showSaveStatus('已保存');
    const searchInput = document.getElementById('search-notes');
    this.renderList(searchInput ? searchInput.value : '');
    window.dispatchEvent(new Event('data-updated'));
  },

  insertTodoBlock() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    let node = range.commonAncestorContainer;
    
    // Find the parent block node (e.g. P, DIV, H1, H2) inside the editor
    let blockNode = null;
    let temp = node;
    const editor = document.getElementById('rich-editor');
    while (temp && temp !== editor) {
      if (temp.nodeType === Node.ELEMENT_NODE) {
        const tag = temp.tagName.toLowerCase();
        if (tag === 'p' || tag === 'div' || /^h[1-6]$/.test(tag) || temp.classList.contains('editor-task-line')) {
          blockNode = temp;
          break;
        }
      }
      temp = temp.parentNode;
    }

    if (blockNode && blockNode.classList.contains('editor-task-line')) {
      // Second click: Revert todo line to a normal paragraph
      const textSpan = blockNode.querySelector('.editor-task-text');
      const text = textSpan ? textSpan.innerText : blockNode.innerText;
      
      const p = document.createElement('p');
      p.innerHTML = text.trim() || '<br>';
      
      const taskId = blockNode.dataset.id;
      if (taskId) {
        currentDb.deleteTask(taskId);
      }
      
      blockNode.parentNode.replaceChild(p, blockNode);
      this.saveCurrentNote();
      return;
    }

    // Convert blockNode to a todo line
    const text = blockNode ? blockNode.innerText.trim() : (selection.toString().trim() || '待办任务');
    const id = 't_' + Math.random().toString(36).substr(2, 5) + '_' + Date.now().toString(36).substr(-4);
    
    const newLine = document.createElement('div');
    newLine.className = 'editor-task-line';
    newLine.dataset.id = id;
    newLine.innerHTML = `
      <input type="checkbox" class="editor-task-checkbox" data-id="${id}">
      <span class="editor-task-text" data-id="${id}">${text || '<br>'}</span>
    `;

    if (blockNode && blockNode.parentNode === editor) {
      blockNode.parentNode.replaceChild(newLine, blockNode);
    } else {
      // Fallback: insert at range
      range.deleteContents();
      range.insertNode(newLine);
    }
    
    // Position caret at the end of the text span
    const textSpan = newLine.querySelector('.editor-task-text');
    const newRange = document.createRange();
    newRange.selectNodeContents(textSpan);
    newRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(newRange);
    
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
