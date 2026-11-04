// Self-hosted font: bundled by Vite, so no request goes to Google Fonts.
import '@fontsource-variable/plus-jakarta-sans';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';

import { state } from './state.js';
import { normalizeUrl } from './content.js';
import { renderPreview } from './qr.js';
import { validateLogoFile, readAsDataURL, composeLogo } from './logo.js';
import { downloadQR } from './export.js';
import { debounce, initPanels, initThemeToggle, toast } from './ui.js';

const $ = (id) => document.getElementById(id);

// --- Elements ---
const urlForm = $('url-form');
const urlInput = $('url-input');
const urlError = $('url-error');
const stage = $('qr-stage');
const qrContainer = $('qr-container');
const qrEmpty = $('qr-empty');
const encodedWrap = $('encoded-wrap');
const encodedText = $('encoded-text');
const downloadButtons = [$('download-png'), $('download-svg'), $('mobile-download')];

const logoDropzone = $('logo-dropzone');
const logoInput = $('logo-input');
const logoOptions = $('logo-options');
const logoThumb = $('logo-thumb');
const logoName = $('logo-name');
const logoRemove = $('logo-remove');
const logoSize = $('logo-size');
const logoSizeValue = $('logo-size-value');
const logoPlate = $('logo-plate');
const logoEclNote = $('logo-ecl-note');
const logoEclWarning = $('logo-ecl-warning');

const eclRadios = document.querySelectorAll('input[name="ecl"]');
const fgColor = $('fg-color');
const bgColor = $('bg-color');

/* ================= Rendering ================= */

/** Redraw the preview (or the empty state) from the current state. */
function render({ animate = false } = {}) {
  const hasData = Boolean(state.data);
  qrEmpty.hidden = hasData;
  encodedWrap.hidden = !hasData;
  for (const button of downloadButtons) button.disabled = !hasData;

  if (!hasData) {
    qrContainer.replaceChildren();
    return;
  }
  encodedText.textContent = state.data;
  renderPreview(qrContainer, state, { animate });
}

/* ================= Content (URL input) ================= */

function showError(message) {
  urlError.textContent = message;
  urlError.hidden = false;
  urlInput.setAttribute('aria-invalid', 'true');
}

function clearError() {
  urlError.hidden = true;
  urlInput.removeAttribute('aria-invalid');
}

/**
 * Read the input and update the QR. While typing we stay quiet about errors
 * (half-typed links are always "invalid") and just dim the old QR instead.
 * Errors are shown when the user presses Generate or leaves the field.
 */
function updateFromInput({ showErrors }) {
  const raw = urlInput.value;
  if (!raw.trim()) {
    clearError();
    stage.classList.remove('is-stale');
    if (showErrors) showError('Please paste a link first.');
    if (state.data) {
      state.data = '';
      render();
    }
    return null;
  }

  const { text, error } = normalizeUrl(raw);
  if (error) {
    stage.classList.toggle('is-stale', Boolean(state.data));
    if (showErrors) showError(error);
    return null;
  }

  clearError();
  stage.classList.remove('is-stale');
  if (text !== state.data) {
    state.data = text;
    render({ animate: true });
  }
  return text;
}

// Live preview: redraw ~300ms after the user stops typing.
const livePreview = debounce(() => updateFromInput({ showErrors: false }), 300);

urlInput.addEventListener('input', () => {
  if (!urlError.hidden) clearError();
  livePreview();
});

urlInput.addEventListener('blur', () => {
  if (urlInput.value.trim()) updateFromInput({ showErrors: true });
});

// The Generate button (and Enter key) update immediately and show errors.
urlForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = updateFromInput({ showErrors: true });
  if (text) urlInput.value = text; // show the https:// we added
});

/* ================= Error correction ================= */

// Remembers the user's level from before a logo forced it to H.
let eclBeforeLogo = null;

function setEcl(level) {
  state.ecl = level;
  for (const radio of eclRadios) radio.checked = radio.value === level;
  syncLogoNotes();
}

// With a logo, explain why we picked H, or warn if the user lowered it.
function syncLogoNotes() {
  const lowEcl = Boolean(state.logo) && state.ecl !== 'H';
  logoEclNote.hidden = lowEcl;
  logoEclWarning.hidden = !lowEcl;
}

for (const radio of eclRadios) {
  radio.addEventListener('change', () => {
    setEcl(radio.value);
    render();
  });
}

/* ================= Logo ================= */

async function handleLogoFile(file) {
  if (!file) return;
  const error = validateLogoFile(file);
  if (error) {
    toast(error, 'error');
    return;
  }

  try {
    state.logoSrc = await readAsDataURL(file);
    state.logo = await composeLogo(state.logoSrc, state.logoPlate);
  } catch {
    state.logoSrc = null;
    state.logo = null;
    toast('Couldn’t read that image. Try another file.', 'error');
    return;
  }

  state.logoName = file.name;
  logoThumb.src = state.logoSrc;
  logoName.textContent = file.name;
  logoOptions.hidden = false;

  // Switch to H the first time a logo is added, and remember the old level.
  if (eclBeforeLogo === null) eclBeforeLogo = state.ecl;
  setEcl('H');
  render({ animate: true });
}

function removeLogo() {
  state.logoSrc = null;
  state.logo = null;
  state.logoName = '';
  logoInput.value = '';
  logoOptions.hidden = true;
  setEcl(eclBeforeLogo ?? 'M');
  eclBeforeLogo = null;
  render({ animate: true });
  logoInput.focus();
}

logoInput.addEventListener('change', () => handleLogoFile(logoInput.files[0]));
logoRemove.addEventListener('click', removeLogo);

// Drag-and-drop: highlight the zone while a file hovers, read it on drop.
logoDropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  logoDropzone.classList.add('is-dragging');
});
logoDropzone.addEventListener('dragleave', () => logoDropzone.classList.remove('is-dragging'));
logoDropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  logoDropzone.classList.remove('is-dragging');
  handleLogoFile(event.dataTransfer.files[0]);
});

logoSize.addEventListener('input', () => {
  state.logoSize = Number(logoSize.value);
  logoSizeValue.textContent = `${state.logoSize}%`;
  render();
});

logoPlate.addEventListener('change', async () => {
  state.logoPlate = logoPlate.checked;
  if (!state.logoSrc) return;
  state.logo = await composeLogo(state.logoSrc, state.logoPlate);
  render();
});

/* ================= Colors ================= */

function bindColor(input, key) {
  const label = $(`${key}-value`);
  input.addEventListener('input', () => {
    state[key] = input.value;
    label.textContent = input.value;
    render();
  });
}
bindColor(fgColor, 'fg');
bindColor(bgColor, 'bg');

/* ================= Downloads ================= */

async function download(extension) {
  if (!state.data) return;
  try {
    const filename = await downloadQR(state, extension);
    toast(`Downloaded ${filename}`);
  } catch (err) {
    console.error(err);
    toast('Download failed. Please try again.', 'error');
  }
}

$('download-png').addEventListener('click', () => download('png'));
$('download-svg').addEventListener('click', () => download('svg'));
$('mobile-download').addEventListener('click', () => download('png'));

/* ================= Start ================= */

initPanels();
initThemeToggle();
render();
