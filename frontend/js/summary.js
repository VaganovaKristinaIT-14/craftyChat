// ============================================================
// SUMMARY — полное управление саммари (чистый вид без эмодзи)
// ============================================================

let expandedSummaryBlocks = new Set();

const DEFAULT_SUMMARY_PROMPT =
`Ты — летописец и архивариус ролевой игры. Твоя задача — составить предельно плотную, фактологическую и психологическую выжимку (Summary) последних событий из сообщений ниже.

КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО:
- Пересказывать базовые описания карточек персонажей и лорбука (система их уже знает).
- Использовать воду, метафоры и общие фразы ('они долго говорили').
- Писать вводные фразы ('Вот пересказ', 'В этих сообщениях...').

СТРУКТУРА ВЫВОДА (следуй строго по пунктам):
1. ХРОНИКА СОБЫТИЙ: ключевые поворотные факты (кто куда пошел, что нашел, приказы, выстрелы).
2. ПСИХОЛОГИЯ И ОТНОШЕНИЯ: внутреннее состояние (страхи, срывы, паника), сдвиги в доверии, обиды, подозрения, утаенная правда.
3. ФИЗИЧЕСКИЙ СТАТУС И ВЕЩИ: ранения, травмы, утомление, принятые препараты/яд/алкоголь, важные предметы.
4. АКТИВНЫЕ ОБЕЩАНИЯ И ЦЕЛИ: о чем договорились, невыполненные обещания, куда запланировали поехать.

Стиль: предельно краткий, сухой, телеграфный русский язык с максимальной концентрацией смысла.`;

async function updateSummaryIconStatus(chatId) {
  const summaryBtn = document.querySelector('.menu-btn[data-menu="summary"]');
  if (!summaryBtn) return;

  if (!chatId) {
    summaryBtn.classList.remove('summary-alert');
    summaryBtn.title = "Долгосрочная память чата — краткий пересказ старых сообщений";
    return;
  }

  try {
    const status = await getSummaryStatus(chatId);
    if (status && !status.is_actual) {
      summaryBtn.classList.add('summary-alert');
      summaryBtn.title = `Внимание: накопилось ${status.unsummarized_count} сообщений без саммари!`;
    } else {
      summaryBtn.classList.remove('summary-alert');
      summaryBtn.title = "Долгосрочная память чата — память актуальна";
    }
  } catch (e) {}
}

window.updateSummaryIconStatus = updateSummaryIconStatus;

