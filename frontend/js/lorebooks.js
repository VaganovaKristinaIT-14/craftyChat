// ============================================================
// LOREBOOKS — полное управление лорбуками (с улучшениями)
// ============================================================

let selectedLorebookId = null;
let expandedEntries = new Set();

// Читаемые названия статусов
const STATUS_MAP = {
  constant: { label: 'Постоянная', color: '#f39c12', icon: '🔒' },
  normal:   { label: 'Обычная', color: '#4a6cf7', icon: '📄' },
  vector:   { label: 'Векторная', color: '#9b59b6', icon: '📚' }
};

async function renderLorebooksPanel() {
  const body = document.getElementById('central-panel-body');
  if (!body) return;

  try {
    const lorebooks = await getLorebooks();
    if (!selectedLorebookId && lorebooks.length > 0) selectedLorebookId = lorebooks[0].id;
    if (selectedLorebookId && !lorebooks.find(l => l.id === selectedLorebookId)) selectedLorebookId = null;

    // --- Шапка ---
    let html = `
      <div class="lorebook-header">
        <div class="lorebook-selector">
          <select id="lorebookSelect" class="lorebook-select">
            ${lorebooks.map(l => `<option value="${l.id}" ${l.id === selectedLorebookId ? 'selected' : ''}>${escHtml(l.name)}</option>`).join('')}
          </select>
          <button class="btn btn-sm" id="createLorebookBtn" title="Создать новый мир">➕</button>
          <button class="btn btn-sm btn-outline" id="renameLorebookBtn" title="Переименовать мир">✎</button>
          <button class="btn btn-sm" id="duplicateLorebookBtn" title="Создать копию мира">📋</button>
          <button class="btn btn-sm btn-danger" id="deleteLorebookBtn" title="Удалить мир">🗑️</button>
          <button class="btn btn-sm" id="exportLorebookBtn" title="Экспортировать мир">⬇️</button>
          <button class="btn btn-sm" id="importLorebookBtn" title="Импортировать мир">⬆️</button>
        </div>
        <div class="lorebook-stats">
          <span class="stat-badge">📚 ${lorebooks.length} миров</span>
          ${selectedLorebookId ? `<span class="stat-badge">📝 ${lorebooks.find(l => l.id === selectedLorebookId)?.entries?.length || 0} записей</span>` : ''}
        </div>
      </div>
    `;

    const lb = lorebooks.find(l => l.id === selectedLorebookId);
    if (lb) {
      html += `
        <div class="world-header">
          <h3 class="world-name">🌍 ${escHtml(lb.name)}</h3>
          <button class="btn btn-sm" id="addEntryBtn">➕ Добавить запись</button>
        </div>
        <div id="entriesList" class="entries-grid">
          ${lb.entries.length === 0 ? '<p class="empty-message">Нет записей. Создайте первую!</p>' :
            lb.entries.map(e => {
              const isExpanded = expandedEntries.has(e.id);
              const status = STATUS_MAP[e.status] || STATUS_MAP.normal;
              const priorityEmoji = e.priority <= 3 ? '🔴' : e.priority <= 6 ? '🟡' : '🟢';
              return `
                <div class="entry-card ${e.active ? 'active' : 'inactive'}" data-id="${e.id}">
                  <div class="entry-header">
                    <div class="entry-title">
                      <span class="drag-handle" title="Перетащите для изменения порядка">⠿</span>
                      <span class="entry-name">${escHtml(e.name)}</span>
                      <button class="rename-entry-btn btn btn-sm btn-outline" data-id="${e.id}" title="Переименовать запись">✎</button>
                      <span class="status-badge" style="background:${status.color}; color:#fff;" title="${status.label}">${status.icon} ${status.label}</span>
                      <span class="priority-badge" title="Приоритет: ${e.priority} (1 — самый важный)">${priorityEmoji} ${e.priority}</span>
                    </div>
                    <div class="entry-controls">
                      <label class="toggle-label" title="${e.active ? 'Активна' : 'Неактивна'}">
                        <input type="checkbox" class="entry-active" ${e.active ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                      </label>
                      <button class="btn btn-sm btn-danger delete-entry-btn" data-id="${e.id}" title="Удалить запись">✕</button>
                    </div>
                  </div>
                  <div class="entry-detail" style="display:${isExpanded ? 'block' : 'none'};">
                    <div class="entry-field">
                      <label>🔑 Ключевые слова (введите слово и нажмите Enter)</label>
                      <div class="keywords-container">
                        ${e.keywords.map(k => `<span class="keyword-chip">${escHtml(k)} <button class="remove-keyword" data-keyword="${k}">✕</button></span>`).join('')}
                      </div>
                      <input class="add-keyword-input" placeholder="Например: замок, принц, магия" />
                    </div>
                    <div class="entry-field row">
                      <div class="field-group">
                        <label>🎯 Приоритет (1–10)</label>
                        <input type="number" class="entry-priority" value="${e.priority}" min="1" max="10" title="1 — самый высокий приоритет" />
                      </div>
                      <div class="field-group">
                        <label>🔍 Глубина сканирования (%)</label>
                        <input type="number" class="entry-depth" value="${e.scan_depth}" min="0" max="100" title="Насколько далеко в истории искать ключевые слова" />
                      </div>
                      <div class="field-group">
                        <label>📌 Статус</label>
                        <select class="entry-status">
                          <option value="constant" ${e.status === 'constant' ? 'selected' : ''}>Постоянная (всегда)</option>
                          <option value="normal" ${e.status === 'normal' ? 'selected' : ''}>Обычная (по ключевым словам)</option>
                          <option value="vector" ${e.status === 'vector' ? 'selected' : ''}>Векторная (общий блок)</option>
                        </select>
                      </div>
                    </div>
                    <div class="entry-field">
                      <label>📄 Содержание записи</label>
                      <textarea class="entry-content" rows="3" placeholder="Текст, который будет добавлен в промпт при активации записи">${escHtml(e.content)}</textarea>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
        </div>
      `;
    } else {
      html += `<p class="empty-message">Создайте свой первый мир!</p>`;
    }

    body.innerHTML = html;

    // ========== ОБРАБОТЧИКИ ==========

    // 1. Создать мир
    document.getElementById('createLorebookBtn')?.addEventListener('click', async () => {
      const name = prompt('Название нового мира:');
      if (name) {
        const newLb = await createLorebook(name);
        selectedLorebookId = newLb.id;
        renderLorebooksPanel();
        showToast('Мир создан', 'success');
      }
    });

    // 2. Переключение мира
    document.getElementById('lorebookSelect')?.addEventListener('change', function() {
      selectedLorebookId = this.value;
      renderLorebooksPanel();
    });

    // 3. Переименовать мир
    document.getElementById('renameLorebookBtn')?.addEventListener('click', async () => {
      const id = document.getElementById('lorebookSelect').value;
      const name = prompt('Новое название мира:');
      if (name) {
        await renameLorebook(id, name);
        renderLorebooksPanel();
        showToast('Мир переименован', 'success');
      }
    });

    // 4. Дублировать мир
    document.getElementById('duplicateLorebookBtn')?.addEventListener('click', async () => {
      const id = document.getElementById('lorebookSelect').value;
      const newLb = await duplicateLorebook(id);
      selectedLorebookId = newLb.id;
      renderLorebooksPanel();
      showToast('Мир скопирован', 'success');
    });

    // 5. Удалить мир
    document.getElementById('deleteLorebookBtn')?.addEventListener('click', async () => {
      const id = document.getElementById('lorebookSelect').value;
      if (!confirm('Удалить мир и все его записи?')) return;
      await deleteLorebook(id);
      selectedLorebookId = null;
      renderLorebooksPanel();
      showToast('Мир удалён', 'success');
    });

    // 6. Экспорт мира
    document.getElementById('exportLorebookBtn')?.addEventListener('click', async () => {
      const id = document.getElementById('lorebookSelect').value;
      const data = await exportLorebook(id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `lorebook_${data.name}.json`; a.click();
      URL.revokeObjectURL(url);
      showToast('Мир экспортирован', 'success');
    });

    // 7. Импорт мира
    document.getElementById('importLorebookBtn')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.json';
      input.onchange = async (ev) => {
        const file = ev.target.files[0];
        if (!file) return;
        const text = await file.text();
        try {
          const imported = JSON.parse(text);
          if (!imported.name) { showToast('Неверный формат', 'error'); return; }
          const newLb = await importLorebook(imported);
          selectedLorebookId = newLb.id;
          renderLorebooksPanel();
          showToast('Мир импортирован', 'success');
        } catch (e) { showToast('Ошибка импорта', 'error'); }
      };
      input.click();
    });

    // 8. Добавить запись
    document.getElementById('addEntryBtn')?.addEventListener('click', async () => {
      const id = document.getElementById('lorebookSelect').value;
      await createLoreEntry(id, { name: 'Новая запись' });
      renderLorebooksPanel();
      showToast('Запись добавлена', 'success');
    });

    // 9. Переименовать запись (новая кнопка ✎)
    document.querySelectorAll('.rename-entry-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        const card = this.closest('.entry-card');
        const entryId = card.dataset.id;
        const worldId = document.getElementById('lorebookSelect').value;
        const currentName = card.querySelector('.entry-name').textContent;
        const newName = prompt('Введите новое название записи:', currentName);
        if (newName && newName.trim()) {
          await updateLoreEntry(worldId, entryId, { name: newName.trim() });
          renderLorebooksPanel();
          showToast('Запись переименована', 'success');
        }
      });
    });

    // 10. Раскрытие/сворачивание записи (по клику на имя или на заголовок)
    document.querySelectorAll('.entry-name, .entry-toggle').forEach(el => {
      el.addEventListener('click', function(e) {
        // Игнорируем клик по кнопке переименования (они выше)
        if (e.target.closest('.rename-entry-btn')) return;
        const card = this.closest('.entry-card');
        const id = card.dataset.id;
        if (expandedEntries.has(id)) expandedEntries.delete(id);
        else expandedEntries.add(id);
        renderLorebooksPanel();
      });
    });

    // 11. Включение/выключение записи
    document.querySelectorAll('.entry-active').forEach(cb => {
      cb.addEventListener('change', async function() {
        const card = this.closest('.entry-card');
        const entryId = card.dataset.id;
        const worldId = document.getElementById('lorebookSelect').value;
        await updateLoreEntry(worldId, entryId, { active: this.checked });
        // обновляем визуал
        card.classList.toggle('active', this.checked);
        card.classList.toggle('inactive', !this.checked);
      });
    });

    // 12. Удаление записи
    document.querySelectorAll('.delete-entry-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        const card = this.closest('.entry-card');
        const entryId = card.dataset.id;
        const worldId = document.getElementById('lorebookSelect').value;
        if (!confirm('Удалить запись?')) return;
        await deleteLoreEntry(worldId, entryId);
        renderLorebooksPanel();
        showToast('Запись удалена', 'success');
      });
    });

    // 13. Добавление ключевого слова
    document.querySelectorAll('.add-keyword-input').forEach(input => {
      input.addEventListener('keydown', async function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          const kw = this.value.trim();
          if (!kw) return;
          const card = this.closest('.entry-card');
          const entryId = card.dataset.id;
          const worldId = document.getElementById('lorebookSelect').value;
          await addKeywordToEntry(worldId, entryId, kw);
          renderLorebooksPanel();
        }
      });
    });

    // 14. Удаление ключевого слова
    document.querySelectorAll('.remove-keyword').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        const kw = this.dataset.keyword;
        const card = this.closest('.entry-card');
        const entryId = card.dataset.id;
        const worldId = document.getElementById('lorebookSelect').value;
        await removeKeywordFromEntry(worldId, entryId, kw);
        renderLorebooksPanel();
      });
    });

    // 15. Автосохранение полей (приоритет, глубина, статус, содержание)
    document.querySelectorAll('.entry-priority, .entry-depth, .entry-status, .entry-content').forEach(el => {
      el.addEventListener('change', debounce(async function() {
        const card = this.closest('.entry-card');
        const entryId = card.dataset.id;
        const worldId = document.getElementById('lorebookSelect').value;
        const field = this.classList.contains('entry-priority') ? 'priority' :
                      this.classList.contains('entry-depth') ? 'scan_depth' :
                      this.classList.contains('entry-status') ? 'status' : 'content';
        const val = this.type === 'number' ? parseInt(this.value) : this.value;
        await updateLoreEntry(worldId, entryId, { [field]: val });
        // Если изменился статус или приоритет, перерисовываем для обновления бейджей
        if (field === 'status' || field === 'priority') {
          renderLorebooksPanel();
        }
      }, 500));
    });

    // 16. Drag-and-drop (пока заглушка — можно добавить позже)
    // Здесь можно добавить библиотеку Sortable или реализовать вручную.
    // Пока оставим как есть.

  } catch (e) {
    body.innerHTML = `<p class="error-message">Ошибка загрузки лорбуков</p>`;
    console.error(e);
  }
}