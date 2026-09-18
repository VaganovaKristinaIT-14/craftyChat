// ============================================================
// PRESETS — управление пресетами
// ============================================================

function getActiveCollectionFrom(data) {
  if (!data || !data.collections || data.collections.length === 0) return null;
  return data.collections.find(c => c.id === data.activeCollectionId) || data.collections[0];
}

async function renderPresetsPanel() {
  const panelBody = document.getElementById('presets-body');
  if (!panelBody) return;
  try {
    const data = await getPresetsData();
    const collection = getActiveCollectionFrom(data);
    if (!collection) {
      panelBody.innerHTML = `<p style="color:#666;">Нет сборников пресетов</p>`;
      return;
    }

    const settings = await getSettings();
    const censorMode = settings.censor_mode || 'off';

    panelBody.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:16px;flex-wrap:wrap;">
        <select id="collectionSelect" style="background:#2e2e2e;color:#fff;border:1px solid #555;border-radius:4px;padding:4px 8px;flex:1;min-width:120px;">
          ${data.collections.map(c => `
            <option value="${c.id}" ${c.id === data.activeCollectionId ? 'selected' : ''}>${escHtml(c.name)}</option>
          `).join('')}
        </select>
        <button class="preset-tool-btn" id="addCollectionBtn" title="Добавить сборник">${window.iconImg('add', 'Добавить', 18, 18)}</button>
        <button class="preset-tool-btn" id="renameCollectionBtn" title="Переименовать">${window.iconImg('rename', 'Переименовать', 18, 18)}</button>
        <button class="preset-tool-btn" id="deleteCollectionBtn" title="Удалить сборник">${window.iconImg('delete', 'Удалить', 18, 18)}</button>
        <button class="preset-tool-btn" id="exportCollectionBtn" title="Экспортировать">${window.iconImg('export', 'Экспорт', 18, 18)}</button>
        <button class="preset-tool-btn" id="importCollectionBtn" title="Импортировать">${window.iconImg('import', 'Импорт', 18, 18)}</button>
      </div>

      <!-- Блок кнопок цензуры -->
      <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:12px;">
        <button class="censor-btn ${censorMode === 'messages' ? 'active' : ''}" id="censorMessagesBtn">Цензура сообщений</button>
        <button class="censor-btn ${censorMode === 'full' ? 'active' : ''}" id="censorPromptBtn">Цензура промпта</button>
      </div>

      <div style="margin-bottom:12px;">
        <div style="font-size:14px; color:var(--paper); margin-bottom:4px;">Макс. длина промпта (токены): <span id="tokenLimitDisplay">${collection.tokenLimit || 30000}</span></div>
        <input type="range" id="tokenLimit" min="5000" max="100000" step="1000" value="${collection.tokenLimit || 30000}" style="width:100%;">
      </div>
      <label class="preset-label">Основной промпт:</label>
      <textarea id="mainPrompt" rows="6" style="width:100%;background:#111212;color:#fff;border:1px solid #555;border-radius:4px;padding:8px;resize:vertical;">${escHtml(collection.mainPrompt)}</textarea>
      <label class="preset-label">Дополнительный промпт:</label>
      <textarea id="extraPrompt" rows="4" style="width:100%;background:#111212;color:#fff;border:1px solid #555;border-radius:4px;padding:8px;resize:vertical;">${escHtml(collection.extraPrompt)}</textarea>
      <hr style="border-color:#444;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h3 style="color:#fff;font-size:15px;">Пресеты</h3>
        <button class="preset-tool-btn" id="addPresetBtn" title="Добавить пресет">${window.iconImg('add', 'Добавить', 18, 18)}</button>
      </div>
      <div id="presetsList" style="margin-top:10px; display:flex; flex-direction:column; gap:10px;">
        ${collection.presets.length === 0 ? `
          <p style="color:var(--paper-faint); font-size:14px;">Нет пресетов. Нажмите «+».</p>
        ` : collection.presets.map(p => `
          <div class="preset-item" data-id="${p.id}">
            <div class="preset-item-header">
              <span class="preset-toggle">${escHtml(p.name)}</span>
              <div class="preset-item-controls">
                <label class="switch">
                  <input type="checkbox" ${p.enabled ? 'checked' : ''} class="preset-toggle-checkbox">
                  <span class="slider"></span>
                </label>
                <button class="edit-preset" title="Переименовать">${window.iconImg('rename', 'Переименовать', 18, 18)}</button>
                <button class="delete-preset" title="Удалить">${window.iconImg('delete', 'Удалить', 18, 18)}</button>
              </div>
            </div>
            <div class="preset-content" style="display:none;">
              <textarea rows="10">${escHtml(p.content)}</textarea>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Обработчики кнопок цензуры
    document.getElementById('censorMessagesBtn')?.addEventListener('click', async function(e) {
      e.stopPropagation();
      const newMode = censorMode === 'messages' ? 'off' : 'messages';
      await updateSettings({ censor_mode: newMode });
      renderPresetsPanel();
    });

    document.getElementById('censorPromptBtn')?.addEventListener('click', async function(e) {
      e.stopPropagation();
      const newMode = censorMode === 'full' ? 'off' : 'full';
      await updateSettings({ censor_mode: newMode });
      renderPresetsPanel();
    });

    // Переключение коллекции
    document.getElementById('collectionSelect')?.addEventListener('change', async function(e) {
      e.stopPropagation();
      const d = await getPresetsData();
      d.activeCollectionId = this.value;
      await savePresetsData(d);
      window.markDirty('presets');
      renderPresetsPanel();
    });

    // Создать коллекцию
    document.getElementById('addCollectionBtn')?.addEventListener('click', async function(e) {
      e.stopPropagation();
      const name = await showPrompt('Введите название нового сборника', 'Новый сборник', { title: 'Новый сборник' });
      if (!name) return;
      const d = await getPresetsData();
      const newCol = { id: generateId(), name, mainPrompt: '', extraPrompt: '', presets: [], tokenLimit: 30000 };
      d.collections.push(newCol);
      d.activeCollectionId = newCol.id;
      await savePresetsData(d);
      window.markDirty('presets');
      renderPresetsPanel();
      showToast('Сборник создан', 'success');
    });

    // Переименовать коллекцию
    document.getElementById('renameCollectionBtn')?.addEventListener('click', async function(e) {
      e.stopPropagation();
      const d = await getPresetsData();
      const col = getActiveCollectionFrom(d);
      if (!col) return;
      const newName = await showPrompt('Новое название сборника', col.name, { title: 'Переименовать сборник' });
      if (!newName) return;
      col.name = newName;
      await savePresetsData(d);
      window.markDirty('presets');
      renderPresetsPanel();
    });

    // Удалить коллекцию
    document.getElementById('deleteCollectionBtn')?.addEventListener('click', async function(e) {
      e.stopPropagation();
      const d = await getPresetsData();
      if (d.collections.length <= 1) {
        showToast('Нельзя удалить последний сборник', 'warning');
        return;
      }
      const col = getActiveCollectionFrom(d);
      if (!col) return;
      if (!(await showConfirm(`Удалить сборник "${col.name}"? Это действие необратимо.`, { title: 'Удаление сборника', okText: 'Удалить' }))) return;
      d.collections = d.collections.filter(c => c.id !== col.id);
      d.activeCollectionId = d.collections[0].id;
      await savePresetsData(d);
      window.markDirty('presets');
      renderPresetsPanel();
      showToast('Сборник удалён', 'success');
    });

    // Экспорт
    document.getElementById('exportCollectionBtn')?.addEventListener('click', async function(e) {
      e.stopPropagation();
      const d = await getPresetsData();
      const col = getActiveCollectionFrom(d);
      if (!col) return;
      const exportData = { name: col.name, mainPrompt: col.mainPrompt, extraPrompt: col.extraPrompt, presets: col.presets.map(p => ({ name: p.name, enabled: p.enabled, content: p.content })), tokenLimit: col.tokenLimit };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `presets_${col.name}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Сборник экспортирован', 'success');
    });

    // Импорт
    document.getElementById('importCollectionBtn')?.addEventListener('click', function(e) {
      e.stopPropagation();
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async function(ev) {
        const file = ev.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async function(ev2) {
          try {
            const imported = JSON.parse(ev2.target.result);
            if (!imported.name || typeof imported.mainPrompt !== 'string') {
              showToast('Неверный формат файла', 'error');
              return;
            }
            const d = await getPresetsData();
            const newCol = { id: generateId(), name: imported.name || 'Импортированный', mainPrompt: imported.mainPrompt || '', extraPrompt: imported.extraPrompt || '', presets: (imported.presets || []).map(p => ({ id: generateId(), name: p.name || 'Пресет', enabled: p.enabled !== undefined ? p.enabled : true, content: p.content || '' })), tokenLimit: imported.tokenLimit || 30000 };
            d.collections.push(newCol);
            d.activeCollectionId = newCol.id;
            await savePresetsData(d);
            window.markDirty('presets');
            renderPresetsPanel();
            showToast('Сборник импортирован', 'success');
          } catch (err) {
            showToast('Ошибка чтения файла', 'error');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });

    // Ползунок лимита
    document.getElementById('tokenLimit')?.addEventListener('input', debounce(async function(e) {
      document.getElementById('tokenLimitDisplay').textContent = this.value;
      const d = await getPresetsData();
      const col = getActiveCollectionFrom(d);
      if (col) {
        col.tokenLimit = parseInt(this.value);
        await savePresetsData(d);
        window.markDirty('presets');
      }
    }, 400));

    // Основной промпт
    document.getElementById('mainPrompt')?.addEventListener('input', debounce(async function() {
      const d = await getPresetsData();
      const col = getActiveCollectionFrom(d);
      if (col) {
        col.mainPrompt = this.value;
        await savePresetsData(d);
        window.markDirty('presets');
      }
    }, 500));

    // Дополнительный промпт
    document.getElementById('extraPrompt')?.addEventListener('input', debounce(async function() {
      const d = await getPresetsData();
      const col = getActiveCollectionFrom(d);
      if (col) {
        col.extraPrompt = this.value;
        await savePresetsData(d);
        window.markDirty('presets');
      }
    }, 500));

    // Добавить пресет
    document.getElementById('addPresetBtn')?.addEventListener('click', async function(e) {
      e.stopPropagation();
      const d = await getPresetsData();
      const col = getActiveCollectionFrom(d);
      if (!col) return;
      col.presets.push({ id: generateId(), name: `Preset ${col.presets.length + 1}`, enabled: true, content: '' });
      await savePresetsData(d);
      window.markDirty('presets');
      renderPresetsPanel();
    });

    // Удалить пресет
    document.querySelectorAll('.delete-preset').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        const item = this.closest('.preset-item');
        const id = item.dataset.id;
        const d = await getPresetsData();
        const col = getActiveCollectionFrom(d);
        if (!col) return;
        col.presets = col.presets.filter(p => p.id !== id);
        await savePresetsData(d);
        window.markDirty('presets');
        renderPresetsPanel();
      });
    });

    // Включение/выключение пресета
    document.querySelectorAll('.preset-toggle-checkbox').forEach(cb => {
      cb.addEventListener('change', async function(e) {
        e.stopPropagation();
        const item = this.closest('.preset-item');
        const id = item.dataset.id;
        const d = await getPresetsData();
        const col = getActiveCollectionFrom(d);
        if (!col) return;
        const preset = col.presets.find(p => p.id === id);
        if (preset) {
          preset.enabled = this.checked;
          await savePresetsData(d);
          window.markDirty('presets');
        }
      });
    });

    // Раскрытие содержимого пресета
    document.querySelectorAll('.preset-toggle').forEach(span => {
      span.addEventListener('click', function(e) {
        e.stopPropagation();
        const content = this.closest('.preset-item').querySelector('.preset-content');
        if (content) {
          content.style.display = content.style.display === 'none' ? 'block' : 'none';
        }
      });
    });

    // Редактирование содержимого пресета
    document.querySelectorAll('.preset-content textarea').forEach(textarea => {
      textarea.addEventListener('input', debounce(async function(e) {
        const item = this.closest('.preset-item');
        const id = item.dataset.id;
        const d = await getPresetsData();
        const col = getActiveCollectionFrom(d);
        if (!col) return;
        const preset = col.presets.find(p => p.id === id);
        if (preset) {
          preset.content = this.value;
          await savePresetsData(d);
          window.markDirty('presets');
        }
      }, 500));
    });

    // Переименовать пресет
    document.querySelectorAll('.edit-preset').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        const item = this.closest('.preset-item');
        const id = item.dataset.id;
        const d = await getPresetsData();
        const col = getActiveCollectionFrom(d);
        if (!col) return;
        const preset = col.presets.find(p => p.id === id);
        if (!preset) return;
        const newName = await showPrompt('Новое название пресета', preset.name, { title: 'Переименовать пресет' });
        if (!newName) return;
        preset.name = newName;
        await savePresetsData(d);
        window.markDirty('presets');
        renderPresetsPanel();
      });
    });
  } catch (e) {
    panelBody.innerHTML = `<p style="color:#e74c6f;">Ошибка загрузки пресетов</p>`;
    console.error(e);
  }
}