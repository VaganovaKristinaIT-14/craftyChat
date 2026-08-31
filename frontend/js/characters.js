// ============================================================
// CHARACTERS — управление персонажами (Bot)
// ============================================================

let currentCharPage = 1;
let selectedCharId = null;
const CHAR_PER_PAGE = 10;

async function renderCharactersPanel() {
  const body = document.getElementById('characters-body');
  if (!body) return;

  try {
    const data = await getCharacters(currentCharPage, CHAR_PER_PAGE);
    const chars = data.items || [];
    const total = data.total || 0;
    const totalPages = data.pages || 1;

    let html = `
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">
        <button class="preset-tool-btn" id="createCharBtn" title="Создать персонажа">${window.iconImg('add', 'Создать', 18, 18)}</button>
        <button class="preset-tool-btn" id="importCharBtn" title="Импортировать персонажа">${window.iconImg('import', 'Импорт', 18, 18)}</button>
      </div>
      <div class="card-list" id="charList">
        ${chars.length === 0 ? '<p style="color:#666; padding:10px;">Нет персонажей</p>' :
          chars.map(c => `
            <div class="card-item" data-id="${c.id}">
              <div class="card-avatar">${c.avatar ? `<img src="${c.avatar}">` : '🤖'}</div>
              <div class="card-info">
                <div class="name">${escHtml(c.name)}</div>
                <div class="sub">токенов: ${c.token_count || 0}</div>
              </div>
              <button class="preset-tool-btn edit-char-btn" data-id="${c.id}" title="Редактировать">${window.iconImg('rename', 'Редактировать', 14, 14)}</button>
            </div>
          `).join('')}
      </div>
      <div style="display:flex; justify-content:space-between; padding-top:12px; border-top:1px solid var(--line); margin-top: auto;">
        <button class="btn btn-sm btn-outline" id="prevCharPage" ${currentCharPage <= 1 ? 'disabled' : ''}>◀</button>
        <span style="color:var(--paper-faint); font-family:var(--font-mono); font-size:13px;">${currentCharPage} / ${totalPages}</span>
        <button class="btn btn-sm btn-outline" id="nextCharPage" ${currentCharPage >= totalPages ? 'disabled' : ''}>▶</button>
      </div>
    `;

    body.innerHTML = html;

    // Открытие чата
    document.querySelectorAll('#charList .card-item').forEach(el => {
      el.addEventListener('click', function(e) {
        if (e.target.closest('.edit-char-btn')) return;
        const id = this.dataset.id;
        if (id && typeof openChatForCharacter === 'function') openChatForCharacter(id);
      });
    });

    // Редактирование
    document.querySelectorAll('.edit-char-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        selectedCharId = this.dataset.id;
        renderCharDetail();
      });
    });

    // Создать
    document.getElementById('createCharBtn')?.addEventListener('click', function(e) {
      e.stopPropagation();
      selectedCharId = 'new';
      renderCharDetail();
    });

    // Импорт
    document.getElementById('importCharBtn')?.addEventListener('click', function(e) {
      e.stopPropagation();
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async function(ev) {
        const file = ev.target.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const imported = JSON.parse(text);
          const created = await importCharacter(imported);
          window.markDirty('characters');
          renderCharactersPanel();
          showToast('Персонаж импортирован', 'success');
        } catch (e) { showToast('Ошибка чтения файла', 'error'); }
      };
      input.click();
    });

    // Пагинация
    document.getElementById('prevCharPage')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentCharPage > 1) { currentCharPage--; renderCharactersPanel(); }
    });
    document.getElementById('nextCharPage')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentCharPage < totalPages) { currentCharPage++; renderCharactersPanel(); }
    });

  } catch (e) {
    body.innerHTML = `<p style="color:var(--wine-bright);">Ошибка загрузки</p>`;
    console.error(e);
  }
}

