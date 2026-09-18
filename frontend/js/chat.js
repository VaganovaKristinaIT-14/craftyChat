// ============================================================
// CHAT — работа с чатами (полная версия с фильтрацией удалённых)
// ============================================================

// Состояние пагинации чата
let chatPagination = {
  chatId: null,
  messages: [],          // все загруженные сообщения в порядке возрастания индекса
  loadedPages: [],       // номера загруженных страниц
  totalPages: 0,
  isLoading: false,
  scrollPos: 0           // для сохранения позиции прокрутки
};

window.currentChatId = null;
let chatMode = 'user';
let chatMessagesPage = 1; // пока не используется, оставлено для совместимости
let chatMenuOpen = false;
const MSG_PER_PAGE = 20;

// Состояние для режима удаления сообщений
let deleteModeActive = false;
let selectedMessageIndices = new Set();

// === ПАГИНАЦИЯ: вспомогательная функция для сброса состояния ===
function resetPagination(chatId) {
  chatPagination.chatId = chatId;
  chatPagination.messages = [];
  chatPagination.loadedPages = [];
  chatPagination.totalPages = 0;
  chatPagination.isLoading = false;
  chatPagination.scrollPos = 0;
}

// В файле chat.js найти функцию window.openChat и заменить её:

window.openChat = async function(chatId) {
  const chat = await getChat(chatId);
  if (!chat) {
    showToast('Чат не найден', 'error');
    return;
  }

  // Получаем персону, которая СЕЙЧАС привязана к этому боту на бэкенде
  const linkedPersona = await getPersonaForCharacter(chat.character_id);

  let targetPersonaId = null;

  if (linkedPersona) {
    // Если привязка есть, используем её
    targetPersonaId = linkedPersona.id;
    await activatePersona(linkedPersona.id);
  } else {
    // Если привязки нет, пробуем использовать глобально активную персону
    const personasData = await getPersonas(1, 1);
    targetPersonaId = personasData.active_persona_id;
  }

  // Если persona_id в чате устарел или отсутствует, обновляем чат на бэкенде
  if (chat.persona_id !== targetPersonaId) {
    await updateChat(chatId, { persona_id: targetPersonaId });
    chat.persona_id = targetPersonaId;
  }

  window.currentChatId = chatId;
  chatMessagesPage = 1;
  resetPagination(chatId);
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
    const chatId = window.currentChatId;
    if (!chatId) {
      renderMainPage();
      return;
    }

    // Если чат сменился – сбрасываем состояние (но это уже сделано в openChat)
    if (chatPagination.chatId !== chatId) {
      resetPagination(chatId);
    }

    // === ПАГИНАЦИЯ: определяем, какую страницу загружать ===
    let pageToLoad = 1;
    if (chatPagination.loadedPages.length === 0) {
      // Первая загрузка – берём самую новую страницу (page = 1)
      pageToLoad = 1;
    } else {
      // Уже есть загруженные – загружаем следующую (старее)
      const lastLoaded = Math.max(...chatPagination.loadedPages);
      pageToLoad = lastLoaded + 1;
    }

    // Загружаем данные чата (получаем страницу)
    const chat = await getChat(chatId, pageToLoad, MSG_PER_PAGE);
    if (!chat) {
      showToast('Чат не найден', 'error');
      renderMainPage();
      return;
    }

    // Если это первая страница, сохраняем общее количество страниц
    if (pageToLoad === 1) {
      // Предполагаем, что getChat возвращает { messages, total }
      chatPagination.totalPages = Math.ceil((chat.messages_total || 0) / MSG_PER_PAGE);
if (chatPagination.totalPages === 0) chatPagination.totalPages = 1;
    }

    // Фильтруем удалённые сообщения
    const newMessages = chat.messages.filter(m => !m.deleted);

    // Добавляем загруженные сообщения в общий массив
    if (pageToLoad === 1) {
      // Первая страница – самые новые сообщения, они должны быть в конце
      chatPagination.messages = newMessages;
    } else {
      // Более старые сообщения добавляем в начало
      chatPagination.messages = newMessages.concat(chatPagination.messages);
    }

    // Сохраняем загруженную страницу
    if (!chatPagination.loadedPages.includes(pageToLoad)) {
      chatPagination.loadedPages.push(pageToLoad);
    }

    // Теперь у нас есть все загруженные сообщения в chatPagination.messages
    const activeMessages = chatPagination.messages;

    // Получаем персонажа и персону (как и раньше)
    const character = await getCharacter(chat.character_id);
    const persona = chat.persona_id ? await getPersona(chat.persona_id) : null;

    const modeDisplay = chatMode === 'user' ? 'User' : 'Char';

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

    // === ПАГИНАЦИЯ: формируем кнопку "Показать ранние" ===
    let loadMoreHtml = '';
    if (chatPagination.loadedPages.length < chatPagination.totalPages && !chatPagination.isLoading) {
      loadMoreHtml = `
        <div style="text-align:center; padding: 8px 0;">
          <button id="loadMoreBtn" class="btn btn-outline btn-sm">
            Показать ранние сообщения
          </button>
        </div>
      `;
    } else if (chatPagination.isLoading) {
      loadMoreHtml = `
        <div style="text-align:center; padding: 8px 0; color: var(--paper-faint);">
          Загрузка...
        </div>
      `;
    }

    // Формируем HTML сообщений
    const messagesHtml = activeMessages.length === 0
      ? '<p class="empty-message">Нет сообщений. Начните историю первым.</p>'
      : activeMessages.map(m => {
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
                  <div class="message-info-left">
                    <span class="message-author">${escHtml(avatarName)}</span>
                    <span class="message-time">${formatDate(m.timestamp)}</span>
                  </div>
                  <div class="message-actions-right">
  <button class="edit-msg-btn" data-index="${m.index}" data-role="${m.role}" title="Редактировать">
    ${window.iconImg('rename', 'Редактировать', 18, 18)}
  </button>
</div>
                </div>
                <div class="message-text">${escHtml(m.content)}</div>
                <div class="message-meta" style="display:none;">
                  <span class="msg-index">#${m.index}</span>
                </div>
              </div>
            </div>
          `;
        }).join('');

    // Основной HTML чата
    main.innerHTML = `
      <div class="chat-viewport">
        <div id="chatMessages" class="chat-messages">
          ${loadMoreHtml}
          ${messagesHtml}
        </div>

        <footer class="chat-footer" style="position:relative;">
          <div class="mode-indicator">
            <span>Режим: <strong id="modeDisplay">${modeDisplay}</strong></span>
            <span id="deleteModeActions" style="display:none; margin-left:16px;">
              <button class="preset-tool-btn" id="confirmDeleteBtn" title="Подтвердить удаление">${window.iconImg('ok', 'Подтвердить', 16, 16)}</button>
              <button class="preset-tool-btn" id="cancelDeleteBtn" title="Отменить">${window.iconImg('close', 'Отменить', 16, 16)}</button>
            </span>
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

    // === ПАГИНАЦИЯ: обработчик кнопки "Показать ранние" ===
    const loadBtn = document.getElementById('loadMoreBtn');
    if (loadBtn) {
      loadBtn.addEventListener('click', async function() {
        if (chatPagination.isLoading) return;
        chatPagination.isLoading = true;
        // Сохраняем текущую позицию прокрутки (относительно верхней части)
        const msgContainer = document.getElementById('chatMessages');
        if (msgContainer) {
          chatPagination.scrollPos = msgContainer.scrollTop;
        }
        await renderChat(); // рекурсивно загрузит следующую страницу
        chatPagination.isLoading = false;
        // Восстанавливаем позицию прокрутки (прокручиваем к тому же месту)
        const newMsgContainer = document.getElementById('chatMessages');
        if (newMsgContainer) {
          // После добавления старых сообщений scrollTop должен увеличиться на высоту добавленных
          // Мы просто устанавливаем сохранённое значение, но оно уже сместится автоматически,
          // так как содержимое увеличилось. Можно установить точное значение:
          // Для простоты оставляем как есть – пользователь сам прокрутит.
          // Но можно прокрутить к первому сообщению из старых, чтобы не потерять место.
          // Попробуем найти первое сообщение из только что добавленных (новых в начале)
          // и прокрутить к нему.
          const firstOldMsg = newMsgContainer.querySelector('.message-row');
          if (firstOldMsg) {
            firstOldMsg.scrollIntoView({ block: 'start' });
          } else {
            newMsgContainer.scrollTop = chatPagination.scrollPos;
          }
        }
      });
    }

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
        // После отправки сбрасываем пагинацию, чтобы загрузить свежие сообщения
        resetPagination(window.currentChatId);
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
      const maxHeight = 288; // 12 строк
      if (this.scrollHeight > maxHeight) {
        this.style.height = maxHeight + 'px';
      } else {
        this.style.height = this.scrollHeight + 'px';
      }
    });

    // Меню чата
    const menuBtn = document.getElementById('chatMenuBtn');
    const dropdown = document.getElementById('chatMenuDropdown');
    menuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleChatMenu(dropdown);
    });

    // Редактирование сообщений (делегирование)
    document.getElementById('chatMessages').addEventListener('click', async function(e) {
      const btn = e.target.closest('.edit-msg-btn');
      if (!btn) return;
      e.stopPropagation();
      const row = btn.closest('.message-row');
      const index = parseInt(btn.dataset.index);
      const role = btn.dataset.role;
      startEditMessage(row, index, role);
    });

    // Режим удаления сообщений: клик по сообщению (если активен)
    document.getElementById('chatMessages').addEventListener('click', function(e) {
      if (!deleteModeActive) return;
      const row = e.target.closest('.message-row');
      if (!row) return;
      const index = parseInt(row.dataset.index);
      if (isNaN(index)) return;
      toggleMessageSelection(row, index);
    });

    // Кнопки подтверждения/отмены удаления
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', async function() {
      if (selectedMessageIndices.size === 0) {
        showToast('Выберите хотя бы одно сообщение', 'warning');
        return;
      }
      const ok = await showConfirm('Удалить выбранные сообщения? Это действие необратимо.', { title: 'Удаление сообщений', okText: 'Удалить' });
      if (!ok) return;
      try {
        await deleteMessages(window.currentChatId, Array.from(selectedMessageIndices));
        exitDeleteMode();
        // После удаления сбрасываем пагинацию и перерисовываем
        resetPagination(window.currentChatId);
        await renderChat();
        showToast('Сообщения удалены', 'success');
      } catch (e) {
        showToast('Ошибка удаления', 'error');
      }
    });

    document.getElementById('cancelDeleteBtn')?.addEventListener('click', function() {
      exitDeleteMode();
      renderChat();
    });

    // Прокрутка вниз (только если мы на первой странице и не грузили старые)
    const msgs = document.getElementById('chatMessages');
    if (msgs) {
      if (pageToLoad === 1) {
        msgs.scrollTop = msgs.scrollHeight;
      } else {
        // При подгрузке старых восстанавливаем позицию
        if (chatPagination.scrollPos > 0) {
          msgs.scrollTop = chatPagination.scrollPos;
        }
      }
    }

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
// МЕНЮ ЧАТА (без эмодзи)
// ============================================================

