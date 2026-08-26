// ============================================
// CHARACTERS — логика панели «Персонажи»
// ============================================

const CHARACTERS_PER_PAGE = 10;
let currentCharacterPage = 0;
let viewMode = 'list'; // 'list' или 'detail'
let selectedCharacterId = null;

function renderCharactersPanel() {
    const panelBody = document.querySelector('#characters-panel .panel-body');
    if (!panelBody) return;

    const characters = getCharactersData();

    if (viewMode === 'list') {
        renderCharacterList(panelBody, characters);
    } else {
        renderCharacterDetail(panelBody, selectedCharacterId);
    }

    const panelHeader = document.querySelector('#characters-panel .panel-header h2');
    if (panelHeader) {
        panelHeader.textContent = viewMode === 'list' ? '🤖 Персонажи' : '🤖 Редактирование';
    }

    attachCharacterEvents();
}

// ============================================
// РЕНДЕР СПИСКА
// ============================================
function renderCharacterList(container, characters) {
    const totalPages = Math.ceil(characters.length / CHARACTERS_PER_PAGE) || 1;
    if (currentCharacterPage >= totalPages) currentCharacterPage = totalPages - 1;
    if (currentCharacterPage < 0) currentCharacterPage = 0;

    const start = currentCharacterPage * CHARACTERS_PER_PAGE;
    const pageCharacters = characters.slice(start, start + CHARACTERS_PER_PAGE);

    container.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%;">
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">
                <button id="createCharacterBtn" style="background:#4a6cf7;color:#fff;border:none;border-radius:4px;padding:6px 12px;cursor:pointer;">➕ Создать</button>
                <button id="importCharacterBtn" style="background:#4a6cf7;color:#fff;border:none;border-radius:4px;padding:6px 12px;cursor:pointer;">⬆️ Импорт</button>
            </div>

            <div id="characterList" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">
                ${pageCharacters.length === 0 ? `
                    <p style="color:#888;font-size:14px;text-align:center;margin-top:40px;">Нет персонажей.<br>Создайте первого.</p>
                ` : pageCharacters.map(c => `
                    <div class="character-item" data-id="${c.id}" style="
                        background: #2e2e2e;
                        border-radius: 8px;
                        padding: 10px 14px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        border: 1px solid transparent;
                        transition: all 0.2s;
                    ">
                        <div class="character-click" style="display:flex;align-items:center;gap:12px;flex:1;cursor:pointer;">
                            <div style="width:40px;height:40px;border-radius:50%;overflow:hidden;flex-shrink:0;background:#444;display:flex;align-items:center;justify-content:center;">
                                ${c.avatar ? `<img src="${c.avatar}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="color:#aaa;font-size:20px;">🤖</span>`}
                            </div>
                            <div style="flex:1;min-width:0;">
                                <div style="color:#fff;font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(c.name)}</div>
                            </div>
                        </div>
                        <button class="edit-character-btn" data-id="${c.id}" style="background:transparent;color:#aaa;border:none;cursor:pointer;font-size:14px;padding:4px;" title="Редактировать">✎</button>
                    </div>
                `).join('')}
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid #444;margin-top:8px;">
                <button id="prevCharPage" style="background:transparent;color:#aaa;border:none;cursor:pointer;font-size:14px;padding:4px 8px;" ${currentCharacterPage <= 0 ? 'disabled style="opacity:0.3;"' : ''}>◀</button>
                <span style="color:#888;font-size:13px;">${currentCharacterPage + 1} / ${totalPages}</span>
                <button id="nextCharPage" style="background:transparent;color:#aaa;border:none;cursor:pointer;font-size:14px;padding:4px 8px;" ${currentCharacterPage >= totalPages - 1 ? 'disabled style="opacity:0.3;"' : ''}>▶</button>
            </div>
        </div>
    `;
}

// ============================================
// РЕНДЕР ДЕТАЛЬНОГО РЕЖИМА
// ============================================
function renderCharacterDetail(container, charId) {
    const char = charId ? getCharacter(charId) : null;
    if (!char) {
        viewMode = 'list';
        renderCharactersPanel();
        return;
    }

    const totalText = Object.values(char.fields).join('') + char.name;
    const tokenCount = Math.round(totalText.length / 3);

    container.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%;gap:12px;">
            <div style="flex-shrink:0;">
                <button id="backToListBtn" style="background:transparent;color:#aaa;border:1px solid #555;border-radius:4px;padding:4px 12px;cursor:pointer;font-size:13px;">📋 Список</button>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
                <h3 style="color:#fff;margin:0;font-size:20px;font-weight:600;">${escHtml(char.name)}</h3>
                <span style="color:#888;font-size:13px;" class="token-counter">${tokenCount} токенов</span>
            </div>

            <div style="display:flex;gap:14px;align-items:center;flex-shrink:0;flex-wrap:wrap;">
                <div id="charAvatarContainer" style="width:64px;height:64px;border-radius:50%;overflow:hidden;background:#444;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                    ${char.avatar ? `<img src="${char.avatar}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="color:#aaa;font-size:28px;">🤖</span>`}
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button id="renameCharacterBtn" style="background:#f0c040;color:#000;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:13px;">✎ Переименовать</button>
                    <button id="attachLorebookBtn" style="background:#4a6cf7;color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:13px;">📖 Прикрепить лорбук</button>
                    <button id="exportCharacterBtn" style="background:#4a6cf7;color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:13px;">⬇️ Экспорт</button>
                    <button id="cloneCharacterBtn" style="background:#4a6cf7;color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:13px;">📋 Клонировать</button>
                    <button id="deleteCharacterBtn" style="background:#ff6b6b;color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:13px;">🗑️ Удалить</button>
                </div>
            </div>

            <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;margin-top:4px;">
                ${['personality', 'behavior', 'appearance', 'occupation', 'extra'].map(field => {
                    const labels = {
                        personality: 'Характер',
                        behavior: 'Речь/поведение',
                        appearance: 'Внешность',
                        occupation: 'Род деятельности',
                        extra: 'Дополнительная информация'
                    };
                    return `
                        <div>
                            <label style="color:#aaa;font-size:12px;display:block;margin-bottom:2px;">${labels[field]}</label>
                            <textarea class="char-field" data-field="${field}" rows="2" style="width:100%;background:#111212;color:#fff;border:1px solid #555;border-radius:4px;padding:6px;font-size:13px;resize:vertical;">${escHtml(char.fields[field] || '')}</textarea>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// ============================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================
function attachCharacterEvents() {
    if (viewMode === 'list') {
        // Клик по области с аватаркой/именем -> открыть чат
        document.querySelectorAll('.character-click').forEach(el => {
            el.addEventListener('click', function(e) {
                e.stopPropagation();
                const item = this.closest('.character-item');
                if (item) {
                    const id = item.dataset.id;
                    if (id) {
                        window.openChatForCharacter(id);
                    }
                }
            });
        });

        // Кнопка редактирования -> переход в детальный режим
        document.querySelectorAll('.edit-character-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.dataset.id;
                if (id) {
                    selectedCharacterId = id;
                    viewMode = 'detail';
                    renderCharactersPanel();
                }
            });
        });

        // Создать персонажа
        document.getElementById('createCharacterBtn')?.addEventListener('click', function(e) {
            e.stopPropagation();
            const newChar = getDefaultCharacter();
            const characters = getCharactersData();
            characters.push(newChar);
            saveCharactersData(characters);
            selectedCharacterId = newChar.id;
            viewMode = 'detail';
            renderCharactersPanel();
            showToast('Персонаж создан');
        });

        // Импорт
        document.getElementById('importCharacterBtn')?.addEventListener('click', function(e) {
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
                        if (!imported.name) {
                            showToast('Неверный формат файла');
                            return;
                        }
                        const newChar = {
                            id: generateId(),
                            name: imported.name || 'Импортированный',
                            avatar: imported.avatar || null,
                            lorebook_id: imported.lorebook_id || null,
                            fields: {
                                personality: imported.fields?.personality || '',
                                behavior: imported.fields?.behavior || '',
                                appearance: imported.fields?.appearance || '',
                                occupation: imported.fields?.occupation || '',
                                extra: imported.fields?.extra || ''
                            }
                        };
                        const characters = getCharactersData();
                        characters.push(newChar);
                        saveCharactersData(characters);
                        selectedCharacterId = newChar.id;
                        viewMode = 'detail';
                        renderCharactersPanel();
                        showToast('Персонаж импортирован');
                    } catch (err) {
                        showToast('Ошибка чтения файла');
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        });

        // Пагинация
        document.getElementById('prevCharPage')?.addEventListener('click', function(e) {
            e.stopPropagation();
            if (currentCharacterPage > 0) {
                currentCharacterPage--;
                renderCharactersPanel();
            }
        });
        document.getElementById('nextCharPage')?.addEventListener('click', function(e) {
            e.stopPropagation();
            const totalPages = Math.ceil(getCharactersData().length / CHARACTERS_PER_PAGE);
            if (currentCharacterPage < totalPages - 1) {
                currentCharacterPage++;
                renderCharactersPanel();
            }
        });
    }

    if (viewMode === 'detail') {
        // Назад к списку
        document.getElementById('backToListBtn')?.addEventListener('click', function(e) {
            e.stopPropagation();
            viewMode = 'list';
            renderCharactersPanel();
        });

        // Переименовать
        document.getElementById('renameCharacterBtn')?.addEventListener('click', function(e) {
            e.stopPropagation();
            if (!selectedCharacterId) return;
            const char = getCharacter(selectedCharacterId);
            if (!char) return;
            const newName = prompt('Новое имя персонажа:', char.name);
            if (!newName) return;
            char.name = newName;
            const chars = getCharactersData();
            const idx = chars.findIndex(c => c.id === char.id);
            if (idx !== -1) chars[idx] = char;
            saveCharactersData(chars);
            renderCharactersPanel();
            showToast('Персонаж переименован');
        });

        // Экспорт
        document.getElementById('exportCharacterBtn')?.addEventListener('click', function(e) {
            e.stopPropagation();
            if (!selectedCharacterId) return;
            const char = getCharacter(selectedCharacterId);
            if (!char) return;
            const exportData = {
                name: char.name,
                avatar: char.avatar,
                lorebook_id: char.lorebook_id,
                fields: char.fields
            };
            const json = JSON.stringify(exportData, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `character_${char.name}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Персонаж экспортирован');
        });

        // Клонировать
        document.getElementById('cloneCharacterBtn')?.addEventListener('click', function(e) {
            e.stopPropagation();
            if (!selectedCharacterId) return;
            const original = getCharacter(selectedCharacterId);
            if (!original) return;
            const clone = JSON.parse(JSON.stringify(original));
            clone.id = generateId();
            clone.name = original.name + ' (копия)';
            const chars = getCharactersData();
            chars.push(clone);
            saveCharactersData(chars);
            selectedCharacterId = clone.id;
            renderCharactersPanel();
            showToast('Персонаж склонирован');
        });

        // Удалить
        document.getElementById('deleteCharacterBtn')?.addEventListener('click', function(e) {
            e.stopPropagation();
            if (!selectedCharacterId) return;
            const char = getCharacter(selectedCharacterId);
            if (!char) return;
            if (!confirm(`Удалить персонажа "${char.name}"?`)) return;
            let chars = getCharactersData();
            chars = chars.filter(c => c.id !== selectedCharacterId);
            saveCharactersData(chars);
            selectedCharacterId = null;
            viewMode = 'list';
            renderCharactersPanel();
            showToast('Персонаж удалён');
        });

        // Аватарка
        document.getElementById('charAvatarContainer')?.addEventListener('click', function(e) {
            e.stopPropagation();
            if (!selectedCharacterId) return;
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
                    compressImage(base64, 200, 200, 0.8, function(thumbnail) {
                        const char = getCharacter(selectedCharacterId);
                        if (!char) return;
                        char.avatar = thumbnail;
                        const chars = getCharactersData();
                        const idx = chars.findIndex(c => c.id === char.id);
                        if (idx !== -1) chars[idx] = char;
                        saveCharactersData(chars);
                        renderCharactersPanel();
                        showToast('Аватарка обновлена');
                    });
                };
                reader.readAsDataURL(file);
            };
            input.click();
        });

        // Автосохранение полей
        document.querySelectorAll('.char-field').forEach(textarea => {
            textarea.addEventListener('input', function(e) {
                e.stopPropagation();
                if (!selectedCharacterId) return;
                const char = getCharacter(selectedCharacterId);
                if (!char) return;
                const field = this.dataset.field;
                char.fields[field] = this.value;
                const chars = getCharactersData();
                const idx = chars.findIndex(c => c.id === char.id);
                if (idx !== -1) chars[idx] = char;
                saveCharactersData(chars);
                updateTokenCounter(char);
            });
        });

        // Прикрепить лорбук (заглушка)
        document.getElementById('attachLorebookBtn')?.addEventListener('click', function(e) {
            e.stopPropagation();
            showToast('Привязка лорбуков будет реализована позже');
        });
    }
}

function updateTokenCounter(char) {
    const tokenSpan = document.querySelector('#characters-panel .panel-body .token-counter');
    if (tokenSpan) {
        const totalText = Object.values(char.fields).join('') + char.name;
        const tokenCount = Math.round(totalText.length / 3);
        tokenSpan.textContent = tokenCount + ' токенов';
    }
}

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