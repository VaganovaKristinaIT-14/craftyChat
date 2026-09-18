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
            lb.entries.slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map(e => {
              const isExpanded = expandedEntries.has(e.id);
              const statusColor = e.status === 'constant' ? 'var(--amber)' :
                                  e.status === 'vector' ? 'var(--paper-faint)' :
                                  '#4caf50';
              return `
                <div class="entry-card ${e.active ? 'active' : 'inactive'}" data-id="${e.id}" draggable="true">
                  <div class="entry-header">
                    <div class="entry-title">
                      <span class="drag-handle" title="Перетащите для изменения порядка">⠿</span>
                      <span class="entry-name" style="cursor:pointer; font-weight:600;">${escHtml(e.name)}</span>
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
                  <div class="entry-detail" style="display:${isExpanded ? 'block' : 'none'}; padding-top:12px; margin-top:12px; border-top:1px solid var(--line);">
                    <div class="entry-field">
                      <label class="preset-label">Ключевые слова (Enter для добавления)</label>
                      <div class="keywords-container">
                        ${e.keywords.map(k => `
                          <span class="keyword-chip">
                            ${escHtml(k)}
                            <button class="remove-keyword" data-keyword="${k}">${window.iconImg('close', 'Удалить', 12, 12)}</button>
                          </span>
                        `).join('')}
                        <input class="add-keyword-input" placeholder="Добавить...">
                      </div>
                    </div>
                    <div class="entry-field row" style="display:flex; gap:10px; margin-top:10px;">
                      <div class="field-group" style="flex:1;">
                        <label class="preset-label">Приоритет</label>
                        <input type="number" class="entry-priority" value="${e.priority}" min="1" max="10">
                      </div>
                      <div class="field-group" style="flex:1;">
                        <label class="preset-label">Глубина %</label>
                        <input type="number" class="entry-depth" value="${e.scan_depth}" min="0" max="100">
                      </div>
                      <div class="field-group" style="flex:1;">
                        <label class="preset-label">Статус</label>
                        <select class="entry-status">
                          <option value="constant" ${e.status === 'constant' ? 'selected' : ''}>Постоянная</option>
                          <option value="normal" ${e.status === 'normal' ? 'selected' : ''}>Обычная</option>
                          <option value="vector" ${e.status === 'vector' ? 'selected' : ''}>Векторная</option>
                        </select>
                      </div>
                    </div>
                    <div class="entry-field" style="margin-top:10px;">
                      <label class="preset-label">Содержание записи</label>
                      <textarea class="entry-content" rows="4">${escHtml(e.content)}</textarea>
                    </div>
                    <div style="display:flex; justify-content:flex-end; margin-top:10px;">
                        <button class="btn btn-sm btn-outline close-detail-btn" data-id="${e.id}">Свернуть</button>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
        </div>
      `;
    }

    body.innerHTML = html;

    // --- Обработчики событий ---

    const stop = (e) => e.stopPropagation();

    document.getElementById('lorebookSelect')?.addEventListener('change', function(e) {
      selectedLorebookId = this.value;
      renderLorebooksPanel();
    });

    document.getElementById('createLorebookBtn')?.addEventListener('click', async (e) => {
      stop(e);
      const name = await showPrompt('Название нового мира');
      if (name) {
        const newLb = await createLorebook(name);
        window.markDirty('lorebooks');
        selectedLorebookId = newLb.id;
        renderLorebooksPanel();
      }
    });

    document.getElementById('renameLorebookBtn')?.addEventListener('click', async (e) => {
      stop(e);
      const name = await showPrompt('Новое имя мира');
      if (name) {
        await renameLorebook(selectedLorebookId, name);
        window.markDirty('lorebooks');
        renderLorebooksPanel();
      }
    });

    document.getElementById('duplicateLorebookBtn')?.addEventListener('click', async (e) => {
      stop(e);
      await duplicateLorebook(selectedLorebookId);
      window.markDirty('lorebooks');
      renderLorebooksPanel();
    });

    document.getElementById('deleteLorebookBtn')?.addEventListener('click', async (e) => {
      stop(e);
      if (await showConfirm('Удалить мир?')) {
        await deleteLorebook(selectedLorebookId);
        window.markDirty('lorebooks');
        selectedLorebookId = null;
        renderLorebooksPanel();
      }
    });

    document.getElementById('addEntryBtn')?.addEventListener('click', async (e) => {
      stop(e);
      await createLoreEntry(selectedLorebookId, { name: 'Новая запись' });
      window.markDirty('lorebooks');
      renderLorebooksPanel();
    });

    // Раскрытие / Свертывание
    document.querySelectorAll('.entry-name').forEach(el => {
      el.addEventListener('click', function(e) {
        stop(e);
        const id = this.closest('.entry-card').dataset.id;
        if (expandedEntries.has(id)) expandedEntries.delete(id);
        else expandedEntries.add(id);
        renderLorebooksPanel();
      });
    });

    document.querySelectorAll('.close-detail-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        stop(e);
        const id = this.dataset.id;
        expandedEntries.delete(id);
        renderLorebooksPanel();
      });
    });

    // Переключатель активности
    document.querySelectorAll('.entry-active').forEach(cb => {
      cb.addEventListener('change', async function(e) {
        stop(e);
        const id = this.closest('.entry-card').dataset.id;
        await updateLoreEntry(selectedLorebookId, id, { active: this.checked });
        window.markDirty('lorebooks');
      });
    });

    // Редактирование имени записи
    document.querySelectorAll('.edit-entry-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        stop(e);
        const id = this.dataset.id;
        const oldName = this.closest('.entry-card').querySelector('.entry-name').textContent;
        const newName = await showPrompt('Новое имя записи', oldName);
        if (newName) {
          await updateLoreEntry(selectedLorebookId, id, { name: newName });
          window.markDirty('lorebooks');
          renderLorebooksPanel();
        }
      });
    });

    // Удаление записи
    document.querySelectorAll('.delete-entry-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        stop(e);
        if (await showConfirm('Удалить запись?')) {
          await deleteLoreEntry(selectedLorebookId, this.dataset.id);
          window.markDirty('lorebooks');
          renderLorebooksPanel();
        }
      });
    });

    // Ключевые слова
    document.querySelectorAll('.add-keyword-input').forEach(input => {
      input.addEventListener('keydown', async function(e) {
        if (e.key === 'Enter') {
          stop(e);
          const kw = this.value.trim();
          if (kw) {
            const id = this.closest('.entry-card').dataset.id;
            await addKeywordToEntry(selectedLorebookId, id, kw);
            renderLorebooksPanel();
          }
        }
      });
    });

    document.querySelectorAll('.remove-keyword').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        stop(e);
        const id = this.closest('.entry-card').dataset.id;
        await removeKeywordFromEntry(selectedLorebookId, id, this.dataset.keyword);
        renderLorebooksPanel();
      });
    });

    // Автосохранение контента и настроек
    document.querySelectorAll('.entry-priority, .entry-depth, .entry-status, .entry-content').forEach(el => {
      el.addEventListener('change', debounce(async function(e) {
        const id = this.closest('.entry-card').dataset.id;
        let field = 'content';
        if (this.classList.contains('entry-priority')) field = 'priority';
        if (this.classList.contains('entry-depth')) field = 'scan_depth';
        if (this.classList.contains('entry-status')) field = 'status';

        const val = this.type === 'number' ? parseInt(this.value) : this.value;
        await updateLoreEntry(selectedLorebookId, id, { [field]: val });
        window.markDirty('lorebooks');
        if (field !== 'content') renderLorebooksPanel(); // Обновить бейджи
      }, 600));
    });

    // Drag and Drop
    let draggedId = null;
    document.querySelectorAll('.entry-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        draggedId = card.dataset.id;
        card.style.opacity = '0.4';
      });
      card.addEventListener('dragend', () => card.style.opacity = '1');
      card.addEventListener('dragover', (e) => e.preventDefault());
      card.addEventListener('drop', async (e) => {
        e.preventDefault();
        const targetId = card.dataset.id;
        if (draggedId && draggedId !== targetId) {
          const ids = Array.from(document.querySelectorAll('.entry-card')).map(c => c.dataset.id);
          const oldIdx = ids.indexOf(draggedId);
          const newIdx = ids.indexOf(targetId);
          ids.splice(oldIdx, 1);
          ids.splice(newIdx, 0, draggedId);
          await reorderLoreEntries(selectedLorebookId, ids);
          window.markDirty('lorebooks');
          renderLorebooksPanel();
        }
      });
    });

  } catch (err) {
    console.error(err);
    body.innerHTML = `<p class="error-message">Ошибка загрузки</p>`;
  }
}