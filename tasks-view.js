// tasks-view.js - Kanban Board, Today's Focus & Dialog Editor

let currentDb = null;
let currentFilters = { milestoneId: '', priority: '' };

export const TasksView = {
  init(dbInstance) {
    currentDb = dbInstance;

    // Set up filter change listeners
    document.getElementById('filter-milestone').addEventListener('change', (e) => {
      currentFilters.milestoneId = e.target.value;
      this.renderBoard();
    });

    document.getElementById('filter-priority').addEventListener('change', (e) => {
      currentFilters.priority = e.target.value;
      this.renderBoard();
    });

    // Modal dialog click listeners
    const modal = document.getElementById('modal-task-detail');
    const closeBtns = modal.querySelectorAll('.btn-close-modal');
    closeBtns.forEach(btn => btn.addEventListener('click', () => modal.classList.add('hidden')));

    document.getElementById('btn-save-task-detail').addEventListener('click', () => this.saveTaskDetail());
    document.getElementById('btn-delete-task').addEventListener('click', () => this.deleteTask());

    // Drag and Drop event setups on column containers
    const columns = document.querySelectorAll('.kanban-cards');
    columns.forEach(col => {
      col.addEventListener('dragover', (e) => e.preventDefault());
      col.addEventListener('drop', (e) => this.handleCardDrop(e));
    });

    // Mobile Kanban Tab listeners
    const kanbanTabs = document.querySelectorAll('.mobile-kanban-tabs .kanban-tab');
    const board = document.querySelector('.kanban-board');
    
    // Set default active view on board
    if (board) {
      board.classList.add('show-todo');
    }

    kanbanTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        kanbanTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const status = tab.dataset.status;
        if (board) {
          board.classList.remove('show-todo', 'show-doing', 'show-done', 'show-abandoned');
          board.classList.add(`show-${status}`);
        }
      });
    });

    // Initial render
    this.renderFilters();
    this.renderBoard();
    this.renderTodayFocus();
  },

  renderFilters() {
    const milestones = currentDb.getMilestones();
    const filterSelect = document.getElementById('filter-milestone');
    const milestoneOptions = milestones.map(m => `<option value="${m.id}">${m.title}</option>`).join('');
    filterSelect.innerHTML = `<option value="">所有里程碑</option>${milestoneOptions}`;

    // Populates inside editing modal too
    const editSelect = document.getElementById('edit-task-milestone');
    editSelect.innerHTML = `<option value="">无里程碑</option>${milestoneOptions}`;
  },

  renderBoard() {
    const tasks = currentDb.getTasks();
    const milestones = currentDb.getMilestones();

    const columns = {
      todo: document.getElementById('cards-todo'),
      doing: document.getElementById('cards-doing'),
      done: document.getElementById('cards-done'),
      abandoned: document.getElementById('cards-abandoned')
    };

    // Reset columns HTML
    Object.keys(columns).forEach(key => columns[key].innerHTML = '');

    const filteredTasks = tasks.filter(task => {
      const matchMilestone = !currentFilters.milestoneId || task.milestoneId === currentFilters.milestoneId;
      const matchPriority = !currentFilters.priority || task.priority === currentFilters.priority;
      return matchMilestone && matchPriority;
    });

    // Populate counts
    const countTodo = filteredTasks.filter(t => t.status === 'todo').length;
    const countDoing = filteredTasks.filter(t => t.status === 'doing').length;
    const countDone = filteredTasks.filter(t => t.status === 'done').length;
    const countAbandoned = filteredTasks.filter(t => t.status === 'abandoned').length;

    document.getElementById('count-todo').innerText = countTodo;
    document.getElementById('count-doing').innerText = countDoing;
    document.getElementById('count-done').innerText = countDone;
    document.getElementById('count-abandoned').innerText = countAbandoned;

    // Populate counts in mobile tabs
    const tabTodoCount = document.getElementById('tab-count-todo');
    const tabDoingCount = document.getElementById('tab-count-doing');
    const tabDoneCount = document.getElementById('tab-count-done');
    const tabAbandonedCount = document.getElementById('tab-count-abandoned');

    if (tabTodoCount) tabTodoCount.innerText = countTodo;
    if (tabDoingCount) tabDoingCount.innerText = countDoing;
    if (tabDoneCount) tabDoneCount.innerText = countDone;
    if (tabAbandonedCount) tabAbandonedCount.innerText = countAbandoned;

    // Render cards
    filteredTasks.forEach(task => {
      const card = document.createElement('div');
      card.className = 'task-card';
      card.draggable = true;
      card.dataset.id = task.id;
      card.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', task.id));
      card.addEventListener('click', () => this.openTaskDetail(task.id));

      const priorityLabel = task.priority || 'P2';
      const mAssociated = milestones.find(m => m.id === task.milestoneId);
      const milestoneBadge = mAssociated ? `<span class="task-card-milestone">${mAssociated.title.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '').trim()}</span>` : '';

      // Date check
      let dateBadge = '';
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isOverdue = dueDate < today && task.status !== 'done' && task.status !== 'abandoned';
        dateBadge = `<span class="task-card-dueDate ${isOverdue ? 'overdue' : ''}">${task.dueDate}</span>`;
      }

      card.innerHTML = `
        <div class="task-card-header">
          <span class="priority-pill priority-${priorityLabel}">${priorityLabel}</span>
        </div>
        <div class="task-card-text">${task.text}</div>
        <div class="task-card-footer">
          ${dateBadge}
          ${milestoneBadge}
        </div>
      `;

      columns[task.status || 'todo'].appendChild(card);
    });
  },

  renderTodayFocus() {
    const tasks = currentDb.getTasks();
    const container = document.getElementById('today-focus-list');
    container.innerHTML = '';

    // Today's Date header text
    const today = new Date();
    document.getElementById('today-date-text').innerText = today.toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Today's Focus formula: Priority P0 or P1, OR status is "doing", OR due date is today/overdue (not completed)
    const todayStr = today.toISOString().split('T')[0];
    const todayFocusTasks = tasks.filter(task => {
      if (task.status === 'done' || task.status === 'abandoned') return false;
      const isHighPriority = task.priority === 'P0' || task.priority === 'P1';
      const isDoing = task.status === 'doing';
      const isDueSoon = task.dueDate && task.dueDate <= todayStr;
      return isHighPriority || isDoing || isDueSoon;
    });

    if (todayFocusTasks.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: 0.875rem;">
          今天真轻松！没有紧急待办任务，写写笔记规划一下吧。
        </div>
      `;
      return;
    }

    todayFocusTasks.forEach(task => {
      const row = document.createElement('div');
      row.className = 'today-item-row';
      row.innerHTML = `
        <input type="checkbox" class="today-item-checkbox" data-id="${task.id}">
        <div class="today-item-text-container">
          <span class="priority-pill priority-${task.priority}">${task.priority}</span>
          <span class="today-item-text">${task.text}</span>
        </div>
        <div class="today-item-meta">
          ${task.dueDate ? `<span style="font-size: 0.75rem; color: var(--color-danger); font-weight: 500;">${task.dueDate}</span>` : ''}
          <span class="tag-badge" style="background-color: var(--color-primary-light); color: var(--color-primary); font-size: 0.7rem; font-weight: 600;">
            ${task.status === 'doing' ? '进行中' : '待办'}
          </span>
        </div>
      `;

      // Checkbox event
      row.querySelector('.today-item-checkbox').addEventListener('change', (e) => {
        if (e.target.checked) {
          task.status = 'done';
          currentDb.saveTask(task);
          
          // Trigger animations or simple delays
          row.style.opacity = '0.3';
          setTimeout(() => {
            this.renderBoard();
            this.renderTodayFocus();
            window.dispatchEvent(new Event('data-updated'));
          }, 400);
        }
      });

      container.appendChild(row);
    });
  },

  handleCardDrop(e) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    const targetStatus = e.currentTarget.closest('.kanban-column').dataset.status;
    
    if (taskId && targetStatus) {
      const task = currentDb.getTask(taskId);
      if (task && task.status !== targetStatus) {
        task.status = targetStatus;
        currentDb.saveTask(task);
        this.renderBoard();
        this.renderTodayFocus();
        window.dispatchEvent(new Event('data-updated'));
      }
    }
  },

  openTaskDetail(taskId) {
    const task = currentDb.getTask(taskId);
    if (!task) return;

    document.getElementById('edit-task-id').value = task.id;
    document.getElementById('edit-task-text').value = task.text;
    document.getElementById('edit-task-priority').value = task.priority || 'P2';
    document.getElementById('edit-task-status').value = task.status || 'todo';
    document.getElementById('edit-task-duedate').value = task.dueDate || '';
    document.getElementById('edit-task-milestone').value = task.milestoneId || '';

    const noteLinkContainer = document.getElementById('task-source-note-link-container');
    if (task.noteId) {
      const note = currentDb.getNote(task.noteId);
      const noteTitle = note ? note.title : '来源笔记';
      noteLinkContainer.innerHTML = `来源笔记: <a href="#notes" onclick="window.loadNoteById('${task.noteId}')" style="color: var(--color-primary); text-decoration: none; font-weight: 500;">${noteTitle}</a>`;
    } else {
      noteLinkContainer.innerHTML = '独立任务 (无来源笔记)';
    }

    document.getElementById('modal-task-detail').classList.remove('hidden');
  },

  saveTaskDetail() {
    const id = document.getElementById('edit-task-id').value;
    const task = currentDb.getTask(id);
    if (!task) return;

    task.text = document.getElementById('edit-task-text').value.trim();
    task.priority = document.getElementById('edit-task-priority').value;
    task.status = document.getElementById('edit-task-status').value;
    task.dueDate = document.getElementById('edit-task-duedate').value;
    task.milestoneId = document.getElementById('edit-task-milestone').value;

    if (!task.text) {
      alert('任务描述不能为空');
      return;
    }

    currentDb.saveTask(task);
    document.getElementById('modal-task-detail').classList.add('hidden');
    
    this.renderBoard();
    this.renderTodayFocus();
    window.dispatchEvent(new Event('data-updated'));
  },

  deleteTask() {
    const id = document.getElementById('edit-task-id').value;
    if (confirm('确定要删除这个任务吗？如果是从笔记中提取的，任务的行内记录也会从笔记中被擦除。')) {
      currentDb.deleteTask(id);
      document.getElementById('modal-task-detail').classList.add('hidden');
      this.renderBoard();
      this.renderTodayFocus();
      window.dispatchEvent(new Event('data-updated'));
    }
  }
};
