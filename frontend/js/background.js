// ============================================================
// BACKGROUND — управление фонами (с IndexedDB)
// ============================================================

const MAX_THUMBS = 10;

async function renderBackgroundPanel() {
  const body = document.getElementById('central-panel-body');
  if (!body) return;

  try {
    const data = await getBackground();
    const thumbnails = data.thumbnails || [];
    const selected = data.selected;

    body.innerHTML = `
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
        <button class="btn btn-sm" id="addBgBtn">➕ Добавить фон</button>
        <button class="btn btn-sm btn-danger" id="deleteSelectedBgBtn" ${selected ? '' : 'disabled'}>🗑️ Удалить выбранный</button>
        <button class="btn btn-sm btn-danger" id="resetBgBtn">🔄 Сбросить все</button>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px,1fr)); gap:12px;">
        ${thumbnails.length === 0 ? '<p style="color:#666; grid-column:1/-1;">Нет фонов</p>' :
          thumbnails.map(t => `
            <div class="bg-thumb" data-id="${t.id}" style="border-radius:8px; overflow:hidden; cursor:pointer; border:2px solid ${selected === t.id ? '#4a6cf7' : 'transparent'}; position:relative; aspect-ratio:16/9; background:#222;">
              <img src="${t.data}" style="width:100%; height:100%; object-fit:cover;">
              <button class="delete-bg-btn" data-id="${t.id}" style="position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer;">✕</button>
              ${selected === t.id ? '<div style="position:absolute; bottom:4px; right:4px; background:#4a6cf7; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; font-size:12px;">✓</div>' : ''}
            </div>
          `).join('')}
      </div>
    `;

    document.getElementById('addBgBtn')?.addEventListener('click', function() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async function(ev) {
        const file = ev.target.files[0];
        if (!file) return;
        if (file.size > 5*1024*1024) { showToast('Файл >5 МБ', 'error'); return; }
        try {
          await uploadBackground(file);
          renderBackgroundPanel();
          showToast('Фон загружен', 'success');
        } catch (e) {}
      };
      input.click();
    });

    document.getElementById('deleteSelectedBgBtn')?.addEventListener('click', async function() {
      if (!selected) return;
      await deleteBackground(selected);
      renderBackgroundPanel();
      showToast('Фон удалён', 'success');
    });

    document.getElementById('resetBgBtn')?.addEventListener('click', async function() {
      if (!(await showConfirm('Удалить все фоны? Это действие необратимо.', { title: 'Сброс фонов', okText: 'Удалить' }))) return;
      await resetBackgrounds();
      renderBackgroundPanel();
      showToast('Сброшено', 'success');
    });

    document.querySelectorAll('.bg-thumb').forEach(el => {
      el.addEventListener('click', async function(e) {
        if (e.target.closest('.delete-bg-btn')) return;
        const id = this.dataset.id;
        await selectBackground(id);
        renderBackgroundPanel();
        showToast('Фон применён', 'success');
      });
    });

    document.querySelectorAll('.delete-bg-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        const id = this.dataset.id;
        await deleteBackground(id);
        renderBackgroundPanel();
        showToast('Фон удалён', 'success');
      });
    });

  } catch (e) {
    body.innerHTML = `<p style="color:#e74c6f;">Ошибка загрузки фонов</p>`;
    console.error(e);
  }
}