function toggleChatMenu(dropdown) {
  if (!dropdown) return;
  if (dropdown.style.display === 'none') {
    dropdown.className = 'chat-menu-dropdown';
    dropdown.innerHTML = `
      <div class="chat-menu-item" data-action="close">Закрыть чат</div>
      <div class="chat-menu-item" data-action="chats">Все чаты</div>
      <div class="chat-menu-item" data-action="new">Новый чат</div>
      <div class="chat-menu-item" data-action="checkpoint">Чекпоинт</div>
      <div class="chat-menu-item" data-action="delete_messages">Удалить сообщения</div>
      <div class="chat-menu-item" data-action="generate">Генерация промпта</div>
      <div style="border-top:1px solid #333; margin:4px 12px;"></div>
      <div class="chat-menu-item" data-action="mode_user">Режим User</div>
      <div class="chat-menu-item" data-action="mode_char">Режим Char</div>
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

    case 'delete_messages':
      enterDeleteMode();
      break;

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
// РЕЖИМ УДАЛЕНИЯ СООБЩЕНИЙ
// ============================================================

function enterDeleteMode() {
  deleteModeActive = true;
  selectedMessageIndices.clear();

  const actions = document.getElementById('deleteModeActions');
  if (actions) actions.style.display = 'inline';

  document.querySelectorAll('.message-row').forEach(row => {
    row.classList.add('selectable');
    row.style.cursor = 'pointer';
  });

  const dropdown = document.getElementById('chatMenuDropdown');
  if (dropdown) dropdown.style.display = 'none';
  chatMenuOpen = false;
}

function exitDeleteMode() {
  deleteModeActive = false;
  selectedMessageIndices.clear();

  const actions = document.getElementById('deleteModeActions');
  if (actions) actions.style.display = 'none';

  document.querySelectorAll('.message-row').forEach(row => {
    row.classList.remove('selectable', 'selected-for-delete');
    row.style.cursor = '';
  });
}

function toggleMessageSelection(row, index) {
  if (!deleteModeActive) return;
  if (row.classList.contains('selected-for-delete')) {
    row.classList.remove('selected-for-delete');
    selectedMessageIndices.delete(index);
  } else {
    row.classList.add('selected-for-delete');
    selectedMessageIndices.add(index);
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
// МОДАЛЬНОЕ ОКНО "ВСЕ ЧАТЫ" (с иконками)
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
        <button class="preset-tool-btn" data-action="export_json" title="Экспорт JSON">${window.iconImg('export', 'JSON', 16, 16)}</button>
        <button class="preset-tool-btn" data-action="export_txt" title="Экспорт TXT">${window.iconImg('export', 'TXT', 16, 16)}</button>
        <button class="preset-tool-btn" data-action="delete" title="Удалить">${window.iconImg('delete', 'Удалить', 16, 16)}</button>
      </div>
    `).join('');

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

  document.getElementById('avatarPreviewClose').addEventListener('click', () => {
    container.remove();
  });

  container.addEventListener('click', (e) => {
    if (e.target === container) container.remove();
  });
}

