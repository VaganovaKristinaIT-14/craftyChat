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

  try {
    const chat = await getChat(window.currentChatId, chatMessagesPage, MSG_PER_PAGE);
    if (!chat) {
      showToast('Чат не найден', 'error');
      return;
    }

    const character = await getCharacter(chat.character_id);
    const persona = chat.persona_id ? await getPersona(chat.persona_id) : null;

    const modeLabel = chatMode === 'user' ? (persona?.name || 'User') : (character?.name || 'Char');

    // 🔥 ФИЛЬТРУЕМ УДАЛЁННЫЕ СООБЩЕНИЯ
    const activeMessages = chat.messages.filter(m => !m.deleted);

    main.innerHTML = `
      <div style="display:flex; flex-direction:column; height:100%;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 16px; border-bottom:1px solid #333; background:#14141a;">
          <div style="display:flex; align-items:center; gap:10px;">
            ${character?.avatar ? `<img src="${character.avatar}" style="width:32px;height:32px;border-radius:50%;">` : ''}
            <span style="font-weight:600;">${escHtml(character?.name || 'Персонаж')}</span>
            <span style="color:#666; font-size:13px;">${escHtml(chat.name)}</span>
          </div>
          <button class="btn btn-sm btn-outline" id="closeChatBtn">✕ Закрыть</button>
        </div>

        <div id="chatMessages" style="flex:1; overflow-y:auto; padding:12px 16px; display:flex; flex-direction:column; gap:6px;">
          ${activeMessages.length === 0 ? '<p style="color:#666; text-align:center; margin-top:40px;">Нет сообщений</p>' :
            activeMessages.map(m => `
              <div style="display:flex; ${m.role === 'user' ? 'justify-content:flex-end;' : 'justify-content:flex-start;'}">
                <div class="message ${m.role === 'user' ? 'message-user' : 'message-char'}">
                  <div>${escHtml(m.content)}</div>
                  <div class="message-meta">
                    <span class="msg-index">#${m.index}</span>
                    <span class="msg-time">${new Date(m.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            `).join('')}
        </div>

        <div style="display:flex; align-items:center; padding:4px 16px; background:#14141a; border-top:1px solid #333;">
          <span style="color:#888; font-size:13px;">Режим: <span id="modeDisplay" style="color:#4a6cf7; font-weight:600;">${modeLabel}</span></span>
        </div>

        <div class="chat-input-row">
          <button class="btn btn-outline" id="chatMenuBtn" style="padding:0 10px;">☰</button>
          <textarea id="chatInput" rows="1" placeholder="Введите сообщение..."></textarea>
          <button class="btn" id="sendChatBtn">✈</button>
        </div>

        <div id="chatMenuDropdown" style="display:none; position:absolute; bottom:70px; left:20px; background:#1e1e26; border:1px solid #333; border-radius:10px; padding:6px 0; min-width:200px; box-shadow:0 8px 24px rgba(0,0,0,0.5); z-index:200;"></div>
      </div>
    `;

    // === Обработчики ===

    // Закрыть чат
    document.getElementById('closeChatBtn')?.addEventListener('click', function() {
      renderMainPage();
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
    input?.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    input?.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    // Меню чата
    const menuBtn = document.getElementById('chatMenuBtn');
    const dropdown = document.getElementById('chatMenuDropdown');
    menuBtn?.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleChatMenu(dropdown);
    });

    // Закрытие меню при клике вне
    document.addEventListener('click', function onOutside(e) {
      if (dropdown && dropdown.style.display !== 'none' && !dropdown.contains(e.target) && !menuBtn.contains(e.target)) {
        dropdown.style.display = 'none';
        chatMenuOpen = false;
      }
    });

    // Прокрутка вниз
    const msgs = document.getElementById('chatMessages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;

    // Восстанавливаем режим из сохранённого на сервере
    if (chat.mode) chatMode = chat.mode;

  } catch (e) {
    main.innerHTML = `<p style="color:#e74c6f;">Ошибка загрузки чата</p>`;
    console.error(e);
  }
}

// ============================================================
// МЕНЮ ЧАТА
// ============================================================

function toggleChatMenu(dropdown) {
  if (!dropdown) return;
  if (dropdown.style.display === 'none') {
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
      const indicesStr = prompt(
        'Введите индексы сообщений для удаления (через запятую, например: 1,2,5)\n' +
        'Индексы видны как #0, #1 рядом с каждым сообщением.'
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
            if (confirm('Удалить чат?')) {
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