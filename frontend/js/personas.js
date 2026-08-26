// ============================================
// PERSONAS — логика панели «Персоны»
// ============================================

const PERSONAS_PER_PAGE = 10;
let currentPersonaPage = 0;
let selectedPersonaId = null;

function renderPersonasPanel() {
    const panelBody = document.getElementById('central-panel-body');
    if (!panelBody) return;

    const personas = getPersonasData();
    const activeId = getActivePersonaId();

    // Если нет выбранной, но есть активная — используем её
    if (!selectedPersonaId && activeId && personas.some(p => p.id === activeId)) {
        selectedPersonaId = activeId;
    }
    // Если выбранная не существует — сбрасываем
    if (selectedPersonaId && !personas.some(p => p.id === selectedPersonaId)) {
        selectedPersonaId = null;
    }
    // Если нет выбранной и есть хотя бы одна персона — выбираем первую
    if (!selectedPersonaId && personas.length > 0) {
        selectedPersonaId = personas[0].id;
    }

    const totalPages = Math.ceil(personas.length / PERSONAS_PER_PAGE) || 1;
    if (currentPersonaPage >= totalPages) currentPersonaPage = totalPages - 1;
    if (currentPersonaPage < 0) currentPersonaPage = 0;

    const start = currentPersonaPage * PERSONAS_PER_PAGE;
    const pagePersonas = personas.slice(start, start + PERSONAS_PER_PAGE);
    const selectedPersona = selectedPersonaId ? getPersona(selectedPersonaId) : null;

    panelBody.innerHTML = `
        <div style="display:flex;height:100%;gap:20px;min-height:400px;">
            <!-- Левая колонка: список -->
            <div style="flex:0 0 280px;display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button id="createPersonaBtn" style="background:#4a6cf7;color:#fff;border:none;border-radius:4px;padding:6px 12px;cursor:pointer;">➕ Создать</button>
                    <button id="importPersonaBtn" style="background:#4a6cf7;color:#fff;border:none;border-radius:4px;padding:6px 12px;cursor:pointer;">⬆️ Импорт</button>
                </div>
                <div id="personaList" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">
                    ${pagePersonas.length === 0 ? `
                        <p style="color:#888;font-size:14px;">Нет персон. Создайте первую.</p>
                    ` : pagePersonas.map(p => `
                        <div class="persona-item" data-id="${p.id}" style="
                            background: ${selectedPersonaId === p.id ? '#3a3a4a' : '#2e2e2e'};
                            border: 2px solid ${selectedPersonaId === p.id ? '#4a6cf7' : 'transparent'};
                            border-radius: 8px;
                            padding: 10px;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            transition: all 0.2s;
                        ">
                            <div style="width:40px;height:40px;border-radius:50%;overflow:hidden;flex-shrink:0;background:#444;display:flex;align-items:center;justify-content:center;">
                                ${p.avatar ? `<img src="${p.avatar}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="color:#aaa;font-size:20px;">👤</span>`}
                            </div>
                            <div style="flex:1;min-width:0;">
                                <div style="color:#fff;font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(p.name)}</div>
                                <div style="color:#888;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(p.description.substring(0, 40))}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid #444;">
                    <button id="prevPageBtn" style="background:transparent;color:#aaa;border:none;cursor:pointer;font-size:16px;" ${currentPersonaPage <= 0 ? 'disabled style="opacity:0.3;"' : ''}>◀</button>
                    <span style="color:#888;font-size:13px;">${currentPersonaPage + 1} / ${totalPages}</span>
                    <button id="nextPageBtn" style="background:transparent;color:#aaa;border:none;cursor:pointer;font-size:16px;" ${currentPersonaPage >= totalPages - 1 ? 'disabled style="opacity:0.3;"' : ''}>▶</button>
                </div>
            </div>

            <!-- Правая колонка: редактирование -->
            <div style="flex:1;background:#2e2e2e;border-radius:8px;padding:16px;display:flex;flex-direction:column;gap:12px;">
                ${selectedPersona ? `
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <h3 style="color:#fff;margin:0;font-size:18px;">${escHtml(selectedPersona.name)}</h3>
                        <div style="display:flex;gap:6px;">
                            <button id="renamePersonaBtn" style="background:#f0c040;color:#000;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;">✎</button>
                            <button id="exportPersonaBtn" style="background:#4a6cf7;color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;">⬇️</button>
                            <button id="deletePersonaBtn" style="background:#ff6b6b;color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;">🗑️</button>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div id="personaAvatarContainer" style="width:64px;height:64px;border-radius:50%;overflow:hidden;background:#444;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                            ${selectedPersona.avatar ? `<img src="${selectedPersona.avatar}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="color:#aaa;font-size:28px;">👤</span>`}
                        </div>
                        <div style="flex:1;">
                            <label style="color:#fff;font-size:13px;">Описание персоны:</label>
                            <textarea id="personaDescription" rows="4" style="width:100%;background:#111212;color:#fff;border:1px solid #555;border-radius:4px;padding:8px;resize:vertical;">${escHtml(selectedPersona.description)}</textarea>
                        </div>
                    </div>
                    <div style="border-top:1px solid #444;padding-top:12px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <h4 style="color:#fff;margin:0;font-size:15px;">Связи</h4>
                            <button id="linkCharacterBtn" style="background:#4a6cf7;color:#fff;border:none;border-radius:4px;padding:4px 12px;cursor:pointer;">Персонаж</button>
                        </div>
                        <div id="linkedCharactersList" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">
                            ${selectedPersona.linked_characters && selectedPersona.linked_characters.length > 0 ? 
                                selectedPersona.linked_characters.map(charId => {
                                    const char = getCharacter(charId);
                                    return char ? `<span style="background:#3a3a4a;padding:4px 10px;border-radius:12px;color:#fff;font-size:13px;">${escHtml(char.name)}</span>` : ''
                                }).join('') 
                            : `<span style="color:#888;font-size:13px;">Нет привязанных персонажей</span>`}
                        </div>
                    </div>
                ` : `
                    <p style="color:#888;text-align:center;margin-top:40px;">Выберите персону слева или создайте новую.</p>
                `}
            </div>
        </div>
    `;

    // ============================================
    // Обработчики событий (с stopPropagation)
    // ============================================

    // Выбор персоны из списка
    document.querySelectorAll('.persona-item').forEach(el => {
        el.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.dataset.id;
            if (id) {
                selectedPersonaId = id;
                setActivePersonaId(id);
                renderPersonasPanel();
            }
        });
    });

    // Создать персону
    document.getElementById('createPersonaBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        const newPersona = getDefaultPersona();
        const personas = getPersonasData();
        personas.push(newPersona);
        savePersonasData(personas);
        selectedPersonaId = newPersona.id;
        setActivePersonaId(newPersona.id);
        renderPersonasPanel();
        showToast('Персона создана');
    });

    // Импорт персоны
    document.getElementById('importPersonaBtn')?.addEventListener('click', function(e) {
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
                    if (!imported.name || typeof imported.description !== 'string') {
                        showToast('Неверный формат файла');
                        return;
                    }
                    const newPersona = {
                        id: generateId(),
                        name: imported.name || 'Импортированная',
                        avatar: imported.avatar || null,
                        description: imported.description || '',
                        linked_characters: imported.linked_characters || []
                    };
                    const personas = getPersonasData();
                    personas.push(newPersona);
                    savePersonasData(personas);
                    selectedPersonaId = newPersona.id;
                    setActivePersonaId(newPersona.id);
                    renderPersonasPanel();
                    showToast('Персона импортирована');
                } catch (err) {
                    showToast('Ошибка чтения файла');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    });

    // Переименовать персону
    document.getElementById('renamePersonaBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!selectedPersonaId) return;
        const persona = getPersona(selectedPersonaId);
        if (!persona) return;
        const newName = prompt('Новое имя персоны:', persona.name);
        if (!newName) return;
        persona.name = newName;
        const personas = getPersonasData();
        const idx = personas.findIndex(p => p.id === persona.id);
        if (idx !== -1) personas[idx] = persona;
        savePersonasData(personas);
        renderPersonasPanel();
        showToast('Персона переименована');
    });

    // Экспорт персоны
    document.getElementById('exportPersonaBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!selectedPersonaId) return;
        const persona = getPersona(selectedPersonaId);
        if (!persona) return;
        const exportData = {
            name: persona.name,
            avatar: persona.avatar,
            description: persona.description,
            linked_characters: persona.linked_characters
        };
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `persona_${persona.name}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Персона экспортирована');
    });

    // Удалить персону
    document.getElementById('deletePersonaBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!selectedPersonaId) return;
        const persona = getPersona(selectedPersonaId);
        if (!persona) return;
        if (!confirm(`Удалить персону "${persona.name}"?`)) return;
        let personas = getPersonasData();
        personas = personas.filter(p => p.id !== selectedPersonaId);
        savePersonasData(personas);
        if (getActivePersonaId() === selectedPersonaId) {
            setActivePersonaId(null);
        }
        selectedPersonaId = personas.length > 0 ? personas[0].id : null;
        if (selectedPersonaId) setActivePersonaId(selectedPersonaId);
        renderPersonasPanel();
        showToast('Персона удалена');
    });

    // Загрузка аватарки
    document.getElementById('personaAvatarContainer')?.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!selectedPersonaId) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = function(ev) {
            const file = ev.target.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
                showToast('Файл слишком большой! Максимум 5 МБ.');
                return;
            }
            const reader = new FileReader();
            reader.onload = function(ev2) {
                const base64 = ev2.target.result;
                // Сжимаем до 200x200
                compressImage(base64, 200, 200, 0.8, function(thumbnail) {
                    const persona = getPersona(selectedPersonaId);
                    if (!persona) return;
                    persona.avatar = thumbnail;
                    const personas = getPersonasData();
                    const idx = personas.findIndex(p => p.id === persona.id);
                    if (idx !== -1) personas[idx] = persona;
                    savePersonasData(personas);
                    renderPersonasPanel();
                    showToast('Аватарка обновлена');
                });
            };
            reader.readAsDataURL(file);
        };
        input.click();
    });

    // Автосохранение описания
    document.getElementById('personaDescription')?.addEventListener('input', function(e) {
        e.stopPropagation();
        if (!selectedPersonaId) return;
        const persona = getPersona(selectedPersonaId);
        if (!persona) return;
        persona.description = this.value;
        const personas = getPersonasData();
        const idx = personas.findIndex(p => p.id === persona.id);
        if (idx !== -1) personas[idx] = persona;
        savePersonasData(personas);
    });

    // Привязка персонажа (заглушка — позже)
    document.getElementById('linkCharacterBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        showToast('Привязка персонажей будет реализована позже');
    });

    // Пагинация
    document.getElementById('prevPageBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        if (currentPersonaPage > 0) {
            currentPersonaPage--;
            renderPersonasPanel();
        }
    });
    document.getElementById('nextPageBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        const totalPages = Math.ceil(getPersonasData().length / PERSONAS_PER_PAGE);
        if (currentPersonaPage < totalPages - 1) {
            currentPersonaPage++;
            renderPersonasPanel();
        }
    });
}

// Компрессия изображения (такая же как в фонах)
function compressImage(dataUrl, maxWidth, maxHeight, quality, callback) {
    const img = new Image();
    img.onload = function() {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
        }
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        callback(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = function() {
        showToast('Не удалось обработать изображение');
    };
    img.src = dataUrl;
}