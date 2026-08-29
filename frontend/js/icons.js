// ============================================================
// ICONS — централизованное хранилище иконок
// ============================================================

const ICON_BASE = 'assets/icons/';

export const ICONS = {
  add: `${ICON_BASE}add.svg`,
  background: `${ICON_BASE}background.svg`,
  characters: `${ICON_BASE}characters.svg`,
  copy: `${ICON_BASE}copy.svg`,
  export: `${ICON_BASE}export.svg`,
  import: `${ICON_BASE}import.svg`,
  lore: `${ICON_BASE}lore.svg`,
  persona: `${ICON_BASE}persona.svg`,
  preset: `${ICON_BASE}preset.svg`,
  rename: `${ICON_BASE}rename.svg`,
  send: `${ICON_BASE}send.svg`,        // <-- добавляем
};

export function iconImg(name, alt = '', width = 18, height = 18) {
  const src = ICONS[name];
  if (!src) return '';
  return `<img src="${src}" alt="${alt}" width="${width}" height="${height}" style="flex-shrink:0;">`;
}

export function iconButton(iconName, text, alt = '', className = 'btn') {
  return `<button class="${className}">${iconImg(iconName, alt)} ${text}</button>`;
}

// Делаем доступной глобально для использования в обычных скриптах
window.iconImg = iconImg;