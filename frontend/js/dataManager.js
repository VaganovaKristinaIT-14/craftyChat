// ============================================
// DATA MANAGER — localStorage + IndexedDB
// ============================================

// ---------- localStorage (метаданные) ----------
function getData(key) {
    try {
        return JSON.parse(localStorage.getItem(key)) || null;
    } catch {
        return null;
    }
}

function setData(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------- Пресеты (коллекции) ----------
function getDefaultPresetsData() {
    return {
        collections: [
            {
                id: generateId(),
                name: 'Основной',
                mainPrompt: 'Ты — персонаж. Отвечай коротко, по делу. Не повторяй действия пользователя.',
                extraPrompt: 'Будь саркастичным, но не злым. Используй короткие фразы.',
                presets: [],
                tokenLimit: 10000
            }
        ],
        activeCollectionId: null
    };
}

function getPresetsData() {
    let data = getData('crafty_presets');
    if (!data) {
        data = getDefaultPresetsData();
        data.activeCollectionId = data.collections[0].id;
        setData('crafty_presets', data);
    } else {
        // МИГРАЦИЯ СТАРЫХ ДАННЫХ
        if (!data.collections || !Array.isArray(data.collections) || data.collections.length === 0) {
            // Создаём коллекцию из старых данных
            const newCollection = {
                id: generateId(),
                name: 'Основной',
                mainPrompt: data.mainPrompt || '',
                extraPrompt: data.extraPrompt || '',
                presets: data.presets || [],
                tokenLimit: data.tokenLimit || 10000
            };
            data.collections = [newCollection];
            data.activeCollectionId = newCollection.id;
            // Удаляем старые поля, чтобы не было путаницы
            delete data.mainPrompt;
            delete data.extraPrompt;
            delete data.presets;
            delete data.tokenLimit;
            setData('crafty_presets', data);
        }
    }
    return data;
}

function savePresetsData(data) {
    setData('crafty_presets', data);
}

function getActiveCollection() {
    const data = getPresetsData();
    if (!data || !data.collections) return null;
    return data.collections.find(c => c.id === data.activeCollectionId);
}

function getCollection(id) {
    const data = getPresetsData();
    if (!data || !data.collections) return null;
    return data.collections.find(c => c.id === id);
}

// ---------- Дефолтные значения для других разделов ----------
function getDefaultLorebooks() { return []; }
function getDefaultPersonas() { return []; }
function getDefaultCharacters() { return []; }

function getDefaultBackground() {
    return {
        selected: null,
        thumbnails: []
    };
}

// ---------- IndexedDB (для фонов) ----------
const DB_NAME = 'CraftyChatDB';
const STORE_NAME = 'backgrounds';
let db = null;

function openDB() {
    return new Promise((resolve, reject) => {
        if (db && db instanceof IDBDatabase) {
            resolve(db);
            return;
        }
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = function(e) {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = function(e) {
            db = e.target.result;
            resolve(db);
        };
        request.onerror = function(e) {
            reject(e.target.error);
        };
    });
}

function saveImageToDB(id, dataUrl) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const record = { id, data: dataUrl };
            const request = store.put(record);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    });
}

function getImageFromDB(id) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result ? request.result.data : null);
            request.onerror = () => reject(request.error);
        });
    });
}

function deleteImageFromDB(id) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    });
}

function deleteAllImagesFromDB() {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    });
}

// ---------- Экранирование HTML ----------
function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


// ============================================
// ПЕРСОНЫ (User)
// ============================================

function getDefaultPersonas() {
    return [];
}

function getPersonasData() {
    let data = getData('crafty_personas');
    if (!data) {
        data = getDefaultPersonas();
        setData('crafty_personas', data);
    }
    return data;
}

function savePersonasData(personas) {
    setData('crafty_personas', personas);
}

function getActivePersonaId() {
    return getData('crafty_active_persona') || null;
}

function setActivePersonaId(id) {
    if (id) {
        setData('crafty_active_persona', id);
    } else {
        localStorage.removeItem('crafty_active_persona');
    }
}

function getPersona(id) {
    const personas = getPersonasData();
    return personas.find(p => p.id === id) || null;
}

function getDefaultPersona() {
    return {
        id: generateId(),
        name: 'New persona',
        avatar: null,  // base64 или null
        description: '',
        linked_characters: []  // массив ID персонажей
    };
}


// ============================================
// ПЕРСОНАЖИ (Bot) — вспомогательная функция
// ============================================

// Для свяей с персонами
function getCharacter(id) {
    const characters = getData('crafty_characters') || [];
    return characters.find(c => c.id === id) || null;
}

// ============================================
// ПЕРСОНАЖИ (Bot)
// ============================================

function getDefaultCharacters() {
    return [];
}

function getCharactersData() {
    let data = getData('crafty_characters');
    if (!data) {
        data = getDefaultCharacters();
        setData('crafty_characters', data);
    }
    return data;
}

function saveCharactersData(characters) {
    setData('crafty_characters', characters);
}

function getCharacter(id) {
    const characters = getCharactersData();
    return characters.find(c => c.id === id) || null;
}

function getDefaultCharacter() {
    return {
        id: generateId(),
        name: 'New character',
        avatar: null,
        lorebook_id: null,
        fields: {
            personality: '',
            behavior: '',
            appearance: '',
            occupation: '',
            extra: ''
        }
    };
}

// ============================================
// ЧАТЫ
// ============================================

function getDefaultChats() {
    return [];
}

function getChatsData() {
    let data = getData('crafty_chats');
    if (!data) {
        data = getDefaultChats();
        setData('crafty_chats', data);
    }
    return data;
}

function saveChatsData(chats) {
    setData('crafty_chats', chats);
}

function getCharacterChats(characterId) {
    const chats = getChatsData();
    return chats.filter(c => c.character_id === characterId);
}

function getLastChat(characterId) {
    const chats = getCharacterChats(characterId);
    if (chats.length === 0) return null;
    chats.sort((a, b) => new Date(b.updated) - new Date(a.updated));
    return chats[0];
}

function createChat(characterId, personaId) {
    const chats = getChatsData();
    const character = getCharacter(characterId);
    const newChat = {
        id: generateId(),
        character_id: characterId,
        persona_id: personaId || null,
        name: `Чат с ${character?.name || 'персонажем'}`,
        messages: [],
        summary_blocks: [],
        last_summarized_index: -1,
        step_size: 10,
        updated: new Date().toISOString()
    };
    chats.push(newChat);
    saveChatsData(chats);
    updateChatsIndex(newChat);
    return newChat;
}

// Индексный файл для главной страницы
function getChatsIndex() {
    let index = getData('crafty_chats_index');
    if (!index) index = [];
    return index;
}

function saveChatsIndex(index) {
    setData('crafty_chats_index', index);
}

function updateChatsIndex(chat) {
    let index = getChatsIndex();
    const existing = index.find(c => c.id === chat.id);
    if (existing) {
        existing.name = chat.name;
        existing.updated = chat.updated;
        existing.last_message_preview = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].content.substring(0, 50) : '';
    } else {
        index.push({
            id: chat.id,
            character_id: chat.character_id,
            name: chat.name,
            updated: chat.updated,
            last_message_preview: ''
        });
    }
    saveChatsIndex(index);
}