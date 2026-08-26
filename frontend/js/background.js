// ============================================
// BACKGROUND — логика панели «Фоны» (с защитой от дублирования)
// ============================================

const MAX_THUMBNAILS = 10;
const THUMBNAIL_WIDTH = 300;
const QUALITY = 0.9;

function renderBackgroundPanel() {
    const panelBody = document.getElementById('central-panel-body');
    if (!panelBody) return;

    const data = getData('crafty_background') || getDefaultBackground();
    const thumbnails = data.thumbnails || [];
    const selectedId = data.selected;

    panelBody.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <button id="addBackgroundBtn" style="background:#4a6cf7;color:#fff;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;font-size:14px;">➕ Добавить фон</button>
            <button id="deleteSelectedBackgroundBtn" style="background:${selectedId ? '#ff6b6b' : '#555'};color:#fff;border:none;border-radius:6px;padding:8px 16px;cursor:${selectedId ? 'pointer' : 'default'};font-size:14px;opacity:${selectedId ? 1 : 0.5};" ${selectedId ? '' : 'disabled'}>🗑️ Удалить выбранный</button>
        </div>
        <div id="backgroundThumbnails" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:12px;margin-top:12px;">
            ${thumbnails.length === 0 ? `
                <p style="color:#888;font-size:14px;grid-column:1/-1;text-align:center;">У вас пока нет сохранённых фонов. Нажмите «Добавить фон», чтобы выбрать изображение.</p>
            ` : thumbnails.map((item, index) => `
                <div class="background-thumb" data-id="${item.id}" style="border-radius:8px;overflow:hidden;cursor:pointer;border:2px solid ${selectedId === item.id ? '#4a6cf7' : 'transparent'};transition:border 0.3s;position:relative;aspect-ratio:16/9;background:#2e2e2e;">
                    <img src="${item.data}" alt="Фон ${index + 1}" style="width:100%;height:100%;object-fit:cover;display:block;">
                    <button class="delete-background" data-id="${item.id}" style="position:absolute;top:4px;right:4px;background:rgba(255,0,0,0.8);color:#fff;border:none;border-radius:50%;width:20px;height:20px;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.3s;">✕</button>
                    ${selectedId === item.id ? `<div style="position:absolute;bottom:4px;right:4px;background:#4a6cf7;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:14px;">✓</div>` : ''}
                </div>
            `).join('')}
        </div>
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #444;">
            <button id="resetBackgroundBtn" style="background:transparent;color:#ff6b6b;border:1px solid #ff6b6b;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:13px;">🔄 Сбросить все фоны</button>
        </div>
    `;

    // ============================================
    // Обработчики (с stopPropagation для защиты от закрытия панели)
    // ============================================

    document.getElementById('addBackgroundBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (!file) return;
            handleBackgroundUpload(file);
        };
        input.click();
    });

    document.getElementById('deleteSelectedBackgroundBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        const data = getData('crafty_background');
        if (!data || !data.selected) return;
        deleteSelectedBackground();
    });

    document.querySelectorAll('.background-thumb').forEach(el => {
        el.addEventListener('click', function(e) {
            e.stopPropagation(); // ← предотвращаем закрытие панели
            if (e.target.classList.contains('delete-background')) return;
            const id = this.dataset.id;
            selectBackground(id);
        });
    });

    document.querySelectorAll('.delete-background').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.dataset.id;
            deleteBackground(id);
        });
    });

    document.getElementById('resetBackgroundBtn')?.addEventListener('click', function(e) {
        e.stopPropagation();
        resetAllBackgrounds();
    });
}

// ============================================
// ФУНКЦИИ РАБОТЫ С ФОНАМИ
// ============================================

function handleBackgroundUpload(file) {
    if (!file) return;
    console.log('📂 Выбран файл:', file.name, file.size);

    // Проверка на дубликат по имени и размеру
    const data = getData('crafty_background') || getDefaultBackground();
    const existing = data.thumbnails.find(t => t.name === file.name && t.size === file.size);
    if (existing) {
        showToast('⚠️ Этот фон уже загружен!');
        console.log('⚠️ Дубликат найден:', file.name, file.size);
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showToast('Файл слишком большой! Максимум 5 МБ.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const fullBase64 = e.target.result;
        console.log('✅ Оригинал загружен, длина:', fullBase64.length);

        // Создаём миниатюру для превью
        compressImage(fullBase64, THUMBNAIL_WIDTH, THUMBNAIL_WIDTH * 9/16, 0.8, function(thumbnail) {
            console.log('✅ Миниатюра создана, длина:', thumbnail.length);

            const id = generateId();
            // Сохраняем полное изображение в IndexedDB
            saveImageToDB(id, fullBase64).then(() => {
                console.log('✅ Полное изображение сохранено в IndexedDB');

                const data = getData('crafty_background') || getDefaultBackground();
                const thumbnails = data.thumbnails || [];

                // Добавляем новый фон с именем и размером
                thumbnails.unshift({
                    id: id,
                    name: file.name,
                    size: file.size,
                    data: thumbnail
                });

                if (thumbnails.length > MAX_THUMBNAILS) {
                    const removed = thumbnails.pop();
                    deleteImageFromDB(removed.id).catch(console.warn);
                }

                data.thumbnails = thumbnails;
                data.selected = id;
                setData('crafty_background', data);

                applyFullBackground(id);
                renderBackgroundPanel();
                showToast('Фон добавлен и применён!');
            }).catch(err => {
                console.error('❌ Ошибка сохранения в IndexedDB:', err);
                showToast('Ошибка сохранения фона');
            });
        });
    };
    reader.onerror = function() {
        showToast('Ошибка чтения файла');
    };
    reader.readAsDataURL(file);
}

function applyFullBackground(id) {
    getImageFromDB(id).then(dataUrl => {
        if (dataUrl) {
            applyBackgroundToPage(dataUrl);
        } else {
            console.warn('⚠️ Изображение не найдено в IndexedDB');
            applyBackgroundToPage(null);
        }
    }).catch(err => {
        console.error('❌ Ошибка загрузки из IndexedDB:', err);
        applyBackgroundToPage(null);
    });
}

function selectBackground(id) {
    const data = getData('crafty_background');
    if (!data) return;

    data.selected = id;
    setData('crafty_background', data);

    applyFullBackground(id);
    renderBackgroundPanel();
    showToast('Фон применён');
}

function deleteSelectedBackground() {
    const data = getData('crafty_background');
    if (!data || !data.selected) return;
    deleteBackground(data.selected);
}

function deleteBackground(id) {
    const data = getData('crafty_background');
    if (!data) return;

    const thumbnails = data.thumbnails || [];
    const index = thumbnails.findIndex(t => t.id === id);
    if (index === -1) return;

    deleteImageFromDB(id).catch(console.warn);
    thumbnails.splice(index, 1);

    if (data.selected === id) {
        data.selected = thumbnails.length > 0 ? thumbnails[0].id : null;
        if (data.selected) {
            applyFullBackground(data.selected);
        } else {
            applyBackgroundToPage(null);
        }
    }

    data.thumbnails = thumbnails;
    setData('crafty_background', data);
    renderBackgroundPanel();
    showToast('Фон удалён');
}

function resetAllBackgrounds() {
    deleteAllImagesFromDB().then(() => {
        const data = getDefaultBackground();
        setData('crafty_background', data);
        applyBackgroundToPage(null);
        renderBackgroundPanel();
        showToast('Все фоны удалены, стандартный фон восстановлен');
    }).catch(err => {
        console.error('❌ Ошибка очистки IndexedDB:', err);
        showToast('Ошибка при сбросе фонов');
    });
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function compressImage(dataUrl, maxWidth, maxHeight, quality, callback) {
    const img = new Image();
    img.onload = function() {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
        }

        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        callback(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = function() {
        console.error('❌ Ошибка загрузки изображения');
        showToast('Не удалось обработать изображение');
    };
    img.src = dataUrl;
}

function applyBackgroundToPage(base64) {
    if (base64) {
        document.body.style.backgroundImage = `url(${base64})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundAttachment = 'fixed';
    } else {
        document.body.style.backgroundImage = 'none';
        document.body.style.backgroundColor = '#040303';
    }
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

function initBackground() {
    const data = getData('crafty_background');
    if (!data) {
        setData('crafty_background', getDefaultBackground());
        return;
    }

    if (data.selected) {
        getImageFromDB(data.selected).then(dataUrl => {
            if (dataUrl) {
                applyBackgroundToPage(dataUrl);
            } else {
                data.selected = null;
                setData('crafty_background', data);
            }
        }).catch(() => {
            data.selected = null;
            setData('crafty_background', data);
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    initBackground();
});