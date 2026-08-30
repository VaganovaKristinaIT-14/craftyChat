// ============================================================
// PERSONAS — управление персонами (User)
// ============================================================

let currentPersonaPage = 1;
let selectedPersonaId = null;
const PERSONA_PER_PAGE = 10;

async function renderPersonasPanel() {
  const body = document.getElementById('central-panel-body');
  if (!body) return;

  try {
    const data = await getPersonas(currentPersonaPage, PERSONA_PER_PAGE);
    const personas = data.items || [];
    const total = data.total || 0;
    const totalPages = data.pages || 1;
    const activeId = data.active_persona_id;

    if (!selectedPersonaId && personas.length > 0) selectedPersonaId = personas[0].id;
    if (selectedPersonaId && !personas.find(p => p.id === selectedPersonaId)) selectedPersonaId = null;

    let html = `
      <div style="display:flex; gap:20px; height:100%;">
        <div style="flex:0 0 260px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="btn btn-sm" id="createPersonaBtn">➕ Создать</button>
            <button class="btn btn-sm" id="importPersonaBtn">⬆️ Импорт</button>
          </div>
          <div class="card-list" id="personaList">
            ${personas.length === 0 ? '<p style="color:#666;">Нет персон</p>' :
              personas.map(p => `
                <div class="card-item ${p.id === selectedPersonaId ? 'active' : ''}" data-id="${p.id}">
                  <div class="card-avatar">${p.avatar ? `<img src="${p.avatar}">` : '👤'}</div>
                  <div class="card-info">
                    <div class="name">${escHtml(p.name)} ${p.id === activeId ? '⭐' : ''}</div>
                    <div class="sub">${escHtml(p.description.substring(0, 30))}</div>
                  </div>
                </div>
              `).join('')}
          </div>
          <div style="display:flex; justify-content:space-between; padding-top:8px; border-top:1px solid #333;">
            <button class="btn btn-sm btn-outline" id="prevPersonaPage" ${currentPersonaPage <= 1 ? 'disabled' : ''}>◀</button>
            <span style="color:#666;">${currentPersonaPage} / ${totalPages}</span>
            <button class="btn btn-sm btn-outline" id="nextPersonaPage" ${currentPersonaPage >= totalPages ? 'disabled' : ''}>▶</button>
          </div>
        </div>
        <div style="flex:1; background:#2a2a34; border-radius:12px; padding:16px;" id="personaDetailContainer">
          ${selectedPersonaId ? await renderPersonaDetail(selectedPersonaId) : '<p style="color:#666; text-align:center; margin-top:40px;">Выберите персону</p>'}
        </div>
      </div>
    `;
    body.innerHTML = html;

    // Выбор персоны
    document.querySelectorAll('#personaList .card-item').forEach(el => {
      el.addEventListener('click', function() {
        selectedPersonaId = this.dataset.id;
        renderPersonasPanel();
      });
    });

    // Создать
    document.getElementById('createPersonaBtn')?.addEventListener('click', async function() {
      const newP = await createPersona({ name: 'Новая персона', description: '' });
      selectedPersonaId = newP.id;
      await activatePersona(newP.id);
      renderPersonasPanel();
      showToast('Персона создана', 'success');
    });

    // Импорт
    document.getElementById('importPersonaBtn')?.addEventListener('click', function() {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.json';
      input.onchange = async function(ev) {
        const file = ev.target.files[0];
        if (!file) return;
        const text = await file.text();
        try {
          const imported = JSON.parse(text);
          if (!imported.name) { showToast('Неверный формат', 'error'); return; }
          const newP = await importPersona(imported);
          selectedPersonaId = newP.id;
          await activatePersona(newP.id);
          renderPersonasPanel();
          showToast('Импортировано', 'success');
        } catch (e) { showToast('Ошибка', 'error'); }
      };
      input.click();
    });

    // Пагинация
    document.getElementById('prevPersonaPage')?.addEventListener('click', function() {
      if (currentPersonaPage > 1) { currentPersonaPage--; renderPersonasPanel(); }
    });
    document.getElementById('nextPersonaPage')?.addEventListener('click', function() {
      if (currentPersonaPage < totalPages) { currentPersonaPage++; renderPersonasPanel(); }
    });

    if (selectedPersonaId) {
      attachPersonaDetailHandlers();
    }

  } catch (e) {
    body.innerHTML = `<p style="color:#e74c6f;">Ошибка загрузки</p>`;
    console.error(e);
  }
}

