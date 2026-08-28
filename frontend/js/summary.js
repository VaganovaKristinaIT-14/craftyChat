// ============================================================
// SUMMARY — полное управление саммари (улучшенный интерфейс)
// ============================================================

async function renderSummaryPanel() {
  const body = document.getElementById('central-panel-body');
  if (!body) return;

  if (!window.currentChatId) {
    body.innerHTML = `<div class="summary-placeholder">📝 Зайдите в чат, чтобы управлять саммари</div>`;
    return;
  }

  try {
    const status = await getSummaryStatus(window.currentChatId);
    const chat = await getChat(window.currentChatId);
    const blocks = chat.summary_blocks || [];

    let html = `
      <div class="summary-status">
        <div class="status-icon">${status.is_actual ? '✅' : '❌'}</div>
        <div class="status-text">
          <span class="status-label" style="color:${status.is_actual ? '#4caf50' : '#e74c6f'}">${status.label}</span>
          <span class="status-detail">(${status.unsummarized_count} сообщений не охвачено)</span>
        </div>
        <div class="status-progress">
          <div class="progress-bar" style="width: ${Math.max(0, 100 - (status.unsummarized_count / 10) * 100)}%; background: ${status.is_actual ? '#4caf50' : '#f39c12'};"></div>
        </div>
      </div>
      <div class="summary-prompt-section">
        <label>📝 Промпт для генерации саммари</label>
        <textarea id="summaryPrompt" rows="3" class="summary-prompt-text">${escHtml('Ниже приведены известные данные (карточки и лорбук). Ты НЕ должен включать их в саммари — они уже известны. Перескажи только новые события из сообщений ниже.')}</textarea>
        <button class="btn btn-sm" id="generateSummaryBtn">⚡ Сгенерировать и скопировать промпт</button>
        <span style="font-size:12px; color:var(--paper-faint); margin-left:8px;">(после получения ответа вставьте его в поле ниже)</span>
      </div>
      <div class="summary-blocks-section">
        <div class="blocks-header">
          <h4>📖 Блоки саммари (краткое содержание истории)</h4>
          <button class="btn btn-sm" id="addEmptySummaryBtn">➕ Добавить пустой блок</button>
        </div>
        <div class="blocks-list">
          ${blocks.length === 0 ? '<p class="empty-message">Нет блоков саммари</p>' :
            blocks.map((b, idx) => `
              <div class="summary-block" data-id="${b.id}">
                <div class="block-header">
                  <span class="block-name">${escHtml(b.name || `Блок ${idx+1}`)}</span>
                  <span class="block-range">📌 Индексы сообщений: #${b.start_index ?? '?'} — #${b.end_index ?? '?'}</span>
                  <div class="block-controls">
                    <button class="btn btn-sm btn-outline rename-summary-btn" data-id="${b.id}" title="Переименовать блок">✎</button>
                    <button class="btn btn-sm btn-danger delete-summary-btn" data-id="${b.id}" title="Удалить блок">✕</button>
                  </div>
                </div>
                <div class="block-content">
                  <div class="summary-text-display">${escHtml(b.summary)}</div>
                  <textarea class="summary-edit" style="display:none;" rows="3">${escHtml(b.summary)}</textarea>
                  <button class="btn btn-sm btn-outline edit-summary-btn" data-id="${b.id}">✎ Редактировать текст</button>
                </div>
              </div>
            `).join('')}
        </div>
      </div>
    `;

    body.innerHTML = html;

    // ========== ОБРАБОТЧИКИ ==========

    // Генерация промпта для саммари
    document.getElementById('generateSummaryBtn')?.addEventListener('click', async function() {
      const promptText = document.getElementById('summaryPrompt').value;
      try {
        const result = await generateSummaryPrompt(window.currentChatId, promptText);
        if (!result.ok) {
          showToast(result.message, 'warning');
          return;
        }
        await navigator.clipboard.writeText(result.prompt);
        showToast(`Промпт для саммари скопирован (токенов: ${result.tokens})`, 'success');
        const summary = await showPrompt('Вставьте полученный от модели пересказ', '', { title: 'Сохранить саммари', multiline: true });
        if (summary) {
          await saveSummaryBlock(window.currentChatId, result.start_index, result.end_index, summary);
          renderSummaryPanel();
          showToast('Блок саммари сохранён', 'success');
        }
      } catch (e) {
        showToast('Ошибка генерации', 'error');
      }
    });

    // Добавить пустой блок
    document.getElementById('addEmptySummaryBtn')?.addEventListener('click', async function() {
      await addEmptySummaryBlock(window.currentChatId);
      renderSummaryPanel();
      showToast('Пустой блок создан', 'success');
    });

    // Удаление блока
    document.querySelectorAll('.delete-summary-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        const id = this.dataset.id;
        if (!(await showConfirm('Удалить блок саммари?', { title: 'Удаление блока', okText: 'Удалить' }))) return;
        await deleteSummaryBlock(window.currentChatId, id);
        renderSummaryPanel();
        showToast('Блок удалён', 'success');
      });
    });

    // Переименование блока
    document.querySelectorAll('.rename-summary-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        const id = this.dataset.id;
        const block = blocks.find(b => b.id === id);
        const currentName = block?.name || '';
        const newName = await showPrompt('Новое название блока', currentName, { title: 'Переименовать блок' });
        if (newName) {
          await updateSummaryBlock(window.currentChatId, id, { name: newName });
          renderSummaryPanel();
          showToast('Название обновлено', 'success');
        }
      });
    });

    // Редактирование содержимого блока
    document.querySelectorAll('.edit-summary-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const container = this.closest('.block-content');
        const display = container.querySelector('.summary-text-display');
        const editArea = container.querySelector('.summary-edit');
        if (editArea.style.display === 'none') {
          display.style.display = 'none';
          editArea.style.display = 'block';
          this.textContent = '💾 Сохранить изменения';
        } else {
          const newText = editArea.value;
          const id = this.dataset.id;
          updateSummaryBlock(window.currentChatId, id, { summary: newText }).then(() => {
            renderSummaryPanel();
            showToast('Изменения сохранены', 'success');
          });
        }
      });
    });

  } catch (e) {
    body.innerHTML = `<p class="error-message">Ошибка загрузки саммари</p>`;
    console.error(e);
  }
}