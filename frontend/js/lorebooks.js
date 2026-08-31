// ============================================================
// LOREBOOKS — полное управление лорбуками (с улучшениями)
// ============================================================

let selectedLorebookId = null;
let expandedEntries = new Set(); // содержит id записей, у которых раскрыты детали

async function renderLorebooksPanel() {
  const body = document.getElementById('central-panel-body');
  if (!body) return;

  try {
    const lorebooks = await getLorebooks();
    if (!selectedLorebookId && lorebooks.length > 0) selectedLorebookId = lorebooks[0].id;
    if (selectedLorebookId && !lorebooks.find(l => l.id === selectedLorebookId)) selectedLorebookId = null;

    // --- Шапка (без фона и статистики) ---
    let html = `
      <div style="display:flex; align-items:center; gap:6px; margin-bottom:16px; flex-wrap:wrap;">
        <select id="lorebookSelect" style="background:var(--ink-0); color:var(--paper); border:1px solid var(--line); border-radius:4px; padding:4px 8px; min-width:160px;">
          ${lorebooks.map(l => `<option value="${l.id}" ${l.id === selectedLorebookId ? 'selected' : ''}>${escHtml(l.name)}</option>`).join('')}
        </select>
        <button class="preset-tool-btn" id="createLorebookBtn" title="Создать новый мир">${window.iconImg('add', 'Создать', 18, 18)}</button>
        <button class="preset-tool-btn" id="renameLorebookBtn" title="Переименовать мир">${window.iconImg('rename', 'Переименовать', 18, 18)}</button>
        <button class="preset-tool-btn" id="duplicateLorebookBtn" title="Создать копию мира">${window.iconImg('copy', 'Копировать', 18, 18)}</button>
        <button class="preset-tool-btn" id="deleteLorebookBtn" title="Удалить мир">${window.iconImg('delete', 'Удалить', 18, 18)}</button>
        <button class="preset-tool-btn" id="exportLorebookBtn" title="Экспортировать мир">${window.iconImg('export', 'Экспорт', 18, 18)}</button>
        <button class="preset-tool-btn" id="importLorebookBtn" title="Импортировать мир">${window.iconImg('import', 'Импорт', 18, 18)}</button>
      </div>
    `;

    const lb = lorebooks.find(l => l.id === selectedLorebookId);
    if (lb) {
      html += `
        <div class="world-header" style="display:flex; justify-content:space-between; align-items:center; margin:8px 0 16px;">
          <h3 class="world-name" style="font-family:var(--font-display); font-size:22px; font-weight:560; margin:0;">${escHtml(lb.name)}</h3>
          <button class="add-entry-btn" id="addEntryBtn" title="Добавить запись">
            ${window.iconImg('add', 'Добавить запись', 18, 18)} Добавить запись
          </button>
        </div>
        <div id="entriesList" class="entries-grid">
          ${lb.entries.length === 0 ? '<p class="empty-message">Нет записей. Создайте первую!</p>' :
            // сортируем записи по order (если есть)
            lb.entries.slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map(e => {
              const isExpanded = expandedEntries.has(e.id);
              // статус – только цветной кружок
              const statusColor = e.status === 'constant' ? 'var(--amber)' :
                                  e.status === 'vector' ? 'var(--paper-faint)' :
                                  '#4caf50'; // normal – зеленый
              return `
                <div class="entry-card ${e.active ? 'active' : 'inactive'}" data-id="${e.id}" draggable="true">
                  <div class="entry-header">
                    <div class="entry-title">
                      <span class="drag-handle" title="Перетащите для изменения порядка">⠿</span>
                      <span class="entry-name">${escHtml(e.name)}</span>
                      <span class="status-dot" style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${statusColor}; margin-left:6px;" title="${e.status}"></span>
                      <span class="priority-badge" style="font-size:12px; background:var(--ink-4); padding:2px 8px; border-radius:12px; color:var(--paper-dim);">${e.priority}</span>
                    </div>
                    <div class="entry-controls">
                      <label class="switch" title="${e.active ? 'Активна' : 'Неактивна'}">
                        <input type="checkbox" class="entry-active" ${e.active ? 'checked' : ''}>
                        <span class="slider"></span>
                      </label>
                      <button class="edit-entry-btn" data-id="${e.id}" title="Редактировать запись">${window.iconImg('rename', 'Редактировать', 14, 14)}</button>
                      <button class="delete-entry-btn" data-id="${e.id}" title="Удалить запись">${window.iconImg('delete', 'Удалить', 14, 14)}</button>
                    </div>
                  </div>
                  <div class="entry-detail" style="display:${isExpanded ? 'block' : 'none'};">
                    <div style="display:flex; justify-content:flex-end; margin-bottom:6px;">
                      <button class="close-detail-btn" data-id="${e.id}" title="Закрыть" style="background:transparent; border:none; color:var(--paper-faint); cursor:pointer;">${window.iconImg('close', 'Закрыть', 16, 16)}</button>
                    </div>
                    <div class="entry-field">
                      <label class="preset-label">Ключевые слова</label>
                      <div class="keywords-container" style="display:flex; flex-wrap:wrap; gap:6px; border:1px solid var(--line); border-radius:var(--radius-sm); padding:6px; background:var(--ink-0);">
                        ${e.keywords.map(k => `
                          <span class="keyword-chip" style="background:var(--ink-4); padding:4px 8px; border-radius:16px; display:inline-flex; align-items:center; gap:4px; font-size:13px;">
                            ${escHtml(k)}
                            <button class="remove-keyword" data-keyword="${k}" style="background:transparent; border:none; color:var(--paper-faint); cursor:pointer; padding:0; line-height:1;">${window.iconImg('close', 'Удалить', 12, 12)}</button>
                          </span>
                        `).join('')}
                        <input class="add-keyword-input" placeholder="Введите ключевое слово..." style="border:none; background:transparent; color:var(--paper); padding:4px; flex:1; min-width:80px; outline:none; font-size:14px;">
                      </div>
                    </div>
                    <div class="entry-field row">
                      <div class="field-group">
                        <label class="preset-label">Приоритет (1–10)</label>
                        <input type="number" class="entry-priority" value="${e.priority}" min="1" max="10" title="1 — самый высокий приоритет" />
                      </div>
                      <div class="field-group">
                        <label class="preset-label">Глубина сканирования (%)</label>
                        <input type="number" class="entry-depth" value="${e.scan_depth}" min="0" max="100" title="Насколько далеко в истории искать ключевые слова" />
                      </div>
                      <div class="field-group">
                        <label class="preset-label">Статус</label>
                        <select class="entry-status">
                          <option value="constant" ${e.status === 'constant' ? 'selected' : ''}>Постоянная</option>
                          <option value="normal" ${e.status === 'normal' ? 'selected' : ''}>Обычная</option>
                          <option value="vector" ${e.status === 'vector' ? 'selected' : ''}>Векторная</option>
                        </select>
                      </div>
                    </div>
                    <div class="entry-field">
                      <label class="preset-label">Содержание записи</label>
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
      const name = await showPrompt('Название нового мира', '', { title: 'Новый мир' });
      if (name) {
        const newLb = await createLorebook(name);
        window.markDirty('lorebooks');
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

    // 3. Переименовать мир – без тоста
    document.getElementById('renameLorebookBtn')?.addEventListener('click', async () => {
      const id = document.getElementById('lorebookSelect').value;
      const name = await showPrompt('Новое название мира', '', { title: 'Переименовать мир' });
      if (name) {
        await renameLorebook(id, name);
        window.markDirty('lorebooks');
        renderLorebooksPanel();
        // убрали showToast
      }
    });

    // 4. Дублировать мир
    document.getElementById('duplicateLorebookBtn')?.addEventListener('click', async () => {
      const id = document.getElementById('lorebookSelect').value;
      const newLb = await duplicateLorebook(id);
      window.markDirty('lorebooks');
      selectedLorebookId = newLb.id;
      renderLorebooksPanel();
      showToast('Мир скопирован', 'success');
    });

    // 5. Удалить мир
    document.getElementById('deleteLorebookBtn')?.addEventListener('click', async () => {
      const id = document.getElementById('lorebookSelect').value;
      if (!(await showConfirm('Удалить мир и все его записи? Это действие необратимо.', { title: 'Удаление мира', okText: 'Удалить' }))) return;
      await deleteLorebook(id);
      window.markDirty('lorebooks');
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
          window.markDirty('lorebooks');
          selectedLorebookId = newLb.id;
          renderLorebooksPanel();
          showToast('Мир импортирован', 'success');
        } catch (e) { showToast('Ошибка импорта', 'error'); }
      };
      input.click();
    });

    // 8. Добавить запись – кастомная кнопка
    document.getElementById('addEntryBtn')?.addEventListener('click', async () => {
      const id = document.getElementById('lorebookSelect').value;
      await createLoreEntry(id, { name: 'Новая запись' });
      window.markDirty('lorebooks');
      renderLorebooksPanel();
      showToast('Запись добавлена', 'success');
    });

    // 9. Переименовать запись – без тоста
    document.querySelectorAll('.edit-entry-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        const card = this.closest('.entry-card');
        const entryId = card.dataset.id;
        const worldId = document.getElementById('lorebookSelect').value;
        const currentName = card.querySelector('.entry-name').textContent;
        const newName = await showPrompt('Введите новое название записи', currentName, { title: 'Переименовать запись' });
        if (newName && newName.trim()) {
          await updateLoreEntry(worldId, entryId, { name: newName.trim() });
          window.markDirty('lorebooks');
          renderLorebooksPanel();
          // убрали showToast
        }
      });
    });

    // 10. Раскрытие/сворачивание записи: только открытие по клику на имя, закрытие по крестику или клику вне
    document.querySelectorAll('.entry-name').forEach(el => {
      el.addEventListener('click', function(e) {
        const card = this.closest('.entry-card');
        const id = card.dataset.id;
        // Если уже открыто – не закрываем (только открываем)
        if (!expandedEntries.has(id)) {
          expandedEntries.add(id);
          renderLorebooksPanel();
        }
      });
    });

    // Закрытие по крестику внутри деталей
    document.querySelectorAll('.close-detail-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const card = this.closest('.entry-card');
        const id = card.dataset.id;
        expandedEntries.delete(id);
        renderLorebooksPanel();
      });
    });

    // Закрытие при клике вне карточки (глобально)
    document.addEventListener('click', function onOutsideClick(e) {
      const entriesList = document.getElementById('entriesList');
      if (!entriesList) return;
      if (!entriesList.contains(e.target)) {
        if (expandedEntries.size > 0) {
          expandedEntries.clear();
          renderLorebooksPanel();
        }
      }
    });

    // 11. Включение/выключение записи (переключатель)
    document.querySelectorAll('.entry-active').forEach(cb => {
      cb.addEventListener('change', async function() {
        const card = this.closest('.entry-card');
        const entryId = card.dataset.id;
        const worldId = document.getElementById('lorebookSelect').value;
        await updateLoreEntry(worldId, entryId, { active: this.checked });
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
        if (!(await showConfirm('Удалить запись?', { title: 'Удаление записи', okText: 'Удалить' }))) return;
        await deleteLoreEntry(worldId, entryId);
        window.markDirty('lorebooks');
        renderLorebooksPanel();
        showToast('Запись удалена', 'success');
      });
    });

    // 13. Добавление ключевого слова (по Enter)
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

    // 14. Удаление ключевого слова (иконка close)
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
        window.markDirty('lorebooks');
        // Если изменился статус или приоритет, перерисовываем для обновления бейджей
        if (field === 'status' || field === 'priority') {
          renderLorebooksPanel();
        }
      }, 500));
    });

    // 16. Drag-and-drop (нативный)
    let draggedItem = null;
    const entries = document.querySelectorAll('.entry-card');
    entries.forEach(entry => {
      entry.addEventListener('dragstart', function(e) {
        draggedItem = this;
        this.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
      });
      entry.addEventListener('dragend', function(e) {
        this.style.opacity = '1';
      });
      entry.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const target = this;
        if (target !== draggedItem) {
          const rect = target.getBoundingClientRect();
          const next = (e.clientY > rect.top + rect.height / 2);
          const parent = target.parentNode;
          if (next) {
            parent.insertBefore(draggedItem, target.nextSibling);
          } else {
            parent.insertBefore(draggedItem, target);
          }
        }
      });
    });

    // Сохранение порядка после перетаскивания (по окончании drag)
    document.addEventListener('dragend', async function() {
      if (draggedItem) {
        const entriesList = document.getElementById('entriesList');
        const cardIds = Array.from(entriesList.querySelectorAll('.entry-card')).map(el => el.dataset.id);
        const worldId = document.getElementById('lorebookSelect').value;
        if (worldId && cardIds.length) {
          await reorderLoreEntries(worldId, cardIds);
          window.markDirty('lorebooks');
        }
        draggedItem = null;
      }
    });

  } catch (e) {
    body.innerHTML = `<p class="error-message">Ошибка загрузки лорбуков</p>`;
    console.error(e);
  }
}