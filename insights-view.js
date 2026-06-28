// insights-view.js - Custom SVG Charts, Heatmap Grid & Weekly Report Generator

let currentDb = null;

export const InsightsView = {
  init(dbInstance) {
    currentDb = dbInstance;

    // Bind report events
    document.getElementById('btn-generate-report').addEventListener('click', () => this.openReportModal());
    document.getElementById('btn-copy-report').addEventListener('click', () => this.copyReport());
    document.getElementById('btn-save-report-note').addEventListener('click', () => this.saveReportAsNote());

    // Report modal close
    const modal = document.getElementById('modal-report');
    const closeBtns = modal.querySelectorAll('.btn-close-modal');
    closeBtns.forEach(btn => btn.addEventListener('click', () => modal.classList.add('hidden')));

    this.render();
  },

  render() {
    this.renderMetrics();
    this.renderTrendChart();
    this.renderDistributionChart();
    this.renderHeatmap();
  },

  renderMetrics() {
    const tasks = currentDb.getTasks();
    const notes = currentDb.getNotes();
    const milestones = currentDb.getMilestones();

    const doneCount = tasks.filter(t => t.status === 'done').length;
    const doingCount = tasks.filter(t => t.status === 'doing').length;
    const notesCount = notes.length;

    // Milestone ratio
    const activeCount = milestones.length;
    const completedMilestones = milestones.filter(m => m.status === 'completed').length;
    const ratioStr = activeCount > 0 ? Math.round((completedMilestones / activeCount) * 100) + '%' : '0%';

    document.getElementById('insight-metric-done').innerText = doneCount;
    document.getElementById('insight-metric-doing').innerText = doingCount;
    document.getElementById('insight-metric-notes').innerText = notesCount;
    document.getElementById('insight-metric-ratio').innerText = ratioStr;
  },

  renderTrendChart() {
    const tasks = currentDb.getTasks();
    const container = document.getElementById('trend-chart-wrapper');
    container.innerHTML = '';

    // Calculate last 7 days labels & values
    const daysData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
      
      // Find count of tasks completed on this day
      const count = tasks.filter(t => {
        if (t.status !== 'done' || !t.updatedAt) return false;
        return t.updatedAt.startsWith(dateStr);
      }).length;

      daysData.push({ dateStr, label, count });
    }

    // SVG Drawing parameters
    const width = 500;
    const height = 200;
    const padding = 35;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const maxVal = Math.max(...daysData.map(d => d.count), 4); // Min Y scale height is 4

    // Map coordinates
    const points = daysData.map((d, index) => {
      const x = padding + (index * (chartWidth / (daysData.length - 1)));
      const y = padding + chartHeight - ((d.count / maxVal) * chartHeight);
      return { x, y, val: d.count, label: d.label };
    });

    // Construct SVG path string (curved path helper)
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p = points[i];
      // Control points for smooth bezier curve
      const cpX1 = p0.x + (p.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p.x - p0.x) / 2;
      const cpY2 = p.y;
      pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p.x} ${p.y}`;
    }

    // Shadow filled area path
    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    // Render SVG
    let svgContent = `
      <svg viewBox="0 0 ${width} ${height}" class="svg-chart">
        <defs>
          <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--color-primary)" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="var(--color-primary)" stop-opacity="0.00"/>
          </linearGradient>
        </defs>
        
        <!-- Y Grid lines -->
        ${[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const y = padding + (ratio * chartHeight);
          const gridVal = Math.round(maxVal * (1 - ratio));
          return `
            <line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" class="chart-grid-line" stroke-dasharray="3,3"/>
            <text x="${padding - 10}" y="${y + 3}" text-anchor="end" class="chart-label-text">${gridVal}</text>
          `;
        }).join('')}

        <!-- X Labels -->
        ${points.map(p => `
          <text x="${p.x}" y="${height - 12}" text-anchor="middle" class="chart-label-text">${p.label}</text>
        `).join('')}

        <!-- Gradient Area -->
        <path d="${areaD}" fill="url(#chart-gradient)" />

        <!-- Line -->
        <path d="${pathD}" class="chart-line" />

        <!-- Dots -->
        ${points.map(p => `
          <circle cx="${p.x}" cy="${p.y}" r="4" class="chart-dot" data-val="${p.val}">
            <title>完成任务: ${p.val}个</title>
          </circle>
        `).join('')}
      </svg>
    `;

    container.innerHTML = svgContent;
  },

  renderDistributionChart() {
    const tasks = currentDb.getTasks();
    const container = document.getElementById('distribution-chart-wrapper');
    container.innerHTML = '';

    // Calculate priority distribution
    const p0 = tasks.filter(t => t.priority === 'P0').length;
    const p1 = tasks.filter(t => t.priority === 'P1').length;
    const p2 = tasks.filter(t => t.priority === 'P2').length;
    const p3 = tasks.filter(t => t.priority === 'P3').length;
    const total = p0 + p1 + p2 + p3 || 1;

    // Donut chart drawing using circle dash array
    const r = 50;
    const cx = 80;
    const cy = 100;
    const circ = 2 * Math.PI * r; // ~314.16

    const segments = [
      { count: p0, color: 'var(--priority-p0)', label: 'P0 紧急' },
      { count: p1, color: 'var(--priority-p1)', label: 'P1 重要' },
      { count: p2, color: 'var(--priority-p2)', label: 'P2 中等' },
      { count: p3, color: 'var(--priority-p3)', label: 'P3 低期' }
    ];

    let currentOffset = 0;
    let circlesHtml = '';
    let legendHtml = '';

    segments.forEach(seg => {
      const pct = seg.count / total;
      const strokeLength = pct * circ;
      const dashArray = `${strokeLength} ${circ}`;
      const dashOffset = -currentOffset;

      if (seg.count > 0) {
        circlesHtml += `
          <circle cx="${cx}" cy="${cy}" r="${r}" 
                  fill="transparent" 
                  stroke="${seg.color}" 
                  stroke-width="16" 
                  stroke-dasharray="${dashArray}" 
                  stroke-dashoffset="${dashOffset}"
                  transform="rotate(-90 ${cx} ${cy})">
            <title>${seg.label}: ${seg.count}个 (${Math.round(pct * 100)}%)</title>
          </circle>
        `;
      }

      legendHtml += `
        <div class="legend-item">
          <span class="legend-dot" style="background-color: ${seg.color};"></span>
          <span>${seg.label}: <strong>${seg.count}个</strong> (${Math.round(pct * 100)}%)</span>
        </div>
      `;

      currentOffset += strokeLength;
    });

    // If zero tasks
    if (tasks.length === 0) {
      container.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85rem;">记录一些任务数据再来查看吧</span>`;
      return;
    }

    container.innerHTML = `
      <div style="display: flex; align-items: center; width: 100%;">
        <svg width="180" height="200" viewBox="0 0 180 200">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="transparent" stroke="#F3F4F6" stroke-width="16"/>
          ${circlesHtml}
          <!-- Center Text -->
          <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="var(--text-primary)">
            ${tasks.length}个
          </text>
        </svg>
        <div class="pie-legend">
          ${legendHtml}
        </div>
      </div>
    `;
  },

  renderHeatmap() {
    const tasks = currentDb.getTasks();
    const notes = currentDb.getNotes();
    const container = document.getElementById('heatmap-container');
    container.innerHTML = '';

    // Render past 24 weeks grid (approx 6 months)
    const weeksToRender = 24;
    const daysToRender = weeksToRender * 7;
    const daysData = [];

    const now = new Date();
    // Align starting day to sunday 24 weeks ago
    const startDate = new Date();
    startDate.setDate(now.getDate() - daysToRender + 1);

    for (let i = 0; i < daysToRender; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];

      // Calculate activities count
      const taskDoneCount = tasks.filter(t => t.status === 'done' && t.updatedAt && t.updatedAt.startsWith(dateStr)).length;
      const noteCreatedCount = notes.filter(n => n.createdAt && n.createdAt.startsWith(dateStr)).length;
      const noteUpdatedCount = notes.filter(n => n.updatedAt && n.updatedAt.startsWith(dateStr) && !n.createdAt.startsWith(dateStr)).length;
      
      const totalActivities = taskDoneCount + noteCreatedCount + noteUpdatedCount;

      daysData.push({
        dateStr,
        count: totalActivities,
        label: `${d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}: 完成任务 ${taskDoneCount} 个, 写笔记 ${noteCreatedCount + noteUpdatedCount} 次`
      });
    }

    let gridHtml = '';
    daysData.forEach(d => {
      let level = 0;
      if (d.count > 0 && d.count <= 1) level = 1;
      else if (d.count > 1 && d.count <= 3) level = 2;
      else if (d.count > 3 && d.count <= 5) level = 3;
      else if (d.count > 5) level = 4;

      const levelClass = level > 0 ? `day-level-${level}` : '';
      gridHtml += `<div class="heatmap-day ${levelClass}" data-tooltip="${d.label}"></div>`;
    });

    container.innerHTML = `
      <div class="heatmap-scroll">
        <div class="heatmap-grid" style="grid-template-columns: repeat(${weeksToRender}, 10px);">
          ${gridHtml}
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end; align-items: center; gap: 6px; font-size: 0.725rem; color: var(--text-muted); margin-top: 4px; padding-right: 8px;">
        <span>少</span>
        <span class="heatmap-day" style="display: inline-block; float: none;"></span>
        <span class="heatmap-day day-level-1" style="display: inline-block; float: none;"></span>
        <span class="heatmap-day day-level-2" style="display: inline-block; float: none;"></span>
        <span class="heatmap-day day-level-3" style="display: inline-block; float: none;"></span>
        <span class="heatmap-day day-level-4" style="display: inline-block; float: none;"></span>
        <span>多</span>
      </div>
    `;
  },

  openReportModal() {
    const notes = currentDb.getNotes();
    const tasks = currentDb.getTasks();
    const milestones = currentDb.getMilestones();

    const today = new Date();
    const pastWeekDate = new Date();
    pastWeekDate.setDate(today.getDate() - 7);
    const pastWeekStr = pastWeekDate.toISOString().split('T')[0];

    // Filter weekly work
    const completedTasks = tasks.filter(t => t.status === 'done' && t.updatedAt && t.updatedAt >= pastWeekStr);
    const pendingTasks = tasks.filter(t => t.status === 'todo');
    const doingTasks = tasks.filter(t => t.status === 'doing');
    
    const activeMilestones = milestones.filter(m => m.status === 'active');
    const completedMilestones = milestones.filter(m => m.status === 'completed' && m.dueDate >= pastWeekStr);

    const notesModified = notes.filter(n => n.updatedAt >= pastWeekStr);

    // Formulate report HTML
    const reportHtml = `<h1>GNote 复盘周报 (${pastWeekDate.toLocaleDateString('zh-CN')} - ${today.toLocaleDateString('zh-CN')})</h1>
<p>这一周，我们在打卡与灵感的路上齐头并进。</p>

<h2>里程碑进展</h2>
<ul>
${completedMilestones.length > 0 ? completedMilestones.map(m => `  <li><strong>【已达成】</strong> ${m.title}</li>`).join('') : '  <li>本周无达成的里程碑</li>'}
${activeMilestones.length > 0 ? activeMilestones.map(m => `  <li><strong>【进行中】</strong> ${m.title}</li>`).join('') : '  <li>暂无活跃里程碑</li>'}
</ul>

<h2>本周已完成行动 (${completedTasks.length} 个)</h2>
${completedTasks.length > 0 ? completedTasks.map(t => `
<div class="editor-task-line task-completed" data-id="${t.id}">
  <input type="checkbox" class="editor-task-checkbox" data-id="${t.id}" checked="checked">
  <span class="editor-task-text" data-id="${t.id}">${t.text}</span>
</div>`).join('') : '<p>还没有本周勾选的已完成任务，下周加把劲！</p>'}

<h2>正在推进的行动 (${doingTasks.length} 个)</h2>
${doingTasks.length > 0 ? doingTasks.map(t => `
<div class="editor-task-line task-doing" data-id="${t.id}">
  <input type="checkbox" class="editor-task-checkbox" data-id="${t.id}">
  <span class="editor-task-text" data-id="${t.id}">${t.text}</span>
</div>`).join('') : '<p>暂无进行中的任务</p>'}

<h2>知识库沉淀</h2>
<p>本周共更新或记录了 <strong>${notesModified.length}</strong> 篇笔记：</p>
<ul>
${notesModified.length > 0 ? notesModified.map(n => `  <li>[[${n.title}]]</li>`).join('') : '  <li>无笔记写入</li>'}
</ul>

<h2>下周工作反思与规划</h2>
<div class="editor-task-line" data-id="t_rep_${Math.random().toString(36).substr(2,4)}">
  <input type="checkbox" class="editor-task-checkbox">
  <span class="editor-task-text">梳理下一阶段的待办与重心</span>
</div>
<div class="editor-task-line" data-id="t_rep_${Math.random().toString(36).substr(2,4)}">
  <input type="checkbox" class="editor-task-checkbox">
  <span class="editor-task-text">聚焦核心，避免在支线上消耗过多精力</span>
</div>
<p><br></p>
`;

    document.getElementById('report-output-textarea').value = reportHtml;
    document.getElementById('modal-report').classList.remove('hidden');
  },

  copyReport() {
    const text = document.getElementById('report-output-textarea').value;
    navigator.clipboard.writeText(text).then(() => {
      alert('报告已成功复制到剪贴板！');
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  },

  saveReportAsNote() {
    const content = document.getElementById('report-output-textarea').value;
    const noteTitle = `GNote 复盘周报 (${new Date().toLocaleDateString('zh-CN')})`;
    
    const newNote = {
      title: noteTitle,
      content: content,
      tags: ['复盘', '周报']
    };

    const saved = currentDb.saveNote(newNote);
    document.getElementById('modal-report').classList.add('hidden');
    
    // Select notes panel and load the newly created note
    window.location.hash = '#notes';
    window.loadNoteById(saved.id);
  }
};