// ============================================================
// РЕДАКТИРОВАНИЕ СООБЩЕНИЙ
// ============================================================

let activeEditRow = null;
let originalText = '';
let editIndex = null;

function startEditMessage(row, index, role) {
  cancelEdit();

  const textDiv = row.querySelector('.message-text');
  if (!textDiv) return;
  const editBtn = row.querySelector('.edit-msg-btn');
  if (!editBtn) return;

  originalText = textDiv.textContent;
  editIndex = index;
  activeEditRow = row;

  const textarea = document.createElement('textarea');
  textarea.className = 'edit-textarea';
  textarea.value = originalText;
  textDiv.replaceWith(textarea);

  // --- АВТОРАСШИРЕНИЕ ПОД ВЕСЬ ТЕКСТ СООБЩЕНИЯ ---
  // Сразу задаем высоту по содержимому сообщения
  setTimeout(() => {
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight + 15) + 'px';
  }, 0);

  // И динамически меняем при ручном вводе/удалении текста
  textarea.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight + 15) + 'px';
  });
  // ----------------------------------------------

  editBtn.style.display = 'none';

  const header = row.querySelector('.message-header');
  const actions = document.createElement('div');
  actions.className = 'edit-actions';
  actions.innerHTML = `
    <button class="edit-confirm-btn" title="Сохранить">${window.iconImg('ok', 'Сохранить', 18, 18)}</button>
    <button class="edit-cancel-btn" title="Отменить">${window.iconImg('close', 'Отменить', 18, 18)}</button>
  `;

  header.parentNode.insertBefore(actions, textarea);

  actions.querySelector('.edit-confirm-btn').addEventListener('click', async function() {
    const newText = textarea.value.trim();
    if (!newText) {
      showToast('Сообщение не может быть пустым', 'warning');
      return;
    }
    try {
      await editMessage(window.currentChatId, index, newText);
      resetPagination(window.currentChatId);
      await renderChat();
    } catch (e) {
      showToast('Ошибка сохранения', 'error');
    }
  });

  actions.querySelector('.edit-cancel-btn').addEventListener('click', function() {
    cancelEdit();
  });

  textarea.focus();
}


function cancelEdit() {
  if (!activeEditRow) return;

  const textarea = activeEditRow.querySelector('.edit-textarea');
  if (textarea) {
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = originalText;
    textarea.replaceWith(textDiv);
  }

  const editBtn = activeEditRow.querySelector('.edit-msg-btn');
  if (editBtn) editBtn.style.display = 'inline-flex';

  const actions = activeEditRow.querySelector('.edit-actions');
  if (actions) actions.remove();

  activeEditRow = null;
  originalText = '';
  editIndex = null;
}