async function renderCharDetail() {
  const body = document.getElementById('characters-body');
  if (!body || !selectedCharId) return;

  if (selectedCharId === 'new') {
    renderCharCreate(body);
    return;
  }

  try {
    let char = await getCharacter(selectedCharId);
    const totalText = char.name + Object.values(char.fields).join('');
    const tokenCount = Math.round(totalText.length / 3);

    body.innerHTML = `
      <button class="btn btn-sm btn-outline" id="backToCharList" style="margin-bottom:12px;">◀ Список</button>
      <div style="display:flex; justify-content:flex-start; align-items:baseline; gap:12px;">
        <h3 style="font-size:18px;">${escHtml(char.name)}</h3>
        <span class="token-counter" style="color:var(--paper-faint); font-family:var(--font-mono); font-size:12px;">${tokenCount} токенов</span>
      </div>
      <div style="display:flex; gap:12px; align-items:center; margin:12px 0; background:var(--ink-3); padding:10px; border-radius:var(--radius-md);">
        <div id="charAvatar" class="avatar-clickable" style="width:54px;height:54px;border-radius:50%;overflow:hidden;background:var(--ink-4);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:24px;cursor:pointer;flex-shrink:0;">
          ${char.avatar ? `<img src="${char.avatar}" style="width:100%;height:100%;object-fit:cover;">` : '🤖'}
        </div>
        <div style="display:flex; gap:4px; flex-wrap:wrap;">
          <button class="preset-tool-btn" id="charAvatarUploadBtn" title="Загрузить аватар">${window.iconImg('add_phot', '', 20, 20)}</button>
          <button class="preset-tool-btn" id="renameCharBtn" title="Переименовать">${window.iconImg('rename', '', 20, 20)}</button>
          <button class="preset-tool-btn" id="exportCharBtn" title="Экспорт">${window.iconImg('export', '', 20, 20)}</button>
          <button class="preset-tool-btn" id="cloneCharBtn" title="Клонировать">${window.iconImg('copy', '', 20, 20)}</button>
          <button class="preset-tool-btn" id="deleteCharBtn" title="Удалить">${window.iconImg('delete', '', 20, 20)}</button>
        </div>
      </div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${['personality','behavior','appearance','occupation','extra'].map(field => {
          const labels = { personality:'Характер', behavior:'Речь / Поведение', appearance:'Внешность', occupation:'Род деятельности', extra:'Дополнительно' };
          return `
            <div class="field-group">
              <label>${labels[field]}</label>
              <textarea class="char-field" data-field="${field}" rows="3">${escHtml(char.fields[field] || '')}</textarea>
            </div>
          `;
        }).join('')}
      </div>
    `;

    document.getElementById('backToCharList')?.addEventListener('click', function(e) {
      e.stopPropagation();
      renderCharactersPanel();
    });

    document.getElementById('charAvatarUploadBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*';
        input.onchange = async (ev) => {
            const file = ev.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                compressImage(e.target.result, 800, 800, 0.9, async (thumb) => {
                    const blob = await fetch(thumb).then(r => r.blob());
                    await uploadCharacterAvatar(char.id, new File([blob], 'avatar.jpg', {type:'image/jpeg'}));
                    window.markDirty('characters');
                    renderCharDetail();
                });
            };
            reader.readAsDataURL(file);
        };
        input.click();
    });

    document.getElementById('charAvatar')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (char.avatar) openLightbox(char.avatar);
    });

    document.getElementById('renameCharBtn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const name = await showPrompt('Новое имя персонажа', char.name);
      if (name) {
        await updateCharacter(char.id, { name });
        window.markDirty('characters');
        renderCharDetail();
      }
    });

    document.getElementById('exportCharBtn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const data = await exportCharacter(char.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `character_${char.name}.json`;
      a.click();
    });

    document.getElementById('cloneCharBtn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const data = await exportCharacter(char.id);
      data.name += ' (копия)';
      const created = await importCharacter(data);
      window.markDirty('characters');
      selectedCharId = created.id;
      renderCharDetail();
    });

    document.getElementById('deleteCharBtn')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (await showConfirm(`Удалить "${char.name}"?`)) {
            await deleteCharacter(char.id);
            window.markDirty('characters');
            renderCharactersPanel();
        }
    });

    document.querySelectorAll('.char-field').forEach(tx => {
      tx.addEventListener('input', debounce(async function() {
        const field = this.dataset.field;
        await updateCharacter(char.id, { fields: { [field]: this.value } });
        window.markDirty('characters');
        char.fields[field] = this.value;
        const total = char.name + Object.values(char.fields).join('');
        const span = body.querySelector('.token-counter');
        if (span) span.textContent = Math.round(total.length / 3) + ' токенов';
      }, 500));
    });

  } catch (e) { console.error(e); }
}

