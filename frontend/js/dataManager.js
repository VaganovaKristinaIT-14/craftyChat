// ============================================================
// DATA MANAGER — все запросы к API, хранение состояния
// ============================================================

const API_BASE = '/api';

// ---------- Вспомогательные ----------
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function debounce(fn, delay = 400) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
window.debounce = debounce;

// ---------- TOAST (улучшенный) ----------
const TOAST_TYPES = {
  success: { icon: '✅', title: 'Готово', className: 'toast-success' },
  error:   { icon: '❌', title: 'Ошибка', className: 'toast-error' },
  warning: { icon: '⚠️', title: 'Внимание', className: 'toast-warning' },
  info:    { icon: 'ℹ️', title: 'Информация', className: 'toast-info' },
};

let toastContainerInstance = null;

function getToastContainer() {
  if (!toastContainerInstance) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    toastContainerInstance = container;
  }
  return toastContainerInstance;
}

function showToast(message, type = 'info', duration = 5000) {
  const container = getToastContainer();
  const existing = container.querySelectorAll('.toast');
  if (existing.length >= 5) {
    existing[0].classList.add('hidden');
    setTimeout(() => existing[0].remove(), 400);
  }

  const config = TOAST_TYPES[type] || TOAST_TYPES.info;
  const toast = document.createElement('div');
  toast.className = `toast ${config.className}`;
  toast.innerHTML = `
    <span class="toast-icon">${config.icon}</span>
    <div class="toast-content">
      <div class="toast-title">${config.title}</div>
      <div class="toast-message">${escHtml(message)}</div>
    </div>
    <button class="toast-close" aria-label="Закрыть">✕</button>
    <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
  `;
  container.appendChild(toast);

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    toast.classList.add('hidden');
    setTimeout(() => toast.remove(), 400);
  });

  const timer = setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('hidden');
      setTimeout(() => toast.remove(), 400);
    }
  }, duration);

  toast.addEventListener('click', (e) => {
    if (e.target === toast || e.target.closest('.toast-content')) return;
  });

  return toast;
}
window.showToast = showToast;

// ---------- API-запросы ----------
async function apiRequest(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json();
  if (!res.ok) {
    showToast(data.error || 'Ошибка сервера', 'error');
    throw new Error(data.error || 'API error');
  }
  return data;
}

