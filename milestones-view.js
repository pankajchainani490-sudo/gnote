// milestones-view.js - Milestone Management & Simple Gantt Chart

let currentDb = null;

export const MilestonesView = {
  init(dbInstance) {
    currentDb = dbInstance;

    // Bind buttons
    document.getElementById('btn-new-milestone').addEventListener('click', () => this.openMilestoneModal());
    document.getElementById('btn-save-milestone').addEventListener('click', () => this.saveMilestone());
    document.getElementById('btn-delete-milestone').addEventListener('click', () => this.deleteMilestone());

    // Setup modal close
    const modal = document.getElementById('modal-milestone');
    const closeBtns = modal.querySelectorAll('.btn-close-modal');
    closeBtns.forEach(btn => btn.addEventListener('click', () => modal.classList.add('hidden')));

    this.render();
  },

  render() {
    this.renderGrid();
    this.renderGantt();
  },

  renderGrid() {
    const milestones = currentDb.getMilestones();
    const tasks = currentDb.getTasks();
    const container = document.getElementById('milestones-grid-container');
    container.innerHTML = '';

    if (milestones.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; background: white; border-radius: var(--radius-md); border: 1px solid var(--border-light); color: var(--text-secondary);">
          <h3>暂无里程碑计划</h3>
          <p style="font-size: 0.85rem; margin-top: 6px; color: var(--text-muted);">设定一个阶段目标（如“第一版设计稿交付”），集中击破相关任务！</p>
        </div>
      `;
      return;
    }

    milestones.forEach(m => {
      // Calculate tasks linked to this milestone
      const milestoneTasks = tasks.filter(t => t.milestoneId === m.id);
      const totalCount = milestoneTasks.length;
      const doneCount = milestoneTasks.filter(t => t.status === 'done').length;
      const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

      const card = document.createElement('div');
      card.className = 'milestone-card';
      card.addEventListener('click', () => this.openMilestoneModal(m.id));

      const statusLabels = { active: '进行中', pending: '准备中', completed: '已达成' };
      const statusClass = `status-${m.status || 'pending'}`;

      card.innerHTML = `
        <div class="milestone-card-header">
          <span class="milestone-card-title">${m.title}</span>
          <span class="milestone-card-status ${statusClass}">${statusLabels[m.status] || '准备中'}</span>
        </div>
        <p class="milestone-card-desc">${m.description || '无详细描述...'}</p>
        <div class="milestone-progress-section">
          <div class="progress-header">
            <span>任务达成度 (${doneCount}/${totalCount})</span>
            <span>${progressPercent}%</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
          </div>
        </div>
        <div class="milestone-card-footer">
          <div class="milestone-dates">
            <span>${m.startDate || '未定'}</span>
            <span>至</span>
            <span>${m.dueDate || '未定'}</span>
          </div>
        </div>
      `;

      container.appendChild(card);
    });
  },

  renderGantt() {
    const milestones = currentDb.getMilestones().filter(m => m.startDate && m.dueDate);
    const tasks = currentDb.getTasks();
    const container = document.getElementById('gantt-chart-container');
    container.innerHTML = '';

    if (milestones.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.85rem;">
          在里程碑中设置“开始日期”与“截止日期”以生成甘特图时间轴。
        </div>
      `;
      return;
    }

    // Sort milestones by start date
    milestones.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    // Calculate dates boundary
    const startDates = milestones.map(m => new Date(m.startDate).getTime());
    const dueDates = milestones.map(m => new Date(m.dueDate).getTime());
    const minTime = Math.min(...startDates);
    const maxTime = Math.max(...dueDates);
    const totalDuration = maxTime - minTime || 1; // Avoid divide by zero

    milestones.forEach(m => {
      const mTasks = tasks.filter(t => t.milestoneId === m.id);
      const totalCount = mTasks.length;
      const doneCount = mTasks.filter(t => t.status === 'done').length;
      const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

      const row = document.createElement('div');
      row.className = 'gantt-row';

      const startTime = new Date(m.startDate).getTime();
      const endTime = new Date(m.dueDate).getTime();
      const leftPercent = ((startTime - minTime) / totalDuration) * 100;
      const widthPercent = ((endTime - startTime) / totalDuration) * 100;

      // Ensure minimal width to show label
      const safeWidthPercent = Math.max(widthPercent, 10);

      row.innerHTML = `
        <div class="gantt-label" title="${m.title}">${m.title}</div>
        <div class="gantt-track">
          <div class="gantt-bar" style="left: ${leftPercent}%; width: ${safeWidthPercent}%;">
            <div style="position: absolute; left: 0; top: 0; bottom: 0; background-color: var(--color-primary); opacity: 0.2; width: ${progressPercent}%; border-radius: 4px 0 0 4px;"></div>
            <span style="position: relative; z-index: 2;">${progressPercent}%</span>
          </div>
        </div>
      `;

      container.appendChild(row);
    });
  },

  openMilestoneModal(milestoneId = null) {
    const modal = document.getElementById('modal-milestone');
    const deleteBtn = document.getElementById('btn-delete-milestone');

    if (milestoneId) {
      // Edit mode
      const m = currentDb.getMilestone(milestoneId);
      if (!m) return;

      document.getElementById('milestone-modal-title').innerText = '编辑里程碑';
      document.getElementById('edit-milestone-id').value = m.id;
      document.getElementById('edit-milestone-name').value = m.title;
      document.getElementById('edit-milestone-desc').value = m.description || '';
      document.getElementById('edit-milestone-startdate').value = m.startDate || '';
      document.getElementById('edit-milestone-duedate').value = m.dueDate || '';

      deleteBtn.classList.remove('hidden');
    } else {
      // New mode
      document.getElementById('milestone-modal-title').innerText = '新建里程碑';
      document.getElementById('edit-milestone-id').value = '';
      document.getElementById('edit-milestone-name').value = '';
      document.getElementById('edit-milestone-desc').value = '';
      
      const todayStr = new Date().toISOString().split('T')[0];
      const twoWeeksLaterStr = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      document.getElementById('edit-milestone-startdate').value = todayStr;
      document.getElementById('edit-milestone-duedate').value = twoWeeksLaterStr;

      deleteBtn.classList.add('hidden');
    }

    modal.classList.remove('hidden');
  },

  saveMilestone() {
    const id = document.getElementById('edit-milestone-id').value;
    const title = document.getElementById('edit-milestone-name').value.trim();
    const description = document.getElementById('edit-milestone-desc').value.trim();
    const startDate = document.getElementById('edit-milestone-startdate').value;
    const dueDate = document.getElementById('edit-milestone-duedate').value;

    if (!title) {
      alert('里程碑标题不能为空');
      return;
    }

    if (startDate && dueDate && startDate > dueDate) {
      alert('开始日期不能晚于截止日期');
      return;
    }

    const milestoneData = { title, description, startDate, dueDate };
    
    if (id) {
      // Update
      const old = currentDb.getMilestone(id);
      const tasks = currentDb.getTasks().filter(t => t.milestoneId === id);
      const totalCount = tasks.length;
      const doneCount = tasks.filter(t => t.status === 'done').length;
      
      let status = 'pending';
      if (totalCount > 0 && doneCount === totalCount) status = 'completed';
      else if (doneCount > 0 || totalCount > 0) status = 'active';

      currentDb.saveMilestone({ ...old, ...milestoneData, status });
    } else {
      // Create
      currentDb.saveMilestone({ ...milestoneData, status: 'pending' });
    }

    document.getElementById('modal-milestone').classList.add('hidden');
    this.render();
    
    // Dispatch to re-populate task options
    window.dispatchEvent(new Event('data-updated'));
  },

  deleteMilestone() {
    const id = document.getElementById('edit-milestone-id').value;
    if (confirm('确认删除此里程碑吗？这不会删除任务本身，但会取消任务与该里程碑的关联。')) {
      currentDb.deleteMilestone(id);
      document.getElementById('modal-milestone').classList.add('hidden');
      this.render();
      window.dispatchEvent(new Event('data-updated'));
    }
  }
};