async function renderPersonaDetail(personaId) {
  try {
    const persona = await getPersona(personaId);
    if (!persona) return '<p style="color:#666;">Персона не найдена</p>';

    const charsData = await getCharacters(1, 1000);
    const allChars = charsData.items || [];

    return `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3 style="font-size:18px;">${escHtml(persona.name)}</h3>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-sm" id="renamePersonaBtn">✎</button>
          <button class="btn btn-sm" id="exportPersonaBtn">⬇️</button>
          <button class="btn btn-sm btn-danger" id="deletePersonaBtn">🗑️</button>
          <button class="btn btn-sm" id="activatePersonaBtn">⭐ Активна</button>
        </div>
      </div>
      <div style="display:flex; gap:12px; margin:8px 0;">
        <div id="personaAvatar" class="avatar-clickable" style="width:64px;height:64px;border-radius:50%;overflow:hidden;background:#333;display:flex;align-items:center;justify-content:center;font-size:28px;">
          ${persona.avatar ? `<img src="${persona.avatar}">` : '👤'}
          <div class="avatar-upload-badge" id="personaAvatarUpload" title="Загрузить аватар">📷</div>
        </div>
        <div style="flex:1;">
          <label>Описание</label>
          <textarea id="personaDesc" rows="3" style="width:100%;">${escHtml(persona.description)}</textarea>
        </div>
      </div>
      <div style="border-top:1px solid #333; padding-top:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h4 style="font-size:15px;">Связи с персонажами</h4>
          <button class="btn btn-sm" id="linkCharBtn">➕ Привязать</button>
        </div>
        <div id="linkedChars" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">
  ${persona.linked_characters && persona.linked_characters.length > 0 ?
    persona.linked_characters.map(charId => {
      const ch = allChars.find(c => c.id === charId);
      return ch ? `
        <div style="display:flex; align-items:center; gap:6px; background:var(--ink-3); padding:4px 10px 4px 4px; border-radius:20px; border:1px solid var(--line);">
          <div style="width:28px;height:28px;border-radius:50%;overflow:hidden;background:var(--ink-4);display:flex;align-items:center;justify-content:center;font-size:14px;">
            ${ch.avatar ? `<img src="${ch.avatar}" style="width:100%;height:100%;object-fit:cover;">` : '🤖'}
          </div>
          <span style="font-size:13px;font-weight:500;">${escHtml(ch.name)}</span>
          <button class="unlink-btn" data-char-id="${charId}" style="background:none;border:none;color:var(--wine);cursor:pointer;font-size:14px;padding:0 4px;">✕</button>
        </div>
      ` : ''
    }).join('') :
    '<span style="color:var(--paper-faint);font-style:italic;">Нет привязанных персонажей</span>'
  }
</div>
      </div>
    `;
  } catch (e) {
    return `<p style="color:#e74c6f;">Ошибка загрузки персоны</p>`;
  }
}

