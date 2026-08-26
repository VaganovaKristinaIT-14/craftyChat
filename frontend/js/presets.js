// ============================================
// PRESETS — логика панели «Пресеты»
// ============================================

function renderPresetsPanel() {
    const panelBody = document.querySelector('#presets-panel .panel-body');
    if (!panelBody) return;

    const data = getPresetsData();
    const collection = getActiveCollection();
    if (!collection) return;

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
            <!-- TODO: на бэке подключить реальный подсчёт токенов через tiktoken и обрезку промпта -->
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
            ` : collection.presets.map((p, index) => `
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

    // ============================================
    // Обработчики событий (все с stopPropagation)
    // ============================================

    // 1. Переключение сборника
    document.getElementById('collectionSelect')?.addEventListener('change', function(e) {
        e.stopPropagation();
        const data = getPresetsData();
        data.activeCollectionId = this.value;
        savePresetsData(data);
        renderPresetsPanel();
    });

    // 2. Добавить сборник
    document.getElementById('addCollectionBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        const name = prompt('Введите название нового сборника:', 'Новый сборник');
        if (!name) return;
        const data = getPresetsData();
        const newCol = {
            id: generateId(),
            name: name,
            mainPrompt: '',
            extraPrompt: '',
            presets: [],
            tokenLimit: 10000
        };
        data.collections.push(newCol);
        data.activeCollectionId = newCol.id;
        savePresetsData(data);
        renderPresetsPanel();
        showToast('Сборник создан');
    });

    // 3. Переименовать сборник
    document.getElementById('renameCollectionBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        const data = getPresetsData();
        const collection = data.collections.find(c => c.id === data.activeCollectionId);
        if (!collection) return;
        const newName = prompt('Новое название:', collection.name);
        if (!newName) return;
        collection.name = newName;
        savePresetsData(data);
        renderPresetsPanel();
        showToast('Сборник переименован');
    });

    // 4. Удалить сборник
    document.getElementById('deleteCollectionBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        const data = getPresetsData();
        if (data.collections.length <= 1) {
            showToast('Нельзя удалить последний сборник');
            return;
        }
        const collection = data.collections.find(c => c.id === data.activeCollectionId);
        if (!collection) return;
        if (!confirm(`Удалить сборник "${collection.name}"?`)) return;
        data.collections = data.collections.filter(c => c.id !== data.activeCollectionId);
        data.activeCollectionId = data.collections[0].id;
        savePresetsData(data);
        renderPresetsPanel();
        showToast('Сборник удалён');
    });

    // 5. Экспорт сборника
    document.getElementById('exportCollectionBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        const data = getPresetsData();
        const collection = data.collections.find(c => c.id === data.activeCollectionId);
        if (!collection) return;
        const exportData = {
            name: collection.name,
            mainPrompt: collection.mainPrompt,
            extraPrompt: collection.extraPrompt,
            presets: collection.presets.map(p => ({ name: p.name, enabled: p.enabled, content: p.content })),
            tokenLimit: collection.tokenLimit
        };
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `presets_${collection.name}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Сборник экспортирован');
    });

    // 6. Импорт сборника
    document.getElementById('importCollectionBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = function(ev) {
            const file = ev.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(ev2) {
                try {
                    const imported = JSON.parse(ev2.target.result);
                    if (!imported.name || typeof imported.mainPrompt !== 'string') {
                        showToast('Неверный формат файла');
                        return;
                    }
                    const data = getPresetsData();
                    const newCol = {
                        id: generateId(),
                        name: imported.name || 'Импортированный',
                        mainPrompt: imported.mainPrompt || '',
                        extraPrompt: imported.extraPrompt || '',
                        presets: (imported.presets || []).map(p => ({
                            id: generateId(),
                            name: p.name || 'Пресет',
                            enabled: p.enabled !== undefined ? p.enabled : true,
                            content: p.content || ''
                        })),
                        tokenLimit: imported.tokenLimit || 10000
                    };
                    data.collections.push(newCol);
                    data.activeCollectionId = newCol.id;
                    savePresetsData(data);
                    renderPresetsPanel();
                    showToast('Сборник импортирован');
                } catch (err) {
                    showToast('Ошибка чтения файла');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    });

    // 7. Ползунок токенов
    document.getElementById('tokenLimit')?.addEventListener('input', function(e) {
        e.stopPropagation();
        document.getElementById('tokenLimitDisplay').textContent = this.value;
        const data = getPresetsData();
        const collection = data.collections.find(c => c.id === data.activeCollectionId);
        if (collection) {
            collection.tokenLimit = parseInt(this.value);
            savePresetsData(data);
        }
    });

    // 8. Сохранение основного промпта
    document.getElementById('mainPrompt')?.addEventListener('input', function(e) {
        e.stopPropagation();
        const data = getPresetsData();
        const collection = data.collections.find(c => c.id === data.activeCollectionId);
        if (collection) {
            collection.mainPrompt = this.value;
            savePresetsData(data);
        }
    });

    // 9. Сохранение дополнительного промпта
    document.getElementById('extraPrompt')?.addEventListener('input', function(e) {
        e.stopPropagation();
        const data = getPresetsData();
        const collection = data.collections.find(c => c.id === data.activeCollectionId);
        if (collection) {
            collection.extraPrompt = this.value;
            savePresetsData(data);
        }
    });

    // 10. Добавить пресет
    document.getElementById('addPresetBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        const data = getPresetsData();
        const collection = data.collections.find(c => c.id === data.activeCollectionId);
        if (!collection) return;
        collection.presets.push({
            id: generateId(),
            name: `Preset ${collection.presets.length + 1}`,
            enabled: true,
            content: ''
        });
        savePresetsData(data);
        renderPresetsPanel();
    });

    // 11. Удаление пресета
    document.querySelectorAll('.delete-preset').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const item = this.closest('.preset-item');
            const id = item.dataset.id;
            const data = getPresetsData();
            const collection = data.collections.find(c => c.id === data.activeCollectionId);
            if (!collection) return;
            collection.presets = collection.presets.filter(p => p.id !== id);
            savePresetsData(data);
            renderPresetsPanel();
        });
    });

    // 12. Включение/отключение пресета
    document.querySelectorAll('.preset-toggle-checkbox').forEach(cb => {
        cb.addEventListener('change', function(e) {
            e.stopPropagation();
            const item = this.closest('.preset-item');
            const id = item.dataset.id;
            const data = getPresetsData();
            const collection = data.collections.find(c => c.id === data.activeCollectionId);
            if (!collection) return;
            const preset = collection.presets.find(p => p.id === id);
            if (preset) {
                preset.enabled = this.checked;
                savePresetsData(data);
            }
        });
    });

    // 13. Раскрытие содержимого пресета
    document.querySelectorAll('.preset-toggle').forEach(span => {
        span.addEventListener('click', function(e) {
            e.stopPropagation();
            const content = this.closest('.preset-item').querySelector('.preset-content');
            if (content) {
                content.style.display = content.style.display === 'none' ? 'block' : 'none';
            }
        });
    });

    // 14. Сохранение содержимого пресета
    document.querySelectorAll('.preset-content textarea').forEach(textarea => {
        textarea.addEventListener('input', function(e) {
            e.stopPropagation();
            const item = this.closest('.preset-item');
            const id = item.dataset.id;
            const data = getPresetsData();
            const collection = data.collections.find(c => c.id === data.activeCollectionId);
            if (!collection) return;
            const preset = collection.presets.find(p => p.id === id);
            if (preset) {
                preset.content = this.value;
                savePresetsData(data);
            }
        });
    });

    // 15. Редактирование названия пресета
    document.querySelectorAll('.edit-preset').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const item = this.closest('.preset-item');
            const id = item.dataset.id;
            const data = getPresetsData();
            const collection = data.collections.find(c => c.id === data.activeCollectionId);
            if (!collection) return;
            const preset = collection.presets.find(p => p.id === id);
            if (!preset) return;
            const newName = prompt('Новое название пресета:', preset.name);
            if (!newName) return;
            preset.name = newName;
            savePresetsData(data);
            renderPresetsPanel();
        });
    });
}