// ============================================================
// ПРЕСЕТЫ
// ============================================================
async function getPresetsData() { return apiRequest(`${API_BASE}/presets`); }
async function savePresetsData(data) { return apiRequest(`${API_BASE}/presets`, { method: 'PUT', body: JSON.stringify(data) }); }
async function createCollection(name) { return apiRequest(`${API_BASE}/presets/collections`, { method: 'POST', body: JSON.stringify({ name }) }); }
async function renameCollection(id, name) { return apiRequest(`${API_BASE}/presets/collections/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }); }
async function deleteCollection(id) { return apiRequest(`${API_BASE}/presets/collections/${id}`, { method: 'DELETE' }); }
async function activateCollection(id) { return apiRequest(`${API_BASE}/presets/collections/${id}/activate`, { method: 'POST' }); }
async function addMiniPreset(collectionId, name, content) { return apiRequest(`${API_BASE}/presets/collections/${collectionId}/presets`, { method: 'POST', body: JSON.stringify({ name, content }) }); }
async function updateMiniPreset(collectionId, presetId, data) { return apiRequest(`${API_BASE}/presets/collections/${collectionId}/presets/${presetId}`, { method: 'PUT', body: JSON.stringify(data) }); }
async function deleteMiniPreset(collectionId, presetId) { return apiRequest(`${API_BASE}/presets/collections/${collectionId}/presets/${presetId}`, { method: 'DELETE' }); }

// ============================================================
// ПЕРСОНАЖИ (CHARACTERS)
// ============================================================
async function getCharacters(page = 1, perPage = 10) { return apiRequest(`${API_BASE}/characters?page=${page}&per_page=${perPage}`); }
async function getCharacter(id) { return apiRequest(`${API_BASE}/characters/${id}`); }
async function createCharacter(data) { return apiRequest(`${API_BASE}/characters`, { method: 'POST', body: JSON.stringify(data) }); }
async function updateCharacter(id, data) { return apiRequest(`${API_BASE}/characters/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
async function deleteCharacter(id) { return apiRequest(`${API_BASE}/characters/${id}`, { method: 'DELETE' }); }
async function uploadCharacterAvatar(id, file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/characters/${id}/avatar`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json();
    showToast(err.error || 'Ошибка загрузки', 'error');
    throw new Error(err.error);
  }
  return res.json();
}
async function importCharacter(data) { return apiRequest(`${API_BASE}/characters/import`, { method: 'POST', body: JSON.stringify(data) }); }
async function exportCharacter(id) {
  const res = await fetch(`${API_BASE}/characters/${id}/export`);
  if (!res.ok) throw new Error('Export failed');
  return res.json();
}

// ============================================================
// ПЕРСОНЫ (PERSONAS)
// ============================================================
async function getPersonas(page = 1, perPage = 10) { return apiRequest(`${API_BASE}/personas?page=${page}&per_page=${perPage}`); }
async function getPersona(id) { return apiRequest(`${API_BASE}/personas/${id}`); }
async function createPersona(data) { return apiRequest(`${API_BASE}/personas`, { method: 'POST', body: JSON.stringify(data) }); }
async function updatePersona(id, data) { return apiRequest(`${API_BASE}/personas/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
async function deletePersona(id) { return apiRequest(`${API_BASE}/personas/${id}`, { method: 'DELETE' }); }
async function uploadPersonaAvatar(id, file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/personas/${id}/avatar`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json();
    showToast(err.error || 'Ошибка загрузки', 'error');
    throw new Error(err.error);
  }
  return res.json();
}
async function activatePersona(id) { return apiRequest(`${API_BASE}/personas/${id}/activate`, { method: 'POST' }); }
async function linkPersonaToCharacter(personaId, characterId) { return apiRequest(`${API_BASE}/personas/${personaId}/link-character`, { method: 'POST', body: JSON.stringify({ character_id: characterId }) }); }
async function unlinkPersonaFromCharacter(personaId, characterId) { return apiRequest(`${API_BASE}/personas/${personaId}/unlink-character`, { method: 'POST', body: JSON.stringify({ character_id: characterId }) }); }
async function importPersona(data) { return apiRequest(`${API_BASE}/personas/import`, { method: 'POST', body: JSON.stringify(data) }); }
async function exportPersona(id) {
  const res = await fetch(`${API_BASE}/personas/${id}/export`);
  if (!res.ok) throw new Error('Export failed');
  return res.json();
}
async function getPersonaForCharacter(characterId) { return apiRequest(`${API_BASE}/personas/for-character/${characterId}`); }

// ============================================================
// ЛОРБУКИ (WORLD INFO)
// ============================================================
async function getLorebooks() { return apiRequest(`${API_BASE}/lorebooks`); }
async function getLorebook(id) { return apiRequest(`${API_BASE}/lorebooks/${id}`); }
async function createLorebook(name) { return apiRequest(`${API_BASE}/lorebooks`, { method: 'POST', body: JSON.stringify({ name }) }); }
async function renameLorebook(id, name) { return apiRequest(`${API_BASE}/lorebooks/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }); }
async function duplicateLorebook(id) { return apiRequest(`${API_BASE}/lorebooks/${id}/duplicate`, { method: 'POST' }); }
async function deleteLorebook(id) { return apiRequest(`${API_BASE}/lorebooks/${id}`, { method: 'DELETE' }); }
async function importLorebook(data) { return apiRequest(`${API_BASE}/lorebooks/import`, { method: 'POST', body: JSON.stringify(data) }); }
async function exportLorebook(id) {
  const res = await fetch(`${API_BASE}/lorebooks/${id}/export`);
  if (!res.ok) throw new Error('Export failed');
  return res.json();
}
async function createLoreEntry(lorebookId, data = {}) { return apiRequest(`${API_BASE}/lorebooks/${lorebookId}/entries`, { method: 'POST', body: JSON.stringify(data) }); }
async function updateLoreEntry(lorebookId, entryId, data) { return apiRequest(`${API_BASE}/lorebooks/${lorebookId}/entries/${entryId}`, { method: 'PUT', body: JSON.stringify(data) }); }
async function deleteLoreEntry(lorebookId, entryId) { return apiRequest(`${API_BASE}/lorebooks/${lorebookId}/entries/${entryId}`, { method: 'DELETE' }); }
async function reorderLoreEntries(lorebookId, order) { return apiRequest(`${API_BASE}/lorebooks/${lorebookId}/entries/reorder`, { method: 'PUT', body: JSON.stringify({ order }) }); }
async function addKeywordToEntry(lorebookId, entryId, keyword) { return apiRequest(`${API_BASE}/lorebooks/${lorebookId}/entries/${entryId}/keywords`, { method: 'POST', body: JSON.stringify({ keyword }) }); }
async function removeKeywordFromEntry(lorebookId, entryId, keyword) { return apiRequest(`${API_BASE}/lorebooks/${lorebookId}/entries/${entryId}/keywords/${encodeURIComponent(keyword)}`, { method: 'DELETE' }); }

// ============================================================
// ЧАТЫ
// ============================================================
async function getRecentChats() { return apiRequest(`${API_BASE}/chats/recent`); }
async function getChatsByCharacter(characterId) { return apiRequest(`${API_BASE}/chats?character_id=${characterId}`); }
async function getChat(id, page = 1, perPage = 20) { return apiRequest(`${API_BASE}/chats/${id}?page=${page}&per_page=${perPage}`); }
async function createChat(data) { return apiRequest(`${API_BASE}/chats`, { method: 'POST', body: JSON.stringify(data) }); }
async function updateChat(id, data) { return apiRequest(`${API_BASE}/chats/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
async function deleteChat(id) { return apiRequest(`${API_BASE}/chats/${id}`, { method: 'DELETE' }); }
async function createCheckpoint(id) { return apiRequest(`${API_BASE}/chats/${id}/checkpoint`, { method: 'POST' }); }
async function addMessage(chatId, role, content) { return apiRequest(`${API_BASE}/chats/${chatId}/messages`, { method: 'POST', body: JSON.stringify({ role, content }) }); }
async function editMessage(chatId, index, content) { return apiRequest(`${API_BASE}/chats/${chatId}/messages/${index}`, { method: 'PUT', body: JSON.stringify({ content }) }); }
async function deleteMessages(chatId, indices) { return apiRequest(`${API_BASE}/chats/${chatId}/messages`, { method: 'DELETE', body: JSON.stringify({ indices }) }); }
async function setChatMode(chatId, mode) { return apiRequest(`${API_BASE}/chats/${chatId}/mode`, { method: 'POST', body: JSON.stringify({ mode }) }); }
async function generateMainPrompt(chatId, message) { return apiRequest(`${API_BASE}/chats/${chatId}/generate-prompt`, { method: 'POST', body: JSON.stringify({ message }) }); }
async function exportChatJSON(id) {
  const res = await fetch(`${API_BASE}/chats/${id}/export/json`);
  if (!res.ok) throw new Error('Export failed');
  return res.json();
}
async function exportChatTXT(id) {
  const res = await fetch(`${API_BASE}/chats/${id}/export/txt`);
  if (!res.ok) throw new Error('Export failed');
  return res.text();
}
async function importChat(data) { return apiRequest(`${API_BASE}/chats/import`, { method: 'POST', body: JSON.stringify({ chat: data }) }); }

// ============================================================
// САММАРИ
// ============================================================
async function getSummaryStatus(chatId) { return apiRequest(`${API_BASE}/chats/${chatId}/summary/status`); }
async function generateSummaryPrompt(chatId, summaryPrompt) { return apiRequest(`${API_BASE}/chats/${chatId}/summary/generate-prompt`, { method: 'POST', body: JSON.stringify({ summary_prompt: summaryPrompt }) }); }
async function saveSummaryBlock(chatId, startIndex, endIndex, summary, name) { return apiRequest(`${API_BASE}/chats/${chatId}/summary/blocks`, { method: 'POST', body: JSON.stringify({ start_index: startIndex, end_index: endIndex, summary, name }) }); }
async function addEmptySummaryBlock(chatId) { return apiRequest(`${API_BASE}/chats/${chatId}/summary/blocks/empty`, { method: 'POST' }); }
async function updateSummaryBlock(chatId, blockId, data) { return apiRequest(`${API_BASE}/chats/${chatId}/summary/blocks/${blockId}`, { method: 'PUT', body: JSON.stringify(data) }); }
async function deleteSummaryBlock(chatId, blockId) { return apiRequest(`${API_BASE}/chats/${chatId}/summary/blocks/${blockId}`, { method: 'DELETE' }); }

// ============================================================
// ФОНЫ
// ============================================================
async function getBackground() { return apiRequest(`${API_BASE}/background`); }
async function uploadBackground(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/background/upload`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json();
    showToast(err.error || 'Ошибка загрузки фона', 'error');
    throw new Error(err.error);
  }
  return res.json();
}
async function selectBackground(id) { return apiRequest(`${API_BASE}/background/${id}/select`, { method: 'POST' }); }
async function deleteBackground(id) { return apiRequest(`${API_BASE}/background/${id}`, { method: 'DELETE' }); }
async function resetBackgrounds() { return apiRequest(`${API_BASE}/background/reset`, { method: 'POST' }); }
async function getFullBackground(id) {
  const res = await fetch(`${API_BASE}/background/${id}/full`);
  if (!res.ok) throw new Error('Failed to load full background');
  return res.json();
}

// ============================================================
// НАСТРОЙКИ
// ============================================================
async function getSettings() { return apiRequest(`${API_BASE}/settings`); }
async function updateSettings(data) { return apiRequest(`${API_BASE}/settings`, { method: 'PUT', body: JSON.stringify(data) }); }
async function countTokens(text) { return apiRequest(`${API_BASE}/settings/count-tokens`, { method: 'POST', body: JSON.stringify({ text }) }); }

// ============================================================
// КОМПРЕССИЯ ИЗОБРАЖЕНИЙ
// ============================================================
function compressImage(dataUrl, maxWidth, maxHeight, quality, callback) {
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement('canvas');
    let w = img.width, h = img.height;
    if (w > maxWidth || h > maxHeight) {
      const ratio = Math.min(maxWidth / w, maxHeight / h);
      w *= ratio; h *= ratio;
    }
    canvas.width = Math.round(w);
    canvas.height = Math.round(h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    callback(canvas.toDataURL('image/jpeg', quality));
  };
  img.onerror = function() {
    showToast('Не удалось обработать изображение', 'error');
    callback(null);
  };
  img.src = dataUrl;
}
window.compressImage = compressImage;