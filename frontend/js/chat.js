// ============================================================
// CHAT — работа с чатами (полная версия с фильтрацией удалённых)
// ============================================================

window.currentChatId = null;
let chatMode = 'user';
let chatMessagesPage = 1;
let chatMenuOpen = false;
const MSG_PER_PAGE = 20;

window.openChat = async function(chatId) {
  window.currentChatId = chatId;
  chatMessagesPage = 1;
  await renderChat();
};

window.openChatForCharacter = async function(characterId) {
  const chats = await getChatsByCharacter(characterId);
  if (chats && chats.length > 0) {
    const last = chats.sort((a, b) => new Date(b.updated) - new Date(a.updated))[0];
    await openChat(last.id);
  } else {
    const newChat = await createChat({ character_id: characterId });
    await openChat(newChat.id);
  }
};

async function renderChat() {
  const main = document.getElementById('main-content');
  if (!main) return;

  main.classList.add('chat-mode');

  try {
    const chat = await getChat(window.currentChatId, chatMessagesPage, MSG_PER_PAGE);
    if (!chat) {
      showToast('Чат не найден', 'error');
      renderMainPage();
      return;
    }

    const character = await getCharacter(chat.character_id);
    const persona = chat.persona_id ? await getPersona(chat.persona_id) : null;

    const modeDisplay = chatMode === 'user' ? 'User' : 'Char';
    const activeMessages = chat.messages.filter(m => !m.deleted);

    const formatDate = (iso) => {
      const date = new Date(iso);
      const months = [
        'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
        'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
      ];
      const day = date.getDate();
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      const hours = date.getHours().toString().replace(/^0/, '');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${day} ${month} ${year} г. ${hours}:${minutes}`;
    };

    main.innerHTML = `
      <div class="chat-viewport">
        <div id="chatMessages" class="chat-messages">
          ${activeMessages.length === 0 ? '<p class="empty-message">Нет сообщений. Начните историю первым.</p>' :
            activeMessages.map(m => {
              const isUser = m.role === 'user';
              const avatarSrc = isUser ? (persona?.avatar || '') : (character?.avatar || '');
              const avatarName = isUser ? (persona?.name || 'User') : (character?.name || 'Char');
              const avatarHtml = avatarSrc
                ? `<img src="${avatarSrc}" class="msg-avatar avatar-clickable" data-avatar-src="${avatarSrc}" data-avatar-name="${avatarName}">`
                : `<div class="msg-avatar msg-avatar-fallback avatar-clickable" data-avatar-src="" data-avatar-name="${avatarName}">${isUser ? '👤' : '🤖'}</div>`;
              return `
              <div class="message-row ${isUser ? 'message-row-user' : 'message-row-char'}" data-index="${m.index}">
                ${avatarHtml}
                <div class="message-content-wrapper">
                  <div class="message-header">
                    <span class="message-author">${escHtml(avatarName)}</span>
                    <span class="message-time">${formatDate(m.timestamp)}</span>
                    <button class="edit-msg-btn" data-index="${m.index}" data-role="${m.role}" title="Редактировать">${window.iconImg('rename', 'Редактировать', 14, 14)}</button>
                  </div>
                  <div class="message-text">${escHtml(m.content)}</div>
                  <div class="message-meta" style="display:none;">
                    <span class="msg-index">#${m.index}</span>
                  </div>
                </div>
              </div>
            `; }).join('')}
        </div>

        <footer class="chat-footer" style="position:relative;">
          <div class="mode-indicator">
            <span>Режим: <strong id="modeDisplay">${modeDisplay}</strong></span>
          </div>
          <div class="chat-input-row">
            <button class="btn btn-outline" id="chatMenuBtn">☰</button>
            <textarea id="chatInput" rows="1" placeholder="Напишите сценарий..."></textarea>
            <button class="btn" id="sendChatBtn">${window.iconImg('send', 'Отправить', 20, 20)}</button>
          </div>
          <div id="chatMenuDropdown" class="chat-menu-dropdown" style="display:none;"></div>
        </footer>
      </div>
    `;

    // === Обработчики ===

    // Клик по аватарке
    document.querySelectorAll('.msg-avatar.avatar-clickable').forEach(el => {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        const src = this.dataset.avatarSrc;
        const name = this.dataset.avatarName || 'Аватар';
        showAvatarPreview(src, name);
      });
    });

    // Отправка сообщения
    const sendBtn = document.getElementById('sendChatBtn');
    const input = document.getElementById('chatInput');

    async function sendMessage() {
      const text = input.value.trim();
      if (!text) return;
      const role = chatMode === 'user' ? 'user' : 'assistant';
      try {
        const result = await addMessage(window.currentChatId, role, text);
        if (result.chat_mode) chatMode = result.chat_mode;
        if (result.notify_update_history) {
          showToast('Обновите историю чата (саммари)', 'warning', 5000);
        }
        input.value = '';
        await renderChat();
        if (role === 'user') {
          await generateAndCopyPrompt(text);
        }
      } catch (e) {
        showToast('Ошибка отправки', 'error');
      }
    }

    sendBtn?.addEventListener('click', sendMessage);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    input?.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 150) + 'px';
    });

    // Меню чата
    const menuBtn = document.getElementById('chatMenuBtn');
    const dropdown = document.getElementById('chatMenuDropdown');
    menuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleChatMenu(dropdown);
    });

    // === Редактирование сообщений (делегирование) ===
    document.getElementById('chatMessages').addEventListener('click', async function(e) {
      const btn = e.target.closest('.edit-msg-btn');
      if (!btn) return;
      e.stopPropagation();
      const row = btn.closest('.message-row');
      const index = parseInt(btn.dataset.index);
      const role = btn.dataset.role;
      startEditMessage(row, index, role);
    });

    // Прокрутка вниз
    const msgs = document.getElementById('chatMessages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;

    if (chat.mode) chatMode = chat.mode;
    const modeEl = document.getElementById('modeDisplay');
    if (modeEl) modeEl.textContent = chatMode === 'user' ? 'User' : 'Char';

  } catch (e) {
    main.innerHTML = `<p class="error-message">Ошибка загрузки чата: ${e.message}</p>`;
    console.error(e);
    renderMainPage();
  }
}

// ============================================================
// МЕНЮ ЧАТА
// ============================================================

function toggleChatMenu(dropdown) {
  if (!dropdown) return;
  if (dropdown.style.display === 'none') {
    // Добавляем класс для стилизации, убираем inline-стили позиционирования
    dropdown.className = 'chat-menu-dropdown';
    dropdown.innerHTML = `
      <div class="chat-menu-item" data-action="close" style="padding:8px 16px; color:#e74c6f; cursor:pointer;">✕ Закрыть чат</div>
      <div class="chat-menu-item" data-action="chats" style="padding:8px 16px; cursor:pointer;">📋 Все чаты</div>
      <div class="chat-menu-item" data-action="new" style="padding:8px 16px; cursor:pointer;">➕ Новый чат</div>
      <div class="chat-menu-item" data-action="checkpoint" style="padding:8px 16px; cursor:pointer;">💾 Чекпоинт</div>
      <div class="chat-menu-item" data-action="delete_messages" style="padding:8px 16px; color:#e74c6f; cursor:pointer;">🗑️ Удалить сообщения</div>
      <div class="chat-menu-item" data-action="generate" style="padding:8px 16px; color:#4a6cf7; cursor:pointer;">⚡ Генерация промпта</div>
      <div style="border-top:1px solid #333; margin:4px 12px;"></div>
      <div class="chat-menu-item" data-action="mode_user" style="padding:8px 16px; cursor:pointer;">👤 Режим User</div>
      <div class="chat-menu-item" data-action="mode_char" style="padding:8px 16px; cursor:pointer;">🤖 Режим Char</div>
    `;
    dropdown.style.display = 'block';
    chatMenuOpen = true;

    dropdown.querySelectorAll('.chat-menu-item').forEach(item => {
      item.addEventListener('mouseenter', function() { this.style.background = '#2a2a34'; });
      item.addEventListener('mouseleave', function() { this.style.background = 'transparent'; });
      item.addEventListener('click', function(e) {
        e.stopPropagation();
        const action = this.dataset.action;
        handleChatMenuAction(action);
        dropdown.style.display = 'none';
        chatMenuOpen = false;
      });
    });
  } else {
    dropdown.style.display = 'none';
    chatMenuOpen = false;
  }
}

// ============================================================
// ОБРАБОТЧИКИ ДЕЙСТВИЙ МЕНЮ
// ============================================================

async function handleChatMenuAction(action) {
  switch (action) {
    case 'close':
      renderMainPage();
      break;

    case 'chats':
      showAllChatsModal();
      break;

    case 'new':
      if (window.currentChatId) {
        const chat = await getChat(window.currentChatId);
        if (chat) {
          const newChat = await createChat({
            character_id: chat.character_id,
            persona_id: chat.persona_id
          });
          await openChat(newChat.id);
          showToast('Новый чат создан', 'success');
        }
      }
      break;

    case 'checkpoint':
      if (window.currentChatId) {
        const cp = await createCheckpoint(window.currentChatId);
        await openChat(cp.id);
        showToast('Чекпоинт создан', 'success');
      }
      break;

    case 'delete_messages': {
      const indicesStr = await showPrompt(
        'Индексы видны как #0, #1 рядом с каждым сообщением.',
        '',
        { title: 'Удалить сообщения (через запятую, напр. 1,2,5)' }
      );
      if (indicesStr) {
        const indices = indicesStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        if (indices.length) {
          await deleteMessages(window.currentChatId, indices);
          await renderChat();
          showToast('Сообщения удалены', 'success');
        }
      }
      break;
    }

    case 'generate':
      if (window.currentChatId) {
        const lastMsg = document.querySelector('#chatMessages .message:last-child');
        const text = lastMsg ? lastMsg.textContent : '';
        await generateAndCopyPrompt(text);
      }
      break;

    case 'mode_user': {
      const result = await setChatMode(window.currentChatId, 'user');
      chatMode = result.mode;
      updateModeDisplay();
      showToast('Режим: User', 'info');
      break;
    }

    case 'mode_char': {
      const result = await setChatMode(window.currentChatId, 'char');
      chatMode = result.mode;
      updateModeDisplay();
      showToast('Режим: Char', 'info');
      break;
    }

    default:
      break;
  }
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function updateModeDisplay() {
  const el = document.getElementById('modeDisplay');
  if (el) {
    el.textContent = chatMode === 'user' ? 'User' : 'Char';
  }
}

async function generateAndCopyPrompt(userMessage) {
  try {
    const result = await generateMainPrompt(window.currentChatId, userMessage);
    if (result.ok === false) {
      showToast(result.message || 'Нельзя сгенерировать промпт', 'warning');
      return;
    }
    await navigator.clipboard.writeText(result.prompt);
    showToast(
      `Промпт скопирован (${result.tokens_after} токенов, отброшено ${result.discarded_tokens})`,
      'success'
    );
    console.log('Промпт:', result.prompt);
  } catch (e) {
    showToast('Ошибка генерации промпта', 'error');
  }
}

// ============================================================
// МОДАЛЬНОЕ ОКНО "ВСЕ ЧАТЫ"
// ============================================================

async function showAllChatsModal() {
  const modal = document.getElementById('chats-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  const body = document.getElementById('chats-modal-body');

  try {
    const chatData = await getChat(window.currentChatId);
    const chats = await getChatsByCharacter(chatData.character_id);

    body.innerHTML = chats.map(c => `
      <div class="card-item" data-id="${c.id}" style="cursor:pointer;">
        <div class="card-info">
          <div class="name">${escHtml(c.name)}</div>
          <div class="sub">${new Date(c.updated).toLocaleString()}</div>
        </div>
        <button class="btn btn-sm btn-outline" data-action="export_json">⬇️ JSON</button>
        <button class="btn btn-sm btn-outline" data-action="export_txt">⬇️ TXT</button>
        <button class="btn btn-sm btn-danger" data-action="delete">🗑️</button>
      </div>
    `).join('');

    // Обработчики внутри модалки
    body.querySelectorAll('.card-item').forEach(el => {
      el.addEventListener('click', function(e) {
        if (e.target.closest('button')) return;
        const id = this.dataset.id;
        modal.style.display = 'none';
        openChat(id);
      });

      el.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', async function(e) {
          e.stopPropagation();
          const action = this.dataset.action;
          const id = el.dataset.id;

          if (action === 'export_json') {
            const data = await exportChatJSON(id);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `chat_${id}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Экспортировано JSON', 'success');
          } else if (action === 'export_txt') {
            const text = await exportChatTXT(id);
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `chat_${id}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Экспортировано TXT', 'success');
          } else if (action === 'delete') {
            if (await showConfirm('Удалить чат? Это действие необратимо.', { title: 'Удаление чата', okText: 'Удалить' })) {
              await deleteChat(id);
              showAllChatsModal(); // обновить список
              showToast('Чат удалён', 'success');
            }
          }
        });
      });
    });
  } catch (e) {
    body.innerHTML = '<p style="color:#e74c6f;">Ошибка загрузки чатов</p>';
  }

  document.getElementById('closeChatsModal')?.addEventListener('click', function() {
    modal.style.display = 'none';
  });
  modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.style.display = 'none';
  });
}

// ============================================================
// ПОЛНОЭКРАННЫЙ ПРОСМОТР АВАТАРКИ СЛЕВА (без затемнения)
// ============================================================

function showAvatarPreview(src, name) {
  // Удаляем старый предпросмотр, если есть
  const old = document.getElementById('avatar-preview-container');
  if (old) old.remove();

  const container = document.createElement('div');
  container.id = 'avatar-preview-container';
  container.className = 'avatar-preview-container';

  let content = '';
  if (src) {
    content = `<img src="${src}" class="avatar-preview-image" alt="${escHtml(name)}">`;
  } else {
    content = `<div class="avatar-preview-placeholder">${escHtml(name)}<br><span style="font-size:14px;">нет аватарки</span></div>`;
  }

  container.innerHTML = `
    <div class="avatar-preview-box">
      <button class="avatar-preview-close" id="avatarPreviewClose">✕</button>
      ${content}
      <div class="avatar-preview-name">${escHtml(name)}</div>
    </div>
  `;

  document.body.appendChild(container);

  // Закрытие по крестику
  document.getElementById('avatarPreviewClose').addEventListener('click', () => {
    container.remove();
  });

  // Закрытие по клику вне изображения (по фону)
  container.addEventListener('click', (e) => {
    if (e.target === container) container.remove();
  });
}

// ============================================================
// РЕДАКТИРОВАНИЕ СООБЩЕНИЙ
// ============================================================

let activeEditRow = null;       // ссылка на редактируемый .message-row
let originalText = '';          // исходный текст сообщения
let editIndex = null;           // индекс редактируемого сообщения

function startEditMessage(row, index, role) {
  // Закрываем предыдущее редактирование
  cancelEdit();

  const textDiv = row.querySelector('.message-text');
  if (!textDiv) return;
  const editBtn = row.querySelector('.edit-msg-btn');
  if (!editBtn) return;

  originalText = textDiv.textContent;
  editIndex = index;
  activeEditRow = row;

  // Создаём textarea
  const textarea = document.createElement('textarea');
  textarea.className = 'edit-textarea';
  textarea.value = originalText;
  textDiv.replaceWith(textarea);

  // Скрываем кнопку редактирования
  editBtn.style.display = 'none';

  // Создаём панель действий (галочка и крестик)
  const header = row.querySelector('.message-header');
  const actions = document.createElement('div');
  actions.className = 'edit-actions';
  actions.innerHTML = `
    <button class="edit-confirm-btn" title="Сохранить">${window.iconImg('ok', 'Сохранить', 18, 18)}</button>
    <button class="edit-cancel-btn" title="Отменить">${window.iconImg('close', 'Отменить', 18, 18)}</button>
  `;

  // Вставляем actions ПОСЛЕ header (перед textarea)
  header.parentNode.insertBefore(actions, textarea);

  // Обработчики
  actions.querySelector('.edit-confirm-btn').addEventListener('click', async function() {
    const newText = textarea.value.trim();
    if (!newText) {
      showToast('Сообщение не может быть пустым', 'warning');
      return;
    }
    try {
      await editMessage(window.currentChatId, index, newText);
      await renderChat();
      showToast('Сообщение обновлено', 'success');
    } catch (e) {
      showToast('Ошибка сохранения', 'error');
    }
  });

  actions.querySelector('.edit-cancel-btn').addEventListener('click', function() {
    cancelEdit();
  });

  // Автофокус
  textarea.focus();
  textarea.select();
}

function cancelEdit() {
  if (!activeEditRow) return;

  // Восстанавливаем исходный текст
  const textarea = activeEditRow.querySelector('.edit-textarea');
  if (textarea) {
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = originalText;
    textarea.replaceWith(textDiv);
  }

  // Показываем кнопку редактирования
  const editBtn = activeEditRow.querySelector('.edit-msg-btn');
  if (editBtn) editBtn.style.display = 'inline-flex';

  // Удаляем панель действий
  const actions = activeEditRow.querySelector('.edit-actions');
  if (actions) actions.remove();

  // Сбрасываем состояние
  activeEditRow = null;
  originalText = '';
  editIndex = null;
}