// ============================================
// CHAT — логика отображения чата
// ============================================

let chatMode = 'user';
let currentChatId = null;
let chatMenuOpen = false;

function renderChat(chatId) {
    currentChatId = chatId;
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    mainContent.style.display = 'flex';
    mainContent.style.flexDirection = 'column';
    mainContent.style.height = '100%';
    mainContent.style.padding = '0';
    mainContent.style.borderRadius = '0';
    mainContent.style.minHeight = '100%';
    mainContent.style.background = '#2e2e2e';

    const chats = getChatsData();
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
        showToast('Чат не найден');
        return;
    }

    const character = getCharacter(chat.character_id);
    const persona = getPersona(chat.persona_id);
    const modeLabel = chatMode === 'user'
        ? (persona?.name || 'User')
        : (character?.name || 'Char');

    mainContent.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%;width:100%;flex:1;">
            <!-- Заголовок -->
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 16px;border-bottom:1px solid #444;flex-shrink:0;background:#2e2e2e;">
                <div style="display:flex;align-items:center;gap:10px;">
                    ${character?.avatar ? `<img src="${character.avatar}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">` : ''}
                    <span style="color:#fff;font-weight:600;">${character?.name || 'Персонаж'}</span>
                    <span style="color:#888;font-size:12px;">${chat.name}</span>
                </div>
                <button id="closeChatBtn" style="background:transparent;color:#aaa;border:none;cursor:pointer;font-size:18px;padding:4px 8px;">✕</button>
            </div>

            <!-- Сообщения -->
            <div id="chatMessages" style="flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:8px;">
                ${chat.messages.length === 0 ? `
                    <p style="color:#888;text-align:center;margin-top:40px;">Нет сообщений. Начните диалог.</p>
                ` : chat.messages.map(msg => `
                    <div style="display:flex;gap:8px;${msg.role === 'user' ? 'justify-content:flex-end;' : 'justify-content:flex-start;'}">
                        ${msg.role === 'assistant' ? (character?.avatar ? `<img src="${character.avatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;">` : '') : ''}
                        <div style="background:${msg.role === 'user' ? '#4a6cf7' : '#2e2e2e'};padding:8px 12px;border-radius:12px;max-width:70%;word-wrap:break-word;">
                            <div style="color:#fff;font-size:14px;">${escHtml(msg.content)}</div>
                            <div style="color:#888;font-size:10px;margin-top:2px;text-align:right;">${new Date(msg.timestamp).toLocaleTimeString()}</div>
                        </div>
                        ${msg.role === 'user' ? (persona?.avatar ? `<img src="${persona.avatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;">` : '') : ''}
                    </div>
                `).join('')}
            </div>

            <!-- Режим над полем ввода -->
            <div style="display:flex;align-items:center;gap:8px;padding:4px 16px 2px 16px;flex-shrink:0;background:#2e2e2e;">
                <span style="color:#888;font-size:12px;">Режим: <span id="modeDisplay" style="color:#4a6cf7;font-weight:600;">${modeLabel}</span></span>
            </div>

            <!-- Поле ввода с иконкой меню -->
            <div id="inputRow" style="border-top:1px solid #444;padding:6px 16px 10px 16px;display:flex;gap:8px;align-items:center;flex-shrink:0;background:#2e2e2e;position:relative;">
                <button id="chatMenuBtn" style="background:transparent;color:#aaa;border:none;cursor:pointer;font-size:20px;padding:4px;display:flex;align-items:center;justify-content:center;height:36px;width:36px;flex-shrink:0;">☰</button>
                <textarea id="chatInput" rows="1" style="flex:1;background:#111212;color:#fff;border:1px solid #555;border-radius:8px;padding:8px;resize:none;font-family:inherit;font-size:14px;min-height:36px;max-height:120px;" placeholder="Введите сообщение..."></textarea>
                <button id="sendChatBtn" style="background:#4a6cf7;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center;height:40px;width:40px;flex-shrink:0;">✈</button>
                <!-- Контейнер для меню (позиционируется относительно inputRow) -->
                <div id="chatMenuDropdown" style="display:none;position:absolute;bottom:calc(100% + 6px);left:0;background:#2e2e2e;border:1px solid #555;border-radius:8px;padding:6px 0;min-width:200px;z-index:100;box-shadow:0 8px 24px rgba(0,0,0,0.5);animation:slideUp 0.15s ease;"></div>
            </div>
        </div>
    `;

    // ============================================
    // Обработчики
    // ============================================

    document.getElementById('closeChatBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        renderMainPage();
        closeChatMenu();
    });

    // Кнопка меню
    document.getElementById('chatMenuBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        toggleChatMenu();
    });

    // Отправка
    function sendMessage() {
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        if (!text) return;
        const role = chatMode === 'user' ? 'user' : 'assistant';
        addMessageToChat(chatId, role, text);
        input.value = '';
        input.style.height = 'auto';
        if (role === 'user') {
            chatMode = 'char';
            updateModeDisplay();
        }
    }

    document.getElementById('sendChatBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        sendMessage();
    });

    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        chatInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
    }

    // Прокрутка вниз
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Закрытие меню при клике вне его
    document.addEventListener('click', function onOutsideClick(e) {
        const dropdown = document.getElementById('chatMenuDropdown');
        const btn = document.getElementById('chatMenuBtn');
        if (dropdown && btn && dropdown.style.display !== 'none') {
            if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
                closeChatMenu();
            }
        }
    });

    // Закрытие по Escape
    document.addEventListener('keydown', function onEscape(e) {
        if (e.key === 'Escape') {
            closeChatMenu();
        }
    });
}

// ============================================
// УПРАВЛЕНИЕ МЕНЮ ЧАТА
// ============================================
function toggleChatMenu() {
    const dropdown = document.getElementById('chatMenuDropdown');
    if (!dropdown) return;
    if (dropdown.style.display === 'none' || dropdown.style.display === '') {
        openChatMenu();
    } else {
        closeChatMenu();
    }
}

function openChatMenu() {
    const dropdown = document.getElementById('chatMenuDropdown');
    if (!dropdown) return;
    if (chatMenuOpen) return;
    chatMenuOpen = true;

    const currentMode = chatMode;

    dropdown.innerHTML = `
        <div style="display:flex;flex-direction:column;">
            <div class="chat-menu-item" data-action="close" style="padding:8px 16px;color:#ff6b6b;cursor:pointer;border-radius:0;transition:background 0.15s;white-space:nowrap;">✕ Закрыть чат</div>
            <div class="chat-menu-item" data-action="chats" style="padding:8px 16px;color:#fff;cursor:pointer;border-radius:0;transition:background 0.15s;white-space:nowrap;">📋 Все чаты</div>
            <div class="chat-menu-item" data-action="new" style="padding:8px 16px;color:#fff;cursor:pointer;border-radius:0;transition:background 0.15s;white-space:nowrap;">➕ Начать новый чат</div>
            <div class="chat-menu-item" data-action="checkpoint" style="padding:8px 16px;color:#fff;cursor:pointer;border-radius:0;transition:background 0.15s;white-space:nowrap;">💾 Сделать чекпоинт</div>
            <div class="chat-menu-item" data-action="delete_messages" style="padding:8px 16px;color:#ff6b6b;cursor:pointer;border-radius:0;transition:background 0.15s;white-space:nowrap;">🗑️ Удалить сообщения</div>
            <div class="chat-menu-item" data-action="generate" style="padding:8px 16px;color:#4a6cf7;cursor:pointer;border-radius:0;transition:background 0.15s;white-space:nowrap;">⚡ Сгенерировать промпт</div>
            <div style="border-top:1px solid #444;margin:4px 12px;"></div>
            <div class="chat-menu-item" data-action="mode_user" style="padding:8px 16px;color:${currentMode === 'user' ? '#4a6cf7' : '#aaa'};cursor:pointer;border-radius:0;transition:background 0.15s;font-weight:${currentMode === 'user' ? 'bold' : 'normal'};white-space:nowrap;">
                👤 Режим user
            </div>
            <div class="chat-menu-item" data-action="mode_char" style="padding:8px 16px;color:${currentMode === 'char' ? '#4a6cf7' : '#aaa'};cursor:pointer;border-radius:0;transition:background 0.15s;font-weight:${currentMode === 'char' ? 'bold' : 'normal'};white-space:nowrap;">
                🤖 Режим char
            </div>
        </div>
    `;

    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.chat-menu-item').forEach(item => {
        item.addEventListener('mouseenter', function() {
            this.style.background = '#3a3a4a';
        });
        item.addEventListener('mouseleave', function() {
            this.style.background = 'transparent';
        });
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            const action = this.dataset.action;
            handleChatMenuAction(action);
            closeChatMenu();
        });
    });
}

function closeChatMenu() {
    const dropdown = document.getElementById('chatMenuDropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
    }
    chatMenuOpen = false;
}

function handleChatMenuAction(action) {
    switch (action) {
        case 'close':
            renderMainPage();
            break;
        case 'chats':
            showToast('Список чатов будет реализован позже');
            break;
        case 'new':
            if (currentChatId) {
                const chat = getChat(currentChatId);
                if (chat) {
                    const newChat = createChat(chat.character_id, chat.persona_id);
                    renderChat(newChat.id);
                    showToast('Новый чат создан');
                }
            }
            break;
        case 'checkpoint':
            if (currentChatId) {
                const chat = getChat(currentChatId);
                if (chat) {
                    const copy = JSON.parse(JSON.stringify(chat));
                    copy.id = generateId();
                    copy.name = chat.name + ' (чекпоинт)';
                    const chats = getChatsData();
                    chats.push(copy);
                    saveChatsData(chats);
                    updateChatsIndex(copy);
                    renderChat(copy.id);
                    showToast('Чекпоинт создан');
                }
            }
            break;
        case 'delete_messages':
            showToast('Выберите сообщения для удаления (будет позже)');
            break;
        case 'generate':
            showToast('Промпт сгенерирован! (заглушка)');
            console.log('Сгенерирован промпт для чата:', currentChatId);
            break;
        case 'mode_user':
            chatMode = 'user';
            updateModeDisplay();
            showToast('Режим: User');
            break;
        case 'mode_char':
            chatMode = 'char';
            updateModeDisplay();
            showToast('Режим: Char');
            break;
        default:
            break;
    }
}

function updateModeDisplay() {
    const display = document.getElementById('modeDisplay');
    if (!display) return;
    if (currentChatId) {
        const chat = getChat(currentChatId);
        if (chat) {
            const character = getCharacter(chat.character_id);
            const persona = getPersona(chat.persona_id);
            const label = chatMode === 'user'
                ? (persona?.name || 'User')
                : (character?.name || 'Char');
            display.textContent = label;
        }
    }
}

function getChat(chatId) {
    const chats = getChatsData();
    return chats.find(c => c.id === chatId) || null;
}

// ============================================
// ДОБАВЛЕНИЕ СООБЩЕНИЯ
// ============================================
function addMessageToChat(chatId, role, content) {
    const chats = getChatsData();
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    const newMsg = {
        id: chat.messages.length,
        role: role,
        content: content,
        timestamp: new Date().toISOString()
    };
    chat.messages.push(newMsg);
    chat.updated = new Date().toISOString();
    saveChatsData(chats);
    updateChatsIndex(chat);
    renderChat(chatId);
}

// ============================================
// ГЛАВНАЯ СТРАНИЦА
// ============================================
function renderMainPage() {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.style.display = 'block';
        mainContent.style.height = 'auto';
        mainContent.style.padding = '30px';
        mainContent.style.borderRadius = '0';
        mainContent.style.minHeight = '100%';
        mainContent.style.background = '#2e2e2e';
        mainContent.innerHTML = `
            <h1>🏠 Главная</h1>
            <p>Здесь будут последние чаты.</p>
            <p style="color:#888; font-size:14px;">(пока заглушка)</p>
        `;
    }
}

// ============================================
// ОТКРЫТИЕ ЧАТА ПО ПЕРСОНАЖУ
// ============================================
window.openChatForCharacter = function(characterId) {
    let chat = getLastChat(characterId);
    if (!chat) {
        const activePersonaId = getActivePersonaId() || null;
        chat = createChat(characterId, activePersonaId);
    }
    renderChat(chat.id);
};