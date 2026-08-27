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
        <button class="btn btn-sm" id="createCharBtn">➕ Создать</button>
        <button class="btn btn-sm" id="importCharBtn">⬆️ Импорт</button>
      </div>
      <div class="card-list" id="charList">
        ${chars.length === 0 ? '<p style="color:#666;">Нет персонажей</p>' :
          chars.map(c => `
            <div class="card-item" data-id="${c.id}">
              <div class="card-avatar">${c.avatar ? `<img src="${c.avatar}">` : '🤖'}</div>
              <div class="card-info">
                <div class="name">${escHtml(c.name)}</div>
                <div class="sub">токенов: ${c.token_count || 0}</div>
              </div>
              <button class="copy-id-btn" data-id="${c.id}" title="Скопировать ID персонажа">📋</button>
              <button class="edit-char-btn btn btn-sm btn-outline" data-id="${c.id}">✎</button>
            </div>
          `).join('')}
      </div>
      <div style="display:flex; justify-content:space-between; padding-top:12px; border-top:1px solid #333;">
        <button class="btn btn-sm btn-outline" id="prevCharPage" ${currentCharPage <= 1 ? 'disabled' : ''}>◀</button>
        <span style="color:#666;">${currentCharPage} / ${totalPages}</span>
        <button class="btn btn-sm btn-outline" id="nextCharPage" ${currentCharPage >= totalPages ? 'disabled' : ''}>▶</button>
      </div>
    `;

    body.innerHTML = html;

    // Копирование ID
    document.querySelectorAll('.copy-id-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        const id = this.dataset.id;
        try {
          await navigator.clipboard.writeText(id);
          const original = this.textContent;
          this.textContent = '✅';
          this.classList.add('copied');
          showToast(`ID персонажа скопирован: ${id}`, 'success', 3000);
          setTimeout(() => {
            this.textContent = original;
            this.classList.remove('copied');
          }, 2000);
        } catch (err) {
          const input = document.createElement('input');
          input.value = id;
          document.body.appendChild(input);
          input.select();
          document.execCommand('copy');
          input.remove();
          showToast(`ID скопирован: ${id}`, 'success', 3000);
        }
      });
    });

    // Открытие чата
    document.querySelectorAll('#charList .card-item').forEach(el => {
      el.addEventListener('click', function(e) {
        if (e.target.closest('.edit-char-btn') || e.target.closest('.copy-id-btn')) return;
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
    document.getElementById('createCharBtn')?.addEventListener('click', async function() {
      const newChar = { name: 'Новый персонаж', fields: {} };
      const created = await createCharacter(newChar);
      selectedCharId = created.id;
      renderCharDetail();
      showToast('Персонаж создан', 'success');
    });

    // Импорт
    document.getElementById('importCharBtn')?.addEventListener('click', function() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async function(ev) {
        const file = ev.target.files[0];
        if (!file) return;
        const text = await file.text();
        try {
          const imported = JSON.parse(text);
          if (!imported.name) { showToast('Неверный формат файла', 'error'); return; }
          const created = await importCharacter(imported);
          selectedCharId = created.id;
          renderCharDetail();
          showToast('Персонаж импортирован', 'success');
        } catch (e) { showToast('Ошибка чтения файла', 'error'); }
      };
      input.click();
    });

    // Пагинация
    document.getElementById('prevCharPage')?.addEventListener('click', function() {
      if (currentCharPage > 1) { currentCharPage--; renderCharactersPanel(); }
    });
    document.getElementById('nextCharPage')?.addEventListener('click', function() {
      if (currentCharPage < totalPages) { currentCharPage++; renderCharactersPanel(); }
    });

  } catch (e) {
    body.innerHTML = `<p style="color:#e74c6f;">Ошибка загрузки</p>`;
    console.error(e);
  }
}

// ---------- Детальный режим ----------
async function renderCharDetail() {
  const body = document.getElementById('characters-body');
  if (!body || !selectedCharId) return;

  try {
    let char = await getCharacter(selectedCharId);
    if (!char) { showToast('Персонаж не найден', 'error'); return; }

    const totalText = char.name + Object.values(char.fields).join('');
    const tokenCount = Math.round(totalText.length / 3);

    body.innerHTML = `
      <button class="btn btn-sm btn-outline" id="backToCharList">📋 Список</button>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
        <h3 style="font-size:20px;">${escHtml(char.name)}</h3>
        <span class="token-counter" style="color:#666;">${tokenCount} токенов</span>
      </div>
      <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin:8px 0;">
        <div id="charAvatar" style="width:64px;height:64px;border-radius:50%;overflow:hidden;background:#333;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:28px;">
          ${char.avatar ? `<img src="${char.avatar}" style="width:100%;height:100%;object-fit:cover;">` : '🤖'}
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button class="btn btn-sm" id="renameCharBtn">✎ Переименовать</button>
          <button class="btn btn-sm" id="exportCharBtn">⬇️ Экспорт</button>
          <button class="btn btn-sm" id="cloneCharBtn">📋 Клонировать</button>
          <button class="btn btn-sm btn-danger" id="deleteCharBtn">🗑️ Удалить</button>
          <button class="btn btn-sm btn-outline copy-id-btn" id="copyIdBtn" data-id="${char.id}" title="Скопировать ID">📋 ID</button>
        </div>
      </div>
      <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
        ${['personality','behavior','appearance','occupation','extra'].map(field => {
          const labels = { personality:'Характер', behavior:'Речь/поведение', appearance:'Внешность', occupation:'Род деятельности', extra:'Дополнительно' };
          return `
            <label>${labels[field]}</label>
            <textarea class="char-field" data-field="${field}" rows="2">${escHtml(char.fields[field] || '')}</textarea>
          `;
        }).join('')}
      </div>
    `;

    // --- обработчики ---

    document.getElementById('backToCharList')?.addEventListener('click', function() {
      selectedCharId = null;
      renderCharactersPanel();
    });

    document.getElementById('renameCharBtn')?.addEventListener('click', async function() {
      const name = prompt('Новое имя:', char.name);
      if (name) {
        await updateCharacter(char.id, { name });
        char = await getCharacter(char.id);
        renderCharDetail();
        showToast('Персонаж переименован', 'success');
      }
    });

    document.getElementById('exportCharBtn')?.addEventListener('click', async function() {
      const data = await exportCharacter(char.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `character_${char.name}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Персонаж экспортирован', 'success');
    });

    document.getElementById('cloneCharBtn')?.addEventListener('click', async function() {
      const data = await exportCharacter(char.id);
      data.name = char.name + ' (копия)';
      const created = await importCharacter(data);
      selectedCharId = created.id;
      renderCharDetail();
      showToast('Создана копия персонажа', 'success');
    });

    document.getElementById('deleteCharBtn')?.addEventListener('click', async function() {
      if (!confirm(`Удалить персонажа "${char.name}"?`)) return;
      await deleteCharacter(char.id);
      selectedCharId = null;
      renderCharactersPanel();
      showToast('Персонаж удалён', 'success');
    });

    document.getElementById('copyIdBtn')?.addEventListener('click', async function(e) {
      e.stopPropagation();
      const id = this.dataset.id;
      try {
        await navigator.clipboard.writeText(id);
        const original = this.textContent;
        this.textContent = '✅ Скопировано!';
        setTimeout(() => { this.textContent = original; }, 2000);
        showToast(`ID персонажа скопирован: ${id}`, 'success', 3000);
      } catch (err) {
        showToast('Не удалось скопировать ID', 'error');
      }
    });

    document.getElementById('charAvatar')?.addEventListener('click', function() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async function(ev) {
        const file = ev.target.files[0];
        if (!file) return;
        if (file.size > 5*1024*1024) { showToast('Файл >5 МБ', 'error'); return; }
        const reader = new FileReader();
        reader.onload = function(e) {
          compressImage(e.target.result, 200, 200, 0.8, async function(thumb) {
            if (!thumb) { showToast('Не удалось обработать изображение', 'error'); return; }
            const blob = await fetch(thumb).then(r => r.blob());
            const fileObj = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
            await uploadCharacterAvatar(char.id, fileObj);
            char = await getCharacter(char.id);
            renderCharDetail();
            showToast('Аватар обновлён', 'success');
          });
        };
        reader.readAsDataURL(file);
      };
      input.click();
    });

    document.querySelectorAll('.char-field').forEach(textarea => {
      textarea.addEventListener('input', debounce(async function() {
        const field = this.dataset.field;
        const val = this.value;
        await updateCharacter(char.id, { fields: { [field]: val } });
        char = await getCharacter(char.id);
        const total = char.name + Object.values(char.fields).join('');
        const tokens = Math.round(total.length / 3);
        const span = body.querySelector('.token-counter');
        if (span) span.textContent = tokens + ' токенов';
      }, 500));
    });

  } catch (e) {
    body.innerHTML = `<p style="color:#e74c6f;">Ошибка загрузки персонажа</p>`;
    console.error(e);
  }
}