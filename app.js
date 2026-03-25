// ─── Storage ────────────────────────────────────────────────────────────────

const KEY = { items: 'dp_items', schedule: 'dp_schedule', log: 'dp_log' };

function load(key)      { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } }
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function uid()          { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

const getItems    = () => load(KEY.items);
const getSchedule = () => load(KEY.schedule);
const getLog      = () => load(KEY.log);

// ─── Helpers ────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Quality = effort >= 5 (right side of graph)
function isQuality(item) { return item.effort >= 5; }

function itemMap() {
  return Object.fromEntries(getItems().map(i => [i.id, i]));
}

// ─── Items Tab ──────────────────────────────────────────────────────────────

function addItem() {
  const name     = document.getElementById('item-name').value.trim();
  const type     = document.getElementById('item-type').value;
  const effort   = parseFloat(document.getElementById('item-effort').value);
  const dopamine = parseFloat(document.getElementById('item-dopamine').value);

  if (!name)                                                    return alert('Please enter a name.');
  if (isNaN(effort)   || effort < 0   || effort > 10)          return alert('Effort must be 0–10.');
  if (isNaN(dopamine) || dopamine < 0 || dopamine > 10)        return alert('Dopamine must be 0–10.');

  const items = getItems();
  items.push({ id: uid(), name, type, effort, dopamine });
  save(KEY.items, items);

  document.getElementById('item-name').value = '';
  renderItems();
  refreshSelects();
}

function deleteItem(id) {
  if (!confirm('Delete this item? It will still appear in existing schedule/log entries.')) return;
  save(KEY.items, getItems().filter(i => i.id !== id));
  renderItems();
  refreshSelects();
}

function renderItems() {
  const items = getItems();
  const el = document.getElementById('items-list');

  if (!items.length) {
    el.innerHTML = '<div class="empty">No items yet. Add one above to get started.</div>';
    return;
  }

  el.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Name</th><th>Type</th><th>Effort</th><th>Dopamine</th><th>Zone</th><th></th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td><strong>${esc(item.name)}</strong></td>
            <td><span class="badge badge-${item.type}">${item.type}</span></td>
            <td>
              <div class="bar-wrap">
                ${item.effort.toFixed(1)}
                <div class="bar-bg"><div class="bar-fill bar-effort" style="width:${item.effort * 10}%"></div></div>
              </div>
            </td>
            <td>
              <div class="bar-wrap">
                ${item.dopamine.toFixed(1)}
                <div class="bar-bg"><div class="bar-fill bar-dopamine" style="width:${item.dopamine * 10}%"></div></div>
              </div>
            </td>
            <td>
              <span class="badge ${isQuality(item) ? 'badge-quality' : 'badge-cheap'}">
                ${isQuality(item) ? 'Quality' : 'Cheap'}
              </span>
            </td>
            <td><button class="btn btn-danger" onclick="deleteItem('${item.id}')">Delete</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ─── Graph Tab ──────────────────────────────────────────────────────────────

let graphChart = null;

function renderGraph() {
  const items  = getItems();
  const canvas = document.getElementById('graph-canvas');

  if (graphChart) { graphChart.destroy(); graphChart = null; }

  const quality = items.filter(i =>  isQuality(i)).map(i => ({ x: i.effort, y: i.dopamine, name: i.name }));
  const cheap   = items.filter(i => !isQuality(i)).map(i => ({ x: i.effort, y: i.dopamine, name: i.name }));

  // Plugin: draw labels above each point
  const labelPlugin = {
    id: 'pointLabels',
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx;
      ctx.save();
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#333';
      chart.data.datasets.forEach((ds, di) => {
        const meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        meta.data.forEach((el, pi) => {
          const point = ds.data[pi];
          if (point && point.name) {
            ctx.fillText(point.name, el.x, el.y - 11);
          }
        });
      });
      ctx.restore();
    }
  };

  // Plugin: dashed divider line at effort=5
  const dividerPlugin = {
    id: 'divider',
    beforeDraw(chart) {
      const ctx = chart.ctx;
      const xs  = chart.scales.x;
      const ys  = chart.scales.y;
      if (!xs || !ys) return;
      const xPx = xs.getPixelForValue(5);
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(xPx, ys.top);
      ctx.lineTo(xPx, ys.bottom);
      ctx.stroke();
      ctx.font = '600 11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(196,34,34,0.45)';
      ctx.fillText('← CHEAP', xPx - 55, ys.top + 16);
      ctx.fillStyle = 'rgba(26,124,69,0.45)';
      ctx.fillText('QUALITY →', xPx + 60, ys.top + 16);
      ctx.restore();
    }
  };

  graphChart = new Chart(canvas, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Quality (effort ≥ 5)',
          data: quality,
          backgroundColor: 'rgba(26,124,69,0.75)',
          pointRadius: 9,
          pointHoverRadius: 11,
        },
        {
          label: 'Cheap (effort < 5)',
          data: cheap,
          backgroundColor: 'rgba(200,40,40,0.75)',
          pointRadius: 9,
          pointHoverRadius: 11,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          min: 0, max: 10,
          title: { display: true, text: 'Effort  →', font: { size: 12, weight: '600' } },
          ticks: { stepSize: 1 }
        },
        y: {
          min: 0, max: 10,
          title: { display: true, text: 'Dopamine  ↑', font: { size: 12, weight: '600' } },
          ticks: { stepSize: 1 }
        }
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.raw.name}: effort ${ctx.raw.x}, dopamine ${ctx.raw.y}`
          }
        }
      }
    },
    plugins: [labelPlugin, dividerPlugin]
  });
}

// ─── Schedule Tab ───────────────────────────────────────────────────────────

function addScheduleEntry() {
  const date     = document.getElementById('schedule-date').value;
  const itemId   = document.getElementById('schedule-item-select').value;
  const duration = parseInt(document.getElementById('schedule-duration').value);

  if (!date)                     return alert('Please select a date.');
  if (!itemId)                   return alert('Please select an item.');
  if (!duration || duration < 1) return alert('Please enter a valid duration.');

  const entries    = getSchedule();
  const dayEntries = entries.filter(e => e.date === date);
  const maxOrder   = dayEntries.length ? Math.max(...dayEntries.map(e => e.order)) : -1;

  entries.push({ id: uid(), date, itemId, durationMin: duration, order: maxOrder + 1 });
  save(KEY.schedule, entries);
  renderSchedule();
}

function deleteScheduleEntry(id) {
  save(KEY.schedule, getSchedule().filter(e => e.id !== id));
  renderSchedule();
}

function moveScheduleEntry(id, dir) {
  const date    = document.getElementById('schedule-date').value;
  const entries = getSchedule();
  const day     = entries.filter(e => e.date === date).sort((a, b) => a.order - b.order);
  const idx     = day.findIndex(e => e.id === id);

  if (dir === 'up'   && idx === 0)              return;
  if (dir === 'down' && idx === day.length - 1) return;

  const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
  [day[idx].order, day[swapIdx].order] = [day[swapIdx].order, day[idx].order];
  save(KEY.schedule, entries);
  renderSchedule();
}

function renderSchedule() {
  const date = document.getElementById('schedule-date').value;
  const el   = document.getElementById('schedule-list');

  if (!date) { el.innerHTML = '<div class="empty">Select a date above.</div>'; return; }

  const map     = itemMap();
  const entries = getSchedule().filter(e => e.date === date).sort((a, b) => a.order - b.order);

  if (!entries.length) {
    el.innerHTML = '<div class="empty">Nothing planned for this day yet.</div>';
    return;
  }

  const totalMin = entries.reduce((s, e) => s + e.durationMin, 0);

  el.innerHTML = `
    <table>
      <thead>
        <tr><th>#</th><th>Activity</th><th>Type</th><th>Zone</th><th>Duration</th><th></th><th></th></tr>
      </thead>
      <tbody>
        ${entries.map((e, i) => {
          const item = map[e.itemId];
          if (!item) return `<tr><td colspan="7" style="color:#bbb">Item deleted</td></tr>`;
          return `
            <tr>
              <td style="color:#bbb;font-weight:600">${i + 1}</td>
              <td><strong>${esc(item.name)}</strong></td>
              <td><span class="badge badge-${item.type}">${item.type}</span></td>
              <td><span class="badge ${isQuality(item) ? 'badge-quality' : 'badge-cheap'}">${isQuality(item) ? 'Quality' : 'Cheap'}</span></td>
              <td>${e.durationMin} min</td>
              <td>
                <div class="order-btns">
                  <button class="order-btn" onclick="moveScheduleEntry('${e.id}','up')">▲</button>
                  <button class="order-btn" onclick="moveScheduleEntry('${e.id}','down')">▼</button>
                </div>
              </td>
              <td><button class="btn btn-danger" onclick="deleteScheduleEntry('${e.id}')">✕</button></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
    <div style="margin-top:12px;font-size:0.8rem;color:#888">
      Total planned: <strong>${totalMin} min</strong> (${(totalMin / 60).toFixed(1)}h)
    </div>
  `;
}

// ─── Log Tab ────────────────────────────────────────────────────────────────

function addLogEntry() {
  const date      = document.getElementById('log-date').value;
  const itemId    = document.getElementById('log-item-select').value;
  const startTime = document.getElementById('log-start-time').value;
  const duration  = parseInt(document.getElementById('log-duration').value);

  if (!date)                     return alert('Please select a date.');
  if (!itemId)                   return alert('Please select an item.');
  if (!duration || duration < 1) return alert('Please enter a valid duration.');

  const entries = getLog();
  entries.push({ id: uid(), date, itemId, startTime: startTime || '', durationMin: duration });
  save(KEY.log, entries);
  renderLog();
}

function deleteLogEntry(id) {
  save(KEY.log, getLog().filter(e => e.id !== id));
  renderLog();
}

function sortedDayLog(date) {
  return getLog()
    .filter(e => e.date === date)
    .sort((a, b) => {
      if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
      if (a.startTime) return -1;
      if (b.startTime) return 1;
      return 0;
    });
}

function calcQualityBeforeCheap(entries, map) {
  let minutes = 0;
  for (const e of entries) {
    const item = map[e.itemId];
    if (!item) continue;
    if (isQuality(item)) { minutes += e.durationMin; }
    else                 { break; }
  }
  return minutes;
}

function renderLog() {
  const date = document.getElementById('log-date').value;
  const el   = document.getElementById('log-list');

  if (!date) { el.innerHTML = '<div class="empty">Select a date above.</div>'; return; }

  const map     = itemMap();
  const entries = sortedDayLog(date);

  if (!entries.length) {
    el.innerHTML = '<div class="empty">Nothing logged for this day yet.</div>';
    return;
  }

  const totalMin      = entries.reduce((s, e) => s + e.durationMin, 0);
  const qualityMin    = entries.reduce((s, e) => { const i = map[e.itemId]; return (i && isQuality(i)) ? s + e.durationMin : s; }, 0);
  const qualityBefore = calcQualityBeforeCheap(entries, map);

  el.innerHTML = `
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Total Logged</div>
        <div class="stat-value">${totalMin}m</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Quality Time</div>
        <div class="stat-value stat-quality">${qualityMin}m</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Quality Before Cheap</div>
        <div class="stat-value stat-purple">${qualityBefore}m</div>
      </div>
    </div>
    <table>
      <thead>
        <tr><th>Start</th><th>Activity</th><th>Zone</th><th>Duration</th><th></th></tr>
      </thead>
      <tbody>
        ${entries.map(e => {
          const item = map[e.itemId];
          if (!item) return `<tr><td colspan="5" style="color:#bbb">Item deleted</td></tr>`;
          return `
            <tr>
              <td style="color:#aaa;font-variant-numeric:tabular-nums">${e.startTime || '—'}</td>
              <td><strong>${esc(item.name)}</strong></td>
              <td><span class="badge ${isQuality(item) ? 'badge-quality' : 'badge-cheap'}">${isQuality(item) ? 'Quality' : 'Cheap'}</span></td>
              <td>${e.durationMin} min</td>
              <td><button class="btn btn-danger" onclick="deleteLogEntry('${e.id}')">✕</button></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

// ─── Trendline Tab ──────────────────────────────────────────────────────────

let trendChart = null;
let trendRange = 'week';

function setTrendRange(range, btn) {
  trendRange = range;
  document.querySelectorAll('.range-btns button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTrendline();
}

function renderTrendline() {
  const days    = trendRange === 'week' ? 7 : trendRange === 'month' ? 30 : 365;
  const canvas  = document.getElementById('trend-canvas');
  const map     = itemMap();
  const logData = getLog();

  const today = new Date();
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().split('T')[0];
  });

  const values = dates.map(date => {
    const entries = logData
      .filter(e => e.date === date)
      .sort((a, b) => {
        if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
        if (a.startTime) return -1;
        if (b.startTime) return 1;
        return 0;
      });
    return calcQualityBeforeCheap(entries, map);
  });

  const labels = dates.map(d => {
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  if (trendChart) { trendChart.destroy(); trendChart = null; }

  trendChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Quality minutes before first cheap activity',
        data: values,
        borderColor: '#5b4cdb',
        backgroundColor: 'rgba(91,76,219,0.08)',
        fill: true,
        tension: 0.35,
        pointRadius: 5,
        pointBackgroundColor: '#5b4cdb',
        pointHoverRadius: 7,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          title: { display: true, text: 'Minutes of quality activity', font: { size: 12 } },
          ticks: { stepSize: 30 }
        },
        x: {
          title: { display: true, text: 'Date', font: { size: 12 } }
        }
      },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.raw} min of quality time`
          }
        }
      }
    }
  });
}

// ─── Shared ─────────────────────────────────────────────────────────────────

function refreshSelects() {
  const items = getItems();
  const opts  = items.map(i =>
    `<option value="${i.id}">${esc(i.name)} (E:${i.effort.toFixed(1)} / D:${i.dopamine.toFixed(1)})</option>`
  ).join('');
  const placeholder = '<option value="">— select item —</option>';
  document.getElementById('schedule-item-select').innerHTML = placeholder + opts;
  document.getElementById('log-item-select').innerHTML      = placeholder + opts;
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));

  document.getElementById('tab-' + tab).classList.add('active');
  const tabs = ['items', 'graph', 'schedule', 'log', 'trendline'];
  document.querySelectorAll('nav button')[tabs.indexOf(tab)].classList.add('active');

  if (tab === 'graph')     renderGraph();
  if (tab === 'trendline') renderTrendline();
}

// ─── Init ────────────────────────────────────────────────────────────────────

(function init() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('schedule-date').value = today;
  document.getElementById('log-date').value      = today;

  const now = new Date();
  document.getElementById('log-start-time').value =
    String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

  renderItems();
  renderSchedule();
  renderLog();
  refreshSelects();
})();