async function renderSummaryPanel() {
  const body = document.getElementById('central-panel-body');
  if (!body) return;

  if (!window.currentChatId) {
    body.innerHTML = `
      <div class="summary-placeholder" style="text-align:center; color:var(--paper-faint); font-size:18px; padding:40px 0;">
        Зайдите в чат, чтобы управлять саммари
      </div>
    `;
    updateSummaryIconStatus(null);
    return;
  }

  try {
    let savedPrompt = DEFAULT_SUMMARY_PROMPT;
    try {
      const settings = await getSettings();
      if (settings && settings.summary_prompt && settings.summary_prompt.trim()) {
        savedPrompt = settings.summary_prompt;
      }
    } catch (err) {}

    const status = await getSummaryStatus(window.currentChatId);
    const chat = await getChat(window.currentChatId);
    const blocks = chat.summary_blocks || [];

    updateSummaryIconStatus(window.currentChatId);

    // Строго 15 сообщений
    const stepSize = 15;
    const progressPercent = Math.min(100, Math.round((status.unsummarized_count / stepSize) * 100));

    let html = `
      <!-- Статус актуальности памяти (БЕЗ ЭМОДЗИ) -->
      <div class="summary-status">
        <div class="status-text">
          <span class="status-label" style="color:${status.is_actual ? '#4caf50' : 'var(--wine-bright)'}">${status.label}</span>
          <span class="status-detail">(${status.unsummarized_count} из ${stepSize} сообщений накопилось)</span>
        </div>
        <div class="status-progress">
          <div class="progress-bar" style="width: ${progressPercent}%; background: ${status.is_actual ? '#4caf50' : 'var(--wine-bright)'};"></div>
        </div>
      </div>

      <!-- Секция редактируемого промпта саммари -->
      <div class="summary-prompt-section" style="margin-bottom: 20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <label class="summary-label" style="margin:0; font-size:15px; font-weight:600; color:var(--paper);">
            Промпт для генерации саммари
          </label>
          <button class="preset-tool-btn" id="resetSummaryPromptBtn" title="Сбросить к исходному шаблону" style="font-size:12px; color:var(--paper-faint); display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
            ${window.iconImg('refresh', 'Сброс', 14, 14)} <span>Сбросить к шаблону</span>
          </button>
        </div>
        
        <textarea id="summaryPrompt" rows="6" class="summary-prompt-text" style="width:100%; background:var(--ink-0); color:var(--paper); border:1px solid var(--line); border-radius:var(--radius-sm); padding:10px 12px; font-family:var(--font-body); font-size:14px; line-height:1.45; resize:vertical;">${escHtml(savedPrompt)}</textarea>

        <div style="display:flex; align-items:center; gap:12px; margin-top:8px; flex-wrap:wrap;">
          <button class="gold-outline-btn" id="generateSummaryBtn">
            ${window.iconImg('refresh', 'Генерация', 18, 18)} Сгенерировать промпт саммари
          </button>
          <span style="font-size:12px; color:var(--paper-faint);">
            (скопирует промпт для модели, после получения ответа вставьте результат)
          </span>
        </div>
      </div>

      <!-- Секция блоков сохраненного саммари -->
      <div class="summary-blocks-section">
        <div class="blocks-header">
          <h4 style="margin:0; font-size:20px; font-weight:500;">Блоки саммари (сохраненные события)</h4>
          <button class="gold-outline-btn" id="addEmptySummaryBtn">
            ${window.iconImg('add', 'Добавить', 18, 18)} Добавить пустой блок
          </button>
        </div>

        <div class="blocks-list" style="max-height: 48vh; overflow-y: auto;">
          ${blocks.length === 0 ? '<p class="empty-message">Нет блоков саммари. Сгенерируйте первый блок, когда накопится 15 сообщений.</p>' :
            blocks.map((b, idx) => {
              const isExpanded = expandedSummaryBlocks.has(b.id);
              return `
              <div class="summary-block" data-id="${b.id}">
                <div class="block-header">
                  <span class="block-name" style="cursor:pointer;" title="Нажмите, чтобы развернуть">${escHtml(b.name || `Блок ${idx+1}`)}</span>
                  <span class="block-range" style="font-family:var(--font-mono); font-size:12px; color:var(--paper-faint);">Диапазон сообщений: #${b.start_index ?? '?'} — #${b.end_index ?? '?'}</span>
                  <div class="block-controls">
                    <button class="preset-tool-btn rename-summary-btn" data-id="${b.id}" title="Переименовать блок">${window.iconImg('rename', 'Переименовать', 16, 16)}</button>
                    <button class="preset-tool-btn delete-summary-btn" data-id="${b.id}" title="Удалить блок">${window.iconImg('delete', 'Удалить', 16, 16)}</button>
                  </div>
                </div>
                <div class="block-content" style="display:${isExpanded ? 'block' : 'none'}; margin-top:8px;">
                  <div class="summary-text-display">${escHtml(b.summary)}</div>
                  <textarea class="summary-edit" style="display:none;" rows="5">${escHtml(b.summary)}</textarea>
                  <button class="btn btn-sm btn-outline edit-summary-btn" data-id="${b.id}" style="margin-top:6px;">✎ Редактировать текст</button>
                </div>
              </div>
            `}).join('')}
        </div>
      </div>
    `;

    body.innerHTML = html;

    // Автосохранение правок промпта
    const promptField = document.getElementById('summaryPrompt');
    if (promptField) {
      promptField.addEventListener('input', debounce(async function() {
        await updateSettings({ summary_prompt: this.value });
      }, 500));
    }

    // Сброс промпта к дефолту
    document.getElementById('resetSummaryPromptBtn')?.addEventListener('click', async function(e) {
      e.stopPropagation();
      const pField = document.getElementById('summaryPrompt');
      if (pField) {
        pField.value = DEFAULT_SUMMARY_PROMPT;
        await updateSettings({ summary_prompt: DEFAULT_SUMMARY_PROMPT });
        showToast('Промпт сброшен к исходному шаблону', 'info');
      }
    });

    // Генерация промпта
    document.getElementById('generateSummaryBtn')?.addEventListener('click', async function(e) {
      e.stopPropagation();
      const currentPromptText = document.getElementById('summaryPrompt')?.value || DEFAULT_SUMMARY_PROMPT;
      try {
        const result = await generateSummaryPrompt(window.currentChatId, currentPromptText);
        if (!result.ok) {
          showToast(result.message, 'warning');
          return;
        }
        await navigator.clipboard.writeText(result.prompt);
        showToast(`Промпт скопирован в буфер! (${result.tokens} токенов)`, 'success');

        const summary = await showPrompt('Вставьте полученный от модели пересказ:', '', {
          title: 'Сохранить блок саммари',
          multiline: true
        });

        if (summary && summary.trim()) {
          await saveSummaryBlock(window.currentChatId, result.start_index, result.end_index, summary.trim());
          renderSummaryPanel();
          updateSummaryIconStatus(window.currentChatId);
          showToast('Блок саммари сохранён', 'success');
        }
      } catch (e) {
        showToast('Ошибка генерации промпта', 'error');
      }
    });

    // Добавить пустой блок
    document.getElementById('addEmptySummaryBtn')?.addEventListener('click', async function(e) {
      e.stopPropagation();
      await addEmptySummaryBlock(window.currentChatId);
      renderSummaryPanel();
      showToast('Пустой блок создан', 'success');
    });

    // Удаление блока
    document.querySelectorAll('.delete-summary-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        const id = this.dataset.id;
        if (!(await showConfirm('Удалить блок саммари? Это действие необратимо.', { title: 'Удаление блока', okText: 'Удалить' }))) return;
        await deleteSummaryBlock(window.currentChatId, id);
        renderSummaryPanel();
        updateSummaryIconStatus(window.currentChatId);
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
        if (newName && newName.trim()) {
          await updateSummaryBlock(window.currentChatId, id, { name: newName.trim() });
          renderSummaryPanel();
        }
      });
    });

    // Раскрытие/сворачивание блока
    document.querySelectorAll('.block-name').forEach(el => {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        const blockDiv = this.closest('.summary-block');
        const id = blockDiv.dataset.id;
        const content = blockDiv.querySelector('.block-content');
        if (expandedSummaryBlocks.has(id)) {
          expandedSummaryBlocks.delete(id);
          content.style.display = 'none';
        } else {
          expandedSummaryBlocks.add(id);
          content.style.display = 'block';
        }
      });
    });

    // Редактирование текста блока
    document.querySelectorAll('.edit-summary-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const container = this.closest('.block-content');
        const display = container.querySelector('.summary-text-display');
        const editArea = container.querySelector('.summary-edit');
        if (editArea.style.display === 'none') {
          display.style.display = 'none';
          editArea.style.display = 'block';
          this.textContent = 'Сохранить изменения';
        } else {
          const newText = editArea.value;
          const id = this.dataset.id;
          updateSummaryBlock(window.currentChatId, id, { summary: newText }).then(() => {
            renderSummaryPanel();
          });
        }
      });
    });

  } catch (e) {
    body.innerHTML = `<p class="error-message">Ошибка загрузки саммари</p>`;
    console.error(e);
  }
}