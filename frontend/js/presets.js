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
    panelBody.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:16px;flex-wrap:wrap;">
        <select id="collectionSelect" style="background:#2e2e2e;color:#fff;border:1px solid #555;border-radius:4px;padding:4px 8px;flex:1;min-width:120px;">
          ${data.collections.map(c => `
            <option value="${c.id}" ${c.id === data.activeCollectionId ? 'selected' : ''}>${escHtml(c.name)}</option>
          `).join('')}
        </select>
        <button id="addCollectionBtn" style="background:#4a6cf7;color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:16px;" title="Добавить сборник">➕</button>
        <button id="renameCollectionBtn" style="background:#f0c040;color:#000;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:16px;" title="Переименовать">✎</button>
        <button id="deleteCollectionBtn" style="background:#ff6b6b;color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:16px;" title="Удалить сборник">🗑️</button>
        <button id="exportCollectionBtn" style="background:#4a6cf7;color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:16px;" title="Экспортировать">⬇️</button>
        <button id="importCollectionBtn" style="background:#4a6cf7;color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:16px;" title="Импортировать">⬆️</button>
      </div>
      <div style="margin-bottom:12px;">
        <label style="color:#fff;font-size:13px;">Макс. длина промпта (токены): <span id="tokenLimitDisplay">${collection.tokenLimit || 10000}</span></label>
        <input type="range" id="tokenLimit" min="5000" max="100000" step="1000" value="${collection.tokenLimit || 10000}" style="width:100%;">
      </div>
      <label style="color:#fff;">Основной промпт:</label>
      <textarea id="mainPrompt" rows="6" style="width:100%;background:#111212;color:#fff;border:1px solid #555;border-radius:4px;padding:8px;resize:vertical;">${escHtml(collection.mainPrompt)}</textarea>
      <label style="color:#fff;">Дополнительный промпт:</label>
      <textarea id="extraPrompt" rows="4" style="width:100%;background:#111212;color:#fff;border:1px solid #555;border-radius:4px;padding:8px;resize:vertical;">${escHtml(collection.extraPrompt)}</textarea>
      <hr style="border-color:#444;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h3 style="color:#fff;font-size:15px;">Пресеты</h3>
        <button id="addPresetBtn" style="background:#4a6cf7;color:#fff;border:none;border-radius:4px;padding:4px 12px;cursor:pointer;">+ Добавить</button>
      </div>
      <div id="presetsList" style="margin-top:8px;">
        ${collection.presets.length === 0 ? `
          <p style="color:#888;font-size:13px;">Нет пресетов. Нажмите «+ Добавить».</p>
        ` : collection.presets.map(p => `
          <div class="preset-item" data-id="${p.id}" style="background:#2e2e2e;padding:8px;border-radius:6px;margin-top:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="color:#fff;cursor:pointer;" class="preset-toggle">${escHtml(p.name)}</span>
              <div style="display:flex;align-items:center;gap:6px;">
                <label style="color:#fff;font-size:12px;">Вкл</label>
                <input type="checkbox" ${p.enabled ? 'checked' : ''} class="preset-toggle-checkbox" style="accent-color:#4a6cf7;">
                <button class="edit-preset" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:14px;" title="Редактировать">✎</button>
                <button class="delete-preset" style="background:none;border:none;color:#ff4444;cursor:pointer;font-size:14px;" title="Удалить">✕</button>
              </div>
            </div>
            <div class="preset-content" style="display:none;margin-top:8px;">
              <textarea rows="2" style="width:100%;background:#111212;color:#fff;border:1px solid #555;border-radius:4px;padding:8px;resize:vertical;">${escHtml(p.content)}</textarea>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Обработчики (все с debounce / async)
    document.getElementById('collectionSelect')?.addEventListener('change', async function(e) {
      e.stopPropagation();
      const d = await getPresetsData();
      d.activeCollectionId = this.value;
      await savePresetsData(d);
      renderPresetsPanel();
    });

    document.getElementById('addCollectionBtn')?.addEventListener('click', async function(e) {
      e.stopPropagation();
      const name = prompt('Введите название нового сборника:', 'Новый сборник');
      if (!name) return;
      const d = await getPresetsData();
      const newCol = { id: generateId(), name, mainPrompt: '', extraPrompt: '', presets: [], tokenLimit: 10000 };
      d.collections.push(newCol);
      d.activeCollectionId = newCol.id;
      await savePresetsData(d);
      renderPresetsPanel();
      showToast('Сборник создан', 'success');
    });

    document.getElementById('renameCollectionBtn')?.addEventListener('click', async function(e) {
      e.stopPropagation();
      const d = await getPresetsData();
      const col = getActiveCollectionFrom(d);
      if (!col) return;
      const newName = prompt('Новое название:', col.name);
      if (!newName) return;
      col.name = newName;
      await savePresetsData(d);
      renderPresetsPanel();
      showToast('Сборник переименован', 'success');
    });

    document.getElementById('deleteCollectionBtn')?.addEventListener('click', async function(e) {
      e.stopPropagation();
      const d = await getPresetsData();
      if (d.collections.length <= 1) {
        showToast('Нельзя удалить последний сборник', 'warning');
        return;
      }
      const col = getActiveCollectionFrom(d);
      if (!col) return;
      if (!confirm(`Удалить сборник "${col.name}"?`)) return;
      d.collections = d.collections.filter(c => c.id !== col.id);
      d.activeCollectionId = d.collections[0].id;
      await savePresetsData(d);
      renderPresetsPanel();
      showToast('Сборник удалён', 'success');
    });

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
            const newCol = { id: generateId(), name: imported.name || 'Импортированный', mainPrompt: imported.mainPrompt || '', extraPrompt: imported.extraPrompt || '', presets: (imported.presets || []).map(p => ({ id: generateId(), name: p.name || 'Пресет', enabled: p.enabled !== undefined ? p.enabled : true, content: p.content || '' })), tokenLimit: imported.tokenLimit || 10000 };
            d.collections.push(newCol);
            d.activeCollectionId = newCol.id;
            await savePresetsData(d);
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

    document.getElementById('tokenLimit')?.addEventListener('input', debounce(async function(e) {
      document.getElementById('tokenLimitDisplay').textContent = this.value;
      const d = await getPresetsData();
      const col = getActiveCollectionFrom(d);
      if (col) {
        col.tokenLimit = parseInt(this.value);
        await savePresetsData(d);
      }
    }, 400));

    document.getElementById('mainPrompt')?.addEventListener('input', debounce(async function() {
      const d = await getPresetsData();
      const col = getActiveCollectionFrom(d);
      if (col) {
        col.mainPrompt = this.value;
        await savePresetsData(d);
      }
    }, 500));

    document.getElementById('extraPrompt')?.addEventListener('input', debounce(async function() {
      const d = await getPresetsData();
      const col = getActiveCollectionFrom(d);
      if (col) {
        col.extraPrompt = this.value;
        await savePresetsData(d);
      }
    }, 500));

    document.getElementById('addPresetBtn')?.addEventListener('click', async function(e) {
      e.stopPropagation();
      const d = await getPresetsData();
      const col = getActiveCollectionFrom(d);
      if (!col) return;
      col.presets.push({ id: generateId(), name: `Preset ${col.presets.length + 1}`, enabled: true, content: '' });
      await savePresetsData(d);
      renderPresetsPanel();
    });

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
        renderPresetsPanel();
      });
    });

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
        }
      });
    });

    document.querySelectorAll('.preset-toggle').forEach(span => {
      span.addEventListener('click', function(e) {
        e.stopPropagation();
        const content = this.closest('.preset-item').querySelector('.preset-content');
        if (content) {
          content.style.display = content.style.display === 'none' ? 'block' : 'none';
        }
      });
    });

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
        }
      }, 500));
    });

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
        const newName = prompt('Новое название пресета:', preset.name);
        if (!newName) return;
        preset.name = newName;
        await savePresetsData(d);
        renderPresetsPanel();
      });
    });
  } catch (e) {
    panelBody.innerHTML = `<p style="color:#e74c6f;">Ошибка загрузки пресетов</p>`;
    console.error(e);
  }
}