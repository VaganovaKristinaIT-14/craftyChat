// ============================================================
// APP — навигация и общие функции
// ============================================================

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
        const central = document.getElementById('central-panel');
        central.querySelector('#central-panel-title').textContent = '🖼️ Фоны';
        central.classList.add('open');
        if (typeof renderBackgroundPanel === 'function') renderBackgroundPanel();
      } else if (menu === 'lore') {
        const central = document.getElementById('central-panel');
        central.querySelector('#central-panel-title').textContent = '📖 Лорбуки';
        central.classList.add('open');
        if (typeof renderLorebooksPanel === 'function') renderLorebooksPanel();
      } else if (menu === 'summary') {
        const central = document.getElementById('central-panel');
        central.querySelector('#central-panel-title').textContent = '📝 Саммари';
        central.classList.add('open');
        if (typeof renderSummaryPanel === 'function') renderSummaryPanel();
      } else if (menu === 'personas') {
        const central = document.getElementById('central-panel');
        central.querySelector('#central-panel-title').textContent = '👤 Персоны';
        central.classList.add('open');
        if (typeof renderPersonasPanel === 'function') renderPersonasPanel();
      }
    });
  });

  // Закрытие панелей при клике вне
  document.addEventListener('click', function(e) {
    const panels = ['presets-panel', 'characters-panel', 'central-panel'];
    const isInside = panels.some(id => document.getElementById(id).contains(e.target));
    const isBtn = e.target.closest('.menu-btn') || e.target.closest('.close-panel');
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
  main.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%;">
      <h1 style="margin-bottom:8px;">🏠 Главная</h1>
      <p style="color:#9a9aa8; margin-bottom:20px;">Ваши последние чаты</p>
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