import { getItem, setItem, removeItem } from './storage.js';

/** Wait until calls stop for `delay` ms, then run `fn` once (used for live preview). */
export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ---------------- Collapsible panels ---------------- */

/**
 * Each panel has a toggle button and a body. We flip `data-open` (CSS animates
 * the height) and `aria-expanded` (for screen readers). Closed bodies get
 * `inert` so keyboard users can't tab into hidden controls.
 */
export function initPanels() {
  for (const panel of document.querySelectorAll('.panel')) {
    const button = panel.querySelector('.panel-toggle');
    const body = panel.querySelector('.panel-body');

    const setOpen = (open) => {
      panel.dataset.open = String(open);
      button.setAttribute('aria-expanded', String(open));
      body.inert = !open;
    };

    setOpen(panel.dataset.open === 'true');
    button.addEventListener('click', () => setOpen(panel.dataset.open !== 'true'));
  }
}

/* ---------------- Toasts ---------------- */

const ICONS = {
  success: '<path d="M20 6 9 17l-5-5"/>',
  error: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>',
};

/** Show a short message at the bottom of the screen instead of alert(). */
export function toast(message, kind = 'success') {
  const container = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast${kind === 'error' ? ' is-error' : ''}`;
  el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[kind]}</svg>`;
  el.append(message);
  container.append(el);

  setTimeout(() => {
    el.classList.add('is-leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, 2400);
}

/* ---------------- Theme toggle ---------------- */

const THEME_KEY = 'qr-theme';
const THEMES = ['system', 'light', 'dark'];
const THEME_ICONS = {
  system: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  light:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  dark: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
};

/**
 * Cycle between system → light → dark. "system" removes the override so the
 * CSS `prefers-color-scheme` media query decides. The choice is saved.
 */
export function initThemeToggle() {
  const button = document.getElementById('theme-toggle');
  const icon = button.querySelector('svg');
  let current = getItem(THEME_KEY, 'system');
  if (!THEMES.includes(current)) current = 'system';

  const apply = (theme) => {
    if (theme === 'system') {
      delete document.documentElement.dataset.theme;
      removeItem(THEME_KEY);
    } else {
      document.documentElement.dataset.theme = theme;
      setItem(THEME_KEY, theme);
    }
    icon.innerHTML = THEME_ICONS[theme];
    button.setAttribute('aria-label', `Theme: ${theme}. Click to change.`);
    button.title = `Theme: ${theme}`;
  };

  apply(current);
  button.addEventListener('click', () => {
    current = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
    apply(current);
  });
}
