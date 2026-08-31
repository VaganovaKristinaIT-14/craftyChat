// ============================================================
// APP — навигация и общие функции
// ============================================================

function openCentralPanel(title, renderFn) {
  const central = document.getElementById('central-panel');
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
        openCentralPanel(' Фоны', renderBackgroundPanel);
      } else if (menu === 'lore') {
        openCentralPanel(' Лорбуки', renderLorebooksPanel);
      } else if (menu === 'summary') {
        openCentralPanel(' Саммари', renderSummaryPanel);
      } else if (menu === 'personas') {
        openCentralPanel('Управление персоной', renderPersonasPanel);
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

// ---------- Главная страница с новым дизайном чатов ----------
window.renderMainPage = async function() {
  const main = document.getElementById('main-content');
  main.classList.remove('chat-mode');
  main.style.display = '';
  main.style.padding = '';
  main.style.overflow = '';

  main.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%;">
      <h1 style="margin-bottom:16px; font-size:28px;">Недавние чаты</h1>
      <div id="recent-chats-list" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:12px; padding-right:4px;">
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

    // Загружаем персонажей для получения аватарок и имён
    const charsData = await getCharacters(1, 1000);
    const characters = charsData.items || [];
    const charMap = {};
    characters.forEach(c => { charMap[c.id] = c; });

    container.innerHTML = chats.map((c, index) => {
      const character = charMap[c.character_id];
      const avatarSrc = character?.avatar || window.DEFAULT_AVATARS?.bot || '🤖';
      const charName = character?.name || 'Персонаж';
      const chatName = c.name || `Chat ${index + 1}`;
      const lastMsg = c.last_message_preview || '';
      // Форматируем дату без секунд
      const date = new Date(c.updated).toLocaleString([], {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      const msgCount = c.messages_count || 0;
      const isPinned = c.pinned || false;

      return `
        <div class="chat-preview-card" data-chat-id="${c.id}">
          <div class="chat-preview-avatar">
            <img src="${avatarSrc}" alt="${charName}">
          </div>
          <div class="chat-preview-content">
            <div class="chat-preview-header">
              <div class="chat-preview-info">
                <span class="chat-preview-char">${escHtml(charName)}</span>
                <span class="chat-preview-name">${escHtml(chatName)}</span>
              </div>
              <div class="chat-preview-meta">
                <span class="chat-preview-date">${date}</span>
                <div class="chat-preview-actions">
                  <button class="preset-tool-btn chat-pin-btn" data-chat-id="${c.id}">${window.iconImg('pin', 'Закрепить', 18, 18)}</button>
                  <button class="preset-tool-btn chat-rename-btn" data-chat-id="${c.id}">${window.iconImg('rename', 'Переименовать', 18, 18)}</button>
                  <button class="preset-tool-btn chat-delete-btn" data-chat-id="${c.id}">${window.iconImg('delete', 'Удалить', 18, 18)}</button>
                </div>
              </div>
            </div>
            <div class="chat-preview-footer">
              <div class="chat-preview-msg-count">
                ${window.iconImg('message', '', 18, 18)} <span>${msgCount}</span>
              </div>
              <div class="chat-preview-last-msg">${escHtml(lastMsg)}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Обработчики для кнопок карточек
    // Закрепить
    container.querySelectorAll('.chat-pin-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        const chatId = this.dataset.chatId;
        try {
          const chat = await getChat(chatId);
          if (!chat) return;
          const newPinned = !chat.pinned;
          await updateChat(chatId, { pinned: newPinned });
          renderMainPage();
          showToast(newPinned ? 'Чат закреплён' : 'Чат откреплён', 'success');
        } catch (err) {
          showToast('Ошибка', 'error');
        }
      });
    });

    // Переименовать
    container.querySelectorAll('.chat-rename-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        const chatId = this.dataset.chatId;
        try {
          const chat = await getChat(chatId);
          if (!chat) return;
          const newName = await showPrompt('Новое название чата', chat.name || '', { title: 'Переименовать чат' });
          if (newName && newName.trim() !== chat.name) {
            await updateChat(chatId, { name: newName.trim() });
            renderMainPage();
            showToast('Чат переименован', 'success');
          }
        } catch (err) {
          showToast('Ошибка', 'error');
        }
      });
    });

    // Удалить
    container.querySelectorAll('.chat-delete-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        const chatId = this.dataset.chatId;
        const ok = await showConfirm('Удалить этот чат? Это действие необратимо.', { title: 'Удаление чата', okText: 'Удалить' });
        if (!ok) return;
        try {
          await deleteChat(chatId);
          renderMainPage();
          showToast('Чат удалён', 'success');
        } catch (err) {
          showToast('Ошибка', 'error');
        }
      });
    });

    // Клик по карточке – открыть чат
    container.querySelectorAll('.chat-preview-card').forEach(card => {
      card.addEventListener('click', function(e) {
        if (e.target.closest('.chat-preview-actions')) return;
        const chatId = this.dataset.chatId;
        if (typeof openChat === 'function') openChat(chatId);
      });
    });

  } catch (e) {
    document.getElementById('recent-chats-list').innerHTML = `<p style="color:#e74c6f;">Ошибка загрузки чатов</p>`;
    console.error(e);
  }
};