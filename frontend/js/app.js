// ============================================================
// APP — навигация и общие функции
// ============================================================

function openCentralPanel(title, renderFn) {
  const central = document.getElementById('central-panel');
  // Закрываем для анимации
  central.classList.remove('open');
  setTimeout(() => {
    const titleEl = central.querySelector('#central-panel-title');
    if (titleEl) titleEl.textContent = title;
    if (typeof renderFn === 'function') renderFn();
    central.classList.add('open');
  }, 250);
}

document.addEventListener('DOMContentLoaded', async function() {
  // Закрытие панелей по клику на крестик
  document.querySelectorAll('.close-panel').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const panel = this.dataset.panel;
      if (panel === 'presets') document.getElementById('presets-panel').classList.remove('open');
      else if (panel === 'characters') document.getElementById('characters-panel').classList.remove('open');
      else if (panel === 'central') document.getElementById('central-panel').classList.remove('open');
    });
  });

  // Меню-кнопки
  const menuBtns = document.querySelectorAll('.menu-btn');
  menuBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const menu = this.dataset.menu;
      menuBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      // Закрываем все панели (боковые и центральную)
      document.getElementById('presets-panel').classList.remove('open');
      document.getElementById('characters-panel').classList.remove('open');
      document.getElementById('central-panel').classList.remove('open');

      if (menu === 'presets') {
        document.getElementById('presets-panel').classList.add('open');
        if (typeof renderPresetsPanel === 'function') renderPresetsPanel();
      } else if (menu === 'characters') {
        document.getElementById('characters-panel').classList.add('open');
        if (typeof renderCharactersPanel === 'function') renderCharactersPanel();
      } else if (menu === 'background') {
        openCentralPanel('🖼️ Фоны', renderBackgroundPanel);
      } else if (menu === 'lore') {
        openCentralPanel('📖 Лорбуки', renderLorebooksPanel);
      } else if (menu === 'summary') {
        openCentralPanel('📝 Саммари', renderSummaryPanel);
      } else if (menu === 'personas') {
        openCentralPanel('👤 Персоны', renderPersonasPanel);
      }
    });
  });

  // Закрытие панелей при клике вне
  document.addEventListener('click', function(e) {
    const panels = ['presets-panel', 'characters-panel', 'central-panel'];
    const isInside = panels.some(id => document.getElementById(id).contains(e.target));
    const isBtn = e.target.closest('.menu-btn') || e.target.closest('.close-panel');
    const isOverlay = e.target.closest('.app-modal-overlay')
      || e.target.closest('.lightbox-overlay')
      || e.target.closest('.toast-container')
      || e.target.closest('.modal-overlay');
    if (isOverlay) return;
    if (!isInside && !isBtn) {
      document.getElementById('presets-panel').classList.remove('open');
      document.getElementById('characters-panel').classList.remove('open');
      document.getElementById('central-panel').classList.remove('open');
      menuBtns.forEach(b => b.classList.remove('active'));
    }
  });

  // Закрытие по Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.getElementById('presets-panel').classList.remove('open');
      document.getElementById('characters-panel').classList.remove('open');
      document.getElementById('central-panel').classList.remove('open');
      menuBtns.forEach(b => b.classList.remove('active'));
    }
  });

  await renderMainPage();
});

window.renderMainPage = async function() {
  const main = document.getElementById('main-content');
  main.classList.remove('chat-mode');
  main.style.display = '';
  main.style.padding = '';
  main.style.overflow = '';

  main.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%;">
      <h1 style="margin-bottom:4px; font-size:28px;">Недавние чаты</h1>
      <div id="recent-chats-list" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:10px;">
        <p style="color:#666;">Загрузка...</p>
      </div>
    </div>
  `;
  try {
    const chats = await getRecentChats();
    const container = document.getElementById('recent-chats-list');
    if (chats.length === 0) {
      container.innerHTML = `<p style="color:#666;">Нет чатов. Создайте первого персонажа и начните диалог.</p>`;
      return;
    }
    container.innerHTML = chats.map(c => `
      <div class="card-item" data-chat-id="${c.id}" style="cursor:pointer;">
        <div class="card-avatar">${c.character_avatar ? `<img src="${c.character_avatar}">` : '🤖'}</div>
        <div class="card-info">
          <div class="name">${escHtml(c.name)}</div>
          <div class="sub">${escHtml(c.last_message_preview || 'Нет сообщений')}</div>
        </div>
        <div style="font-size:12px; color:#666; white-space:nowrap;">${new Date(c.updated).toLocaleString()}</div>
      </div>
    `).join('');
    container.querySelectorAll('.card-item').forEach(el => {
      el.addEventListener('click', function() {
        const chatId = this.dataset.chatId;
        if (typeof openChat === 'function') openChat(chatId);
      });
    });
  } catch (e) {
    document.getElementById('recent-chats-list').innerHTML = `<p style="color:#e74c6f;">Ошибка загрузки чатов</p>`;
  }
};