function renderCharCreate(body) {
  body.innerHTML = `
    <button class="btn btn-sm btn-outline" id="backToCharList" style="margin-bottom:12px;">◀ Список</button>
    <div style="display:flex; justify-content:flex-start; align-items:baseline; gap:12px;">
      <h3 style="font-size:18px;">Новый персонаж</h3>
      <span class="token-counter" style="color:var(--paper-faint); font-family:var(--font-mono); font-size:12px;">0 токенов</span>
    </div>
    <div style="display:flex; gap:12px; align-items:center; margin:12px 0; background:var(--ink-3); padding:10px; border-radius:var(--radius-md);">
      <div style="width:54px;height:54px;border-radius:50%;background:var(--ink-4);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--paper-faint);flex-shrink:0;">
        🤖
      </div>
      <div style="display:flex; gap:6px; flex:1; justify-content:flex-end;">
        <button class="preset-tool-btn" id="saveNewCharBtn" title="Создать">${window.iconImg('ok', '', 22, 22)}</button>
        <button class="preset-tool-btn" id="cancelNewCharBtn" title="Отмена">${window.iconImg('close', '', 22, 22)}</button>
      </div>
    </div>
    <div style="display:flex; flex-direction:column; gap:10px;">
      <div class="field-group">
        <label>Имя персонажа</label>
        <input type="text" id="newCharName" placeholder="Введите имя..." style="background:var(--ink-0);">
      </div>
      ${['personality','behavior','appearance','occupation','extra'].map(field => {
        const labels = { personality:'Характер', behavior:'Речь / Поведение', appearance:'Внешность', occupation:'Род деятельности', extra:'Дополнительно' };
        return `
          <div class="field-group">
            <label>${labels[field]}</label>
            <textarea class="new-char-field" data-field="${field}" rows="2" style="background:var(--ink-0);"></textarea>
          </div>
        `;
      }).join('')}
    </div>
  `;

  const goBack = (e) => {
    if (e) e.stopPropagation();
    renderCharactersPanel();
  };

  document.getElementById('backToCharList')?.addEventListener('click', goBack);
  document.getElementById('cancelNewCharBtn')?.addEventListener('click', goBack);

  document.getElementById('saveNewCharBtn')?.addEventListener('click', async function(e) {
    e.stopPropagation();
    const nameInput = document.getElementById('newCharName');
    const name = nameInput.value.trim();
    if (!name) { showToast('Имя обязательно', 'warning'); nameInput.focus(); return; }

    const fields = {};
    document.querySelectorAll('.new-char-field').forEach(tx => fields[tx.dataset.field] = tx.value);

    try {
      await createCharacter({ name, fields });
      window.markDirty('characters');
      renderCharactersPanel();
      showToast('Персонаж создан', 'success');
    } catch (e) { showToast('Ошибка создания', 'error'); }
  });

  const updateTokens = () => {
    const name = document.getElementById('newCharName').value;
    let text = name;
    document.querySelectorAll('.new-char-field').forEach(tx => text += tx.value);
    const span = body.querySelector('.token-counter');
    if (span) span.textContent = Math.round(text.length / 3) + ' токенов';
  };

  document.getElementById('newCharName').addEventListener('input', updateTokens);
  document.querySelectorAll('.new-char-field').forEach(tx => tx.addEventListener('input', updateTokens));
}