function attachPersonaDetailHandlers() {
  const container = document.getElementById('personaDetailContainer');
  if (!container) return;

  document.getElementById('renamePersonaBtn')?.addEventListener('click', async function() {
    if (!selectedPersonaId) return;
    const persona = await getPersona(selectedPersonaId);
    if (!persona) return;
    const newName = await showPrompt('Новое имя персоны', persona.name, { title: 'Переименовать персону' });
    if (newName) {
      await updatePersona(selectedPersonaId, { name: newName });
      renderPersonasPanel();
      showToast('Переименовано', 'success');
    }
  });

  document.getElementById('exportPersonaBtn')?.addEventListener('click', async function() {
    if (!selectedPersonaId) return;
    const data = await exportPersona(selectedPersonaId);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `persona_${data.name}.json`; a.click();
    URL.revokeObjectURL(url);
    showToast('Экспортировано', 'success');
  });

  document.getElementById('deletePersonaBtn')?.addEventListener('click', async function() {
    if (!selectedPersonaId) return;
    const persona = await getPersona(selectedPersonaId);
    if (!persona) return;
    if (!(await showConfirm(`Удалить персону "${persona.name}"? Это действие необратимо.`, { title: 'Удаление персоны', okText: 'Удалить' }))) return;
    await deletePersona(selectedPersonaId);
    selectedPersonaId = null;
    renderPersonasPanel();
    showToast('Персона удалена', 'success');
  });

  document.getElementById('activatePersonaBtn')?.addEventListener('click', async function() {
    if (!selectedPersonaId) return;
    await activatePersona(selectedPersonaId);
    renderPersonasPanel();
    showToast('Персона активна', 'success');
  });

  document.getElementById('personaAvatar')?.addEventListener('click', async function(e) {
    if (e.target.closest('#personaAvatarUpload')) return;
    if (!selectedPersonaId) return;
    const persona = await getPersona(selectedPersonaId);
    if (persona?.avatar) openLightbox(persona.avatar);
  });

  document.getElementById('personaAvatarUpload')?.addEventListener('click', function(e) {
    e.stopPropagation();
    if (!selectedPersonaId) return;
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async function(ev) {
      const file = ev.target.files[0];
      if (!file) return;
      if (file.size > 5*1024*1024) { showToast('Файл >5 МБ', 'error'); return; }
      const reader = new FileReader();
      reader.onload = function(e) {
        compressImage(e.target.result, 800, 800, 0.9, async function(thumb) {
          if (!thumb) { showToast('Не удалось обработать изображение', 'error'); return; }
          const blob = await fetch(thumb).then(r => r.blob());
          const fileObj = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
          await uploadPersonaAvatar(selectedPersonaId, fileObj);
          renderPersonasPanel();
          showToast('Аватар обновлён', 'success');
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  });

  document.getElementById('personaDesc')?.addEventListener('input', debounce(async function() {
    if (!selectedPersonaId) return;
    const val = this.value;
    await updatePersona(selectedPersonaId, { description: val });
  }, 500));

  document.getElementById('linkCharBtn')?.addEventListener('click', async function() {
  if (!selectedPersonaId) return;

  // Получаем всех персонажей
  const charsData = await getCharacters(1, 1000);
  const allChars = charsData.items || [];
  if (allChars.length === 0) {
    showToast('Нет доступных персонажей. Создайте хотя бы одного.', 'warning');
    return;
  }

  // Строим список для выбора
  const listHtml = allChars.map(ch => `
    <div class="char-select-item" data-char-id="${ch.id}" style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;cursor:pointer;transition:background 0.15s;">
      <div style="width:36px;height:36px;border-radius:50%;overflow:hidden;background:var(--ink-4);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">
        ${ch.avatar ? `<img src="${ch.avatar}" style="width:100%;height:100%;object-fit:cover;">` : '🤖'}
      </div>
      <span style="font-weight:500;">${escHtml(ch.name)}</span>
    </div>
  `).join('');

  // Показываем кастомную модалку (используем showPrompt с multiline, но нам нужен не ввод, а клик по элементу)
  // Поэтому создадим свою модалку на лету.
  const overlay = document.createElement('div');
  overlay.className = 'app-modal-overlay';
  overlay.style.display = 'flex';
  overlay.innerHTML = `
    <div class="app-modal" style="max-width:500px;width:90%;max-height:80vh;display:flex;flex-direction:column;">
      <div class="app-modal-title">Выберите персонажа для привязки</div>
      <div style="flex:1;overflow-y:auto;margin:12px 0;display:flex;flex-direction:column;gap:4px;">
        ${listHtml}
      </div>
      <div class="app-modal-actions">
        <button class="app-modal-btn app-modal-btn-cancel" id="modalCancelBtn">Отмена</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));

  // Обработчик клика по элементу списка
  overlay.querySelectorAll('.char-select-item').forEach(el => {
    el.addEventListener('click', async function() {
      const charId = this.dataset.charId;
      try {
        await linkPersonaToCharacter(selectedPersonaId, charId);
        overlay.remove();
        renderPersonasPanel();
        showToast('Персонаж привязан', 'success');
      } catch (e) {
        showToast('Ошибка привязки', 'error');
      }
    });
    // Эффект при наведении
    el.addEventListener('mouseenter', function() { this.style.background = 'var(--ink-4)'; });
    el.addEventListener('mouseleave', function() { this.style.background = 'transparent'; });
  });

  // Закрытие по кнопке "Отмена"
  overlay.querySelector('#modalCancelBtn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
});

  document.querySelectorAll('.unlink-btn').forEach(btn => {
    btn.addEventListener('click', async function(e) {
      e.stopPropagation();
      if (!selectedPersonaId) return;
      const charId = this.dataset.charId;
      if (!charId) return;
      if (!(await showConfirm('Отвязать персонажа от этой персоны?', { title: 'Отвязать персонажа', okText: 'Отвязать' }))) return;
      await unlinkPersonaFromCharacter(selectedPersonaId, charId);
      renderPersonasPanel();
      showToast('Отвязано', 'success');
    });
  });
}