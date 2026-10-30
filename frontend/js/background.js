// ============================================================
// BACKGROUND — управление фонами (фон только по бокам)
// ============================================================

const MAX_THUMBS = 10;

// Функция применения фона ТОЛЬКО по бокам (на body)
async function applyCurrentBackground() {
  try {
    const data = await getBackground();
    if (!data || !data.selected) {
      removeAppBackground();
      return;
    }

    let bgUrl = null;

    // Пробуем получить полноразмерный фон
    try {
      const full = await getFullBackground(data.selected);
      bgUrl = full.data || full.url || full.image || (typeof full === 'string' ? full : null);
    } catch (e) {
      const thumb = (data.thumbnails || []).find(t => t.id === data.selected);
      if (thumb) bgUrl = thumb.data;
    }

    if (!bgUrl) {
      removeAppBackground();
      return;
    }

    // 1. Ставим фон ТОЛЬКО на body (он виден исключительно по бокам от окна 900px)
    document.body.style.backgroundImage = `url("${bgUrl}")`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
    document.body.style.backgroundRepeat = "no-repeat";
    document.body.style.backgroundAttachment = "fixed";

    // 2. Гарантируем, что само приложение внутри НЕ просвечивает
    const appEl = document.getElementById('app');
    if (appEl) {
      appEl.style.backgroundImage = '';
    }

  } catch (err) {
    console.error('Ошибка применения фона:', err);
  }
}

// Сброс фона (возвращает исходные градиенты CSS)
function removeAppBackground() {
  document.body.style.backgroundImage = '';
  document.body.style.backgroundSize = '';
  document.body.style.backgroundPosition = '';
  document.body.style.backgroundRepeat = '';
  document.body.style.backgroundAttachment = '';

  const appEl = document.getElementById('app');
  if (appEl) {
    appEl.style.backgroundImage = '';
  }
}

window.applyCurrentBackground = applyCurrentBackground;
window.removeAppBackground = removeAppBackground;

async function renderBackgroundPanel() {
  const body = document.getElementById('central-panel-body');
  if (!body) return;

  try {
    const data = await getBackground();
    const thumbnails = data.thumbnails || [];
    const selected = data.selected;

    body.innerHTML = `
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
        <button class="tool-btn" id="addBgBtn" title="Добавить фон">
          ${window.iconImg('add', 'Добавить', 18, 18)} Добавить фон
        </button>
        <button class="tool-btn" id="deleteSelectedBgBtn" title="Удалить выбранный" ${selected ? '' : 'disabled'}>
          ${window.iconImg('delete', 'Удалить', 18, 18)} Удалить выбранный
        </button>
        <button class="tool-btn" id="resetBgBtn" title="Сбросить все">
          ${window.iconImg('refresh', 'Сбросить', 18, 18)} Сбросить все
        </button>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(130px,1fr)); gap:12px;">
        ${thumbnails.length === 0 ? '<p style="color:#666; grid-column:1/-1; padding:20px 0; text-align:center;">Нет фонов. Загрузите свой первый фон!</p>' :
          thumbnails.map(t => `
            <div class="bg-thumb" data-id="${t.id}" style="border-radius:8px; overflow:hidden; cursor:pointer; border:2px solid ${selected === t.id ? 'var(--amber)' : 'transparent'}; position:relative; aspect-ratio:16/9; background:#222; transition:0.15s;">
              <img src="${t.data}" style="width:100%; height:100%; object-fit:cover; display:block;">
              <button class="delete-bg-btn" data-id="${t.id}" title="Удалить" style="position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.65); color:#fff; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:12px;">✕</button>
              ${selected === t.id ? '<div style="position:absolute; bottom:6px; right:6px; background:var(--amber); color:var(--amber-ink); border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:bold;">✓</div>' : ''}
            </div>
          `).join('')}
      </div>
    `;

    // Добавить фон
    document.getElementById('addBgBtn')?.addEventListener('click', function(e) {
      e.stopPropagation();
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async function(ev) {
        const file = ev.target.files[0];
        if (!file) return;
        if (file.size > 8 * 1024 * 1024) { showToast('Файл слишком большой (>8 МБ)', 'error'); return; }
        try {
          const res = await uploadBackground(file);
          window.markDirty('background');
          if (res && res.id) {
            await selectBackground(res.id);
            await applyCurrentBackground();
          }
          renderBackgroundPanel();
          showToast('Фон успешно загружен', 'success');
        } catch (e) {
          showToast('Ошибка загрузки фона', 'error');
        }
      };
      input.click();
    });

    // Удалить выбранный
    document.getElementById('deleteSelectedBgBtn')?.addEventListener('click', async function(e) {
      e.stopPropagation();
      if (!selected) return;
      await deleteBackground(selected);
      window.markDirty('background');
      await applyCurrentBackground();
      renderBackgroundPanel();
      showToast('Фон удалён', 'success');
    });

    // Сбросить все фоны
    document.getElementById('resetBgBtn')?.addEventListener('click', async function(e) {
      e.stopPropagation();
      if (!(await showConfirm('Удалить все фоны? Это действие необратимо.', { title: 'Сброс фонов', okText: 'Удалить' }))) return;
      await resetBackgrounds();
      window.markDirty('background');
      removeAppBackground();
      renderBackgroundPanel();
      showToast('Все фоны сброшены', 'success');
    });

    // Клик по плитке фона — моментальное применение по бокам
    document.querySelectorAll('.bg-thumb').forEach(el => {
      el.addEventListener('click', async function(e) {
        if (e.target.closest('.delete-bg-btn')) return;
        e.stopPropagation();
        const id = this.dataset.id;
        await selectBackground(id);
        window.markDirty('background');
        await applyCurrentBackground();
        renderBackgroundPanel();
        showToast('Фон применён', 'success');
      });
    });

    // Удаление отдельной плитки
    document.querySelectorAll('.delete-bg-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        const id = this.dataset.id;
        await deleteBackground(id);
        window.markDirty('background');
        await applyCurrentBackground();
        renderBackgroundPanel();
        showToast('Фон удалён', 'success');
      });
    });

  } catch (e) {
    body.innerHTML = `<p style="color:#e74c6f;">Ошибка загрузки фонов</p>`;
    console.error(e);
  }
}

// Применяем фон при первой загрузке страницы
applyCurrentBackground();