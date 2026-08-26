// ============================================
// APP — навигация, панели, инициализация
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    const menuBtns = document.querySelectorAll('.menu-btn');
    const leftPanel = document.getElementById('presets-panel');
    const rightPanel = document.getElementById('characters-panel');
    const centralPanel = document.getElementById('central-panel');
    const centralTitle = document.getElementById('central-panel-title');
    const centralBody = document.getElementById('central-panel-body');

    // ============================================
    // ФУНКЦИИ УПРАВЛЕНИЯ ПАНЕЛЯМИ
    // ============================================
    function closeAllPanels() {
        leftPanel.classList.remove('open');
        rightPanel.classList.remove('open');
        centralPanel.classList.remove('open');
    }

    function openCentralPanel(title, html) {
        closeAllPanels();
        centralTitle.textContent = title;
        centralBody.innerHTML = html;
        centralPanel.classList.add('open');
    }

    function isPanelOpen(panel) {
        return panel.classList.contains('open');
    }

    function toggleLeftPanel() {
        if (isPanelOpen(leftPanel)) {
            closeAllPanels();
        } else {
            closeAllPanels();
            leftPanel.classList.add('open');
            if (typeof renderPresetsPanel === 'function') {
                renderPresetsPanel();
            }
        }
    }

    function toggleRightPanel() {
        if (isPanelOpen(rightPanel)) {
            closeAllPanels();
        } else {
            closeAllPanels();
            rightPanel.classList.add('open');
            if (typeof renderCharactersPanel === 'function') {
                renderCharactersPanel();
            }
        }
    }

    // ============================================
    // ОБРАБОТЧИКИ КЛИКОВ ПО КНОПКАМ МЕНЮ
    // ============================================
    menuBtns.forEach(btn => {
        btn.addEventListener('click', function(event) {
            event.stopPropagation();
            const menu = this.dataset.menu;

            if (menu === 'presets') {
                toggleLeftPanel();
                return;
            }

            if (menu === 'background') {
                openCentralPanel('Фон', `<div id="background-content"></div>`);
                if (typeof renderBackgroundPanel === 'function') {
                    renderBackgroundPanel();
                }
                return;
            }

            if (menu === 'lore') {
                openCentralPanel('📖 Лорбуки', `<p>Здесь будет список лорбуков.</p>`);
                if (typeof renderLorebooksPanel === 'function') {
                    renderLorebooksPanel();
                }
                return;
            }

            if (menu === 'summary') {
                openCentralPanel('📝 Саммари', `<p>Здесь будет история чата.</p>`);
                return;
            }

            if (menu === 'personas') {
    openCentralPanel('👤 Персоны', `<div id="personas-content"></div>`);
    if (typeof renderPersonasPanel === 'function') {
        renderPersonasPanel();
    }
    return;
}
            if (menu === 'characters') {
    toggleRightPanel();
    return;
}

            closeAllPanels();
        });
    });

    // ============================================
    // ЗАКРЫТИЕ ПАНЕЛЕЙ ПРИ КЛИКЕ ВНЕ НИХ
    // ============================================
    document.addEventListener('click', function(event) {
        const target = event.target;
        const leftBtn = document.querySelector('[data-menu="presets"]');
        const rightBtn = document.querySelector('[data-menu="characters"]');

        if (leftPanel.contains(target) || leftBtn.contains(target)) return;
        if (rightPanel.contains(target) || rightBtn.contains(target)) return;
        if (centralPanel.contains(target)) return;

        const centralBtns = ['background', 'lore', 'summary', 'personas'];
        let clickedCentral = false;
        centralBtns.forEach(id => {
            const btn = document.querySelector(`[data-menu="${id}"]`);
            if (btn && btn.contains(target)) clickedCentral = true;
        });
        if (clickedCentral) return;

        closeAllPanels();
    });

    // ============================================
    // ЗАКРЫТИЕ ПО ESC
    // ============================================
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllPanels();
        }
    });

    // ============================================
    // УВЕДОМЛЕНИЯ (TOAST)
    // ============================================
    window.showToast = function(text, duration = 3000) {
        const oldToast = document.querySelector('.toast');
        if (oldToast) oldToast.remove();

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = text;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hidden');
            setTimeout(() => toast.remove(), 500);
        }, duration);
    };

    // ============================================
    // ИНИЦИАЛИЗАЦИЯ (рендерим главную)
    // ============================================
    console.log('✅ CraftyChat запущен!');
});