// ============================================================
// APP — навигация и общие функции
// ============================================================

function openCentralPanel(title, renderFn) {
  const central = document.getElementById('central-panel');
  if (!central) return;

  const titleEl = central.querySelector('#central-panel-title');
  if (titleEl) titleEl.textContent = title;

  central.classList.add('open');

  if (typeof renderFn === 'function') {
    renderFn();
  }
}

document.addEventListener('DOMContentLoaded', async function() {

  // --- Отключение автозаполнения и системных подсказок ---
  const disableAutocomplete = (el) => {
    if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return;
    el.setAttribute('autocomplete', 'one-time-code');
    el.setAttribute('spellcheck', 'false');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('autocapitalize', 'off');
    if (!el.getAttribute('name') || el.getAttribute('name') === '') {
      el.setAttribute('name', 'field_' + Math.random().toString(36).substring(7));
    }
  };

  document.addEventListener('focusin', (e) => disableAutocomplete(e.target));

  const observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      for (let node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
            disableAutocomplete(node);
          }
          node.querySelectorAll('input, textarea').forEach(disableAutocomplete);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Закрытие панелей по крестику
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

      const isAlreadyActive = this.classList.contains('active');
      menuBtns.forEach(b => b.classList.remove('active'));

      document.getElementById('presets-panel').classList.remove('open');
      document.getElementById('characters-panel').classList.remove('open');
      document.getElementById('central-panel').classList.remove('open');

      if (isAlreadyActive) return;

      this.classList.add('active');

      if (menu === 'presets') {
        document.getElementById('presets-panel').classList.add('open');
        if (typeof renderPresetsPanel === 'function') renderPresetsPanel();
      } else if (menu === 'characters') {
        document.getElementById('characters-panel').classList.add('open');
        if (typeof renderCharactersPanel === 'function') renderCharactersPanel();
      } else if (menu === 'background') {
        openCentralPanel('Фоны', renderBackgroundPanel);
      } else if (menu === 'lore') {
        openCentralPanel('Лорбуки', renderLorebooksPanel);
      } else if (menu === 'summary') {
        openCentralPanel('Саммари', renderSummaryPanel);
      } else if (menu === 'personas') {
        openCentralPanel('Управление персоной', renderPersonasPanel);
      }
    });
  });

  // Закрытие панелей при клике вне
  document.addEventListener('click', function(e) {
    const panels = ['presets-panel', 'characters-panel', 'central-panel'];
    const isInside = panels.some(id => {
      const el = document.getElementById(id);
      return el && el.contains(e.target);
    });
    const isBtn = e.target.closest('.menu-btn') || e.target.closest('.close-panel');
    const isOverlay = e.target.closest('.app-modal-overlay')
      || e.target.closest('.cropper-overlay')
      || e.target.closest('.lightbox-overlay')
      || e.target.closest('.toast-container')
      || e.target.closest('.modal-overlay');

    if (isOverlay) return;
    if (!isInside && !isBtn) {
      document.getElementById('presets-panel')?.classList.remove('open');
      document.getElementById('characters-panel')?.classList.remove('open');
      document.getElementById('central-panel')?.classList.remove('open');
      menuBtns.forEach(b => b.classList.remove('active'));
    }
  });

  // Закрытие по клавише Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.getElementById('presets-panel')?.classList.remove('open');
      document.getElementById('characters-panel')?.classList.remove('open');
      document.getElementById('central-panel')?.classList.remove('open');
      menuBtns.forEach(b => b.classList.remove('active'));
    }
  });

  await renderMainPage();
});

// ---------- Главная страница с обновленным масштабом ----------
window.renderMainPage = async function() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.classList.remove('chat-mode');
  main.style.display = '';
  main.style.padding = '';
  main.style.overflow = '';

  main.innerHTML = `
    <div style="display:flex; flex-direction:column; height:100%;">
      <h1 style="margin-bottom:20px; font-size:34px; font-family:var(--font-display); letter-spacing:0.5px;">Недавние чаты</h1>
      <div id="recent-chats-list" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:14px; padding-right:6px;">
        <p style="color:#666;">Загрузка...</p>
      </div>
    </div>
  `;

  try {
    const chats = await getRecentChats();
    const container = document.getElementById('recent-chats-list');
    if (!container) return;

    if (!chats || chats.length === 0) {
      container.innerHTML = `<p style="color:#666; padding:20px; text-align:center;">Нет чатов. Создайте первого персонажа и начните диалог.</p>`;
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
      const lastMsg = c.last_message_preview || 'Нет сообщений';
      const isPinned = c.pinned || false;

      const date = new Date(c.updated).toLocaleString([], {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      const msgCount = c.messages_count || 0;

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
                <div class="chat-preview-meta-top">
                  <span class="chat-preview-date">${date}</span>
                  <div class="chat-preview-actions">
                    <button class="preset-tool-btn chat-pin-btn" data-chat-id="${c.id}" title="${isPinned ? 'Открепить' : 'Закрепить'}">
                      ${window.iconImg('pin', 'Закрепить', 21, 21)}
                    </button>
                    <button class="preset-tool-btn chat-rename-btn" data-chat-id="${c.id}" title="Переименовать">
                      ${window.iconImg('rename', 'Переименовать', 21, 21)}
                    </button>
                    <button class="preset-tool-btn chat-delete-btn" data-chat-id="${c.id}" title="Удалить">
                      ${window.iconImg('delete', 'Удалить', 21, 21)}
                    </button>
                  </div>
                </div>
                <div class="chat-preview-msg-count">
                  ${window.iconImg('message', '', 20, 20)} <span>${msgCount}</span>
                </div>
              </div>
            </div>
            <div class="chat-preview-footer">
              <div class="chat-preview-last-msg">
                ${escHtml(lastMsg)}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Обработчик: Закрепить
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
          showToast('Ошибка закрепления', 'error');
        }
      });
    });

    // Обработчик: Переименовать
    container.querySelectorAll('.chat-rename-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        const chatId = this.dataset.chatId;
        try {
          const chat = await getChat(chatId);
          if (!chat) return;
          const newName = await showPrompt('Новое название чата', chat.name || '', { title: 'Переименовать чат' });
          if (newName && newName.trim() !== '' && newName.trim() !== chat.name) {
            await updateChat(chatId, { name: newName.trim() });
            renderMainPage();
            showToast('Чат переименован', 'success');
          }
        } catch (err) {
          showToast('Ошибка переименования', 'error');
        }
      });
    });

    // Обработчик: Удалить
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
          showToast('Ошибка удаления', 'error');
        }
      });
    });

    // Обработчик: Клик по карточке чата для его открытия
    container.querySelectorAll('.chat-preview-card').forEach(card => {
      card.addEventListener('click', function(e) {
        if (e.target.closest('.chat-preview-actions')) return;
        const chatId = this.dataset.chatId;
        if (typeof openChat === 'function') openChat(chatId);
      });
    });

  } catch (e) {
    const container = document.getElementById('recent-chats-list');
    if (container) {
      container.innerHTML = `<p style="color:#e74c6f;">Ошибка загрузки чатов</p>`;
    }
    console.error(e);
  }
};